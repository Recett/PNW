const Discord = require('discord.js');
const {
	EventBase,
	EventMessage,
	EventCheck,
	EventCombat,
	EventEnemy,
	EventAction,
	EventOption,
	CharacterFlag,
	GlobalFlag,
	EnemyBase,
	NpcBase,
} = require('@root/dbObject.js');
const characterUtil = require('./characterUtility');
const locationUtil = require('./locationUtility');
const combatUtil = require('./combatUtility');
const { pronoun } = require('./generalUtility');
const { FLAG_TYPE } = require('../models/event/eventConstants');

/**
 * NEW EVENT UTILITY - Built for the modular event system
 *
 * Core Philosophy:
 * - Events are composed of modular components
 * - Each component handles its specific responsibility
 * - Maximum flexibility and reusability
 * - Clean separation of concerns
 */

class EventProcessor {
	constructor() {
		// Track active event sessions
		this.activeEvents = new Map();
	}

	/**
	 * Process event chain - INITIAL event processing only
	 * Stops at first event that requires user input
	 */
	async processEventChain(eventId, interaction, characterId = null, initialSessionData = {}) {
		// Initialize session data for the entire chain
		const session = {
			characterId,
			interaction,
			// Unique identifier for this session
			eventChainId: `${characterId}_${Date.now()}`,
			flags: {
				// Temporary flags for event chain only
				local: initialSessionData.flags?.local || {},
				// Persistent flags loaded from database
				character: {},
				global: {},
			},
			metadata: initialSessionData.metadata || {},
			ephemeral: initialSessionData.ephemeral !== false,
		};

		// Store session for later retrieval when user responds
		await this.storeSession(session);

		// Process the first event only
		const eventResult = await this.handleEvent(eventId, session);
		
		if (eventResult && eventResult.requiresUserInput) {
			// Event has options - session is stored, waiting for user response
			return {
				sessionId: session.eventChainId,
				awaitingInput: true,
				nextEventId: eventResult.nextEventId,
			};
		}
		else if (eventResult && eventResult.nextEventId) {
			// No user input required, continue with auto-progression
			return await this.continueEventChain(session, eventResult.nextEventId);
		}
		else {
			// Chain complete
			await this.finalizeEventChain(session);
			return { complete: true };
		}
	}

	/**
	 * Continue event chain processing for auto-progression events
	 */
	async continueEventChain(session, startEventId) {
		let currentEventId = startEventId;

		while (currentEventId && currentEventId !== '0') {
			const nextEventInfo = await this.handleEvent(currentEventId, session);
			
			if (nextEventInfo && nextEventInfo.requiresUserInput) {
				// Hit an event that needs user input - stop and wait
				await this.updateSession(session);
				return {
					sessionId: session.eventChainId,
					awaitingInput: true,
					nextEventId: nextEventInfo.nextEventId,
				};
			}
			else if (nextEventInfo) {
				const { nextEventId, delay } = nextEventInfo;
				
				// Apply delay if specified
				if (delay > 0) {
					await new Promise(resolve => setTimeout(resolve, delay * 1000));
				}
				
				// Continue with next event
				currentEventId = nextEventId;
			}
			else {
				// No more events in chain
				currentEventId = null;
			}
		}

		// Chain complete
		await this.finalizeEventChain(session);
		return { complete: true };
	}

	/**
	 * Resume event chain when user makes a choice
	 */
	async resumeEventChain(sessionId, userChoice) {
		const session = await this.retrieveSession(sessionId);
		if (!session) {
			throw new Error('Session not found or expired');
		}

		// Process the user's choice and get the next event
		const nextEventId = await this.processUserChoice(session, userChoice);
		
		if (nextEventId) {
			// Continue from the chosen path
			return await this.continueEventChain(session, nextEventId);
		}
		else {
			// Choice led to end of chain
			await this.finalizeEventChain(session);
			return { complete: true };
		}
	}

	/**
	 * Load character and global flags from database into session
	 */
	/**
	 * Flags are now loaded on-demand for memory efficiency.
	 * See checkFlag() and executeFlagAction() functions for lazy loading implementation.
	 */

	/**
	 * Session management for handling user choices
	 */
	async storeSession(session) {
		// Store session in memory with TTL (could be database for production)
		this.activeEvents.set(session.eventChainId, {
			...session,
			timestamp: Date.now(),
		});

		// Clean up old sessions (older than 30 minutes)
		const cutoff = Date.now() - (30 * 60 * 1000);
		for (const [id, storedSession] of this.activeEvents) {
			if (storedSession.timestamp < cutoff) {
				this.activeEvents.delete(id);
			}
		}
	}

	async retrieveSession(sessionId) {
		return this.activeEvents.get(sessionId);
	}

	async updateSession(session) {
		if (this.activeEvents.has(session.eventChainId)) {
			this.activeEvents.set(session.eventChainId, {
				...session,
				timestamp: Date.now(),
			});
		}
	}

	async finalizeEventChain(session) {
		// Save any modified flags to database
		await this.saveFlagsToDatabase(session);

		// Remove session from memory
		this.activeEvents.delete(session.eventChainId);
	}

	/**
	 * Process user choice and return next event ID
	 */
	async processUserChoice(session, userChoice) {
		// This would handle the user's option selection
		// and return the appropriate next event ID based on the choice
		// Implementation depends on how options are structured

		// For now, returning a placeholder
		return userChoice.nextEventId || null;
	}

	/**
	 * Save modified character and global flags back to database
	 */
	async saveFlagsToDatabase(session) {
		// Save character flags
		for (const [flagName, value] of Object.entries(session.flags.character)) {
			await characterUtil.updateCharacterFlag(session.characterId, flagName, value);
		}

		// Save global flags
		for (const [flagName, value] of Object.entries(session.flags.global)) {
			await GlobalFlag.upsert({
				flag: flagName,
				value: String(value),
			});
		}
	}

	/**
	 * Handles a single event (non-recursive)
	 */
	async handleEvent(eventId, session) {
		try {
			// Set current event ID in session
			session.eventId = eventId;

			// Get event base
			const eventBase = await this.getEventBase(eventId);
			if (!eventBase || !eventBase.is_active) {
				throw new Error(`Event ${eventId} not found or inactive`);
			}

			// Process event components in order
			const eventResult = await this.processEvent(eventBase, session);

			// Check if this event requires user input (has options)
			const hasOptions = await this.hasUserOptions(eventBase.id, session);
			
			if (hasOptions) {
				// Event has options - user input required
				return {
					requiresUserInput: true,
					nextEventId: eventBase.next_event_id,
					eventResult,
				};
			}
			else {
				// No user input required - return next event info
				return session.nextEvent || { nextEventId: eventBase.next_event_id };
			}

		}
		catch (error) {
			console.error('Event processing error:', error);
			await this.handleEventError(session.interaction, error);
			return null;
		}
	}

	/**
	 * Check if an event has user options that require input
	 */
	async hasUserOptions(eventId, session) {
		const options = await EventOption.findAll({
			where: { event_id: eventId },
		});

		if (!options || options.length === 0) {
			return false;
		}

		// Check if any options are visible based on check results
		for (const option of options) {
			const isVisible = await this.isOptionVisible(option, session);
			if (isVisible) {
				// At least one option is visible
				return true;
			}
		}

		// No visible options
		return false;
	}

	/**
	 * Check if an option is visible based on its requirements
	 */
	async isOptionVisible(option, session) {
		// Simple implementation - could be expanded based on option visibility rules
		// For now, assume all options are visible unless explicitly hidden
		return true;
	}

	/**
	 * Process a complete event with all its components
	 */
	async processEvent(eventBase, session) {
		// 1. Execute checks first
		const checkResults = await this.processEventChecks(eventBase.id, session);

		// 2. Execute actions based on check results
		await this.executeCheckResultActions(eventBase.id, session, checkResults);

		// 3. Get enemy information for preview
		const enemyInfo = await this.processEventEnemies(eventBase.id, session, checkResults);

		// 4. Process combat if present
		const combatResult = await this.processEventCombat(eventBase.id, session);

		// 5. Execute actions based on combat results
		if (combatResult && combatResult.result) {
			await this.executeCombatResultActions(eventBase.id, session, combatResult, checkResults);
		}

		// 6. Build and send message
		const messageData = await this.buildEventMessage(eventBase, session, checkResults, enemyInfo, combatResult);

		// 7. Get available options
		const options = await this.getAvailableOptions(eventBase.id, session, checkResults);

		// 8. Execute immediate actions
		await this.executeActions(eventBase.id, session, 'immediate', checkResults);

		// 9. Handle user interaction
		await this.handleUserInteraction(eventBase, session, messageData, options, checkResults);
	}

	/**
	 * Process all checks for an event
	 */
	async processEventChecks(eventId, session) {
		const checks = await EventCheck.findAll({
			where: { event_id: eventId },
			order: [['execution_order', 'ASC']],
		});

		const results = {};

		for (const check of checks) {
			try {
				const result = await this.executeCheck(check, session);
				results[check.check_name] = result;

				// If this is a required check and it failed, handle failure
				if (check.is_required && !result.success) {
					await this.handleCheckFailure(check, session, result);
					// Stop processing if required check fails
					return results;
				}
			}
			catch (error) {
				console.error(`Check ${check.check_name} failed:`, error);
				results[check.check_name] = { success: false, error: error.message };
			}
		}

		return results;
	}

	/**
	 * Execute a single check
	 */
	async executeCheck(check, session) {
		switch (check.check_type) {
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
			throw new Error(`Unknown check type: ${check.check_type}`);
		}
	}

	/**
	 * Check flag conditions
	 */
	async checkFlag(check, session) {
		if (!check.flag_data) {
			throw new Error('Flag check missing flag_data');
		}

		const { flag_name, flag_value, is_global_flag } = check.flag_data;
		let flagValue;

		if (is_global_flag) {
			// Check session cache first
			if (session.flags.global[flag_name] !== undefined) {
				flagValue = session.flags.global[flag_name];
			}
			else {
				// Not in cache, load from database
				const globalFlag = await GlobalFlag.findOne({ where: { flag: flag_name } });
				flagValue = globalFlag ? parseInt(globalFlag.value) : 0;
				// Cache the loaded value
				session.flags.global[flag_name] = flagValue;
			}
		}
		else if (session.characterId) {
			// Check session cache first
			if (session.flags.character[flag_name] !== undefined) {
				flagValue = session.flags.character[flag_name];
			}
			else {
				// Not in cache, load from database
				const charFlag = await CharacterFlag.findOne({
					where: { character_id: session.characterId, flag: flag_name },
				});
				flagValue = charFlag ? parseInt(charFlag.value) : 0;
				// Cache the loaded value
				session.flags.character[flag_name] = flagValue;
			}
		}
		else {
			// Local session flags
			flagValue = session.flags.local[flag_name] || 0;
		}

		const success = String(flagValue) === String(flag_value);

		return {
			success,
			value: flagValue,
			expected: flag_value,
			message: success ? check.success_message : check.failure_message,
		};
	}

	/**
	 * Check stat conditions (including dice rolls)
	 */
	async checkStat(check, session) {
		if (!check.stat_data) {
			throw new Error('Stat check missing stat_data');
		}

		if (!session.characterId) {
			return { success: false, message: 'No character for stat check' };
		}

		const character = await characterUtil.getCharacterBase(session.characterId);
		if (!character) {
			return { success: false, message: 'Character not found' };
		}

		const { stat_name, stat_comparison, stat_value, use_dice_roll } = check.stat_data;

		// Get stat value (this would need to be adapted to your stat system)
		const statValue = await this.getCharacterStat(character, stat_name);

		let success = false;
		let rollResult = null;

		if (use_dice_roll) {
			// Roll d100 and compare to stat
			rollResult = Math.floor(Math.random() * 100) + 1;
			const target = Math.max(1, statValue + check.difficulty_modifier);
			success = rollResult <= target;
		}
		else {
			// Direct comparison
			switch (stat_comparison) {
			case 'greater_than':
				success = statValue > stat_value;
				break;
			case 'less_than':
				success = statValue < stat_value;
				break;
			case 'equal':
				success = statValue === stat_value;
				break;
			case 'greater_equal':
				success = statValue >= stat_value;
				break;
			case 'less_equal':
				success = statValue <= stat_value;
				break;
			case 'dice_roll':
				rollResult = Math.floor(Math.random() * 100) + 1;
				success = rollResult <= statValue;
				break;
			default:
				throw new Error(`Unknown stat comparison: ${stat_comparison}`);
			}
		}

		return {
			success,
			statValue,
			rollResult,
			target: stat_value,
			message: success ? check.success_message : check.failure_message,
		};
	}

	/**
	 * Check item requirements - supports multiple items in one check
	 */
	async checkItem(check, session) {
		if (!check.item_data) {
			throw new Error('Item check missing item_data');
		}

		if (!session.characterId) {
			return { success: false, message: 'No character for item check' };
		}

		// item_data can be a single object or an array of objects
		const items = Array.isArray(check.item_data) ? check.item_data : [check.item_data];
		const results = [];
		let allSuccess = true;

		for (const itemReq of items) {
			const { item_id, required_quantity } = itemReq;
			
			// Check if player has the required items (only check, don't consume)
			const hasItem = await this.checkCharacterInventory(
				session.characterId,
				item_id,
				required_quantity,
			);

			results.push({
				item_id,
				required_quantity,
				success: hasItem,
			});

			if (!hasItem) {
				allSuccess = false;
			}
		}

		return {
			success: allSuccess,
			itemResults: results,
			message: allSuccess ? check.success_message : check.failure_message,
		};
	}

	/**
	 * Process enemy information for preview
	 */
	async processEventEnemies(eventId, session, checkResults) {
		const enemies = await EventEnemy.findAll({
			where: { event_id: eventId },
			order: [['display_order', 'ASC']],
		});

		const enemyInfo = [];

		for (const enemy of enemies) {
			// Check if enemy should be shown
			if (enemy.is_hidden) continue;

			// Check reveal conditions
			if (enemy.reveal_conditions && Object.keys(enemy.reveal_conditions).length > 0) {
				const shouldReveal = await this.checkRevealConditions(enemy.reveal_conditions, session, checkResults);
				if (!shouldReveal) continue;
			}

			// Get enemy data
			const enemyData = await this.getEnemyData(enemy);
			enemyInfo.push(enemyData);
		}

		return enemyInfo;
	}

	/**
	 * Process combat if present in the event
	 */
	async processEventCombat(eventId, session) {
		const combat = await EventCombat.findOne({
			where: { event_id: eventId },
		});

		if (!combat) {
			// No combat for this event
			return null;
		}

		// Check if combat should auto-resolve
		if (combat.auto_resolve) {
			return await this.autoResolveCombat(combat, session);
		}

		// For interactive combat, we'll prepare the combat data
		// and let the user choose whether to engage
		return {
			combatConfig: combat,
			isInteractive: true,
			canFlee: combat.can_flee,
		};
	}

	/**
	 * Auto-resolve combat without player interaction
	 */
	async autoResolveCombat(combat, session) {
		if (!session.characterId) {
			return {
				result: 'error',
				message: 'No character found for combat',
			};
		}

		try {
			// Handle different combat types
			if (combat.combat_type === 'enemy' && combat.enemy_ids && combat.enemy_ids.length > 0) {
				// For now, fight the first enemy (can be expanded for group combat)
				const enemyId = combat.enemy_ids[0];
				const combatResult = await combatUtil.mainCombat(session.characterId, enemyId);

				// Determine winner
				const playerWon = combatResult.finalState.player && combatResult.finalState.player.hp > 0;
				const enemyWon = combatResult.finalState.enemy && combatResult.finalState.enemy.hp > 0;

				return {
					result: playerWon ? 'victory' : (enemyWon ? 'defeat' : 'draw'),
					combatLog: combatResult.combatLog,
					battleReport: combatResult.battleReport,
					finalState: combatResult.finalState,
					message: playerWon ? combat.victory_message :
						(enemyWon ? combat.defeat_message : combat.draw_message),
				};
			}

			// Handle other combat types (NPC, group, boss) in the future
			return {
				result: 'error',
				message: 'Unsupported combat type: ' + combat.combat_type,
			};
		}
		catch (error) {
			console.error('Combat resolution error:', error);
			return {
				result: 'error',
				message: 'An error occurred during combat resolution',
			};
		}
	}

	/**
	 * Get detailed enemy information
	 */
	async getEnemyData(enemyConfig) {
		let enemyBase;

		if (enemyConfig.enemy_type === 'enemy') {
			enemyBase = await EnemyBase.findOne({ where: { id: enemyConfig.enemy_id } });
		}
		else if (enemyConfig.enemy_type === 'npc') {
			enemyBase = await NpcBase.findOne({ where: { id: enemyConfig.enemy_id } });
		}

		if (!enemyBase) return null;

		return {
			name: enemyConfig.display_name || enemyBase.name,
			description: enemyConfig.display_description || enemyBase.description,
			avatar: enemyConfig.display_avatar || enemyBase.avatar,
			illustration: enemyConfig.display_illustration || enemyBase.illustration,
			threatLevel: enemyConfig.threat_level,
			warningMessage: enemyConfig.warning_message,
			previewNotes: enemyConfig.preview_notes,
			showHealth: enemyConfig.show_health,
			showLevel: enemyConfig.show_level,
			showStats: enemyConfig.show_stats,
			showAbilities: enemyConfig.show_abilities,
			showWeaknesses: enemyConfig.show_weaknesses,
			showResistances: enemyConfig.show_resistances,
			baseData: enemyBase,
		};
	}

	/**
	 * Build the Discord message for the event
	 */
	async buildEventMessage(eventBase, session, checkResults, enemyInfo, combatResult) {
		// Get event message component
		const eventMessage = await EventMessage.findOne({ where: { event_id: eventBase.id } });

		if (!eventMessage) {
			// No message component, event is purely mechanical
			return null;
		}

		// Check display conditions
		if (eventMessage.display_conditions && Object.keys(eventMessage.display_conditions).length > 0) {
			const shouldDisplay = await this.checkDisplayConditions(eventMessage.display_conditions, session, checkResults);
			if (!shouldDisplay) return null;
		}

		const embed = new Discord.EmbedBuilder();

		// Set title
		if (eventMessage.title) {
			embed.setTitle(eventMessage.title);
		}

		// Handle NPC speaker
		if (eventMessage.npc_speaker) {
			const npc = await EnemyBase.findOne({ where: { id: eventMessage.npc_speaker } });
			if (npc) {
				embed.setAuthor({ name: npc.name, iconURL: npc.avatar });
			}
		}

		// Process text with pronoun substitution
		let text = eventMessage.text || '';
		if (text && session.characterId) {
			const character = await characterUtil.getCharacterBase(session.characterId);
			if (character) {
				text = pronoun(text, character.age, character.gender);
			}
		}

		// Add check results to text if any failed
		const failedChecks = Object.entries(checkResults).filter(([, result]) => !result.success);
		if (failedChecks.length > 0) {
			const failureMessages = failedChecks
				.map(([, result]) => result.message)
				.filter(msg => msg);
			if (failureMessages.length > 0) {
				text += '\n\n' + failureMessages.join('\n');
			}
		}

		embed.setDescription(text);

		// Set images
		if (eventMessage.avatar) {
			embed.setThumbnail(eventMessage.avatar);
		}
		if (eventMessage.illustration) {
			embed.setImage(eventMessage.illustration);
		}

		// Add enemy information as fields
		if (enemyInfo && enemyInfo.length > 0) {
			enemyInfo.forEach((enemy) => {
				let enemyText = '';

				if (enemy.description) {
					enemyText += enemy.description + '\n';
				}

/* 				if (enemy.threatLevel) {
					enemyText += `**Threat Level:** ${enemy.threatLevel}\n`;
				} */

				if (enemy.warningMessage) {
					enemyText += `*${enemy.warningMessage}*\n`;
				}

				// Add visible stats/abilities based on config
/* 				if (enemy.showStats && enemy.showStats.length > 0) {
					enemyText += `**Visible Stats:** ${enemy.showStats.join(', ')}\n`;
				}

				if (enemy.showAbilities && enemy.showAbilities.length > 0) {
					enemyText += `**Known Abilities:** ${enemy.showAbilities.join(', ')}\n`;
				} */

				embed.addFields({
					name: `${enemy.name}`,
					value: enemyText || 'A mysterious opponent...',
					inline: false,
				});
			});
		}

		// Add combat result information if present
		if (combatResult) {
			if (combatResult.result === 'victory') {
				embed.addFields({
					name: '⚔️ Combat Victory!',
					value: combatResult.message || 'You emerged victorious from combat!',
					inline: false,
				});

				if (combatResult.battleReport) {
					// Add battle details in a code block to preserve formatting
					embed.addFields({
						name: '📜 Battle Report',
						value: '```\n' + combatResult.battleReport.substring(0, 800) + '\n```',
						inline: false,
					});
				}
			}
			else if (combatResult.result === 'defeat') {
				embed.addFields({
					name: '💀 Combat Defeat',
					value: combatResult.message || 'You were defeated in combat...',
					inline: false,
				});
			}
			else if (combatResult.result === 'draw') {
				embed.addFields({
					name: '⚖️ Combat Draw',
					value: combatResult.message || 'The combat ended in a stalemate.',
					inline: false,
				});
			}
			else if (combatResult.result === 'error') {
				embed.addFields({
					name: '⚠️ Combat Error',
					value: combatResult.message || 'An error occurred during combat.',
					inline: false,
				});
			}
			else if (combatResult.isInteractive) {
				embed.addFields({
					name: '⚔️ Combat Available',
					value: `A ${combatResult.combatConfig.combat_type} encounter awaits! ${combatResult.canFlee ? 'You can choose to flee if needed.' : 'Victory or defeat - there is no escape!'}`,
					inline: false,
				});
			}
		}

		return { embeds: [embed] };
	}

	/**
	 * Get available options for the player
	 */
	async getAvailableOptions(eventId, session, checkResults) {
		const options = await EventOption.findAll({
			where: { event_id: eventId },
			order: [['display_order', 'ASC']],
		});

		const availableOptions = [];

		for (const option of options) {
			// Check if option should be visible
			const isVisible = await this.checkOptionVisibility(option, session, checkResults);
			if (isVisible) {
				availableOptions.push(option);
			}
		}

		return availableOptions;
	}

	/**
	 * Check if an option should be visible to the player
	 */
	async checkOptionVisibility(option, session, checkResults) {
		// Check required checks
		if (option.required_checks && option.required_checks.length > 0) {
			for (const checkName of option.required_checks) {
				if (!checkResults[checkName] || !checkResults[checkName].success) {
					return false;
				}
			}
		}

		// Check hidden checks (these must fail for option to show)
		if (option.hidden_checks && option.hidden_checks.length > 0) {
			for (const checkName of option.hidden_checks) {
				if (checkResults[checkName] && checkResults[checkName].success) {
					return false;
				}
			}
		}

		return true;
	}

	/**
	 * Handle user interaction with options
	 */
	async handleUserInteraction(eventBase, session, messageData, options, checkResults) {
		if (!messageData) {
			// No message to display, just execute any remaining actions
			await this.executeActions(eventBase.id, session, 'immediate', checkResults);
			return;
		}

		let components = [];

		if (options && options.length > 0) {
			// Create select menu for choices
			const selectMenu = new Discord.StringSelectMenuBuilder()
				.setCustomId(`event_choice_${eventBase.id}`)
				.setPlaceholder(eventBase.choose_placeholder || 'Choose your action...');

			options.forEach((option, index) => {
				selectMenu.addOptions(
					new Discord.StringSelectMenuOptionBuilder()
						.setLabel(`${index + 1}. ${option.text}`)
						.setDescription(option.description || undefined)
						.setValue(option.option_id)
						.setEmoji(option.emoji || undefined),
				);
			});

			components.push(new Discord.ActionRowBuilder().addComponents(selectMenu));
		}
		else {
			// No options, just a continue button
			const button = new Discord.ButtonBuilder()
				.setCustomId(`event_continue_${eventBase.id}`)
				.setLabel('Continue')
				.setStyle(Discord.ButtonStyle.Primary);

			components.push(new Discord.ActionRowBuilder().addComponents(button));
		}

		// Send message
		await this.sendEventMessage(session, messageData, components);

		// Set up collector for user response
		await this.setupEventCollector(eventBase, session, checkResults);
	}

	/**
	 * Send the event message to Discord
	 */
	async sendEventMessage(session, messageData, components) {
		const { interaction } = session;

		if (!(interaction.replied || interaction.deferred)) {
			await interaction.deferReply({
				ephemeral: session.ephemeral,
			});
		}

		await interaction.editReply({
			...messageData,
			components: components.length > 0 ? components : undefined,
		});
	}

	/**
	 * Set up collector for user responses
	 */
	async setupEventCollector(eventBase, session, checkResults) {
		const { interaction } = session;
		const message = await interaction.fetchReply();

		const collector = message.createMessageComponentCollector({
			// 10 minutes
			time: 600000,
			filter: i => i.user.id === interaction.user.id,
		});

		collector.on('collect', async (componentInteraction) => {
			try {
				if (componentInteraction.isStringSelectMenu()) {
					const selectedOptionId = componentInteraction.values[0];
					await this.handleOptionSelected(eventBase, session, selectedOptionId, checkResults, componentInteraction);
				}
				else if (componentInteraction.isButton()) {
					await this.handleContinuePressed(eventBase, session, checkResults, componentInteraction);
				}
			}
			catch (error) {
				console.error('Collector error:', error);
				await this.handleEventError(componentInteraction, error);
			}
		});

		collector.on('end', () => {
			// Clean up if needed
		});
	}

	/**
	 * Handle when player selects an option
	 */
	async handleOptionSelected(eventBase, session, optionId, checkResults, componentInteraction) {
		// Execute actions for this option
		await this.executeActions(eventBase.id, session, 'option_selected', checkResults, optionId);

		// Clean up current message
		await componentInteraction.update({ components: [] });
	}

	/**
	 * Handle continue button press
	 */
	async handleContinuePressed(eventBase, session, checkResults, componentInteraction) {
		// Execute any remaining actions
		await this.executeActions(eventBase.id, session, 'immediate', checkResults);

		// Clean up current message
		await componentInteraction.update({ components: [] });
	}

	/**
	 * Execute actions based on trigger conditions
	 */
	async executeActions(eventId, session, triggerCondition, checkResults, optionId = null, checkName = null) {
		const actions = await EventAction.findAll({
			where: {
				event_id: eventId,
				trigger_condition: triggerCondition,
			},
			order: [['execution_order', 'ASC']],
		});

		for (const action of actions) {
			// Check if action should execute
			if (action.required_check_name) {
				// For check-based triggers, match the specific check name
				if (checkName && action.required_check_name !== checkName) {
					continue;
				}
				// For other triggers, verify the check succeeded
				const checkResult = checkResults[action.required_check_name];
				if (!checkResult || !checkResult.success) continue;
			}

			if (action.required_option_id && action.required_option_id !== optionId) {
				continue;
			}

			// Execute the action
			await this.executeAction(action, session);
		}
	}

	/**
	 * Execute actions based on check results
	 */
	async executeCheckResultActions(eventId, session, checkResults) {
		// Execute actions for successful checks
		for (const [checkName, result] of Object.entries(checkResults)) {
			if (result.success) {
				await this.executeActions(eventId, session, 'check_success', checkResults, null, checkName);
			}
			else {
				await this.executeActions(eventId, session, 'check_failure', checkResults, null, checkName);
			}
		}
	}

	/**
	 * Execute actions based on combat results
	 */
	async executeCombatResultActions(eventId, session, combatResult, checkResults) {
		if (combatResult.result === 'victory') {
			await this.executeActions(eventId, session, 'combat_victory', checkResults);
		}
		else if (combatResult.result === 'defeat') {
			await this.executeActions(eventId, session, 'combat_defeat', checkResults);
		}
		// Note: 'draw' and 'error' results could be added as trigger conditions if needed
	}

	/**
	 * Execute a single action
	 */
	async executeAction(action, session) {
		switch (action.action_type) {
		case 'flag':
			await this.executeFlagAction(action, session);
			break;
		case 'item':
			await this.executeItemAction(action, session);
			break;
		case 'stat':
			await this.executeStatAction(action, session);
			break;
		case 'status':
			await this.executeStatusAction(action, session);
			break;
		case 'move':
			await this.executeMoveAction(action, session);
			break;
		case 'event':
			await this.executeEventAction(action, session);
			break;
		case 'exp':
			await this.executeExpAction(action, session);
			break;
		default:
			console.warn(`Unknown action type: ${action.action_type}`);
		}
	}

	/**
	 * Execute flag modification action
	 */
	async executeFlagAction(action, session) {
		const flagName = action.flag_name;
		const flagType = action.flag_type !== undefined ? action.flag_type :
			(action.is_global_flag ? FLAG_TYPE.GLOBAL : FLAG_TYPE.CHARACTER);
		
		let currentValue = 0;

		// Get current value based on flag type - check cache first, then database
		switch (flagType) {
		case FLAG_TYPE.LOCAL:
			currentValue = session.flags.local[flagName] || 0;
			break;
		case FLAG_TYPE.CHARACTER:
			// Check session cache first
			if (session.flags.character[flagName] !== undefined) {
				currentValue = session.flags.character[flagName];
			}
			else {
				// Not in cache, load from database
				const charFlag = await CharacterFlag.findOne({
					where: { character_id: session.characterId, flag: flagName },
				});
				currentValue = charFlag ? parseInt(charFlag.value) : 0;
				// Cache the loaded value
				session.flags.character[flagName] = currentValue;
			}
			break;
		case FLAG_TYPE.GLOBAL:
			// Check session cache first
			if (session.flags.global[flagName] !== undefined) {
				currentValue = session.flags.global[flagName];
			}
			else {
				// Not in cache, load from database
				const globalFlag = await GlobalFlag.findOne({ where: { flag: flagName } });
				currentValue = globalFlag ? parseInt(globalFlag.value) : 0;
				// Cache the loaded value
				session.flags.global[flagName] = currentValue;
			}
			break;
		default:
			console.warn(`Unknown flag type: ${flagType}`);
			currentValue = session.flags.character[flagName] || 0;
		}

		let newValue = currentValue;

		switch (action.flag_operation) {
		case 'set':
			newValue = parseInt(action.flag_value);
			break;
		case 'add':
			newValue = currentValue + parseInt(action.flag_value);
			break;
		case 'subtract':
			newValue = currentValue - parseInt(action.flag_value);
			break;
		case 'toggle':
			newValue = currentValue ? 0 : 1;
			break;
		}

		// Update the flag based on type (only modify session, DB save happens at end)
		switch (flagType) {
		case FLAG_TYPE.LOCAL:
			session.flags.local[flagName] = newValue;
			break;
		case FLAG_TYPE.CHARACTER:
			session.flags.character[flagName] = newValue;
			break;
		case FLAG_TYPE.GLOBAL:
			session.flags.global[flagName] = newValue;
			break;
		}

		if (action.action_message) {
			console.log(`Flag action: ${action.action_message}`);
		}
	}

	/**
	 * Execute event chaining action
	 */
	async executeEventAction(action, session) {
		if (action.next_event_id) {
			// Store next event info to be processed after current event completes
			// If multiple event actions exist, the last one wins
			session.nextEvent = {
				nextEventId: action.next_event_id,
				delay: action.event_delay || 0,
				// Pass current session data to next event
				sessionData: session,
			};
		}
	}

	/**
	 * Handle errors gracefully
	 */
	async handleEventError(interaction, _error) {
		const errorEmbed = new Discord.EmbedBuilder()
			.setTitle('⚠️ Event Error')
			.setDescription('Something went wrong processing this event.')
			.setColor(0xFF0000);

		try {
			if (interaction.replied || interaction.deferred) {
				await interaction.editReply({ embeds: [errorEmbed], components: [] });
			}
			else {
				await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
			}
		}
		catch (replyError) {
			console.error('Failed to send error message:', replyError);
		}
	}

	// Utility methods for database operations
	async getEventBase(eventId) {
		return await EventBase.findOne({ where: { id: eventId } });
	}

	async getCharacterStat(character, statName) {
		return await characterUtil.getCharacterStat(character, statName);
	}

	async checkCharacterInventory(characterId, itemId, quantity) {
		return await characterUtil.checkCharacterInventory(characterId, itemId, quantity);
	}

	async checkRevealConditions(conditions, session, checkResults) {
		// Implement reveal condition logic
		// For now, return true as placeholder
		return true;
	}

	async checkDisplayConditions(conditions, session, checkResults) {
		// Implement display condition logic
		// For now, return true as placeholder
		return true;
	}

	async consumeItem(characterId, itemId, quantity) {
		// Implement item consumption logic
		console.log(`Consuming ${quantity} of item ${itemId} from character ${characterId}`);
	}

	async applyPendingChanges(session) {
		// Apply any pending changes that weren't applied immediately
		console.log('Applying pending changes...');
	}

	async handleCheckFailure(check, session, result) {
		// Handle when a required check fails
		console.log(`Required check ${check.check_name} failed: ${result.message}`);
	}

	// Placeholder methods for other action types
	async executeItemAction(action, session) {
		if (!action.item_id) {
			console.warn('Item action missing item_id');
			return;
		}

		// Use item_operation if specified, otherwise fall back to legacy quantity-based logic
		if (action.item_operation) {
			switch (action.item_operation) {
			case 'give':
				// Add specified quantity
				if (action.quantity && action.quantity > 0) {
					await characterUtil.addCharacterItem(
						session.characterId,
						action.item_id,
						action.quantity,
					);
				}
				break;
			case 'take':
				// Remove specified quantity
				if (action.quantity && action.quantity > 0) {
					await characterUtil.removeCharacterItem(
						session.characterId,
						action.item_id,
						action.quantity,
					);
				}
				break;
			case 'set':
				// Set to exact quantity
				if (action.quantity !== undefined) {
					await characterUtil.setCharacterItemQuantity(
						session.characterId,
						action.item_id,
						action.quantity,
					);
				}
				break;
			case 'remove_all':
				// Remove all of this item regardless of current quantity
				await characterUtil.removeAllCharacterItem(
					session.characterId,
					action.item_id,
				);
				break;
			default:
				console.warn(`Unknown item operation: ${action.item_operation}`);
			}
		}
		else if (action.item_id && action.quantity) {
			// Legacy quantity-based logic for backward compatibility
			if (action.quantity > 0) {
				// Add item
				await characterUtil.addCharacterItem(
					session.characterId,
					action.item_id,
					action.quantity,
				);
			}
			else {
				// Remove item
				await characterUtil.removeCharacterItem(
					session.characterId,
					action.item_id,
					Math.abs(action.quantity),
				);
			}
		}
	}

	async executeStatAction(action, session) {
		if (action.stat_name && action.value !== undefined) {
			await characterUtil.modifyCharacterStat(
				session.characterId,
				action.stat_name,
				action.value,
			);
		}
	}

	async executeStatusAction(action, session) {
		if (action.status_name) {
			if (action.action_type === 'add') {
				await characterUtil.addCharacterStatus(
					session.characterId,
					action.status_name,
					action.status_type || 'temporary',
					action.value || '',
				);
			}
			else if (action.action_type === 'remove') {
				await characterUtil.removeCharacterStatus(
					session.characterId,
					action.status_name,
				);
			}
		}
	}

	async executeMoveAction(action, session) {
		if (action.location_id) {
			await locationUtil.moveCharacterToLocation(
				session.characterId,
				action.location_id,
				session.guild,
			);
		}
	}

	async executeExpAction(action, session) {
		if (action.exp && action.exp > 0) {
			await characterUtil.addCharacterExperience(
				session.characterId,
				action.exp,
			);
		}

		if (action.skill_exp && typeof action.skill_exp === 'object') {
			await characterUtil.addCharacterSkillExperience(
				session.characterId,
				action.skill_exp,
			);
		}
	}

	async checkSkill(check, session) {
		if (!check.skill_data) {
			throw new Error('Skill check missing skill_data');
		}

		const { skill_id, required_level } = check.skill_data;

		const success = await characterUtil.checkCharacterSkill(
			session.characterId,
			skill_id,
			required_level || 1,
		);
		return {
			success,
			message: success ? check.success_message || 'Skill check passed' : check.failure_message || 'Skill check failed',
		};
	}

	async checkLevel(check, session) {
		if (!check.level_data) {
			throw new Error('Level check missing level_data');
		}

		const { required_level } = check.level_data;

		const success = await characterUtil.checkCharacterLevel(
			session.characterId,
			required_level || 1,
		);
		return {
			success,
			message: success ? check.success_message || 'Level check passed' : check.failure_message || 'Level check failed',
		};
	}

	/**
	 * Check random chance
	 */
	async checkRandom(check, session) {
		if (!check.random_data) {
			throw new Error('Random check missing random_data');
		}

		const { success_chance } = check.random_data;
		const roll = Math.floor(Math.random() * 100) + 1;
		const success = roll <= success_chance;

		return {
			success,
			roll,
			success_chance,
			message: success ? check.success_message || 'Random check succeeded' : check.failure_message || 'Random check failed',
		};
	}
}

// Create singleton instance
const eventProcessor = new EventProcessor();

// Export the main functions for backward compatibility
module.exports = {
	// New modular event system - primary functions
	processEventChain: (eventId, interaction, characterId, sessionData) =>
		eventProcessor.processEventChain(eventId, interaction, characterId, sessionData),
	resumeEventChain: (sessionId, userChoice) =>
		eventProcessor.resumeEventChain(sessionId, userChoice),

	// Legacy compatibility functions (adapt old calls to new system)
	handleEvent: (eventId, interaction, characterId, sessionData) =>
		eventProcessor.processEventChain(eventId, interaction, characterId, sessionData),
	getEventBase: (eventId) => eventProcessor.getEventBase(eventId),

	// Utility exports
	EventProcessor,
	eventProcessor,
};
