const Discord = require('discord.js');
const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const {
	CharacterFlag,
	GlobalFlag,
	NpcPurchase,
	TownBuilding,
	CharacterBase,
	CharacterItem,
} = require('@root/dbObject.js');
const contentStore = require('@root/contentStore.js');
const characterUtil = require('./characterUtility');
const characterSettingUtil = require('./characterSettingUtility');
const locationUtil = require('./locationUtility');
const itemUtility = require('./itemUtility');
const eventLogger = require('./eventLogger');
const combatUtil = require('./combatUtility');
const { processTextTemplate } = require('./generalUtility');
const {
	FLAG_TYPE,
	FLAG_OPERATION,
	FLAG_COMPARISON,
	ITEM_OPERATION,
	STAT_OPERATION,
	MOVEMENT_TYPE,
	STATUS_OPERATION,
	TRIGGER_CONDITION,
	SHOP_TYPE,
	VARIABLE_SOURCE,
} = require('../models/event/eventConstants');
const { EMOJI } = require('../enums');

/**
 * SIMPLIFIED EVENT SYSTEM
 * 
 * Flow for CHECK events:
 * 1. Read event base
 * 2. Perform event checks (if any), collect success/fail messages
 * 3. Build message with check results + event message
 * 4. Display message and options to Discord
 * 5. When user selects option, trigger next event accordingly
 * 
 * Flow for COMBAT events:
 * 1. Perform combat
 * 2. Build message with combat result + event message
 * 3. Display message and options to Discord
 * 4. When user selects option, trigger next event accordingly
 * 
 * If no options exist, show "Continue" button to proceed to next_event_id
 * An event can be CHECK or COMBAT, not both
 */

const NUMBER_EMOJIS = EMOJI.NUMBERS;

class EventProcessor {
	constructor() {
		this.activeEvents = new Map();
		this.activeCharacters = new Set(); // Track characters currently in an active event chain
		this._characterCache = new Map(); // Cache character data within session
		this.pendingDeletions = new Map(); // characterId -> { timeoutId, message }
	}

	async _scheduleDeletion(characterId, message) {
		if (!characterId) {
			await message.delete().catch(() => {});
			return;
		}
		if (this.pendingDeletions.has(characterId)) {
			const existing = this.pendingDeletions.get(characterId);
			clearTimeout(existing.timeoutId);
			this.pendingDeletions.delete(characterId);
		}
		if (message.channelId && message.id) {
			await characterSettingUtil.setCharacterSetting(characterId, '_pending_delete', `${message.channelId}|${message.id}|${Date.now()}`).catch(() => {});
		}
		const timeoutId = setTimeout(async () => {
			message.delete().catch(() => {});
			this.pendingDeletions.delete(characterId);
			await characterSettingUtil.deleteCharacterSetting(characterId, '_pending_delete').catch(() => {});
		}, 60 * 60 * 1000);
		this.pendingDeletions.set(characterId, { timeoutId, message });
	}

	async _cancelPendingDeletion(characterId, client = null) {
		if (!characterId) return;
		if (this.pendingDeletions.has(characterId)) {
			const pending = this.pendingDeletions.get(characterId);
			clearTimeout(pending.timeoutId);
			pending.message.delete().catch(() => {});
			this.pendingDeletions.delete(characterId);
		}
		try {
			const pendingFlag = await characterSettingUtil.getCharacterSetting(characterId, '_pending_delete');
			if (pendingFlag && pendingFlag.includes('|')) {
				if (client) {
					const [channelId, messageId] = pendingFlag.split('|');
					try {
						const channel = await client.channels.fetch(channelId);
						if (channel) {
							const msg = await channel.messages.fetch(messageId).catch(() => null);
							if (msg) await msg.delete().catch(() => {});
						}
					}
					catch (e) { /* message or channel may not exist */ }
				}
				await characterSettingUtil.deleteCharacterSetting(characterId, '_pending_delete').catch(() => {});
			}
		}
		catch (e) { /* setting may not exist */ }
	}

	/**
	 * Process text template with session context (pronouns, variables, player name)
	 * @param {string} text - Text with placeholders
	 * @param {Object} session - Session object
	 * @returns {Promise<string>} - Processed text
	 */
	async processText(text, session) {
		if (!text) return text;

		// First resolve ${...} variable expressions
		let result = this.resolveExpression(text, session);
		if (typeof result === 'number') {
			result = String(result);
		}

		// Then process pronoun/player name templates if we have a character
		if (session.characterId) {
			// Use cached character or fetch
			if (!this._characterCache.has(session.characterId)) {
				const character = await characterUtil.getCharacterBase(session.characterId);
				this._characterCache.set(session.characterId, character);
			}
			const character = this._characterCache.get(session.characterId);
			if (character) {
				result = processTextTemplate(result, character.age, character.gender, character, session.npc);
			}
		}

		return result;
	}

	/**
	 * Main entry point - process an event
	 */
	async processEvent(eventId, interaction, characterId = null, sessionData = {}) {
		const session = {
			characterId,
			interaction,
			sessionId: `${characterId}_${Date.now()}`,
			flags: {
				local: sessionData.flags?.local || {},
				character: sessionData.flags?.character || {},
				global: sessionData.flags?.global || {},
			},
			// Pending flag writes: buffered until chain completes, discarded on timeout/error
			// Keyed by flagName → { op: 'upsert'|'delete', value }
			pendingCharacterFlags: sessionData.pendingCharacterFlags || new Map(),
			pendingGlobalFlags: sessionData.pendingGlobalFlags || new Map(),
			variables: sessionData.variables || {}, // Session variables for action-to-action data passing
			metadata: sessionData.metadata || {},
			ephemeral: sessionData.ephemeral !== false,
			messages: [], // Collect messages to display
			combatLogSent: sessionData.combatLogSent || false, // Track if combat log was already sent
			npc: sessionData.npc || null, // NPC info for relational pronouns
			logSessionId: sessionData.logSessionId || null, // Event logger session
			eventDepth: sessionData.eventDepth || 0, // Track recursion depth
		};

		try {
			// Duplicate event guard - only applies to fresh event chain starts (not chain continuations)
			if (!sessionData.eventDepth && characterId) {
				if (this.activeCharacters.has(characterId)) {
					try {
						if (interaction.replied || interaction.deferred) {
							await interaction.followUp({ content: '\u26A0\uFE0F You are already in an active event. Please finish it first.', flags: MessageFlags.Ephemeral });
						}
						else {
							await interaction.reply({ content: '\u26A0\uFE0F You are already in an active event. Please finish it first.', flags: MessageFlags.Ephemeral });
						}
					}
					catch (e) { /* ignore */ }
					return { success: false, error: 'already_in_event' };
				}
				this.activeCharacters.add(characterId);
				await this._cancelPendingDeletion(characterId, interaction.client);
			}

			// 1. Get event base
			const eventBase = contentStore.events.findByPk(String(eventId));
			if (!eventBase || eventBase.is_active === false) {
				throw new Error(`Event ${eventId} not found or inactive`);
			}

			// Start logging for begin_interview tag
			if (eventBase.tag && Array.isArray(eventBase.tag) && eventBase.tag.includes('begin_interview') && !session.logSessionId) {
				session.logSessionId = eventLogger.startSession(characterId, 'interview_registration');
				console.log(`[EventLogger] Started logging session: ${session.logSessionId}`);
			}

			// Log this event
			if (session.logSessionId) {
				eventLogger.logEvent(session.logSessionId, eventId, session.eventDepth);
			}

			// 2. Check if this is a combat event
			const combat = eventBase.combat || null;

			let nextEventId = eventBase.next;
			let checkOutcomeEventId = null;

			if (combat) {
				// Defer early for combat since it takes time
				if (!(interaction.replied || interaction.deferred)) {
					await interaction.deferReply({ ephemeral: session.ephemeral });
				}

				// COMBAT EVENT FLOW
				const combatResult = await this.processCombat(combat, session);
				session.combatResult = combatResult;

				// Send combat log as separate message first
				if (combatResult.battleReport) {
					await this.sendCombatLog(interaction, combatResult, session.ephemeral);
				}

				// Determine next event based on combat outcome
				if (combatResult.result === 'victory' && combat.on_victory) {
					nextEventId = combat.on_victory;
				}
				else if (combatResult.result === 'defeat' && combat.on_defeat) {
					nextEventId = combat.on_defeat;
				}
				else if (combatResult.result === 'flee') {
					// Use explicit flee route if defined, otherwise treat as defeat
					if (combat.flee_event_id) {
						nextEventId = combat.flee_event_id;
					}
					else {
						// No flee route defined — inconclusive fight counts as a loss
						combatResult.result = 'defeat';
						if (combat.on_defeat) {
							nextEventId = combat.on_defeat;
						}
					}
				}

				// Execute actions based on combat result
				await this.executeActionsByTrigger(eventId, session, combatResult.result);

				// Auto-proceed to next event after combat (skip showing intermediate message)
				if (nextEventId && nextEventId !== '0' && nextEventId.trim() !== '') {
					return await this.processEvent(nextEventId, interaction, characterId, {
						flags: session.flags,
						pendingCharacterFlags: session.pendingCharacterFlags,
						pendingGlobalFlags: session.pendingGlobalFlags,
						variables: session.variables,
						metadata: session.metadata,
						ephemeral: session.ephemeral,
						combatLogSent: true, // Tell next event that combat log is already displayed
						logSessionId: session.logSessionId,
						eventDepth: session.eventDepth + 1,
					});
				}
			}
			else {
				// CHECK EVENT FLOW
				const checkResults = await this.processChecks(eventId, session);
				session.checkResults = checkResults;

				// Determine next event from check outcomes (priority over default)
				checkOutcomeEventId = this.getCheckOutcomeEventId(checkResults);

				// Handle special tag: finish_register
				if (eventBase.tag && Array.isArray(eventBase.tag) && eventBase.tag.includes('finish_register')) {
					await this.handleFinishRegister(session);
				}

				// Handle special tag: redo
				if (eventBase.tag && Array.isArray(eventBase.tag) && eventBase.tag.includes('redo')) {
					await this.handleRedo(session);
				}
			}

			// Execute immediate actions BEFORE silent check (modals need fresh interaction)
			await this.executeActionsByTrigger(eventId, session, TRIGGER_CONDITION.IMMEDIATE);

			// Chain to encounter event if fishing action triggered a combat roll
			if (session.fishNextEvent) {
				const fishNextId = session.fishNextEvent;
				delete session.fishNextEvent;
				return await this.processEvent(fishNextId, interaction, characterId, {
					flags: session.flags,
					pendingCharacterFlags: session.pendingCharacterFlags,
					pendingGlobalFlags: session.pendingGlobalFlags,
					metadata: session.metadata,
					ephemeral: session.ephemeral,
					eventDepth: session.eventDepth + 1,
				});
			}

			// End processing if cooking action launched its own UI
			if (session.cookDone) {
				await this.flushPendingFlags(session);
				this.activeEvents.delete(session.sessionId);
				if (session.characterId) this.activeCharacters.delete(session.characterId);
				return;
			}

			// 3. Handle silent events - skip message/options and auto-proceed
			if (eventBase.silent) {
				// Priority: check outcome > event default
				const proceedToEventId = checkOutcomeEventId || nextEventId;
				if (proceedToEventId) {
					return await this.processEvent(proceedToEventId, interaction, characterId, {
						flags: session.flags,
						pendingCharacterFlags: session.pendingCharacterFlags,
						pendingGlobalFlags: session.pendingGlobalFlags,
						variables: session.variables,
						metadata: session.metadata,
						ephemeral: session.ephemeral,
						combatLogSent: session.combatLogSent, // Preserve combat log state through silent chain
						logSessionId: session.logSessionId,
						eventDepth: session.eventDepth + 1,
					});
				}
				// No next event, end silently
				await this.flushPendingFlags(session);
				if (characterId) this.activeCharacters.delete(characterId);
				return { sessionId: session.sessionId, success: true, silent: true };
			}

			// 4. Build the message
			const messageData = await this.buildMessage(eventBase, session);

			// 5. Get options
			const options = await this.getVisibleOptions(eventId, session);

			// 6. Display to Discord
			// For non-silent events, checkOutcomeEventId (from a check's on_success/on_failure) takes
			// priority over the event's default next — same routing logic as silent events.
			const needsCollector = await this.displayEvent(session, messageData, options, eventBase, checkOutcomeEventId || nextEventId);

			// Store session for option handling only if a collector was set up
			if (needsCollector) {
				this.activeEvents.set(session.sessionId, session);
			}

			return { sessionId: session.sessionId, success: true };
		}
		catch (error) {
			console.error('Event processing error:', error);
			await this.handleError(interaction, error);
			if (characterId) this.activeCharacters.delete(characterId);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Get next event ID from check outcomes (first failed required check or success path)
	 */
	getCheckOutcomeEventId(checkResults) {
		if (!checkResults) return null;
		
		// Return the branch event ID if any check specified one
		return checkResults._branchEventId || null;
	}

	/**
	 * Process combat and return result
	 */
	async processCombat(combat, session) {
		if (!session.characterId) {
			return { result: 'error', message: 'No character for combat' };
		}

		try {
			// Get enemy to fight
			const enemyId = combat.enemy;
			if (!enemyId) {
				return { result: 'error', message: 'No enemy defined for combat' };
			}

			// Handle persistent HP enemies (e.g. Rat King)
			const enemyBase = contentStore.enemies.findByPk(String(enemyId));
			const enemyTags = Array.isArray(enemyBase?.tag) ? enemyBase.tag : [];
			const isPersistent = enemyTags.includes('persistent_hp');

			let enemyStartHp = null;
			if (isPersistent) {
				const hpFlag = await GlobalFlag.findOne({ where: { flag: `global.${enemyId}_hp` } });
				if (hpFlag) {
					enemyStartHp = parseInt(hpFlag.value) || null;
				}
				// Regen HP before each fight
				if (enemyStartHp != null && enemyBase?.regen_per_fight) {
					const maxHp = enemyBase?.stat?.health || enemyStartHp;
					enemyStartHp = Math.min(maxHp, enemyStartHp + enemyBase.regen_per_fight);
					await GlobalFlag.upsert({ flag: `global.${enemyId}_hp`, value: String(enemyStartHp) });
					console.log(`[Combat] Pre-fight regen for ${enemyId}: +${enemyBase.regen_per_fight} HP -> ${enemyStartHp}`);
				}
			}

			const combatOptions = enemyStartHp != null ? { enemyStartHp } : {};
			if (combat.ambient_effect) {
				combatOptions.ambientEffect = combat.ambient_effect;
			}
			const combatResult = await combatUtil.mainCombat(session.characterId, enemyId, combatOptions);

			// Persist enemy HP if enemy survived the encounter
			if (isPersistent) {
				const enemyHpAfter = combatResult.finalState?.enemy?.hp ?? 0;
				if (enemyHpAfter > 0) {
					await GlobalFlag.upsert({ flag: `global.${enemyId}_hp`, value: String(enemyHpAfter) });
					console.log(`[Combat] Saved persistent HP for ${enemyId}: ${enemyHpAfter}`);
				}
				else {
					// Enemy was slain — clear the saved HP
					await GlobalFlag.destroy({ where: { flag: `global.${enemyId}_hp` } });
				}
			}

			// Determine outcome
			const playerWon = combatResult.finalState?.player?.hp > 0;
			const enemyWon = combatResult.finalState?.enemy?.hp > 0;

			let result, message;
			if (playerWon && !enemyWon) {
				result = 'victory';
				message = combat.victory_message || 'You won the battle!';
			}
			else if (enemyWon && !playerWon) {
				result = 'defeat';
				message = combat.defeat_message || 'You were defeated...';
			}
			else {
				result = 'flee';
				message = combat.flee_message || 'You fled from combat.';
			}

			return {
				result,
				message,
				combatLog: combatResult.combatLog,
				battleReport: combatResult.battleReport,
				battleReportPages: combatResult.battleReportPages,
			};
		}
		catch (error) {
			console.error('Combat error:', error);
			return { result: 'error', message: 'Combat failed: ' + error.message };
		}
	}

	/**
	 * Process all checks for an event
	 */
	async processChecks(eventId, session) {
		const eventData = contentStore.events.findByPk(String(eventId));
		const checks = (eventData && eventData.check) ? [...eventData.check].sort((a, b) => (a.execution_order || 0) - (b.execution_order || 0)) : [];

		const results = {};
		let branchEventId = null;

		for (const check of checks) {
			const result = await this.executeCheck(check, session);
			results[check.name] = result;

			// Add message to session (only if not silent)
			if (!check.silent) {
				const message = result.message || this.generateCheckMessage(check, result);
				if (message) {
					session.messages.push({
						type: result.success ? 'success' : 'failure',
						text: message,
					});
				}
			}

			// Check for event branching based on outcome
			if (result.success && check.on_success) {
				branchEventId = check.on_success;
				break; // Branch immediately on first successful branch
			}
			else if (!result.success && check.on_failure) {
				branchEventId = check.on_failure;
				break; // Branch immediately on first failed branch
			}

			// Stop if required check fails (and no failure_event_id to branch to)
			if (check.is_required && !result.success && !check.on_failure) {
				break;
			}
		}

		// Store branch event ID in results for retrieval
		if (branchEventId) {
			results._branchEventId = branchEventId;
		}

		return results;
	}

	/**
	 * Execute a single check
	 */
	async executeCheck(check, session) {
		switch (check.type) {
		case 'flag':
			return await this.checkFlag(check, session);
		case 'stat':
			return await this.checkStat(check, session);
		case 'item':
			return await this.checkItem(check, session);
		case 'skill':
			return await this.checkSkill(check, session);
		case 'level':
			return await this.checkLevel(check, session);
		case 'random':
			return await this.checkRandom(check, session);
		default:
			return { success: false, message: `Unknown check type: ${check.type}` };
		}
	}

	/**
	 * Check flag condition
	 */
	async checkFlag(check, session) {
		const { flag_name, flag_value, flag_comparison, is_global_flag } = check.flag_data || {};
		if (!flag_name) return { success: false, message: 'Invalid flag check' };

		// Convert boolean to FLAG_TYPE
		const flagType = is_global_flag ? FLAG_TYPE.GLOBAL : FLAG_TYPE.CHARACTER;
		let currentValue = await this.getFlagValue(flag_name, flagType, session);
		
		// Default to 'equal' comparison for backwards compatibility
		const comparison = flag_comparison || FLAG_COMPARISON.EQUAL;
		let success = false;

		// Normalize both values to numbers for comparison — YAML may store flag_value as
		// a quoted string (e.g., "1") while currentValue is always an integer from the DB.
		const toNum = (v) => (typeof v === 'string' ? Number(v) : v);
		const cmp = toNum(currentValue);
		const exp = toNum(flag_value);

		switch (comparison) {
		case FLAG_COMPARISON.GREATER_THAN:
			success = cmp > exp;
			break;
		case FLAG_COMPARISON.LESS_THAN:
			success = cmp < exp;
			break;
		case FLAG_COMPARISON.EQUAL:
			success = cmp === exp;
			break;
		case FLAG_COMPARISON.GREATER_EQUAL:
			success = cmp >= exp;
			break;
		case FLAG_COMPARISON.LESS_EQUAL:
			success = cmp <= exp;
			break;
		case FLAG_COMPARISON.NOT_EQUAL:
			success = cmp !== exp;
			break;
		default:
			success = cmp === exp;
		}

		return {
			success,
			value: currentValue,
			expected: flag_value,
			comparison: comparison,
			message: success ? check.success_message : check.failure_message,
		};
	}

	/**
	 * Check stat condition
	 */
	async checkStat(check, session) {
		if (!session.characterId) {
			return { success: false, message: 'No character for stat check' };
		}

		const { stat_name, stat_comparison, stat_value, use_dice_roll } = check.stat_data || {};
		const statValue = await characterUtil.getCharacterStat(session.characterId, stat_name);

		let success = false;
		let rollResult = null;

		if (use_dice_roll) {
			rollResult = Math.floor(Math.random() * 1000) + 1;
			const target = Math.max(1, Math.min(1000, Math.floor(statValue * ((check.difficulty_modifier || 1) * 10))));
			success = rollResult <= target;
		}
		else {
			switch (stat_comparison) {
			case 'greater_than': success = statValue > stat_value; break;
			case 'less_than': success = statValue < stat_value; break;
			case 'equal': success = statValue === stat_value; break;
			case 'greater_equal': success = statValue >= stat_value; break;
			case 'less_equal': success = statValue <= stat_value; break;
			case 'dice_roll':
				rollResult = Math.floor(Math.random() * 100) + 1;
				success = rollResult <= statValue;
				break;
			}
		}

		return {
			success,
			statValue,
			rollResult,
			message: success ? check.success_message : check.failure_message,
		};
	}

	/**
	 * Check item possession
	 */
	async checkItem(check, session) {
		if (!session.characterId) {
			return { success: false, message: 'No character for item check' };
		}

		const items = Array.isArray(check.item_data) ? check.item_data : [check.item_data];
		let allSuccess = true;

		for (const { item_id, required_quantity } of items) {
			const resolvedQty = parseInt(this.resolveExpression(required_quantity ?? 1, session)) || 1;
			const hasItem = await characterUtil.checkCharacterInventory(
				session.characterId, item_id, resolvedQty,
			);
			if (!hasItem) allSuccess = false;
		}

		return {
			success: allSuccess,
			message: allSuccess ? check.success_message : check.failure_message,
		};
	}

	/**
	 * Check skill level
	 */
	async checkSkill(check, session) {
		if (!session.characterId) {
			return { success: false, message: 'No character for skill check' };
		}

		const { skill_id, required_level } = check.skill_data || {};
		const success = await characterUtil.checkCharacterSkill(
			session.characterId, skill_id, required_level || 1,
		);

		return {
			success,
			message: success ? check.success_message : check.failure_message,
		};
	}

	/**
	 * Check character level
	 */
	async checkLevel(check, session) {
		if (!session.characterId) {
			return { success: false, message: 'No character for level check' };
		}

		const { required_level } = check.level_data || {};
		const success = await characterUtil.checkCharacterLevel(
			session.characterId, required_level || 1,
		);

		return {
			success,
			message: success ? check.success_message : check.failure_message,
		};
	}

	/**
	 * Random chance check
	 */
	async checkRandom(check, session) {
		const { success_chance } = check.random_data || { success_chance: 50 };
		const roll = Math.floor(Math.random() * 100) + 1;
		const success = roll <= success_chance;

		return {
			success,
			roll,
			message: success ? check.success_message : check.failure_message,
		};
	}

	/**
	 * Resolve expression with session variables
	 * Supports: ${variable_name}, ${variable * 10}, ${variable + 5}
	 * @param {string|number} template - Value that may contain ${...} expressions
	 * @param {Object} session - Session containing variables
	 * @returns {number|string} - Resolved value (numeric for math, string for text)
	 */
	resolveExpression(template, session) {
		// If already a number, return it
		if (typeof template === 'number') return template;
		
		// If null/undefined, return 0
		if (template == null) return 0;
		
		const str = String(template);
		
		// Check if it contains any ${...} expressions
		if (!str.includes('${')) {
			// Check if it's a plain number
			const num = parseInt(str);
			if (!isNaN(num) && String(num) === str.trim()) {
				return num;
			}
			// Return as string if not a number
			return str;
		}
		
		// Track if we're doing pure math or text substitution
		let isPureMath = true;
		
		// Pronoun/name placeholders that must be preserved for processTextTemplate
		const PRONOUN_PLACEHOLDERS = new Set([
			'player_name', 'player_fullname',
			'first_person', '1p',
			'second_person', '2p',
			'npc_1p', 'npc_2p', 'npc_name',
		]);

		// Replace all ${...} expressions
		const resolved = str.replace(/\$\{([^}]+)\}/g, (match, expr) => {
			// Preserve pronoun/name placeholders so processTextTemplate can handle them
			if (PRONOUN_PLACEHOLDERS.has(expr.trim())) {
				return match;
			}

			// Substitute variable names with their values
			let processedExpr = expr;
			
			// Find all variable references (word characters not followed by operators)
			const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
			processedExpr = processedExpr.replace(varPattern, (varMatch, varName) => {
				// Check if this is a known variable
				if (session.variables && session.variables[varName] !== undefined) {
					const varValue = session.variables[varName];
					// If variable contains non-numeric string, we're not doing pure math
					if (typeof varValue === 'string' && isNaN(Number(varValue))) {
						isPureMath = false;
					}
					return varValue;
				}
				// Not a variable, return as-is (might be a function name or constant we don't support)
				isPureMath = false;
				return varMatch;
			});
			
			// If this is a math expression, try to evaluate it
			if (isPureMath) {
				try {
					// Only allow digits, operators, spaces, and decimal points for safe eval
					if (/^[\d\s+\-*/().]+$/.test(processedExpr)) {
						return Math.floor(eval(processedExpr));
					}
				}
				catch {
					// Fall through to return as string
				}
			}
			
			// Return the substituted string
			return processedExpr;
		});
		
		// If the entire template was a single math expression that got fully evaluated, parse it
		if (isPureMath) {
			const num = parseInt(resolved);
			if (!isNaN(num)) {
				return num;
			}
		}
		
		// Return as string for text templates
		return resolved;
	}

	/**
	 * Execute variable action - read/compute values and store in session
	 */
	async executeVariableAction(action, session) {
		const { variable_name, source_type, source_name, expression, is_global_flag, silent, custom_message,
			input_label, input_placeholder, input_default, is_numeric } = action;
		
		if (!variable_name) return;
		
		let value = is_numeric ? 0 : '';
		
		switch (source_type) {
		case VARIABLE_SOURCE.STAT:
			if (session.characterId && source_name) {
				value = await characterUtil.getCharacterStat(session.characterId, source_name) || 0;
			}
			break;
			
		case VARIABLE_SOURCE.FLAG:
			if (source_name) {
				// Convert boolean to FLAG_TYPE
				const flagType = is_global_flag ? FLAG_TYPE.GLOBAL : FLAG_TYPE.CHARACTER;
				value = await this.getFlagValue(source_name, flagType, session) || 0;
			}
			break;
			
		case VARIABLE_SOURCE.ITEM_COUNT:
			if (session.characterId && source_name) {
				const itemCount = await characterUtil.getCharacterItemQuantity(session.characterId, parseInt(source_name));
				value = itemCount || 0;
			}
			break;
			
		case VARIABLE_SOURCE.LITERAL:
			value = parseInt(expression) || 0;
			break;
			
		case VARIABLE_SOURCE.EXPRESSION:
			value = this.resolveExpression(expression, session);
			break;

		case VARIABLE_SOURCE.INPUT:
			value = await this.collectModalInput(session, {
				variable_name,
				input_label: input_label || 'Enter value',
				input_placeholder: input_placeholder || '',
				input_default: input_default || '',
				is_numeric: is_numeric || false,
			});
			break;

		case VARIABLE_SOURCE.CHAT_INPUT:
			value = await this.collectChatInput(session, {
				variable_name,
				input_label: input_label || 'Please enter your response:',
				input_default: input_default || '',
				is_numeric: is_numeric || false,
			});
			break;
			
		default:
			console.warn(`Unknown variable source type: ${source_type}`);
		}
		
		// Store the value in session variables
		session.variables[variable_name] = value;
		
		// Add message if not silent
		if (!silent) {
			const message = custom_message || `Variable ${variable_name} set to ${value}`;
			session.messages.push({ type: 'info', text: message });
		}
	}

	/**
	 * Collect player input via Discord modal
	 * @param {Object} session - Event session
	 * @param {Object} options - Input options
	 * @returns {string|number} - Player input or default value
	 */
	async collectModalInput(session, options) {
		const { variable_name, input_label, input_placeholder, input_default, is_numeric } = options;

		// If this variable was already captured by the inline handler, return it immediately
		// without trying to show another modal (which would fail on a modal-submit interaction).
		if (session.variables && session.variables[variable_name] !== undefined) {
			return session.variables[variable_name];
		}

		let interaction = session.interaction;

		// Create modal (title/label max 45 chars, placeholder max 100 chars)
		const modalId = `input_modal_${variable_name}_${Date.now()}`;
		const modal = new ModalBuilder()
			.setCustomId(modalId)
			.setTitle(input_label.substring(0, 45));

		const textInput = new TextInputBuilder()
			.setCustomId('input_value')
			.setLabel(input_label.substring(0, 45))
			.setStyle(TextInputStyle.Short)
			.setRequired(true);

		if (input_placeholder && input_placeholder !== 'null') {
			textInput.setPlaceholder(input_placeholder.substring(0, 100));
		}
		if (input_default && input_default !== 'null') {
			textInput.setValue(String(input_default));
		}

		const actionRow = new ActionRowBuilder().addComponents(textInput);
		modal.addComponents(actionRow);

		try {
			// Show modal to user
			await interaction.showModal(modal);

			// Wait for modal submission (5 minute timeout)
			const modalSubmit = await interaction.awaitModalSubmit({
				filter: i => i.customId === modalId && i.user.id === interaction.user.id,
				time: 300_000,
			});

			// Get the input value
			const inputValue = modalSubmit.fields.getTextInputValue('input_value');

			// Acknowledge the modal submission and clear components
			await modalSubmit.update({ components: [] });

			// Update session interaction to use the modal submit for future responses
			session.interaction = modalSubmit;

			// Parse as number if needed
			if (is_numeric) {
				const numValue = parseInt(inputValue);
				return isNaN(numValue) ? (parseInt(input_default) || 0) : numValue;
			}
			return inputValue || input_default || '';
		}
		catch (error) {
			console.error(`Modal input failed for ${variable_name}:`, error);

			// If the modal never reached the user (interaction was already consumed),
			// throw so the event aborts cleanly instead of saving a corrupted empty value.
			if (error.code === 'InteractionAlreadyReplied') {
				throw error;
			}

			// Genuine timeout (user saw modal but didn't respond) — fall back to default.
			if (!interaction.replied && !interaction.deferred) {
				try {
					await interaction.reply({
						content: `${EMOJI.WARNING} Input timed out for ${variable_name}, using default: ${input_default}`,
						ephemeral: true,
					});
				}
				catch (e) {
					console.error('Failed to acknowledge interaction after modal timeout:', e);
				}
			}

			console.log(`Modal input timed out for ${variable_name}, using default: ${input_default}`);
			if (is_numeric) {
				return parseInt(input_default) || 0;
			}
			return input_default || '';
		}
	}

	/**
	 * Collect player input via chat message
	 * @param {Object} session - Event session
	 * @param {Object} options - Input options
	 * @returns {string|number} - Player input or default value
	 */
	async collectChatInput(session, options) {
		const { variable_name, input_label, input_default, is_numeric } = options;
		const interaction = session.interaction;
		const channel = interaction.channel;
		const userId = interaction.user.id;

		if (!channel) {
			console.warn('No channel available for chat input');
			return is_numeric ? (parseInt(input_default) || 0) : (input_default || '');
		}

		try {
			// Send prompt message
			const promptMsg = await channel.send({
				content: `📝 **${input_label}**\n*Type your response below (60 seconds timeout)*`,
			});

			// Wait for user's message (60 second timeout)
			const collected = await channel.awaitMessages({
				filter: m => m.author.id === userId,
				max: 1,
				time: 60_000,
				errors: ['time'],
			});

			const response = collected.first();
			const inputValue = response?.content || '';

			// Try to delete prompt and response for cleaner chat
			try {
				await promptMsg.delete();
				await response.delete();
			}
			catch {
				// Ignore delete errors (permissions, etc.)
			}

			// Parse as number if needed
			if (is_numeric) {
				const numValue = parseInt(inputValue);
				return isNaN(numValue) ? (parseInt(input_default) || 0) : numValue;
			}
			return inputValue || input_default || '';
		}
		catch {
			// Timeout - use default value
			console.log(`Chat input timed out for ${variable_name}, using default: ${input_default}`);
			if (is_numeric) {
				return parseInt(input_default) || 0;
			}
			return input_default || '';
		}
	}

	/**
	 * Execute actions by trigger condition
	 */
	async executeActionsByTrigger(eventId, session, trigger) {
		const eventData = contentStore.events.findByPk(String(eventId));
		const allActions = (eventData && eventData.action) || [];

		// Execute variable actions FIRST to set up session variables for other actions
		const variableActions = allActions.filter(a => a.type === 'variable');
		for (const action of variableActions) {
			await this.executeVariableAction(action, session);
		}

		// Execute flag actions
		const flagActions = allActions.filter(a => a.type === 'flag');
		for (const action of flagActions) {
			await this.executeFlagAction(action, session, eventId);
		}

		// Execute item actions
		const itemActions = allActions.filter(a => a.type === 'item');
		for (const action of itemActions) {
			await this.executeItemAction(action, session);
		}

		// Execute stat actions
		const statActions = allActions.filter(a => a.type === 'stat');
		for (const action of statActions) {
			await this.executeStatAction(action, session);
		}

		// Execute move actions
		const moveActions = allActions.filter(a => a.type === 'move');
		for (const action of moveActions) {
			await this.executeMoveAction(action, session);
		}

		// Execute status actions
		const statusActions = allActions.filter(a => a.type === 'status');
		for (const action of statusActions) {
			await this.executeStatusAction(action, session);
		}

		// Execute shop actions
		const shopActions = allActions.filter(a => a.type === 'shop');
		for (const action of shopActions) {
			await this.executeShopAction(action, session);
		}

		// Execute narrate actions (post embed to a configured channel)
		const narrateActions = allActions.filter(a => a.type === 'narrate');
		for (const action of narrateActions) {
			await this.executeNarrateAction(action, session);
		}

		// Execute fish actions
		const fishActions = allActions.filter(a => a.type === 'fish');
		for (const action of fishActions) {
			await this.executeFishAction(action, session);
		}

		// Execute cook actions
		const cookActions = allActions.filter(a => a.type === 'cook');
		for (const action of cookActions) {
			await this.executeCookAction(action, session);
		}

		// Execute sell actions (take item + give gold = item value)
		const sellActions = allActions.filter(a => a.type === 'sell');
		for (const action of sellActions) {
			await this.executeSellAction(action, session);
		}
	}

	/**
	 * Post a narration embed to a configured channel.
	 * YAML action fields: channel, title, text, color (optional)
	 * `channel` must be a key in src/config/channels.js (case-insensitive).
	 */
	async executeNarrateAction(action, session) {
		const channels = require('@root/config/channels.js');
		const { EmbedBuilder } = require('discord.js');

		const { channel: channelKey, title, text } = action;
		if (!channelKey || !text) {
			console.error('[Narrate] Action missing required fields (channel, text):', action);
			return;
		}

		const channelId = channels[channelKey.toUpperCase()];
		if (!channelId) {
			console.error(`[Narrate] Unknown channel key '${channelKey}' in narrate action`);
			return;
		}

		const client = session.client ?? session.interaction?.client;
		if (!client) {
			console.error('[Narrate] No client available in session for narrate action');
			return;
		}

		const ch = await client.channels.fetch(channelId).catch(() => null);
		if (!ch) {
			console.error(`[Narrate] Could not fetch channel ${channelId}`);
			return;
		}

		const processedText = await this.processText(text, session);
		const processedTitle = title ? await this.processText(title, session) : null;

		const embed = new EmbedBuilder()
			.setDescription(processedText)
			.setColor(action.color ?? 0x2f3136);

		if (processedTitle) embed.setTitle(processedTitle);

		await ch.send({ embeds: [embed] });
	}

	/**
	 * Execute sell action - removes items and gives gold equal to item's value * quantity.
	 * YAML fields: item (item id), quantity (default 1, supports ${variable} expressions), silent (bool), custom_message (optional)
	 */
	async executeSellAction(action, session) {
		if (!session.characterId) return;

		const { item, quantity, silent, custom_message } = action;
		if (!item) return;

		const itemData = contentStore.items.findByPk(String(item));
		if (!itemData) {
			console.error(`[Sell] Unknown item id: ${item}`);
			return;
		}

		const resolvedQuantity = Math.max(1, parseInt(this.resolveExpression(quantity ?? 1, session)) || 1);
		const goldAmount = (itemData.value ?? 0) * resolvedQuantity;

		await characterUtil.removeCharacterItem(session.characterId, item, resolvedQuantity);
		await characterUtil.modifyCharacterStat(session.characterId, 'gold', goldAmount);

		if (!silent) {
			const msg = custom_message || `You receive ${goldAmount} gold.`;
			session.messages.push({ type: 'success', text: msg });
		}
	}

	/**
	 * Execute fish action - runs the fishing catch logic and adds result to session.messages.
	 * For combat encounters, sets session.fishNextEvent to chain to the encounter event.
	 */
	async executeFishAction(action, session) {
		if (!session.characterId) return;

		const CATCH_TABLE = [
			{ id: null, name: null, weight: 60 },
			{ id: 'herring', name: 'Cá trích', weight: 18 },
			{ id: 'mackerel', name: 'Cá thu', weight: 12 },
			{ id: 'crab', name: 'Cua biển khổng lồ', type: 'combat', event: 'fish-encounter-crab', weight: 7 },
			{ id: 'shark', name: 'Cá mập', type: 'combat', event: 'fish-encounter-shark', weight: 3 },
		];
		const TOTAL_WEIGHT = CATCH_TABLE.reduce((sum, e) => sum + e.weight, 0);

		const CATCH_FLAVOUR = {
			herring: [
				'Một con cá trích nhỏ lên câu. Bình thường, nhưng là một ngày lương thiện.',
				'Cá trích vùng vằy ở đầu dây. Có còn hơn không.',
				'Con cá trích gần như tự phiến vào lưỡi câu.',
			],
			mackerel: [
				'Một con cá thu. Chắc thịt, nặng tay. Không tệ.',
				'Cá thu lên lưới. Bếp trưởng sẽ hài lòng.',
				'Một con cá thu đẹp nhảy lên khỏi mặt nước. Một mẻ như ý.',
			],
		};
		const FAIL_FLAVOUR = [
			'Không có gì. biển giữ bí mật của mình hôm nay.',
			'Có gì đó cắn câu — rồi biến mất. Dây câu lên trống rễng.',
			'Chờ mãi. Nước không trả lời.',
			'Có gì đó giật rồi trốn mất. Hôm nay không phải ngày của mình.',
			'Lưỡi câu về trước. Có lẽ ngày mai.',
		];
		const pick = arr => arr[Math.floor(Math.random() * arr.length)];

		const STAMINA_COST = 5;
		const character = await characterUtil.getCharacterBase(session.characterId);
		if ((character?.currentStamina ?? 0) < STAMINA_COST) {
			session.messages.push({ type: 'failure', text: `Bạn quá mệt để câu cá. (Cần ${STAMINA_COST} stamina)` });
			return;
		}
		await characterUtil.modifyCharacterStat(session.characterId, 'currentStamina', -STAMINA_COST);

		// Roll catch
		let roll = Math.random() * TOTAL_WEIGHT;
		let result = CATCH_TABLE[CATCH_TABLE.length - 1];
		for (const entry of CATCH_TABLE) {
			roll -= entry.weight;
			if (roll < 0) { result = entry; break; }
		}

		// Combat encounter — chain to encounter event
		if (result.type === 'combat') {
			session.fishNextEvent = result.event;
			return;
		}

		if (!result.id) {
			session.messages.push({ type: 'info', text: `*${pick(FAIL_FLAVOUR)}*` });
		}
		else {
			await characterUtil.addCharacterItem(session.characterId, result.id, 1);
			session.messages.push({ type: 'success', text: `*${pick(CATCH_FLAVOUR[result.id])}*\n\nBạn nhận được: **${result.name}**` });
		}
	}

	/**
	 * Launch the cooking mini-game from a kitchen object interaction.
	 * Calls cook.js startCooking which edits the interaction reply directly.
	 * Sets session.cookDone to signal processEvent to skip displayEvent.
	 */
	async executeCookAction(action, session) {
		if (!session.characterId) return;
		const STAMINA_COST = 5;
		const character = await characterUtil.getCharacterBase(session.characterId);
		if ((character?.currentStamina ?? 0) < STAMINA_COST) {
			session.messages.push({ type: 'failure', text: `Bạn quá mệt để nấu ăn. (Cần ${STAMINA_COST} stamina)` });
			return;
		}
		const cookCommand = require('../commands/utility/cook.js');
		const started = await cookCommand.startCooking(session.interaction, session.characterId);
		if (started) {
			session.cookDone = true;
		}
		else {
			session.messages.push({ type: 'failure', text: 'Bạn không có nguyên liệu nào để nấu ăn cả.' });
		}
	}

	/**
	 * Handle finish_register tag - apply virtue stats and give starter weapon
	 */
	async handleFinishRegister(session) {
		if (!session.characterId) return;

		try {
			// Check if already registered (prevent double application)
			const alreadyRegistered = await characterUtil.getCharacterFlag(session.characterId, 'registration_complete');
			if (alreadyRegistered) {
				return;
			}

			// Save registration record BEFORE ending log session
			if (session.logSessionId) {
				try {
					const sessionData = eventLogger.getSessionData(session.logSessionId);
					const registrationRecord = {
						eventPath: sessionData.events.map(e => e.eventId), // Ordered list of events visited
						eventDetails: sessionData.events, // Full event details with timestamps and depth
						choices: sessionData.flagActions, // All flag actions (the actual choices made)
						virtueStats: sessionData.virtueStats, // Final virtue totals
						allFlags: session.flags.local, // Complete local flag state at finish
						startTime: sessionData.startTime,
						completionTime: new Date().toISOString(),
					};
					
					await characterSettingUtil.setCharacterSetting(
						session.characterId,
						'registration_record',
						JSON.stringify(registrationRecord),
					);
				}
				catch (saveError) {
					console.error('[handleFinishRegister] Error saving registration record:', saveError);
					// Non-fatal - continue with registration
				}
				
				// Now end the log session and save file
				eventLogger.endSession(session.logSessionId);
			}

			// 1. Read virtue flags from local session flags
			// Try both capitalized (database format) and lowercase (fallback)
			// Default to 8 if not found (as per FINISH_REGISTER_TAG.md specification)
		let fortitude = parseInt(session.flags.local.Fortitude || session.flags.local.fortitude) || 8;
		let justice = parseInt(session.flags.local.Justice || session.flags.local.justice) || 8;
		let prudence = parseInt(session.flags.local.Prudence || session.flags.local.prudence) || 8;
		let temperance = parseInt(session.flags.local.Temperance || session.flags.local.temperance) || 8;
			const jptfTotal = justice + prudence + temperance + fortitude;
			if (jptfTotal > 24) {
				console.error(`[handleFinishRegister] Invalid JPTF total: ${jptfTotal} (max: 24). Values: F=${fortitude}, J=${justice}, P=${prudence}, T=${temperance}`);
				// Scale down proportionally to maintain distribution
				const scale = 24 / jptfTotal;
				fortitude = Math.round(fortitude * scale);
				justice = Math.round(justice * scale);
				prudence = Math.round(prudence * scale);
				temperance = Math.round(temperance * scale);
				
				// Ensure total is exactly 24 after rounding
				const newTotal = fortitude + justice + prudence + temperance;
				if (newTotal !== 24) {
					const diff = 24 - newTotal;
					fortitude += diff; // Apply correction to fortitude
				}
				
				console.warn(`[handleFinishRegister] Scaled to F:${fortitude} J:${justice} P:${prudence} T:${temperance} (total: ${fortitude + justice + prudence + temperance})`);
				session.messages.push({
					type: 'warning',
					text: `${EMOJI.WARNING} Virtue values exceeded maximum (${jptfTotal}/24). Values have been normalized.`,
				});
			}
			else if (jptfTotal < 24) {
				console.warn(`[handleFinishRegister] JPTF total is ${jptfTotal} (expected 24). Using values as-is.`);
			}

			// 2. Apply virtue stats (calculates and adds bonus stats)
			await characterUtil.applyVirtueStats(
				session.characterId,
				fortitude,
				justice,
				prudence,
				temperance,
			);

			// 3. Find starter weapon flag (any local flag starting with "starter_", case-insensitive)
			const starterFlagName = Object.keys(session.flags.local).find(key => key.toLowerCase().startsWith('starter_'));
			
			if (starterFlagName) {
				const starterTag = starterFlagName;

				// 4. Find item with matching tag
				const starterItem = await itemUtility.findItemByTag(starterTag);

				if (starterItem) {
					// 5. Give the item
					await characterUtil.addCharacterItem(session.characterId, starterItem.id, 1);

					// 6. Equip the item
					await characterUtil.equipCharacterItem(session.characterId, starterItem.id, starterItem.item_type);

					// 7. Remove the starter flag from local session
					delete session.flags.local[starterFlagName];
				}
			}

			// 8. Recalculate combat stats
			await characterUtil.calculateCombatStat(session.characterId);
			await characterUtil.calculateAttackStat(session.characterId);

			// 8.1. Set HP and stamina to exactly max amount after registration recalculation
			const { CharacterBase } = require('@root/dbObject.js');
			const updatedCharacter = await CharacterBase.findOne({ where: { id: session.characterId } });
			if (updatedCharacter) {
				await CharacterBase.update({
					currentHp: updatedCharacter.maxHp,
					currentStamina: updatedCharacter.maxStamina,
				}, { where: { id: session.characterId } });
			}

			// 9. Remove unregistered flag (character flag) to unlock full game
			await characterUtil.updateCharacterFlag(session.characterId, 'unregistered', null);

			// 10. Set registration_complete flag to prevent re-running
			await characterUtil.updateCharacterFlag(session.characterId, 'registration_complete', 1);
		}
		catch (error) {
			console.error('Error in handleFinishRegister:', error);
			session.messages.push({
				type: 'error',
				text: `${EMOJI.WARNING} There was an issue completing your registration. Please contact an administrator.`,
			});
		}
	}

	/**
	 * Handle redo tag - clear starter weapons only (keep starter armor) and reset stats to base 9
	 * Virtue bonuses will be recalculated at the end of the event chain by finish_register
	 */
	async handleRedo(session) {
		if (!session.characterId) return;

		try {
			// 1. Find and remove starter weapons only (items with "starter_X" tags, but NOT plain "starter")
			const allCharacterItems = await CharacterItem.findAll({ where: { character_id: session.characterId } });
			const allItems = contentStore.items.findAll();

			for (const charItem of allCharacterItems) {
				const itemDef = allItems.find(i => String(i.id) === String(charItem.item_id));
				if (itemDef?.tag && Array.isArray(itemDef.tag)) {
					// Check if item has starter_X tags (e.g., starter_sword, starter_bow) but NOT plain "starter"
					const hasStarterWeaponTag = itemDef.tag.some(tag =>
						tag.startsWith('starter_') && tag !== 'starter'
					);
					
					if (hasStarterWeaponTag) {
						await CharacterItem.destroy({ where: { id: charItem.id } });
					}
				}
			}

			// 2. Reset stats to base 9 (virtue bonuses will be applied by finish_register at the end)
			await CharacterBase.update(
				{ con: 9, str: 9, dex: 9, agi: 9 },
				{ where: { id: session.characterId } },
			);

			// 3. Recalculate combat stats
			await characterUtil.calculateCombatStat(session.characterId);
			await characterUtil.calculateAttackStat(session.characterId);

			// 4. Reset registration flags so finish_register can run again
			await characterUtil.updateCharacterFlag(session.characterId, 'registration_complete', null);
			await characterUtil.updateCharacterFlag(session.characterId, 'unregistered', 1);
		}
		catch (error) {
			console.error('Error in handleRedo:', error);
			session.messages.push({
				type: 'error',
				text: `${EMOJI.WARNING} There was an issue resetting your character. Please contact an administrator.`,
			});
		}
	}

	/**
	 * Execute flag action
	 */
	async executeFlagAction(action, session, eventId) {
		const { flag_name, flag_value, flag_operation, flag_type, silent, custom_message, output_variable } = action;
		
		// Resolve flag_value if it contains expressions
		const resolvedValue = this.resolveExpression(flag_value, session);

		// Log virtue flag actions
		if (session.logSessionId && ['Fortitude', 'Justice', 'Prudence', 'Temperance'].includes(flag_name)) {
			eventLogger.logFlagAction(session.logSessionId, eventId, flag_name, resolvedValue, flag_operation, flag_type);
		}
		
		let currentValue = await this.getFlagValue(flag_name, flag_type, session);
		let newValue = currentValue;

		switch (flag_operation) {
		case FLAG_OPERATION.SET:
			newValue = resolvedValue;
			break;
		case FLAG_OPERATION.ADD:
			newValue = (parseInt(currentValue) || 0) + resolvedValue;
			break;
		case FLAG_OPERATION.SUBTRACT:
			newValue = (parseInt(currentValue) || 0) - resolvedValue;
			break;
		case FLAG_OPERATION.TOGGLE:
			newValue = currentValue ? 0 : 1;
			break;
		}

		await this.setFlagValue(flag_name, newValue, flag_type, session);

		// Log virtue flag changes to console
		if (['Fortitude', 'Justice', 'Prudence', 'Temperance'].includes(flag_name)) {
			console.log(`[FLAG] ${flag_name}: ${currentValue} -> ${newValue} (${flag_operation} ${resolvedValue}, type: ${flag_type}, event: ${eventId})`);
		}

		// Store result in output variable if specified
		if (output_variable) {
			session.variables[output_variable] = newValue;
		}

		// Add message if not silent
		if (!silent) {
			let message = custom_message || this.generateFlagMessage(flag_name, flag_operation, flag_value, newValue);
			if (message) {
				message = await this.processText(message, session);
				session.messages.push({ type: 'info', text: message });
			}
		}
	}

	/**
	 * Execute item action
	 */
	async executeItemAction(action, session) {
		if (!session.characterId) return;

		const { item, quantity, operation, silent, custom_message, output_variable } = action;
		const item_id = item; // YAML uses 'item' instead of 'item_id'
		
		// Resolve quantity if it contains expressions
		const resolvedQuantity = this.resolveExpression(quantity, session);
		let result = null;
		let quantityAffected = 0;

		switch (operation) {
		case ITEM_OPERATION.GIVE:
			result = await characterUtil.addCharacterItem(session.characterId, item_id, resolvedQuantity);
			quantityAffected = result?.quantityAdded || resolvedQuantity;
			break;
		case ITEM_OPERATION.TAKE:
			result = await characterUtil.removeCharacterItem(session.characterId, item_id, resolvedQuantity);
			quantityAffected = result?.quantityRemoved || 0;
			break;
		case ITEM_OPERATION.SET:
			result = await characterUtil.setCharacterItemQuantity(session.characterId, item_id, resolvedQuantity);
			quantityAffected = result?.newQuantity || resolvedQuantity;
			break;
		case ITEM_OPERATION.REMOVE_ALL:
			result = await characterUtil.removeAllCharacterItem(session.characterId, item_id);
			quantityAffected = result?.quantityRemoved || 0;
			break;
		}

		// Store result in output variable if specified
		if (output_variable) {
			session.variables[output_variable] = quantityAffected;
		}

		// Add message if not silent
		if (!silent) {
			let message = custom_message || await this.generateItemMessage(item_id, resolvedQuantity, operation, session);
			if (message) {
				message = await this.processText(message, session);
				session.messages.push({ type: 'info', text: message });
			}
		}
	}

	/**
	 * Execute stat action
	 */
	async executeStatAction(action, session) {
		if (!session.characterId) return;

		const { stat_name, value, operation, silent, custom_message, output_variable } = action;
		
		// Resolve value if it contains expressions
		const resolvedValue = this.resolveExpression(value, session);
		let result;
		let newStatValue = 0;

		switch (operation) {
		case STAT_OPERATION.SET:
			result = await characterUtil.setCharacterStat(session.characterId, stat_name, resolvedValue);
			newStatValue = resolvedValue;
			break;
		case STAT_OPERATION.ADD:
			result = await characterUtil.modifyCharacterStat(session.characterId, stat_name, resolvedValue);
			newStatValue = await characterUtil.getCharacterStat(session.characterId, stat_name);
			break;
		case STAT_OPERATION.SUBTRACT:
			result = await characterUtil.modifyCharacterStat(session.characterId, stat_name, -resolvedValue);
			newStatValue = await characterUtil.getCharacterStat(session.characterId, stat_name);
			break;
		case STAT_OPERATION.PERCENTAGE: {
			const current = await characterUtil.getCharacterStat(session.characterId, stat_name);
			const newVal = Math.max(1, Math.floor(current * (resolvedValue / 100)));
			result = await characterUtil.setCharacterStat(session.characterId, stat_name, newVal);
			newStatValue = newVal;
			break;
		}
		}

		// Store result in output variable if specified
		if (output_variable) {
			session.variables[output_variable] = newStatValue;
		}

		// Add message if not silent
		if (!silent) {
			let message = custom_message || this.generateStatMessage(stat_name, resolvedValue, operation);
			if (message) {
				message = await this.processText(message, session);
				session.messages.push({ type: 'info', text: message });
			}
		}

		// Handle level up message if XP was modified
		if (result?.leveledUp) {
			session.messages.push({
				type: 'level_up',
				text: `🎉 Level Up! You are now level ${result.newLevel}! (+${result.freeStatPointsGained} stat points)`,
			});
		}
	}

	/**
	 * Execute move action
	 */
	async executeMoveAction(action, session) {
		if (!session.characterId) return;

		const { location, silent, custom_message } = action;
		let location_id = location; // YAML uses 'location' instead of 'location_id'

		if (location === 'adjacent_random') {
			const character = await characterUtil.getCharacterBase(session.characterId);
			if (character?.location_id) {
				const links = await locationUtil.getLinkedLocations(character.location_id);
				if (links.length > 0) {
					const picked = links[Math.floor(Math.random() * links.length)];
					location_id = picked.linked_location_id;
				}
			}
		}

		if (!location_id || location_id === 'adjacent_random') return;

		// Capture old location before moving (for departure notification)
		const characterBefore = await characterUtil.getCharacterBase(session.characterId);
		const oldLocationId = characterBefore?.location_id;

		await locationUtil.moveCharacterToLocation(session.characterId, location_id, session.interaction.guild);

		// Post move activity messages
		const client = session.interaction?.client;
		if (client) {
			const characterName = characterBefore?.name || `<@${session.characterId}>`;
			const characterGender = characterBefore?.gender;
			try {
				if (oldLocationId) {
					await locationUtil.postLocationActivity(client, oldLocationId, characterName, 'depart', characterGender);
				}
				await locationUtil.postLocationActivity(client, location_id, characterName, 'arrive', characterGender);
			}
			catch (actErr) { console.error('[LocationActivity] Error in executeMoveAction:', actErr); }
		}

		// Add message if not silent
		if (!silent) {
			let message = custom_message || await this.generateMoveMessage(location_id);
			if (message) {
				message = await this.processText(message, session);
				session.messages.push({ type: 'info', text: message });
			}
		}
	}

	/**
	 * Execute status action
	 */
	async executeStatusAction(action, session) {
		if (!session.characterId) return;

		const { status_name, status_type, status_value, operation, silent, custom_message } = action;

		switch (operation) {
		case 'add':
			await characterUtil.addCharacterStatus(session.characterId, status_name, status_type, status_value);
			break;
		case 'remove':
			await characterUtil.removeCharacterStatus(session.characterId, status_name);
			break;
		case 'clear_all':
			await characterUtil.clearAllCharacterStatuses(session.characterId);
			break;
		}

		// Add message if not silent
		if (!silent) {
			let message = custom_message || this.generateStatusMessage(status_name, operation);
			if (message) {
				message = await this.processText(message, session);
				session.messages.push({ type: 'info', text: message });
			}
		}
	}

	/**
	 * Execute shop action - stores shop data in session for display
	 */
	async executeShopAction(action, session) {
		const { npc: npc_id, shop_type, silent, custom_message } = action;

		// Get NPC info from YAML content store
		const npc = contentStore.npcs.findByPk(npc_id);
		if (!npc) {
			console.error(`Shop action: NPC ${npc_id} not found`);
			return;
		}

		// Get all town buildings for requirement checks
		const townBuildings = await TownBuilding.findAll();
		const buildingLevels = {};
		for (const building of townBuildings) {
			buildingLevels[building.project_id] = building.current_level || 1;
		}

		// Get shop inventory based on shop type
		const shopData = {
			npcId: npc_id,
			npcName: npc.name,
			shopType: shop_type,
			items: [],
			perks: [],
		};

		// Get item stock if applicable
		if (shop_type === SHOP_TYPE.ITEM || shop_type === SHOP_TYPE.BOTH) {
			// Get purchase counts from DB
			const purchases = await NpcPurchase.findAll({ where: { npc_id: npc_id } });
			const purchaseMap = new Map(purchases.map(p => [String(p.item_id), p.purchased || 0]));

			const stock = (npc.stock || []).map(s => ({
				...s,
				item: contentStore.items.findByPk(String(s.item)),
				remaining: s.amount != null ? s.amount - (purchaseMap.get(String(s.item)) || 0) : null,
			}));
			// Filter items by building requirements
			const filteredStock = stock.filter(s => {
				if (!s.required_building_id) return true;
				const currentLevel = buildingLevels[s.required_building_id] || 0;
				return currentLevel >= (s.required_building_level || 1);
			});
			shopData.items = filteredStock.map(s => ({
				itemId: s.item?.id || s.item,
				name: s.item?.name || 'Unknown Item',
				description: s.item?.description || '',
				itemType: s.item?.item_type || '',
				price: s.price ?? s.item?.value ?? 0,
				amount: s.remaining,
				maxStock: s.amount,
			}));
		}

		// Get teachable perks if applicable
		if (shop_type === SHOP_TYPE.PERK || shop_type === SHOP_TYPE.BOTH) {
			const perks = (npc.perks || []).map(p => ({
				...p,
				perkData: contentStore.perks.findByPk(String(p.perk)),
			}));
			// Filter perks by building requirements
			const filteredPerks = perks.filter(p => {
				if (!p.required_building_id) return true;
				const currentLevel = buildingLevels[p.required_building_id] || 0;
				return currentLevel >= (p.required_building_level || 1);
			});
			shopData.perks = filteredPerks.map(p => ({
				perkId: p.perk,
				name: p.perkData?.name || 'Unknown Perk',
				description: p.perkData?.description || '',
				staminaCost: p.stamina_cost,
				category: p.perkData?.category || '',
			}));
		}

		// Store shop data in session for later display
		session.shopData = shopData;

		// Add message if not silent
		if (!silent) {
			let message = custom_message || `${npc.name} opens their ${shop_type === SHOP_TYPE.PERK ? 'training menu' : 'shop'}.`;
			message = await this.processText(message, session);
			session.messages.push({ type: 'shop', text: message });
		}
	}

	// ============================================================================
	// MESSAGE GENERATION HELPERS
	// ============================================================================

	/**
	 * Generate default message for check result
	 */
	generateCheckMessage(check, result) {
		const checkType = check.type;
		const success = result.success;

		switch (checkType) {
		case 'flag':
			return success ? `Condition met: ${check.name}` : `Condition not met: ${check.name}`;
		case 'stat':
			const statData = check.stat_data || {};
			return success 
				? `${statData.stat_name} check passed!` 
				: `${statData.stat_name} check failed.`;
		case 'item':
			return success ? 'You have the required items.' : 'You don\'t have the required items.';
		case 'skill':
			const skillData = check.skill_data || {};
			return success 
				? `Skill check passed!` 
				: `You need higher skill level.`;
		case 'level':
			const levelData = check.level_data || {};
			return success 
				? `Level requirement met.` 
				: `You need to be level ${levelData.required_level}.`;
		case 'random':
			return success ? 'Success!' : 'Failed...';
		default:
			return success ? 'Check passed.' : 'Check failed.';
		}
	}

	/**
	 * Generate default message for flag action
	 */
	generateFlagMessage(flagName, operation, flagValue, newValue) {
		// Flag actions are usually internal, so default message is minimal
		switch (operation) {
		case FLAG_OPERATION.SET:
			return `Progress updated: ${flagName}`;
		case FLAG_OPERATION.ADD:
		case FLAG_OPERATION.SUBTRACT:
			return `${flagName} changed to ${newValue}`;
		case FLAG_OPERATION.TOGGLE:
			return newValue ? `${flagName} activated` : `${flagName} deactivated`;
		default:
			return `${flagName} updated`;
		}
	}

	/**
	 * Generate default message for item action
	 */
	async generateItemMessage(itemId, quantity, operation, session) {
		const itemName = await itemUtility.getItemName(itemId);
		const qtyText = quantity > 1 ? ` (x${quantity})` : '';

		switch (operation) {
		case ITEM_OPERATION.GIVE:
			return `📦 You received **${itemName}**${qtyText}.`;
		case ITEM_OPERATION.TAKE:
			return `📦 You lost **${itemName}**${qtyText}.`;
		case ITEM_OPERATION.SET:
			return `📦 You now have ${quantity} **${itemName}**.`;
		case ITEM_OPERATION.REMOVE_ALL:
			return `📦 You lost all **${itemName}**.`;
		default:
			return `📦 Your **${itemName}** was updated.`;
		}
	}

	/**
	 * Generate default message for stat action
	 */
	generateStatMessage(statName, value, operation) {
		const formattedStat = statName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

		switch (operation) {
		case STAT_OPERATION.SET:
			return `📊 ${formattedStat} set to ${value}`;
		case STAT_OPERATION.ADD:
			return `📊 ${formattedStat} +${value}`;
		case STAT_OPERATION.SUBTRACT:
			return `📊 ${formattedStat} -${value}`;
		case STAT_OPERATION.PERCENTAGE:
			return `📊 ${formattedStat} changed by ${value}%`;
		default:
			return `📊 ${formattedStat} updated`;
		}
	}

	/**
	 * Generate default message for move action
	 */
	async generateMoveMessage(locationId) {
		const locationName = await locationUtil.getLocationName(locationId);
		return `🚶 You reached **${locationName}**.`;
	}

	/**
	 * Generate default message for status action
	 */
	generateStatusMessage(statusName, operation) {
		const formattedStatus = statusName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

		switch (operation) {
		case 'add':
			return `✨ You are now **${formattedStatus}**.`;
		case 'remove':
			return `✨ **${formattedStatus}** has been removed.`;
		case 'clear_all':
			return `✨ All status effects have been cleared.`;
		default:
			return `✨ Status updated.`;
		}
	}

	// ============================================================================
	// FLAG MANAGEMENT
	// ============================================================================

	/**
	 * Get flag value (with caching)
	 */
	/**
	 * Get flag value - now accepts flagType instead of isGlobal boolean
	 */
	async getFlagValue(flagName, flagType, session) {
		console.log(`[getFlagValue] flagName=${flagName}, flagType=${flagType}, local=`, JSON.stringify(session.flags.local, null, 2));
		
		if (flagType === FLAG_TYPE.GLOBAL) {
			if (session.flags.global[flagName] !== undefined) {
				return session.flags.global[flagName];
			}
			const flag = await GlobalFlag.findOne({ where: { flag: flagName } });
			const value = flag ? parseInt(flag.value) : 0;
			session.flags.global[flagName] = value;
			return value;
		}
		else if (flagType === FLAG_TYPE.CHARACTER && session.characterId) {
			if (session.flags.character[flagName] !== undefined) {
				return session.flags.character[flagName];
			}
			const flag = await CharacterFlag.findOne({
				where: { character_id: session.characterId, flag: flagName },
			});
			const value = flag ? parseInt(flag.value) : 0;
			session.flags.character[flagName] = value;
			return value;
		}
		// Local flags (FLAG_TYPE.LOCAL or default)
		const localValue = session.flags.local[flagName] || 0;
		console.log(`[getFlagValue] Returning local value for ${flagName}:`, localValue);
		return localValue;
	}

	/**
	 * Set flag value
	 */
	async setFlagValue(flagName, value, flagType, session) {
		console.log(`[setFlagValue] BEFORE: flagName=${flagName}, value=${value}, flagType=${flagType}, local=`, JSON.stringify(session.flags.local, null, 2));
		
		const isFalsy = value === 0 || value === null || value === undefined;

		switch (flagType) {
		case FLAG_TYPE.GLOBAL:
			if (isFalsy) {
				delete session.flags.global[flagName];
				session.pendingGlobalFlags.set(flagName, { op: 'delete' });
			}
			else {
				session.flags.global[flagName] = value;
				session.pendingGlobalFlags.set(flagName, { op: 'upsert', value });
			}
			break;
		case FLAG_TYPE.CHARACTER:
			if (session.characterId) {
				if (isFalsy) {
					delete session.flags.character[flagName];
					session.pendingCharacterFlags.set(flagName, { op: 'delete' });
				}
				else {
					session.flags.character[flagName] = value;
					session.pendingCharacterFlags.set(flagName, { op: 'upsert', value });
				}
			}
			break;
		case FLAG_TYPE.LOCAL:
		default:
			if (isFalsy) {
				delete session.flags.local[flagName];
			}
			else {
				session.flags.local[flagName] = value;
			}
			break;
		}
		
		console.log(`[setFlagValue] AFTER: flagName=${flagName}, local=`, JSON.stringify(session.flags.local, null, 2));
	}

	/**
	 * Flush all pending character and global flag writes to the database.
	 * Called only when the event chain completes successfully.
	 * On timeout or error, pending writes are simply discarded.
	 */
	async flushPendingFlags(session) {
		for (const [flagName, entry] of session.pendingGlobalFlags) {
			if (entry.op === 'delete') {
				await GlobalFlag.destroy({ where: { flag: flagName } });
			}
			else {
				await GlobalFlag.upsert({ flag: flagName, value: entry.value });
			}
		}
		if (session.characterId) {
			for (const [flagName, entry] of session.pendingCharacterFlags) {
				// updateCharacterFlag handles null/undefined as a delete
				await characterUtil.updateCharacterFlag(
					session.characterId,
					flagName,
					entry.op === 'delete' ? null : entry.value,
				);
			}
		}
	}

	/**
	 * Returns true if str is a valid http/https URL accepted by Discord embeds.
	 */
	_isValidUrl(str) {
		if (!str || typeof str !== 'string') return false;
		try {
			const url = new URL(str);
			return url.protocol === 'http:' || url.protocol === 'https:';
		}
		catch {
			return false;
		}
	}

	/**
	 * Build the Discord message
	 */
	async buildMessage(eventBase, session) {
		const eventMessage = eventBase.message || null;
		
		const embed = new Discord.EmbedBuilder();

		// Add check/combat result messages first
		let resultText = '';
		if (session.messages && session.messages.length > 0) {
			resultText = session.messages.map(m => {
					const icons = { success: EMOJI.SUCCESS, failure: EMOJI.FAILURE, info: EMOJI.INFO };
				const icon = icons[m.type] || '•';
				return `${icon} ${m.text}`;
			}).join('\n') + '\n\n';
		}

		// Add combat result
		if (session.combatResult) {
			const icons = { victory: EMOJI.SWORD, defeat: EMOJI.SKULL, flee: EMOJI.RUN, error: EMOJI.WARNING };
			resultText += `${icons[session.combatResult.result] || EMOJI.FAILURE} ${session.combatResult.message}\n\n`;
		}

		// Pre-fetch character for author display and text processing
		let character = null;
		if (session.characterId) {
			character = await characterUtil.getCharacterBase(session.characterId);
		}

		// Show interacting PC as embed author in public (non-ephemeral) events
		if (character && !session.ephemeral) {
			const charName = character.fullname || character.name || session.interaction?.user?.username;
			const userAvatar = session.interaction?.user?.displayAvatarURL?.() ?? undefined;
			if (charName) embed.setAuthor({ name: charName, iconURL: userAvatar });
		}

		// Add event message content
		if (eventMessage) {
			// Handle NPC speaker - NPC name becomes title, NPC avatar becomes message avatar
			let npc = session.npc;
			if (eventMessage.npc_speaker) {
				npc = contentStore.npcs.findByPk(eventMessage.npc_speaker);
				if (npc) {
					session.npc = npc; // Store for pronoun processing
					embed.setTitle(npc.name);
						if (npc.avatar && this._isValidUrl(npc.avatar)) {
						embed.setThumbnail(npc.avatar);
					}
				}
			}
			else if (eventMessage.title) {
				// Only use event message title if no NPC speaker
				embed.setTitle(eventMessage.title);
			}

			// Use event message avatar only if no NPC speaker (or NPC has no avatar)
			if (eventMessage.avatar && !eventMessage.npc_speaker && this._isValidUrl(eventMessage.avatar)) {
				embed.setThumbnail(eventMessage.avatar);
			}

			// Process text with pronouns and player name (includes NPC-relational pronouns)
			let text = eventMessage.text || '';
			if (text && character) {
				const npcForTemplate = session.npc || npc;
				text = processTextTemplate(text, character.age, character.gender, character, npcForTemplate);
			}

			embed.setDescription(resultText + text);

			if (eventMessage.avatar && this._isValidUrl(eventMessage.avatar)) embed.setThumbnail(eventMessage.avatar);
			if (eventMessage.illustration && this._isValidUrl(eventMessage.illustration)) embed.setImage(eventMessage.illustration);
		}
		else {
			// No message component, just show results
			embed.setTitle(eventBase.name);
			embed.setDescription(resultText || eventBase.description || 'Continue...');
		}

		// Add enemy preview if present
		const enemies = (eventBase.enemy || [])
			.filter(e => !e.is_hidden)
			.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

		for (const enemy of enemies) {
			const enemyData = await this.getEnemyData(enemy);
			if (enemyData) {
				embed.addFields({
					name: enemyData.name,
					value: enemyData.description || 'A mysterious opponent...',
					inline: false,
				});
			}
		}

		return { embeds: [embed] };
	}

	/**
	 * Get enemy display data
	 */
	async getEnemyData(enemyConfig) {
		let enemyBase;
		if (enemyConfig.enemy_type === 'enemy') {
			enemyBase = contentStore.enemies.findByPk(String(enemyConfig.enemy));
		}
		else {
			enemyBase = contentStore.npcs.findByPk(String(enemyConfig.enemy));
		}

		if (!enemyBase) return null;

		return {
			name: enemyConfig.display_name || enemyBase.name,
			description: enemyConfig.display_description || enemyBase.description,
		};
	}

	/**
	 * Get visible options for the event
	 */
	async getVisibleOptions(eventId, session) {
		const eventData = contentStore.events.findByPk(String(eventId));
		const options = (eventData && eventData.option)
			? eventData.option.map(o => ({ ...o })).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
			: [];

		// Get character for pronoun processing
		let character = null;
		if (session.characterId) {
			character = await characterUtil.getCharacterBase(session.characterId);
		}

		const visible = [];
		for (const option of options) {
			if (await this.isOptionVisible(option, session)) {
				// Process option text with pronouns and player name (includes NPC-relational pronouns)
				if (character && option.text) {
					option.text = processTextTemplate(option.text, character.age, character.gender, character, session.npc);
				}
				if (character && option.description) {
					option.description = processTextTemplate(option.description, character.age, character.gender, character, session.npc);
				}
				visible.push(option);
			}
		}

		return visible;
	}

	/**
	 * Evaluate a single inline check condition
	 */
	async evaluateInlineCheck(checkData, session) {
		if (!checkData || !checkData.type) {
			return { success: false, message: 'Invalid check data' };
		}

		// Resolve any expressions in the check data
		const resolvedCheck = this.resolveCheckExpressions(checkData, session);

		// Use existing check methods based on type
		switch (resolvedCheck.type) {
		case 'flag':
			return await this.checkFlag(resolvedCheck, session);
		case 'stat':
			return await this.checkStat(resolvedCheck, session);
		case 'item':
			return await this.checkItem(resolvedCheck, session);
		case 'skill':
			return await this.checkSkill(resolvedCheck, session);
		case 'level':
			return await this.checkLevel(resolvedCheck, session);
		default:
			return { success: false, message: `Unsupported check type for options: ${resolvedCheck.type}` };
		}
	}

	/**
	 * Resolve expressions in check data objects
	 */
	resolveCheckExpressions(checkData, session) {
		const resolved = { ...checkData };

		// Resolve expressions in nested data objects
		if (resolved.stat_data) {
			resolved.stat_data = {
				...resolved.stat_data,
				stat_value: this.resolveExpression(resolved.stat_data.stat_value, session),
			};
		}
		if (resolved.flag_data) {
			resolved.flag_data = {
				...resolved.flag_data,
				flag_value: this.resolveExpression(resolved.flag_data.flag_value, session),
			};
		}
		if (resolved.level_data) {
			resolved.level_data = {
				...resolved.level_data,
				required_level: this.resolveExpression(resolved.level_data.required_level, session),
			};
		}
		if (resolved.skill_data) {
			resolved.skill_data = {
				...resolved.skill_data,
				required_level: this.resolveExpression(resolved.skill_data.required_level, session),
			};
		}
		if (resolved.item_data) {
			if (Array.isArray(resolved.item_data)) {
				resolved.item_data = resolved.item_data.map(item => ({
					...item,
					required_quantity: this.resolveExpression(item.required_quantity, session),
				}));
			} else {
				resolved.item_data = {
					...resolved.item_data,
					required_quantity: this.resolveExpression(resolved.item_data.required_quantity, session),
				};
			}
		}

		return resolved;
	}

	/**
	 * Check if option is visible based on inline check conditions
	 */
	async isOptionVisible(option, session) {
		// Required checks - all must pass for option to appear
		if (option.required_check && option.required_check.length > 0) {
			for (const checkData of option.required_check) {
				const result = await this.evaluateInlineCheck(checkData, session);
				if (!result.success) {
					return false;
				}
			}
		}

		// Hidden checks - if any pass, option is hidden
		if (option.hidden_check && option.hidden_check.length > 0) {
			for (const checkData of option.hidden_check) {
				const result = await this.evaluateInlineCheck(checkData, session);
				if (result.success) {
					return false;
				}
			}
		}

		return true;
	}

	/**
	 * Send combat log as a separate message
	 */
	async sendCombatLog(interaction, combatResult, ephemeral = true) {
		const color = combatResult.result === 'victory' ? 0x00ff00 : combatResult.result === 'defeat' ? 0xff0000 : 0xffff00;
		const pages = combatResult.battleReportPages || [combatResult.battleReport || 'No combat details available.'];

		// Send the first page by editing the deferred reply
		const firstEmbed = new Discord.EmbedBuilder()
			.setTitle(`${EMOJI.SWORD} Combat Log`)
			.setColor(color)
			.setDescription(pages[0]);
		await interaction.editReply({ embeds: [firstEmbed] });

		// Send remaining pages as follow-up messages
		for (let i = 1; i < pages.length; i++) {
			const pageEmbed = new Discord.EmbedBuilder()
				.setTitle(`${EMOJI.SWORD} Combat Log (${i + 1}/${pages.length})`)
				.setColor(color)
				.setDescription(pages[i]);
			await interaction.followUp({ embeds: [pageEmbed], ephemeral });
		}
	}

	/**
	 * Build shop UI components (select menus for items/perks)
	 */
	buildShopComponents(session, hasOtherOptions = false) {
		const components = [];
		const { shopData } = session;

		// Build item shop select menu
		if (shopData.items && shopData.items.length > 0) {
			const itemOptions = shopData.items.slice(0, 25).map(item => ({
				label: item.name,
				description: `${item.price} gold${item.amount ? ` (${item.amount} in stock)` : ''}`.substring(0, 100),
				value: `shop_buy_${item.itemId}`,
			}));

			const itemSelect = new Discord.StringSelectMenuBuilder()
				.setCustomId(`shop_items_${session.sessionId}`)
				.setPlaceholder('🛒 Buy items...')
				.addOptions(itemOptions);

			components.push(new Discord.ActionRowBuilder().addComponents(itemSelect));
		}

		// Build perk shop select menu
		if (shopData.perks && shopData.perks.length > 0) {
			const perkOptions = shopData.perks.slice(0, 25).map(perk => ({
				label: perk.name,
				description: `${perk.staminaCost} stamina to learn${perk.category ? ` (${perk.category})` : ''}`.substring(0, 100),
				value: `shop_learn_${perk.perkId}`,
			}));

			const perkSelect = new Discord.StringSelectMenuBuilder()
				.setCustomId(`shop_perks_${session.sessionId}`)
				.setPlaceholder('📖 Learn perks...')
				.addOptions(perkOptions);

			components.push(new Discord.ActionRowBuilder().addComponents(perkSelect));
		}

		// Add Leave Shop button if no other navigation options
		if (!hasOtherOptions && components.length > 0) {
			const leaveButton = new Discord.ButtonBuilder()
				.setCustomId('shop_leave')
				.setLabel('R\u1EDDi c\u1EEDa h\u00E0ng')
				.setStyle(Discord.ButtonStyle.Secondary)
				.setEmoji(EMOJI.DOOR);

			components.push(new Discord.ActionRowBuilder().addComponents(leaveButton));
		}

		return components;
	}

	/**
	 * Display event to Discord with options or continue button
	 */
	async displayEvent(session, messageData, options, eventBase, nextEventId) {
		const { interaction } = session;
		// Use followUp if combat log was sent (either from this event or a previous combat event)
		const hasCombatLog = !!session.combatResult?.battleReport || session.combatLogSent;

		let components = [];

		// Determine if there are other navigation options
		const hasOtherOptions = (options && options.length > 0) || (nextEventId && nextEventId !== '0' && nextEventId.trim() !== '');

		// Check if there's shop data to display
		if (session.shopData) {
			const shopComponents = this.buildShopComponents(session, hasOtherOptions);
			components.push(...shopComponents);
		}

		if (options && options.length > 0) {
			// Append numbered options to the embed description
			const optionsText = options.map((option, index) =>
				`${NUMBER_EMOJIS[index]} ${option.text}`
			).join('\n');

			const embed = messageData.embeds[0];
			const currentDesc = embed.data.description || '';
			const separator = currentDesc ? '\n\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\n' : '\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\u2015\n';
			embed.setDescription(currentDesc + separator + optionsText);

			// Build numbered buttons split into balanced rows
			const row1Count = Math.ceil(options.length / 2);
			const buildRow = (opts) => new Discord.ActionRowBuilder().addComponents(
				opts.map((option, idx) => {
					const globalIdx = options.indexOf(option);
					return new Discord.ButtonBuilder()
						.setCustomId(`event_opt_${session.sessionId}|${option.id}`)
						.setLabel(String(globalIdx + 1))
						.setStyle(Discord.ButtonStyle.Secondary);
				})
			);

			if (options.length <= 5) {
				components.push(buildRow(options));
			}
			else {
				components.push(buildRow(options.slice(0, row1Count)));
				components.push(buildRow(options.slice(row1Count)));
			}
		}
		else if (nextEventId && nextEventId !== '0' && nextEventId.trim() !== '') {
			// No options but has next event - show Continue button
			const button = new Discord.ButtonBuilder()
				.setCustomId(`event_continue_${session.sessionId}`)
				.setLabel('Ti\u1EBFp t\u1EE5c')
				.setStyle(Discord.ButtonStyle.Primary);

			components.push(new Discord.ActionRowBuilder().addComponents(button));
		}
		// If no options and no next event (or blank), don't add components (event ends)

		// Send or update message
		if (!(interaction.replied || interaction.deferred)) {
			await interaction.deferReply({ ephemeral: session.ephemeral });
		}

		// If combat log was sent, use followUp for dialog message; otherwise editReply
		let dialogMessage;
		if (hasCombatLog) {
			dialogMessage = await interaction.followUp({
				...messageData,
				components: components.length > 0 ? components : [],
				ephemeral: session.ephemeral,
			});
		}
		else {
			await interaction.editReply({
				...messageData,
				components: components.length > 0 ? components : [],
			});
			dialogMessage = await interaction.fetchReply();
		}

		// Set up collector if there are components
		if (components.length > 0) {
			await this.setupCollector(session, eventBase, nextEventId, dialogMessage);
			return true;
		}
		else {
			// Event ends here - flush flags, schedule message deletion, clean up
			await this.flushPendingFlags(session);
			await this.saveSession(session);
			if (session.characterId) this.activeCharacters.delete(session.characterId);
			await this._scheduleDeletion(session.characterId, dialogMessage);
			return false;
		}
	}

	/**
	 * Set up reaction collector for option selection
	 */
	async setupReactionCollector(session, eventBase, defaultNextEventId, message, options) {
		const { interaction } = session;
		const userId = interaction.user.id;

		const collector = message.createReactionCollector({
			filter: (reaction, user) =>
				!user.bot &&
				user.id === userId &&
				NUMBER_EMOJIS.slice(0, options.length).includes(reaction.emoji.name),
			time: 600000, // 10 minutes
			max: 1,
		});

		collector.on('collect', async (reaction) => {
			try {
				// Clean up reactions
				await message.reactions.removeAll().catch(e => console.error('Failed to remove reactions:', e));

				const index = NUMBER_EMOJIS.indexOf(reaction.emoji.name);
				if (index === -1 || index >= options.length) return;

				const selectedOption = options[index];
				let nextEventId = defaultNextEventId;

				// Look up the full option data to find next event
				const optionData = contentStore.events.findByPk(String(eventBase.id));
				const option = optionData && optionData.option
					? optionData.option.find(o => o.id === selectedOption.id)
					: null;

				if (option?.next) {
					nextEventId = option.next;
				}

				// Handle save-X and clear-X tags
				if (session.characterId && eventBase.tag && Array.isArray(eventBase.tag)) {
					for (const tag of eventBase.tag) {
						if (tag.startsWith('save-')) {
							const settingName = tag.substring(5);
							if (settingName && option?.text) {
								const currentValue = await characterSettingUtil.getCharacterSetting(session.characterId, settingName);
								const newValue = currentValue
									? currentValue + ', "' + option.text.replace(/"/g, '\\"') + '"'
									: '"' + option.text.replace(/"/g, '\\"') + '"';
								await characterSettingUtil.setCharacterSetting(session.characterId, settingName, newValue);
							}
						}
						else if (tag.startsWith('clear-')) {
							const settingName = tag.substring(6);
							if (settingName) {
								await characterSettingUtil.setCharacterSetting(session.characterId, settingName, '');
							}
						}
					}
				}

				await this.saveSession(session);

				if (nextEventId && nextEventId !== '0' && nextEventId.trim() !== '') {
					await this.processEvent(nextEventId, interaction, session.characterId, {
						flags: session.flags,
						pendingCharacterFlags: session.pendingCharacterFlags,
						pendingGlobalFlags: session.pendingGlobalFlags,
						variables: session.variables,
						metadata: session.metadata,
						ephemeral: session.ephemeral,
						eventDepth: session.eventDepth + 1,
					});
				}
				else {
					// Event chain ended - flush flags, schedule message deletion
					await this.flushPendingFlags(session);
					await this._scheduleDeletion(session.characterId, message);
					this.activeEvents.delete(session.sessionId);
					if (session.characterId) this.activeCharacters.delete(session.characterId);
				}
			}
			catch (error) {
				console.error('Reaction collector error:', error);
				this.activeEvents.delete(session.sessionId);
				if (session.characterId) this.activeCharacters.delete(session.characterId);
			}
		});

		collector.on('end', (_, reason) => {
			if (reason === 'time') {
				message.reactions.removeAll().catch(() => {});
				this.activeEvents.delete(session.sessionId);
				if (session.characterId) this.activeCharacters.delete(session.characterId);
			}
		});
	}

	/**
	 * Set up message collector for user interaction
	 */
	async setupCollector(session, eventBase, defaultNextEventId, message = null) {
		const { interaction } = session;
		if (!message) {
			message = await interaction.fetchReply();
		}

		const collector = message.createMessageComponentCollector({
			time: 600000, // 10 minutes
			filter: i => i.user.id === interaction.user.id,
		});

		collector.on('collect', async (componentInteraction) => {
			try {
				let nextEventId = defaultNextEventId;

				if (componentInteraction.isStringSelectMenu()) {
					const selectedValue = componentInteraction.values[0];

					// Check if this is a shop interaction
					if (selectedValue.startsWith('shop_buy_') || selectedValue.startsWith('shop_learn_')) {
						if (selectedValue.startsWith('shop_buy_')) {
							// Show item preview before quantity modal
							await this.showShopItemPreview(componentInteraction, session, selectedValue);
						}
						else {
							// Perk: show quantity modal directly and await submission
							await this.showShopQuantityModal(componentInteraction, session, selectedValue);
							try {
								const modalSubmit = await componentInteraction.awaitModalSubmit({
									filter: i => i.customId === `shop_modal_${selectedValue}` && i.user.id === componentInteraction.user.id,
									time: 60_000,
								});
								await this.handleShopModalSubmit(modalSubmit, session);
							}
							catch (e) {
								// User cancelled or timed out — no action needed
							}
						}
						return; // Don't proceed to next event
					}

					// Regular option selected
					collector.stop();
					const selectedOptionId = selectedValue;
					const optionData = contentStore.events.findByPk(String(eventBase.id));
					const option = optionData && optionData.option
						? optionData.option.find(o => o.id === selectedOptionId)
						: null;

					if (option?.next) {
						nextEventId = option.next;
					}

					// Check if next event will need modal input - handle modal DIRECTLY
					if (nextEventId && nextEventId !== '0' && nextEventId.trim() !== '') {
						const nextEventNeedsInput = await this.eventHasInputActions(nextEventId);
						
						if (nextEventNeedsInput) {
							// Get the input action details from YAML
							const nextEventData = contentStore.events.findByPk(String(nextEventId));
							const nextActions = (nextEventData && nextEventData.action) || [];

							const inputAction = nextActions.find(a => a.type === 'variable' && a.source_type === VARIABLE_SOURCE.INPUT);
							
							if (inputAction) {
								// Create and show modal DIRECTLY - no event processing
								const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
								
								const modalId = `input_modal_${inputAction.variable_name}_${Date.now()}`;
								const modal = new ModalBuilder()
									.setCustomId(modalId)
									.setTitle((inputAction.input_label || 'Nh\u1EADp gi\u00E1 tr\u1ECB').substring(0, 45));

								const textInput = new TextInputBuilder()
									.setCustomId('input_value')
									.setLabel((inputAction.input_label || 'Nh\u1EADp gi\u00E1 tr\u1ECB').substring(0, 45))
									.setStyle(TextInputStyle.Short)
									.setRequired(true);

								if (inputAction.input_placeholder && inputAction.input_placeholder !== 'null') {
									textInput.setPlaceholder(inputAction.input_placeholder.substring(0, 100));
								}
								if (inputAction.input_default && inputAction.input_default !== 'null') {
									textInput.setValue(String(inputAction.input_default));
								}

								const actionRow = new ActionRowBuilder().addComponents(textInput);
								modal.addComponents(actionRow);
								
								try {
										// Show modal with fresh componentInteraction
										await componentInteraction.showModal(modal);
									// Wait for modal submission
									const modalSubmit = await componentInteraction.awaitModalSubmit({
										filter: i => i.customId === modalId && i.user.id === componentInteraction.user.id,
										time: 300_000,
									});
									
									// Get the input value
									const modalValue = modalSubmit.fields.getTextInputValue('input_value');
									
									// Parse as number if needed
									let finalValue = modalValue;
									if (inputAction.is_numeric) {
										const numValue = parseInt(modalValue);
										finalValue = isNaN(numValue) ? (parseInt(inputAction.input_default) || 0) : numValue;
									}
									
// Store in session variables so executeVariableAction won't show a second modal
								session.variables[inputAction.variable_name] = finalValue;

								// Save to character stats directly
									const statActions = nextActions.filter(a => a.type === 'stat');
									
									for (const statAction of statActions) {
										if (statAction.stat_name) {
											await characterUtil.setCharacterStat(session.characterId, statAction.stat_name, finalValue);
										}
									}
									
									// Handle tags
									if (session.characterId && eventBase.tag && Array.isArray(eventBase.tag)) {
										for (const tag of eventBase.tag) {
											if (tag.startsWith('save-')) {
												const settingName = tag.substring(5);
												if (settingName && option?.text) {
													const currentValue = await characterSettingUtil.getCharacterSetting(session.characterId, settingName);
													let newValue = currentValue ? 
														currentValue + ', "' + option.text.replace(/"/g, '\\"') + '"' :
														'"' + option.text.replace(/"/g, '\\"') + '"';
													await characterSettingUtil.setCharacterSetting(session.characterId, settingName, newValue);
												}
											}
											else if (tag.startsWith('clear-')) {
												const settingName = tag.substring(6);
												if (settingName) {
													await characterSettingUtil.setCharacterSetting(session.characterId, settingName, '');
												}
											}
										}
									}
									
									// Acknowledge modal submission
									await modalSubmit.update({ 
										content: '', 
										components: [] 
									});
									
									// Continue processing the event that had input actions
									session.currentEventId = nextEventId;
									await this.processEvent(nextEventId, modalSubmit, session.characterId, {
										flags: session.flags,
										pendingCharacterFlags: session.pendingCharacterFlags,
										pendingGlobalFlags: session.pendingGlobalFlags,
										variables: session.variables,
										eventDepth: session.eventDepth + 1,
									});
									return; // Event processing continues via processEvent
								}
								catch (error) {
									console.error('Modal input failed:', error);
									// Emergency acknowledgment
									if (!componentInteraction.replied && !componentInteraction.deferred) {
										await componentInteraction.reply({ 
											content: `${EMOJI.WARNING} Input failed, please try again.`,
											ephemeral: true 
										});
									}
									return;
								}
							}
							else {
								// No input action found, continue with normal processing
							}
						}
					}
					// Handle save-X and clear-X tags
					if (session.characterId && eventBase.tag && Array.isArray(eventBase.tag)) {
						for (const tag of eventBase.tag) {
							// Handle save-X tags
							if (tag.startsWith('save-')) {
								const settingName = tag.substring(5); // Remove 'save-' prefix
								if (settingName && option?.text) {
									// Get current setting value
									const currentValue = await characterSettingUtil.getCharacterSetting(session.characterId, settingName);
									let newValue;
									
									if (currentValue) {
										// Append to existing value in JSON array format
										newValue = currentValue + ', "' + option.text.replace(/"/g, '\\"') + '"';
									}
									else {
										// First entry
										newValue = '"' + option.text.replace(/"/g, '\\"') + '"';
									}
									
									await characterSettingUtil.setCharacterSetting(session.characterId, settingName, newValue);
								}
							}
							// Handle clear-X tags
							else if (tag.startsWith('clear-')) {
								const settingName = tag.substring(6); // Remove 'clear-' prefix
								if (settingName) {
									await characterSettingUtil.setCharacterSetting(session.characterId, settingName, '');
								}
							}
						}
					}
				}
				else if (componentInteraction.isModalSubmit()) {
					// Handle shop quantity modal submit
					if (componentInteraction.customId.startsWith('shop_modal_')) {
						await this.handleShopModalSubmit(componentInteraction, session);
						return; // Don't proceed to next event, keep shopping
					}
					collector.stop();
				}
				else if (componentInteraction.isButton()) {
					// Handle item preview confirm — show quantity modal and await submission
					if (componentInteraction.customId === 'shop_preview_confirm') {
						const previewValue = session.shopPreviewValue;
						await this.showShopQuantityModal(componentInteraction, session, previewValue);
						try {
							const modalSubmit = await componentInteraction.awaitModalSubmit({
								filter: i => i.customId === `shop_modal_${previewValue}` && i.user.id === componentInteraction.user.id,
								time: 60_000,
							});
							await this.handleShopModalSubmit(modalSubmit, session);
						}
						catch (e) {
							// User cancelled or timed out — no action needed
						}
						return;
					}
					// Handle item preview back — restore shop display
					if (componentInteraction.customId === 'shop_preview_back') {
						const snapshot = session.shopMessageSnapshot;
						const shopComponents = this.buildShopComponents(session);
						await componentInteraction.update({
							content: snapshot?.content || '',
							embeds: snapshot?.embeds || [],
							components: shopComponents,
						});
						session.shopPreviewValue = null;
						session.shopMessageSnapshot = null;
						return;
					}
					// Check for Leave Shop button
					if (componentInteraction.customId === 'shop_leave') {
						collector.stop();
						// Clear shop data and components
						session.shopData = null;
						await componentInteraction.update({ 
							content: `${EMOJI.WAVE} B\u1EA1n r\u1EDDi kh\u1ECFi c\u1EEDa h\u00E0ng.`,
							components: [],
						});
						this.activeEvents.delete(session.sessionId);
						if (session.characterId) this.activeCharacters.delete(session.characterId);
						return;
					}
					// Option button — customId format: event_opt_<sessionId>|<optionId>
					if (componentInteraction.customId.startsWith('event_opt_')) {
						collector.stop();
						const selectedOptionId = componentInteraction.customId.split('|')[1];
						const optionData = contentStore.events.findByPk(String(eventBase.id));
						const option = optionData && optionData.option
							? optionData.option.find(o => o.id === selectedOptionId)
							: null;
						if (option?.next) {
							nextEventId = option.next;
						}
						// Handle save-X and clear-X tags
						if (session.characterId && eventBase.tag && Array.isArray(eventBase.tag)) {
							for (const tag of eventBase.tag) {
								if (tag.startsWith('save-')) {
									const settingName = tag.substring(5);
									if (settingName && option?.text) {
										const currentValue = await characterSettingUtil.getCharacterSetting(session.characterId, settingName);
										const newValue = currentValue
											? currentValue + ', "' + option.text.replace(/"/g, '\\"') + '"'
											: '"' + option.text.replace(/"/g, '\\"') + '"';
										await characterSettingUtil.setCharacterSetting(session.characterId, settingName, newValue);
									}
								}
								else if (tag.startsWith('clear-')) {
									const settingName = tag.substring(6);
									if (settingName) {
										await characterSettingUtil.setCharacterSetting(session.characterId, settingName, '');
									}
								}
							}
						}
					}
					else {
						// Continue / other button uses default next event
						collector.stop();
					}
				}
				else {
					// Fallback for any other interaction type
					collector.stop();
				}

				// Process next event if exists and is not empty/blank
				if (nextEventId && nextEventId !== '0' && nextEventId.trim() !== '') {
					// Check if next event needs modal input BEFORE deferring.
					// showModal() requires a fresh (non-deferred, non-replied) interaction,
					// so we must NOT call deferUpdate() if the next event will show a modal.
					const nextEventNeedsInput = !componentInteraction.replied && !componentInteraction.deferred
						&& await this.eventHasInputActions(nextEventId);

					if (!nextEventNeedsInput) {
						// Normal processing - defer interaction and continue
						await componentInteraction.deferUpdate();
					}

					// Save session flags before proceeding
					await this.saveSession(session);

					await this.processEvent(nextEventId, componentInteraction, session.characterId, {
						flags: session.flags,
						pendingCharacterFlags: session.pendingCharacterFlags,
						pendingGlobalFlags: session.pendingGlobalFlags,
						variables: session.variables,
						metadata: session.metadata,
						ephemeral: session.ephemeral,
						eventDepth: session.eventDepth + 1,
					});
				}
				else {
					// Event chain ended - remove buttons, flush flags, schedule message deletion, clean up
					await componentInteraction.update({ components: [] });
					await this.flushPendingFlags(session);
					await this._scheduleDeletion(session.characterId, componentInteraction.message);
					await this.saveSession(session);
					this.activeEvents.delete(session.sessionId);
					if (session.characterId) this.activeCharacters.delete(session.characterId);
				}
			}
			catch (error) {
				console.error('Collector error:', error);
				this.activeEvents.delete(session.sessionId);
				if (session.characterId) this.activeCharacters.delete(session.characterId);
				await this.handleError(componentInteraction, error);
			}
		});

		collector.on('end', (_, reason) => {
			if (reason === 'time') {
				// Timeout - clear components since they're no longer functional
				message.edit({ components: [] }).catch(() => {});
				this.activeEvents.delete(session.sessionId);
				if (session.characterId) this.activeCharacters.delete(session.characterId);
			}
		});
	}

	/**
	 * Check if event has input actions that need fresh interaction for modals
	 */
	async eventHasInputActions(eventId) {
		try {
			const eventData = contentStore.events.findByPk(String(eventId));
			const actions = (eventData && eventData.action);
			if (!actions) return false;
			return actions.some(a => a.type === 'variable' && a.source_type === VARIABLE_SOURCE.INPUT);
		} catch (error) {
			console.error(`Error checking input actions for event ${eventId}:`, error);
			return false;
		}
	}

	/**
	 * Handle shop purchase/learn interactions
	 */
	async handleShopInteraction(componentInteraction, session, selectedValue) {
		const { CharacterBase, CharacterItem, CharacterPerk } = require('@root/dbObject.js');

		try {
			const character = await CharacterBase.findByPk(session.characterId);
			if (!character) {
				await componentInteraction.reply({
					content: `${EMOJI.FAILURE} Character not found.`,
					ephemeral: true,
				});
				return;
			}

			if (selectedValue.startsWith('shop_buy_')) {
				// Item purchase
				const itemId = selectedValue.replace('shop_buy_', '');
				const shopItem = session.shopData.items.find(i => String(i.itemId) === itemId);

				if (!shopItem) {
					await componentInteraction.reply({
						content: `${EMOJI.FAILURE} Item not found in shop.`,
						ephemeral: true,
					});
					return;
				}

				// Check if player has enough gold
				if (character.gold < shopItem.price) {
					await componentInteraction.reply({
						content: `${EMOJI.FAILURE} Not enough gold. You have ${character.gold} gold, but need ${shopItem.price}.`,
						ephemeral: true,
					});
					return;
				}

				// Check stock
				if (shopItem.amount !== null && shopItem.amount <= 0) {
					await componentInteraction.reply({
						content: `${EMOJI.FAILURE} Item is out of stock.`,
						ephemeral: true,
					});
					return;
				}

				// Deduct gold and give item
				await character.update({ gold: character.gold - shopItem.price });
				await characterUtil.addCharacterItem(session.characterId, itemId, 1);

				// Update stock if limited
				if (shopItem.maxStock !== null) {
					await NpcPurchase.findOrCreate({
						where: { npc_id: session.shopData.npcId, item_id: itemId },
						defaults: { purchased: 0 },
					}).then(([record]) => record.increment('purchased'));
					shopItem.amount -= 1;
				}

				await componentInteraction.reply({
					content: `${EMOJI.SUCCESS} Purchased **${shopItem.name}** for ${shopItem.price} gold!`,
					ephemeral: true,
				});
			}
			else if (selectedValue.startsWith('shop_learn_')) {
				// Perk learning
				const perkId = parseInt(selectedValue.replace('shop_learn_', ''));
				const shopPerk = session.shopData.perks.find(p => p.perkId === perkId || p.perkId === String(perkId));

				if (!shopPerk) {
					await componentInteraction.reply({
						content: `${EMOJI.FAILURE} Perk not found.`,
						ephemeral: true,
					});
					return;
				}

				// Check if already learning or completed this perk
				let charPerk = await CharacterPerk.findOne({
					where: { character_id: session.characterId, perk_id: perkId },
				});

				if (charPerk) {
					if (charPerk.status === 'equipped' || charPerk.status === 'available') {
						await componentInteraction.reply({
							content: `${EMOJI.FAILURE} You have already learned **${shopPerk.name}**.`,
							ephemeral: true,
						});
						return;
					}
					// Already learning - continue training
				}
				else {
					// Start learning new perk
					charPerk = await CharacterPerk.create({
						character_id: session.characterId,
						perk_id: perkId,
						stamina_spent: 0,
						status: 'learning',
					});
				}

				// Check stamina - use 1 stamina per training session
				const trainingCost = 1;
				if (character.currentStamina < trainingCost) {
					await componentInteraction.reply({
						content: `${EMOJI.FAILURE} Not enough stamina. You have ${character.currentStamina} stamina.`,
						ephemeral: true,
					});
					return;
				}

				// Train the perk
				await character.update({ currentStamina: character.currentStamina - trainingCost });
				const newStaminaSpent = charPerk.stamina_spent + trainingCost;
				
				// Check if perk is now fully learned
				if (newStaminaSpent >= shopPerk.staminaCost) {
					await charPerk.update({
						stamina_spent: newStaminaSpent,
						status: 'available',
					});
					await componentInteraction.reply({
						content: `🎉 You have mastered **${shopPerk.name}**! It is now available to equip.`,
						ephemeral: true,
					});
				}
				else {
					await charPerk.update({ stamina_spent: newStaminaSpent });
					const remaining = shopPerk.staminaCost - newStaminaSpent;
					await componentInteraction.reply({
						content: `📖 Training **${shopPerk.name}**... Progress: ${newStaminaSpent}/${shopPerk.staminaCost} stamina (${remaining} more needed).`,
						ephemeral: true,
					});
				}
			}
		}
		catch (error) {
			console.error('Shop interaction error:', error);
			await componentInteraction.reply({
				content: `${EMOJI.FAILURE} An error occurred during the transaction.`,
				ephemeral: true,
			});
		}
	}

	/**
	 * Show item preview embed with Confirm/Back buttons before quantity modal
	 */
	async showShopItemPreview(componentInteraction, session, selectedValue) {
		const itemId = selectedValue.replace('shop_buy_', '');
		const shopItem = session.shopData.items.find(i => String(i.itemId) === itemId);

		if (!shopItem) {
			await componentInteraction.reply({
				content: `${EMOJI.FAILURE} Item not found in shop.`,
				ephemeral: true,
			});
			return;
		}

		// Store for confirm button
		session.shopPreviewValue = selectedValue;

		// Snapshot original message to restore on Back
		const origMsg = componentInteraction.message;
		session.shopMessageSnapshot = {
			content: origMsg.content,
			embeds: origMsg.embeds,
		};

		// Use itemUtility for consistent item display
		const itemWithDetails = await itemUtility.getItemWithDetails(String(itemId));
		const embed = itemUtility.buildItemEmbed(itemWithDetails);

		// Append price and stock as extra fields
		embed.fields = embed.fields || [];
		embed.fields.push({ name: 'Price', value: `${shopItem.price} ${EMOJI.GOLD}`, inline: true });
		if (shopItem.amount !== null) {
			embed.fields.push({ name: 'In Stock', value: String(shopItem.amount), inline: true });
		}

		const confirmButton = new Discord.ButtonBuilder()
			.setCustomId('shop_preview_confirm')
			.setLabel('Buy')
			.setStyle(Discord.ButtonStyle.Success)
			.setEmoji(EMOJI.SHOP);

		const backButton = new Discord.ButtonBuilder()
			.setCustomId('shop_preview_back')
			.setLabel('Back')
			.setStyle(Discord.ButtonStyle.Secondary);

		const row = new Discord.ActionRowBuilder().addComponents(confirmButton, backButton);

		await componentInteraction.update({
			content: '',
			embeds: [embed],
			components: [row],
		});
	}

	/**
	 * Show modal for quantity input when purchasing/training
	 */	
	async showShopQuantityModal(componentInteraction, session, selectedValue) {
		const isItem = selectedValue.startsWith('shop_buy_');
		const id = isItem ? selectedValue.replace('shop_buy_', '') : parseInt(selectedValue.replace('shop_learn_', ''));

		// Get item/perk name for modal title
		let itemName = 'Item';
		if (isItem && session.shopData?.items) {
			const item = session.shopData.items.find(i => String(i.itemId) === id);
			if (item) itemName = item.name;
		}
		else if (!isItem && session.shopData?.perks) {
			const perk = session.shopData.perks.find(p => p.perkId === id || p.perkId === String(id));
			if (perk) itemName = perk.name;
		}

		const modal = new ModalBuilder()
			.setCustomId(`shop_modal_${selectedValue}`)
			.setTitle(isItem ? `Mua ${itemName}` : `Luy\u1EC7n ${itemName}`);

		const quantityInput = new TextInputBuilder()
			.setCustomId('quantity')
			.setLabel(isItem ? 'B\u1EA1n mu\u1ED1n mua bao nhi\u00EAu?' : 'B\u1EA1n mu\u1ED1n d\u00F9ng bao nhi\u00EAu stamina?')
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('Nh\u1EADp s\u1ED1 (v\u00ED d\u1EE5: 1, 5, 10)')
			.setRequired(true)
			.setMinLength(1)
			.setMaxLength(10);

		const actionRow = new ActionRowBuilder().addComponents(quantityInput);
		modal.addComponents(actionRow);

		await componentInteraction.showModal(modal);
	}

	/**
	 * Handle modal submit for shop quantity
	 */
	async handleShopModalSubmit(componentInteraction, session) {
		const { CharacterBase, CharacterItem, CharacterPerk } = require('@root/dbObject.js');

		try {
			const customId = componentInteraction.customId;
			const originalValue = customId.replace('shop_modal_', '');
			const quantityStr = componentInteraction.fields.getTextInputValue('quantity');
			const quantity = parseInt(quantityStr);

			if (isNaN(quantity) || quantity < 1) {
				await componentInteraction.reply({
					content: `${EMOJI.FAILURE} Please enter a valid positive number.`,
					ephemeral: true,
				});
				return;
			}

			const character = await CharacterBase.findByPk(session.characterId);
			if (!character) {
				await componentInteraction.reply({
					content: `${EMOJI.FAILURE} Character not found.`,
					ephemeral: true,
				});
				return;
			}

			if (originalValue.startsWith('shop_buy_')) {
				// Item purchase with quantity
				const itemId = originalValue.replace('shop_buy_', '');
				const shopItem = session.shopData.items.find(i => String(i.itemId) === itemId);

				if (!shopItem) {
					await componentInteraction.reply({
						content: `${EMOJI.FAILURE} Item not found in shop.`,
						ephemeral: true,
					});
					return;
				}

				const totalCost = shopItem.price * quantity;

				// Check if player has enough gold
				if (character.gold < totalCost) {
					const maxAffordable = Math.floor(character.gold / shopItem.price);
					await componentInteraction.reply({
						content: `${EMOJI.FAILURE} Not enough gold. You have ${character.gold} gold, but need ${totalCost} for ${quantity}x. You can afford ${maxAffordable}x.`,
						ephemeral: true,
					});
					return;
				}

				// Check stock
				if (shopItem.amount !== null && shopItem.amount < quantity) {
					await componentInteraction.reply({
						content: `${EMOJI.FAILURE} Not enough stock. Only ${shopItem.amount} available.`,
						ephemeral: true,
					});
					return;
				}

				// Deduct gold and give items
				await character.update({ gold: character.gold - totalCost });
				await characterUtil.addCharacterItem(session.characterId, itemId, quantity);

				// Update stock if limited
				if (shopItem.maxStock !== null) {
					await NpcPurchase.findOrCreate({
						where: { npc_id: session.shopData.npcId, item_id: itemId },
						defaults: { purchased: 0 },
					}).then(([record]) => record.increment('purchased', { by: quantity }));
					shopItem.amount -= quantity;
				}

				await componentInteraction.reply({
					content: `${EMOJI.SUCCESS} Purchased ${quantity}x **${shopItem.name}** for ${totalCost} gold! (Remaining gold: ${character.gold})`,
					ephemeral: true,
				});
			}
			else if (originalValue.startsWith('shop_learn_')) {
				// Perk training with quantity (stamina spent)
				const perkId = parseInt(originalValue.replace('shop_learn_', ''));
				const shopPerk = session.shopData.perks.find(p => p.perkId === perkId || p.perkId === String(perkId));

				if (!shopPerk) {
					await componentInteraction.reply({
						content: `${EMOJI.FAILURE} Perk not found.`,
						ephemeral: true,
					});
					return;
				}

				// Check if already learning or completed
				let charPerk = await CharacterPerk.findOne({
					where: { character_id: session.characterId, perk_id: perkId },
				});

				if (charPerk && (charPerk.status === 'equipped' || charPerk.status === 'available')) {
					await componentInteraction.reply({
						content: `${EMOJI.FAILURE} You have already learned **${shopPerk.name}**.`,
						ephemeral: true,
					});
					return;
				}

				if (!charPerk) {
					charPerk = await CharacterPerk.create({
						character_id: session.characterId,
						perk_id: perkId,
						stamina_spent: 0,
						status: 'learning',
					});
				}

				// Calculate how much stamina is actually needed
				const remaining = shopPerk.staminaCost - charPerk.stamina_spent;
				const actualStaminaToSpend = Math.min(quantity, remaining, character.currentStamina);

				if (actualStaminaToSpend <= 0) {
					if (character.currentStamina <= 0) {
						await componentInteraction.reply({
							content: `${EMOJI.FAILURE} You have no stamina left.`,
							ephemeral: true,
						});
					}
					else {
						await componentInteraction.reply({
							content: `${EMOJI.FAILURE} Training already complete. No more stamina needed.`,
							ephemeral: true,
						});
					}
					return;
				}

				// Spend stamina and train
				await character.update({ currentStamina: character.currentStamina - actualStaminaToSpend });
				const newStaminaSpent = charPerk.stamina_spent + actualStaminaToSpend;

				if (newStaminaSpent >= shopPerk.staminaCost) {
					await charPerk.update({
						stamina_spent: newStaminaSpent,
						status: 'available',
					});
					await componentInteraction.reply({
						content: `🎉 You spent ${actualStaminaToSpend} stamina and have mastered **${shopPerk.name}**! It is now available to equip.`,
						ephemeral: true,
					});
				}
				else {
					await charPerk.update({ stamina_spent: newStaminaSpent });
					const stillRemaining = shopPerk.staminaCost - newStaminaSpent;
					await componentInteraction.reply({
						content: `📖 Spent ${actualStaminaToSpend} stamina training **${shopPerk.name}**. Progress: ${newStaminaSpent}/${shopPerk.staminaCost} (${stillRemaining} more needed).`,
						ephemeral: true,
					});
				}
			}
		}
		catch (error) {
			console.error('Shop modal submit error:', error);
			await componentInteraction.reply({
				content: `${EMOJI.FAILURE} An error occurred during the transaction.`,
				ephemeral: true,
			});
		}
	}

	/**
	 * Save session flags to database
	 */
	async saveSession(session) {
		// Character flags are saved in real-time via setFlagValue
		// Global flags are saved in real-time via setFlagValue
		// Just clean up the session
		this.activeEvents.delete(session.sessionId);
	}

	/**
	 * Handle errors
	 */
	async handleError(interaction, error) {
		const errorEmbed = new Discord.EmbedBuilder()
			.setTitle(`${EMOJI.WARNING} Event Error`)
			.setDescription(error.message || 'Something went wrong.')
			.setColor(0xFF0000);

		try {
			if (interaction.replied || interaction.deferred) {
				await interaction.editReply({ embeds: [errorEmbed], components: [] });
			}
			else {
				await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
			}
		}
		catch (e) {
			console.error('Failed to send error:', e);
		}
	}
}

// Singleton instance
const eventProcessor = new EventProcessor();

module.exports = {
	processEvent: (eventId, interaction, characterId, sessionData) =>
		eventProcessor.processEvent(eventId, interaction, characterId, sessionData),

	// Legacy compatibility
	handleEvent: (eventId, interaction, characterId, sessionData) =>
		eventProcessor.processEvent(eventId, interaction, characterId, sessionData),

	evaluateInlineCheck: (checkData, session) =>
		eventProcessor.evaluateInlineCheck(checkData, session),

	/**
	 * Unlock a character that is stuck in an active event.
	 * Removes them from activeCharacters and purges any associated activeEvents sessions.
	 * @param {string} characterId - The Discord user/character ID to unlock.
	 * @returns {{ wasLocked: boolean }} Whether the character was actually locked.
	 */
	unlockCharacter(characterId) {
		const wasLocked = eventProcessor.activeCharacters.has(characterId);
		eventProcessor.activeCharacters.delete(characterId);

		// Also purge any lingering session entries for this character
		for (const [sessionId, session] of eventProcessor.activeEvents) {
			if (session.characterId === characterId) {
				eventProcessor.activeEvents.delete(sessionId);
			}
		}

		return { wasLocked };
	},

	isCharacterActive(characterId) {
		return eventProcessor.activeCharacters.has(characterId);
	},

	EventProcessor,
	eventProcessor,
};
