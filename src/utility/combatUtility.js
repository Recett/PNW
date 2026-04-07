// Utility functions for handling combat logic
const contentStore = require('@root/contentStore.js');
const characterUtility = require('./characterUtility');
const itemUtility = require('./itemUtility');
const { getCharacterSetting } = require('./characterSettingUtility');

// Named ambient combat effects. Referenced by name in YAML: combat.ambient_effect
const AMBIENT_EFFECTS = {
	bilge_gas: {
		interval: 50,        // fires every N ticks
		stat: 'con',         // stat used for the save roll
		difficulty: 5,       // d1000 target = statValue * difficulty * 10
		label: 'Bilge Miasma',
	},
};

// Discord embed description character limit
const DISCORD_MESSAGE_LIMIT = 4000;

/**
 * Calculate total attack stat for a character (including STR and weapon)
 */
async function getAttackStat(characterId) {
	await characterUtility.calculateAttackStat(characterId);
	const { CharacterAttackStat } = require('@root/dbObject.js');
	return await CharacterAttackStat.findAll({ where: { character_id: characterId } });
}

/**
 * Calculate total defense stat for a character (including CON and equipped armor), update db
 */
async function getDefenseStat(characterId) {
	await characterUtility.calculateCombatStat(characterId);
	const { CharacterCombatStat } = require('@root/dbObject.js');
	return await CharacterCombatStat.findOne({ where: { character_id: characterId } });
}

/**
 * Perform a basic attack roll (returns damage dealt)
 */
async function performAttack(attackerId, defenderId) {
	const attackStats = await getAttackStat(attackerId);
	const defenseStats = await getDefenseStat(defenderId);

	// Get first attack stat if multiple exist
	const attack = attackStats && attackStats.length > 0 ? attackStats[0].attack : 0;
	const defense = defenseStats ? defenseStats.defense : 0;

	// Simple formula: damage = attack - defense (minimum 0)
	return Math.max(0, attack - defense);
}

// --- Initiative Tracker System ---
/**
 * @param {Array} actors Array of combatants. Each actor must have:
 *   - id: unique identifier
 *   - name: (optional) for logs
 *   - attacks: array of { id, name, speed, cooldown, attackFn }
 *   - hp: starting HP
 * @param {Object} options { maxTicks, onAttack }
 * @returns {Object} { combatLog, actors: final state }
 */
function calculateDamage(attacker, tracker, target, ignoreDefense = false, critMultiplier = 1) {
	let attackVal = tracker.attack || 0;
	const defenseVal = ignoreDefense ? 0 : (target.defense || 0);

	// DEX/STR damage variance (player-only — attacker must have str and dex).
	// Variance applied pre-defense on the raw attack value.
	// DEX = 0.5× STR → min attack 50%.  DEX = 2× STR → min attack 100% (no variance).
	// Linear interpolation between those two anchor points.
	if (attackVal > 0 && attacker.str != null && attacker.dex != null) {
		const str = attacker.str || 1;
		const dex = attacker.dex || 0;
		const ratio = dex / str;
		const t = Math.min(1, Math.max(0, (ratio - 0.5) / 1.5));
		const minFraction = 0.5 + 0.5 * t;
		const minAttack = Math.floor(attackVal * minFraction);
		attackVal = minAttack + Math.floor(Math.random() * (attackVal - minAttack + 1));
	}

	const baseDamage = Math.max(0, attackVal - defenseVal);
	return Math.floor(baseDamage * critMultiplier);
}

async function runInitTracker(actors, options = {}) {
	const maxTicks = options.maxTicks || 400;
	const combatLog = [];

	// Track initiative and HP for each attack
	const attackTrackers = [];
	const actorMap = {};
	for (const actor of actors) {
		actorMap[actor.id] = { ...actor };
		for (const attack of actor.attacks) {
			attackTrackers.push({
				actorId: actor.id,
				actorName: actor.name || actor.id,
				attackId: attack.id,
				attackName: attack.name || attack.id,
				speed: attack.speed,
				cooldown: attack.cooldown,
				// Add small random starting initiative to stagger attacks
				// initBonus (e.g. longbow: 8×Dex) is added on top for a head-start
				initiative: Math.floor(Math.random() * (attack.speed || 10)) + (attack.initBonus || 0),
				attack: attack.attack,
				accuracy: attack.accuracy,
				crit: attack.crit,
				isShield: attack.isShield || false,
				isGreatshield: attack.isGreatshield || false,
				// firstStrikeReady: the very first attack from a bonus-initiative weapon is called "First Strike"
				firstStrikeReady: (attack.initBonus || 0) > 0,
			});
		}
	}

	for (let tick = 1; tick <= maxTicks; tick++) {
		for (const tracker of attackTrackers) {
			tracker.initiative += tracker.speed;
			while (tracker.initiative >= tracker.cooldown) {
				// Only two actors: actors[0] and actors[1]
				const attacker = actorMap[tracker.actorId];
				const target = tracker.actorId === actors[0].id ? actorMap[actors[1].id] : actorMap[actors[0].id];
				if (!attacker || !target || target.hp <= 0) break;

				// === Call skill triggers: Before Attack ===
				if (options.handleBeforeAttackSkills) {
					await options.handleBeforeAttackSkills(attacker, target, tracker, options);
				}

				// Calculate hit rate
				const tohit = tracker.accuracy || 0;
				const evd = target.evade || 1;
				let hitRate = 100;
				const rate = evd / tohit;
				if (rate >= 4) {
					hitRate = 0;
				}
				else {
					const x = (rate - 1) / 3;
					hitRate = ((1 - x) / (1 + x)) * 100;
				}
				const roll = Math.floor(Math.random() * 100);
				const hitResult = roll < hitRate;
				let crit = false;
				let critResisted = false;
				let critResistedDamage = 0;
				let damage = 0;
				let shieldGranted = 0;
				let shieldAbsorbed = 0;
				let isShieldAction = tracker.isShield || false;
				
				if (hitResult) {
					// Check if this is a shield attack - grants shield instead of dealing damage
					if (isShieldAction) {
						// Shield attack: grant shield buff to attacker instead of damaging target
						const shieldValue = tracker.attack || 0;
						attacker.shieldStrength = (attacker.shieldStrength || 0) + shieldValue;
						attacker.shieldIsGreatshield = tracker.isGreatshield || false;
						shieldGranted = shieldValue;
						// No damage dealt, no crit possible for shield actions
					}
					else {
						// Crit calculation with crit resistance
						// CritRate is per 1000 (e.g., 60% = 600)
						// CritResistance is also per 1000 (e.g., 10% = 100)
						const critStat = tracker.crit || 0;
						let critRate = critStat > 0 ? critStat : 0;
						critRate = hitRate > 0 ? critRate * hitRate / 100 : critRate;
						// Convert crit resistance percentage to per-1000 scale
						const targetCritResist = (target.critResistance || 0) * 10;
						
						const critRoll = Math.random() * 1000;
						
						if (critRoll < critRate) {
							// Would be a crit - check if resisted
							if (critRoll < targetCritResist) {
								// Crit resisted! Becomes normal hit
								critResisted = true;
								const critDamage = calculateDamage(attacker, tracker, target, true, 2);
								const normalDamage = calculateDamage(attacker, tracker, target);
								// Track damage prevented: crit damage - normal damage (includes defense bypass)
								critResistedDamage = critDamage - normalDamage;
								damage = normalDamage;
							}
							else {
								// Actual crit
								crit = true;
								damage = calculateDamage(attacker, tracker, target, true, 2);
							}
						}
						else {
							// Normal hit (no crit)
							damage = calculateDamage(attacker, tracker, target);
						}
						
						// === Apply shield damage reduction ===
						if (target.shieldStrength > 0 && damage > 0) {
							if (target.shieldIsGreatshield) {
								// Greatshield: only reduce by damage absorbed, not consumed entirely
								shieldAbsorbed = Math.min(target.shieldStrength, damage);
								damage -= shieldAbsorbed;
								target.shieldStrength -= shieldAbsorbed;
							}
							else {
								// Regular shield: fully consumed on hit
								shieldAbsorbed = Math.min(target.shieldStrength, damage);
								damage -= shieldAbsorbed;
								// Shield fully consumed
								target.shieldStrength = 0;
							}
						}
						
						// Protected user: HP cannot drop below 1 in combat
						const hpFloor = target.userId === '275992469764833280' ? 1 : 0;
						target.hp = Math.max(hpFloor, target.hp - damage);
					}
				}
				// === Call skill triggers: After Attack ===
				if (options.handleAfterAttackSkills) {
					await options.handleAfterAttackSkills(attacker, target, tracker, { hit: hitResult, crit, critResisted, damage });
				}

				// Resolve attack display name — first attack from a bonus-initiative weapon is "First Strike"
				let attackDisplayName = tracker.attackName;
				if (tracker.firstStrikeReady) {
					attackDisplayName = 'First Strike';
					tracker.firstStrikeReady = false;
				}

				combatLog.push({
					tick,
					attacker: tracker.actorName,
					attackerId: tracker.actorId,
					target: target.name || target.id,
					targetId: target.id,
					attack: attackDisplayName,
					attackValue: tracker.attack || 0,
					targetDefense: target.defense || 0,
					hitRate,
					roll,
					hit: hitResult,
					crit,
					critResisted,
					critResistedDamage,
					damage,
					targetHp: target.hp,
					isShieldAction,
					shieldGranted,
					shieldAbsorbed,
					attackerShield: attacker.shieldStrength || 0,
					targetShield: target.shieldStrength || 0,
				});
				tracker.initiative -= tracker.cooldown;
				if (target.hp <= 0) break;
			}
		}
		// === Ambient effect tick ===
		if (options.ambientEffect && tick % options.ambientEffect.interval === 0) {
			const effect = options.ambientEffect;
			const playerActor = actorMap[actors[0].id === 'player' ? actors[0].id : actors[1].id];
			if (playerActor && playerActor.id === 'player') {
				const conVal = playerActor.con || 0;
				const dcTarget = Math.min(1000, Math.floor(conVal * effect.difficulty * 10));
				const roll = Math.floor(Math.random() * 1000) + 1;
				const passed = roll <= dcTarget;

				if (!passed) {
					const stacks = playerActor.miasmaStacks || 0;
					const damage = stacks * Math.floor((playerActor.maxHp || 100) / 100);
					if (damage > 0) {
						// Protected user: HP cannot drop below 1 in combat
						const hpFloor = playerActor.userId === '275992469764833280' ? 1 : 0;
						playerActor.hp = Math.max(hpFloor, playerActor.hp - damage);
					}
					playerActor.miasmaStacks = stacks + 1;
					combatLog.push({
						tick,
						type: 'ambient',
						label: effect.label,
						checkPassed: false,
						damage,
						stacks,
						targetHp: playerActor.hp,
					});
					if (playerActor.hp <= 0) break;
				}
				else {
					combatLog.push({
						tick,
						type: 'ambient',
						label: effect.label,
						checkPassed: true,
						damage: 0,
						stacks: playerActor.miasmaStacks || 0,
						targetHp: playerActor.hp,
					});
				}
			}
		}

		// End combat if all but one actor is dead
		const alive = Object.values(actorMap).filter(a => a.hp > 0);
		if (alive.length <= 1) break;
	}

	return { combatLog, actors: actorMap };
}

async function mainCombat(playerId, enemyId, options = {}) {
	if (!playerId) throw new Error('Player ID is required for combat');
	if (!enemyId) throw new Error('Enemy ID is required for combat');

	// Calculate defense/weight first so overweight penalty is current when attack stats are computed
	const playerCombatStats = await getDefenseStat(playerId);

	const playerAttacks = await getAttackStat(playerId);
	if (!playerAttacks || playerAttacks.length === 0) throw new Error('Player has no attacks');

	// Get Enemy base info and stats from YAML content store
	const enemyBase = contentStore.enemies.findByPk(String(enemyId));
	if (!enemyBase) throw new Error('Enemy not found');

	const enemyBaseStat = enemyBase.stat;
	if (!enemyBaseStat) throw new Error('Enemy stats not found');

	// Get Enemy attacks from embedded YAML data
	let enemyAttacks = enemyBase.attack;
	if (!enemyAttacks || enemyAttacks.length === 0) {
		throw new Error('Enemy has no attacks');
	}

	// If enemy has "pick_one" tag, randomly select a single attack at combat start
	const enemyTags = Array.isArray(enemyBase.tag) ? enemyBase.tag : [];
	if (enemyTags.includes('pick_one') && enemyAttacks.length > 1) {
		const pickedIndex = Math.floor(Math.random() * enemyAttacks.length);
		enemyAttacks = [enemyAttacks[pickedIndex]];
	}

	const playerBase = await characterUtility.getCharacterBase(playerId);
	if (!playerBase) throw new Error('Player not found');

	// Get player's agility/speed from combat stats
	const playerSpeed = playerCombatStats ? (playerCombatStats.speed || 15) : 15;

	const player = {
		id: 'player',
		name: playerBase.name || 'Player',
		userId: playerId,
		hp: playerBase.currentHp ?? playerBase.maxHp ?? 100,
		defense: playerCombatStats?.defense || 0,
		evade: playerCombatStats?.evade || 0,
		critResistance: playerCombatStats?.crit_resistance || 0,
		shieldStrength: 0,
		shieldIsGreatshield: false,
		con: playerBase.con || 0,
		str: playerBase.str || 0,
		dex: playerBase.dex || 0,
		maxHp: playerBase.maxHp || 100,
		miasmaStacks: 0,     // populated below from DB flag if ambient effect is active
		attacks: await Promise.all(playerAttacks.map(async (atk) => {
			// Get weapon name and type info from ItemLib if item_id exists
			let attackName = 'Attack';
			let isShield = false;
			let isGreatshield = false;
			let isLongbow = false;
			if (atk.item_id) {
				const itemDetails = await itemUtility.getItemWithDetails(atk.item_id);
				if (itemDetails) {
					attackName = itemDetails.name;
					const subtype = itemDetails.weapon?.subtype?.toLowerCase();
					// Check if weapon is a shield type
					if (subtype === 'shield') {
						isShield = true;
						// Check for greatshield tag in item tags
						if (itemDetails.tag) {
							const tags = Array.isArray(itemDetails.tag) ? itemDetails.tag : [itemDetails.tag];
							isGreatshield = tags.some(t => t && t.toLowerCase().includes('greatshield'));
						}
					}
					// Check if weapon is a longbow
					else if (subtype === 'longbow') {
						isLongbow = true;
					}
				}
			}
			else {
				attackName = 'Unarmed';
			}

			return {
				id: atk.item_id || atk.id,
				name: attackName,
				// Use player's agility for speed, weapon speed as modifier
				speed: playerSpeed,
				// Use cooldown from database
				cooldown: atk.cooldown || 80,
				attack: atk.attack || 0,
				accuracy: atk.accuracy || 0,
				crit: atk.critical || 0,
				isShield: isShield,
				isGreatshield: isGreatshield,
				// Longbow: 8× Dex added to starting initiative (fires First Strike before normal rhythm)
				initBonus: isLongbow ? 8 * (playerBase.dex || 0) : 0,
			};
		})),
	};

	const enemy = {
		id: 'enemy',
		name: enemyBase.name || enemyBase.fullname || 'Unknown Enemy',
		hp: options.enemyStartHp != null ? options.enemyStartHp : (enemyBaseStat.health || 100),
		defense: enemyBaseStat.defense || 0,
		evade: enemyBaseStat.evade || 0,
		critResistance: enemyBaseStat.crit_resistance || 0,
		shieldStrength: 0,
		shieldIsGreatshield: false,
		attacks: enemyAttacks.map(atk => {
			return {
				id: atk.id,
				name: atk.name || 'Attack',
				// Use enemy's speed from base stats
				speed: enemyBaseStat.speed || 12,
				cooldown: Math.max(10, atk.cooldown || 90),
				attack: atk.base_damage || 0,
				accuracy: atk.accuracy || 0,
				crit: atk.critical_chance || 0,
			};
		}),
	};

	// Load miasma stacks from DB if this combat has a bilge ambient effect
	const ambientEffectName = options.ambientEffect || null;
	const ambientEffect = ambientEffectName ? (AMBIENT_EFFECTS[ambientEffectName] || null) : null;
	if (ambientEffect) {
		const { CharacterStatus } = require('@root/dbObject.js');
		const miasmaRow = await CharacterStatus.findOne({ where: { character_id: playerId, source: 'bilge' } });
		player.miasmaStacks = miasmaRow ? (miasmaRow.potency || 0) : 0;
	}

	// === Call skill triggers: Combat Begin ===
	await handleCombatBeginSkills([player, enemy]);

	// Patch runInitTracker to support skill hooks
	const { combatLog, actors } = await runInitTracker(
		[player, enemy],
		{
			maxTicks: 400,
			ambientEffect,
			handleBeforeAttackSkills,
			handleAfterAttackSkills,
		},
	);

	// === Call skill triggers: Combat End ===
	await handleCombatEndSkills(Object.values(actors));

	// Save miasma stacks back to DB if they changed during combat
	if (ambientEffect && actors.player) {
		const newStacks = actors.player.miasmaStacks || 0;
		if (newStacks !== player.miasmaStacks) {
			const { CharacterStatus } = require('@root/dbObject.js');
			if (newStacks === 0) {
				await CharacterStatus.destroy({ where: { character_id: playerId, source: 'bilge' } });
			}
			else {
				const [miasmaStatus, created] = await CharacterStatus.findOrCreate({
					where: { character_id: playerId, source: 'bilge' },
					defaults: {
						category: 'debuff',
						scope: 'persistent',
						potency: newStacks,
					},
				});
				if (!created) {
					await miasmaStatus.update({ potency: newStacks });
				}
			}
		}
	}

	// === Handle combat end rewards (gold, exp, items, weapon skill XP) ===
	const lootResults = await handleCombatEnd(playerId, enemyId, actors, combatLog, player.attacks);

	// Get player's combat_log setting
	const combatLogSetting = await getCharacterSetting(playerId, 'combat_log') || 'short';

	// Update player's HP in the database
	if (actors.player) {
		await characterUtility.setCharacterStat(playerId, 'currentHp', actors.player.hp);

		// If player was knocked out, apply a 12-hour knocked_out status
		if (actors.player.hp <= 0) {
			const { CharacterStatus } = require('@root/dbObject.js');
			const expiresAt = new Date(Date.now() + 12 * 3600 * 1000);
			await CharacterStatus.upsert({
				character_id: playerId,
				status_id: 'knocked_out',
				category: 'debuff',
				scope: 'persistent',
				duration_unit: 'seconds',
				expires_at: expiresAt,
			}, { conflictFields: ['character_id', 'status_id'] });
		}
	}

	// Generate battle report with appropriate format
	const battleReportResult = writeBattleReport(combatLog, actors, lootResults, combatLogSetting);

	return {
		combatLog,
		finalState: actors,
		battleReport: battleReportResult.pages ? battleReportResult.pages[0] : battleReportResult,
		battleReportPages: battleReportResult.pages || [battleReportResult],
		lootResults,
	};
}

// --- Skill Trigger Handlers ---

/**
 * Handle skills that trigger when combat begins.
 * @param {Array} actors - All combatants
 * @param {Object} options - Combat options
 */
async function handleCombatBeginSkills(actors) {
	// Implement skill logic here
	// Using actors parameter to avoid lint warning
	if (actors && actors.length > 0) {
		// Future skill implementation goes here
	}
}

/**
 * Handle skills that trigger before an attack.
 * @param {Object} attacker - The attacking actor
 * @param {Object} defender - The defending actor
 * @param {Object} attack - The attack object
 * @param {Object} options - Combat options
 */
async function handleBeforeAttackSkills(attacker, defender, attack) {
	// Implement skill logic here
	// Using parameters to avoid lint warning
	if (attacker && defender && attack) {
		// Future skill implementation goes here
	}
}

/**
 * Handle skills that trigger after an attack.
 * @param {Object} attacker - The attacking actor
 * @param {Object} defender - The defending actor
 * @param {Object} attack - The attack object
 * @param {Object} result - The result of the attack (damage, crit, etc.)
 * @param {Object} options - Combat options
 */
async function handleAfterAttackSkills(attacker, defender, attack, result) {
	// Implement skill logic here
	// Using parameters to avoid lint warning
	if (attacker && defender && attack && result) {
		// Future skill implementation goes here
	}
}

/**
 * Handle skills that trigger when combat ends.
 * @param {Array} actors - All combatants
 * @param {Object} options - Combat options
 */
async function handleCombatEndSkills(actors) {
	// Implement skill logic here
	// Using actors parameter to avoid lint warning
	if (actors && actors.length > 0) {
		// Future skill implementation goes here
	}
}

/**
 * Calculate total damage dealt per weapon from combat log
 * For shield weapons, tracks shield granted instead of damage dealt
 * @param {Array} combatLog - The combat log entries
 * @param {Array} playerAttacks - The player's attack data with weapon info
 * @returns {Object} Map of item_id -> { damage: number, attackName: string, isShield: boolean, shieldGranted: number }
 */
async function calculateWeaponDamage(combatLog, playerAttacks) {
	const weaponDamageMap = {};
	
	// Create a map of attack name -> { itemId, isShield } from playerAttacks
	const attackNameToInfo = {};
	for (const attack of playerAttacks) {
		if (attack.name) {
			// Use 'unarmed' as a special key for unarmed attacks
			attackNameToInfo[attack.name] = {
				itemId: attack.id || 'unarmed',
				isShield: attack.isShield || false,
			};
		}
	}
	
	// Track total shield absorbed for the player (to distribute to shield weapons)
	let totalShieldAbsorbed = 0;
	
	// Aggregate damage per weapon from combat log
	for (const log of combatLog) {
		// Track shield damage absorbed when player is the target
		if (log.targetId === 'player' && log.shieldAbsorbed > 0) {
			totalShieldAbsorbed += log.shieldAbsorbed;
		}
		
		// Only count player attacks/actions by checking if the attack name is in our map
		const attackInfo = attackNameToInfo[log.attack];
		if (attackInfo && log.hit) {
			const key = attackInfo.itemId || 'unarmed';
			if (!weaponDamageMap[key]) {
				weaponDamageMap[key] = {
					damage: 0,
					attackName: log.attack,
					isShield: attackInfo.isShield,
					shieldGranted: 0,
				};
			}
			
			if (attackInfo.isShield) {
				// Shield weapons track shield granted
				weaponDamageMap[key].shieldGranted += (log.shieldGranted || 0);
			}
			else if (log.damage > 0) {
				// Regular weapons track damage dealt
				weaponDamageMap[key].damage += log.damage;
			}
		}
	}
	
	// Add shield absorbed to shield weapons for XP calculation
	// Distribute total absorbed damage across all equipped shields
	const shieldWeapons = Object.entries(weaponDamageMap).filter(([, data]) => data.isShield);
	if (shieldWeapons.length > 0 && totalShieldAbsorbed > 0) {
		const absorbedPerShield = Math.floor(totalShieldAbsorbed / shieldWeapons.length);
		for (const [key] of shieldWeapons) {
			weaponDamageMap[key].damage = absorbedPerShield;
		}
	}
	
	return weaponDamageMap;
}

/**
 * Calculate armor damage stats from combat log (damage dodged and reduced when player is attacked)
 * Dodged damage is calculated "after armor" - higher defense means less XP from dodges
 * Crit resisted damage also counts as mitigation (bonus crit damage + defense bypass prevented)
 * @param {Array} combatLog - The combat log entries
 * @returns {Object} { damageDodged: number, damageReduced: number, critResistedTotal: number }
 */
function calculateArmorDamageStats(combatLog) {
	let damageDodged = 0;
	let damageReduced = 0;
	let critResistedTotal = 0;
	
	for (const log of combatLog) {
		// Only count attacks targeting the player
		if (log.targetId === 'player') {
			const attackValue = log.attackValue || 0;
			const targetDefense = log.targetDefense || 0;
			
			if (!log.hit) {
				// Attack missed - count damage "after armor" as dodged
				// This means higher defense = less XP from dodging
				const potentialDamage = Math.max(0, attackValue - targetDefense);
				damageDodged += potentialDamage;
			}
			else {
				// Attack hit - check for crit resisted damage
				if (log.critResisted && log.critResistedDamage > 0) {
					// Crit was resisted - this prevented both bonus crit damage AND defense bypass
					critResistedTotal += log.critResistedDamage;
				}
				
				// Normal damage reduction from armor (only for non-crit hits)
				if (!log.crit) {
					const reduced = Math.max(0, attackValue - log.damage);
					damageReduced += reduced;
				}
			}
		}
	}
	
	return { damageDodged, damageReduced, critResistedTotal };
}

/**
 * Get equipped armor pieces grouped by subtype with counts
 * @param {string} playerId - The player's character ID
 * @returns {Object} Map of armor_subtype -> { count: number, skillName: string }
 */
async function getEquippedArmorTypes(playerId) {
	const equippedArmor = await itemUtility.getCharacterEquippedArmor(playerId);
	
	// Group by subtype and count
	const armorTypeCount = {};
	for (const eq of equippedArmor) {
		const itemDetails = await itemUtility.getItemWithDetails(eq.item_id);
		if (itemDetails?.armor?.subtype) {
			const subtype = itemDetails.armor.subtype;
			if (!armorTypeCount[subtype]) {
				armorTypeCount[subtype] = { count: 0, skillName: subtype };
			}
			armorTypeCount[subtype].count++;
		}
	}
	
	return armorTypeCount;
}

/**
 * Apply armor skill XP based on damage dodged, reduced, and crit resisted
 * Formula: XP = (log10(Damage + 1) × 100) / (Level + 1) × armorPieceCount
 * @param {string} playerId - The player's character ID
 * @param {Object} armorDamageStats - { damageDodged: number, damageReduced: number, critResistedTotal: number }
 * @param {Object} armorTypeCount - Map of armor_subtype -> { count: number, skillName: string }
 * @returns {Object} Map of skill_name -> xp gained
 */
async function applyArmorSkillXp(playerId, armorDamageStats, armorTypeCount) {
	const { CharacterSkill } = require('@root/dbObject.js');
	const contentStore = require('@root/contentStore.js');
	const skillXpGained = {};
	
	// Total damage value for XP calculation (dodged + reduced + crit resisted)
	const totalDamageValue = armorDamageStats.damageDodged + armorDamageStats.damageReduced + (armorDamageStats.critResistedTotal || 0);
	
	if (totalDamageValue <= 0) {
		return skillXpGained;
	}
	
	for (const [, armorData] of Object.entries(armorTypeCount)) {
		// Find skill by armor subtype
		const skill = contentStore.skills.findOne({
			where: { subtype: armorData.skillName },
		});
		
		if (!skill) continue;
		
		// Get current skill level for the player
		const characterSkill = await CharacterSkill.findOne({
			where: { character_id: playerId, skill_id: skill.id },
		});
		const currentLevel = characterSkill?.lv || 0;
		
		// Calculate base XP using formula: XP = (log10(Damage + 1) × 100) / (Level + 1)
		const baseXp = Math.floor((Math.log10(totalDamageValue + 1) * 100) / (currentLevel + 1));
		
		// Multiply by number of armor pieces of this type
		const xpGained = baseXp * armorData.count;
		
		if (xpGained > 0) {
			// Add XP to skill
			await characterUtility.addCharacterSkillExperience(playerId, { [skill.id]: xpGained });
			
			// Track for return
			if (!skillXpGained[skill.name]) {
				skillXpGained[skill.name] = 0;
			}
			skillXpGained[skill.name] += xpGained;
		}
	}
	
	return skillXpGained;
}

/**
 * Apply weapon skill XP based on damage dealt
 * Formula: XP = (log10(Damage + 1) × 100) / (Level + 1)
 * @param {string} playerId - The player's character ID
 * @param {Object} weaponDamageMap - Map of item_id -> { damage: number, attackName: string }
 * @returns {Object} Map of skill_name -> xp gained
 */
async function applyWeaponSkillXp(playerId, weaponDamageMap) {
	const { CharacterSkill } = require('@root/dbObject.js');
	const contentStore = require('@root/contentStore.js');
	const skillXpGained = {};
	
	for (const [itemId, weaponData] of Object.entries(weaponDamageMap)) {
		let skillName = null;
		
		// Handle unarmed attacks specially
		if (weaponData.attackName === 'Unarmed') {
			skillName = 'Unarmed';
		}
		else {
			// Skip if no valid item_id
			if (!itemId || itemId === 'null' || itemId === 'undefined') continue;
			
			// Get weapon info including subtype
			const itemDetails = await itemUtility.getItemWithDetails(itemId);
			if (!itemDetails?.weapon?.subtype) continue;
			
			skillName = itemDetails.weapon.subtype;
		}
		
		// Find skill by subtype
		const skill = contentStore.skills.findOne({
			where: { subtype: skillName },
		});
		
		if (!skill) continue;
		
		// Get current skill level for the player
		const characterSkill = await CharacterSkill.findOne({
			where: { character_id: playerId, skill_id: skill.id },
		});
		const currentLevel = characterSkill?.lv || 0;
		
		// Calculate XP using formula: XP = (log10(Damage + 1) × 100) / (Level + 1)
		const damage = weaponData.damage;
		const xpGained = Math.floor((Math.log10(damage + 1) * 100) / (currentLevel + 1));
		
		if (xpGained > 0) {
			// Add XP to skill
			await characterUtility.addCharacterSkillExperience(playerId, { [skill.id]: xpGained });
			
			// Track for return
			if (!skillXpGained[skill.name]) {
				skillXpGained[skill.name] = 0;
			}
			skillXpGained[skill.name] += xpGained;
		}
	}
	
	return skillXpGained;
}

/**
 * Handle combat end rewards (gold, exp, item loot, weapon/armor skill XP) after combat ends.
 * Called after handleCombatEndSkills.
 * @param {string} playerId - The player's character ID
 * @param {string} enemyId - The enemy's base ID
 * @param {Object} actors - The final state of all combatants
 * @param {Array} combatLog - The combat log with attack details
 * @param {Array} playerAttacks - The player's attack data with weapon info
 * @returns {Object} Loot results { gold, exp, items: [...], leveledUp, weaponSkillXp: {...}, armorSkillXp: {...} }
 */
async function handleCombatEnd(playerId, enemyId, actors, combatLog = [], playerAttacks = []) {
	const lootResults = {
		gold: 0,
		exp: 0,
		items: [],
		playerVictory: false,
		leveledUp: false,
		weaponSkillXp: {},
		armorSkillXp: {},
	};

	// Check if player won (enemy HP <= 0 and player HP > 0)
	const playerActor = actors.player || actors[playerId];
	const enemyActor = actors.enemy || actors[enemyId];

	if (!playerActor || !enemyActor) {
		return lootResults;
	}

	// Player must be alive and enemy must be defeated
	if (playerActor.hp <= 0 || enemyActor.hp > 0) {
		return lootResults;
	}

	lootResults.playerVictory = true;

	// Get enemy reward data from YAML content store
	const enemyBase = contentStore.enemies.findByPk(String(enemyId));
	if (!enemyBase || !enemyBase.reward) {
		return lootResults;
	}

	const reward = enemyBase.reward;

	// Get player and enemy levels for XP calculation
	const playerBase = await characterUtility.getCharacterBase(playerId);
	const playerLevel = playerBase?.level || 1;
	const mobLevel = enemyBase.level || enemyBase.lv || 1;

	// Handle gold reward
	if (reward.gold && reward.gold > 0) {
		lootResults.gold = reward.gold;
		// Add gold to character
		await characterUtility.modifyCharacterStat(playerId, 'gold', reward.gold);
	}

	// Handle experience reward (always given on victory, calculated from levels)
	// XP Gained = max(1, [100 / √(player_level)] × (mob_level / player_level)^1.2)
	const baseXp = 100 / Math.sqrt(playerLevel);
	const levelRatio = Math.pow(mobLevel / playerLevel, 1.2);
	const calculatedXp = Math.max(1, Math.floor(baseXp * levelRatio));

	lootResults.exp = calculatedXp;

	// Add experience to character and check for level up
	const expResult = await characterUtility.addCharacterExperience(playerId, calculatedXp);

	// Include level up info in loot results
	if (expResult.leveledUp) {
		lootResults.leveledUp = true;
		lootResults.oldLevel = expResult.oldLevel;
		lootResults.newLevel = expResult.newLevel;
		lootResults.levelsGained = expResult.levelsGained;
		lootResults.freeStatPointsGained = expResult.freeStatPointsGained;
		lootResults.totalFreeStatPoints = expResult.totalFreeStatPoints;
		lootResults.remainingXp = expResult.remainingXp;
	}

	// Handle item drops — support both reward.item and top-level drop field
	const itemDropList = [
		...(reward.item && Array.isArray(reward.item) ? reward.item : []),
		...(enemyBase.drop && Array.isArray(enemyBase.drop) ? enemyBase.drop : []),
	];
	if (itemDropList.length > 0) {
		for (const itemDrop of itemDropList) {
			// Check drop chance (0-1 probability)
			const dropChance = itemDrop.chance || 1;
			const roll = Math.random();

			if (roll < dropChance) {
				const quantity = itemDrop.quantity || 1;
				const itemId = itemDrop.id;

				// Add item to character inventory
				await characterUtility.addCharacterItem(playerId, itemId, quantity);

				// Get item name for the loot report
				const itemName = await itemUtility.getItemName(itemId);

				lootResults.items.push({
					id: itemId,
					name: itemName,
					quantity: quantity,
				});
			}
		}
	}

	// === Handle weapon skill XP gain ===
	// Calculate damage dealt per weapon from combat log
	const weaponDamageMap = await calculateWeaponDamage(combatLog, playerAttacks);
	
	// Calculate and apply weapon skill XP
	if (Object.keys(weaponDamageMap).length > 0) {
		const skillXpGained = await applyWeaponSkillXp(playerId, weaponDamageMap);
		lootResults.weaponSkillXp = skillXpGained;
	}

	// === Handle armor skill XP gain ===
	// Calculate damage dodged, reduced, and crit resisted from combat log
	const armorDamageStats = calculateArmorDamageStats(combatLog);
	
	// Get equipped armor types with counts
	const armorTypeCount = await getEquippedArmorTypes(playerId);
	
	// Calculate and apply armor skill XP (includes dodge, reduction, and crit resistance)
	const totalMitigation = armorDamageStats.damageDodged + armorDamageStats.damageReduced + (armorDamageStats.critResistedTotal || 0);
	if (Object.keys(armorTypeCount).length > 0 && totalMitigation > 0) {
		const armorSkillXpGained = await applyArmorSkillXp(playerId, armorDamageStats, armorTypeCount);
		lootResults.armorSkillXp = armorSkillXpGained;
	}

	return lootResults;
}

function writeBattleReport(combatLog, actors, lootResults = null, combatLogSetting = 'short') {
	// Group consecutive attacks from the same attacker with the same attack
	const groupedLogs = [];
	let currentGroup = null;

	for (const log of combatLog) {
		// Ambient entries are never grouped — flush current group and insert standalone
		if (log.type === 'ambient') {
			if (currentGroup) {
				groupedLogs.push(currentGroup);
				currentGroup = null;
			}
			groupedLogs.push({ type: 'ambient', log });
			continue;
		}
		if (currentGroup &&
			currentGroup.attacker === log.attacker &&
			currentGroup.target === log.target &&
			currentGroup.attack === log.attack &&
			currentGroup.isShieldAction === log.isShieldAction) {
			// Same attack sequence, add to group
			currentGroup.hits.push({
				hit: log.hit,
				crit: log.crit,
				critResisted: log.critResisted,
				critResistedDamage: log.critResistedDamage,
				damage: log.damage,
				targetHp: log.targetHp,
				isShieldAction: log.isShieldAction,
				shieldGranted: log.shieldGranted,
				shieldAbsorbed: log.shieldAbsorbed,
				attackerShield: log.attackerShield,
			});
		}
		else {
			// New attack sequence
			if (currentGroup) groupedLogs.push(currentGroup);
			currentGroup = {
				attacker: log.attacker,
				target: log.target,
				attack: log.attack,
				isShieldAction: log.isShieldAction,
				hits: [{
					hit: log.hit,
					crit: log.crit,
					critResisted: log.critResisted,
					critResistedDamage: log.critResistedDamage,
					damage: log.damage,
					targetHp: log.targetHp,
					isShieldAction: log.isShieldAction,
					shieldGranted: log.shieldGranted,
					shieldAbsorbed: log.shieldAbsorbed,
					attackerShield: log.attackerShield,
				}],
			};
		}
	}
	if (currentGroup) groupedLogs.push(currentGroup);

	// Generate action lines from grouped logs
	const actionLines = [];
	let lastAttacker = null;

	for (const group of groupedLogs) {
		// Render ambient environment entries
		if (group.type === 'ambient') {
			const { log } = group;
			if (log.checkPassed) {
				actionLines.push('');
				actionLines.push('*There is something foul in the air...*');
			}
			else {
				const newStacks = log.stacks + 1;
				actionLines.push('');
				actionLines.push('*You feels hard to breathe.*');
				if (log.damage > 0) {
					actionLines.push(`└─ ${log.label}: -${log.damage} HP | Stacks: ${log.stacks} → ${newStacks} | HP: ${log.targetHp}`);
				}
				else {
					actionLines.push(`└─ ${log.label}: Stacks: ${log.stacks} → ${newStacks} | HP: ${log.targetHp}`);
				}
			}
			lastAttacker = null;
			continue;
		}

		// Add empty line between different attackers' turns
		if (lastAttacker !== null && lastAttacker !== group.attacker) {
			actionLines.push('');
		}
		lastAttacker = group.attacker;

		const hitCount = group.hits.length;
		
		// Handle shield actions separately
		if (group.isShieldAction) {
			if (hitCount === 1) {
				const h = group.hits[0];
				if (h.hit) {
					actionLines.push(`${group.attacker} raises ${group.attack} granting 🛡️ **${h.shieldGranted}** shield!`);
					actionLines.push(`└─ ${group.attacker} Shield: ${h.attackerShield}`);
				}
				else {
					actionLines.push(`${group.attacker} attempts to raise ${group.attack} but fumbles! 💨`);
				}
			}
			else {
				// Multiple shield raises
				let totalShield = 0;
				let lastShield = 0;
				for (const h of group.hits) {
					if (h.hit) {
						totalShield += h.shieldGranted;
						lastShield = h.attackerShield;
					}
				}
				actionLines.push(`${group.attacker} raises ${group.attack} ${hitCount} times granting 🛡️ **${totalShield}** total shield!`);
				actionLines.push(`└─ ${group.attacker} Shield: ${lastShield}`);
			}
		}
		else if (hitCount === 1) {
			// Single attack
			const h = group.hits[0];
			if (h.hit) {
				let attackText = `${group.attacker} attacks ${group.target} with ${group.attack}`;
				if (h.crit) {
					attackText += ' **CRITICAL HIT!** 💥';
				}
				else if (h.critResisted) {
					attackText += ' **CRIT RESISTED!** 🛡️';
				}
				if (h.shieldAbsorbed > 0) {
					attackText += ` (🛡️ ${h.shieldAbsorbed} absorbed)`;
				}
				attackText += ` dealing ${h.damage} damage!`;
				actionLines.push(attackText);
				actionLines.push(`└─ ${group.target} HP: ${h.targetHp}`);
			}
			else {
				actionLines.push(`${group.attacker} attacks ${group.target} with ${group.attack} but misses! 💨`);
			}
		}
		else {
			// Multiple attacks - header line
			actionLines.push(`${group.attacker} attacks ${hitCount} times with ${group.attack}!`);
			
			// Each hit on its own line
			let lastHp = null;
			for (const h of group.hits) {
				if (h.hit) {
					let hitText = '';
					if (h.crit) {
						hitText = `└─ 💥 Crit - ${h.damage} damage`;
					}
					else if (h.critResisted) {
						hitText = `└─ 🛡️ Crit Resisted - ${h.damage} damage`;
					}
					else {
						hitText = `└─ ⚔️ Hit - ${h.damage} damage`;
					}
					if (h.shieldAbsorbed > 0) {
						hitText += ` (🛡️ ${h.shieldAbsorbed} absorbed)`;
					}
					actionLines.push(hitText);
				}
				else {
					actionLines.push('└─ 💨 Miss');
				}
				lastHp = h.targetHp;
			}
			// Show final HP after all attacks
			actionLines.push(`└─ ${group.target} HP: ${lastHp}`);
		}
	}

	// Build outcome section
	const survivors = Object.values(actors).filter(a => a.hp > 0);
	const defeated = Object.values(actors).filter(a => a.hp <= 0);
	const isMutualDestruction = survivors.length === 0 && defeated.length > 0;
	const isDraw = survivors.length === Object.values(actors).length;

	let outcomeSection;
	if (isMutualDestruction) {
		outcomeSection = '\u2620\uFE0F **BATTLE OUTCOME** \u2620\uFE0F\n';
		outcomeSection += `**Mutual Destruction** — both combatants fell simultaneously!\n`;
		outcomeSection += defeated.map(a => a.name).join(' and ') + ' are both defeated.\n';
	}
	else if (isDraw) {
		outcomeSection = '\u23F1\uFE0F **BATTLE OUTCOME** \u23F1\uFE0F\n';
		outcomeSection += `**Inconclusive** — time ran out.\n`;
		outcomeSection += survivors.map(a => `${a.name}: ${a.hp} HP remaining`).join(', ') + '\n';
	}
	else {
		outcomeSection = '\uD83C\uDFC6 **BATTLE OUTCOME** \uD83C\uDFC6\n';
		if (survivors.length > 0) {
			outcomeSection += `**Victorious:** ${survivors.map(a => `${a.name} (${a.hp} HP)`).join(', ')}\n`;
		}
		if (defeated.length > 0) {
			outcomeSection += `**Defeated:** ${defeated.map(a => a.name).join(', ')}\n`;
		}
	}

	// Build rewards section
	let rewardsSection = '';
	if (lootResults && lootResults.playerVictory) {
		rewardsSection += '\n💰 **REWARDS** 💰\n';

		if (lootResults.gold > 0) {
			rewardsSection += `Gold: +${lootResults.gold} 🪙\n`;
		}

		if (lootResults.exp > 0) {
			rewardsSection += `Experience: +${lootResults.exp} ✨\n`;
		}

		if (lootResults.items && lootResults.items.length > 0) {
			rewardsSection += 'Items:\n';
			for (const item of lootResults.items) {
				rewardsSection += `└─ ${item.name} x${item.quantity} 🎁\n`;
			}
		}

		// Show level up info
		if (lootResults.leveledUp) {
			rewardsSection += '\n🎉 **LEVEL UP!** 🎉\n';
			rewardsSection += `Level ${lootResults.oldLevel} → ${lootResults.newLevel}\n`;
			rewardsSection += `Free stat points gained: +${lootResults.freeStatPointsGained}\n`;
			rewardsSection += `Total free stat points: ${lootResults.totalFreeStatPoints}\n`;
		}

		// Show weapon skill XP gained
		if (lootResults.weaponSkillXp && Object.keys(lootResults.weaponSkillXp).length > 0) {
			rewardsSection += '\n🗡️ **SKILL XP** 🗡️\n';
			for (const [skillName, xpGained] of Object.entries(lootResults.weaponSkillXp)) {
				rewardsSection += `${skillName}: +${xpGained} XP\n`;
			}
		}

		// Show armor skill XP gained
		if (lootResults.armorSkillXp && Object.keys(lootResults.armorSkillXp).length > 0) {
			rewardsSection += '\n🛡️ **ARMOR XP** 🛡️\n';
			for (const [skillName, xpGained] of Object.entries(lootResults.armorSkillXp)) {
				rewardsSection += `${skillName}: +${xpGained} XP\n`;
			}
		}
	}

	const header = '⚔️ **BATTLE REPORT** ⚔️\n\n';
	const footer = outcomeSection + rewardsSection;

	// Calculate available space for actions
	const fullReport = header + actionLines.join('\n') + '\n\n' + footer;

	// If report fits in one message, return it
	if (fullReport.length <= DISCORD_MESSAGE_LIMIT) {
		return fullReport;
	}

	// Handle long reports based on setting
	if (combatLogSetting === 'long') {
		// Paginate the report
		return paginateBattleReport(header, actionLines, footer);
	}
	else {
		// Short mode: truncate middle actions
		return truncateBattleReport(header, actionLines, footer);
	}
}

/**
 * Paginate battle report into multiple pages for Discord
 * @param {string} header - Report header
 * @param {Array} actionLines - Array of action lines
 * @param {string} footer - Report footer (outcome + rewards)
 * @returns {Object} { pages: Array<string> }
 */
function paginateBattleReport(header, actionLines, footer) {
	const pages = [];
	let currentPage = header;
	const pageIndicator = (pageNum, totalPages) => `\n*[Page ${pageNum}/${totalPages}]*\n`;

	// First pass: calculate total pages needed
	// Reserve space for page indicator
	const maxContentPerPage = DISCORD_MESSAGE_LIMIT - 100;
	let tempPage = header;
	let pageCount = 1;

	for (const line of actionLines) {
		if ((tempPage + line + '\n').length > maxContentPerPage) {
			pageCount++;
			tempPage = '';
		}
		tempPage += line + '\n';
	}

	// Check if footer fits on last page
	if ((tempPage + '\n' + footer).length > maxContentPerPage) {
		pageCount++;
	}

	// Second pass: actually build pages
	let currentPageNum = 1;
	currentPage = header;

	for (let i = 0; i < actionLines.length; i++) {
		const line = actionLines[i];
		const nextContent = line + '\n';

		// Check if adding this line would exceed limit
		if ((currentPage + nextContent + pageIndicator(currentPageNum, pageCount)).length > maxContentPerPage) {
			// Finish current page
			currentPage += pageIndicator(currentPageNum, pageCount);
			pages.push(currentPage);
			currentPageNum++;
			currentPage = '';
		}

		currentPage += nextContent;
	}

	// Add footer to last page or create new page for it
	if ((currentPage + '\n' + footer + pageIndicator(currentPageNum, pageCount)).length <= DISCORD_MESSAGE_LIMIT) {
		currentPage += '\n' + footer + pageIndicator(currentPageNum, pageCount);
		pages.push(currentPage);
	}
	else {
		// Footer needs its own page
		currentPage += pageIndicator(currentPageNum, pageCount);
		pages.push(currentPage);
		currentPageNum++;
		pages.push(footer + pageIndicator(currentPageNum, pageCount));
	}

	return { pages };
}

/**
 * Truncate battle report to show only first and last actions
 * @param {string} header - Report header
 * @param {Array} actionLines - Array of action lines
 * @param {string} footer - Report footer (outcome + rewards)
 * @returns {string} Truncated report
 */
function truncateBattleReport(header, actionLines, footer) {
	// Show first and last 6 action lines
	const showFirstLines = 6;
	const showLastLines = 6;

	if (actionLines.length <= showFirstLines + showLastLines) {
		// Not enough lines to truncate, just return full
		const report = header + actionLines.join('\n') + '\n\n' + footer;
		return report;
	}

	const firstLines = actionLines.slice(0, showFirstLines);
	const lastLines = actionLines.slice(-showLastLines);
	const skippedCount = actionLines.length - showFirstLines - showLastLines;

	let report = header;
	report += firstLines.join('\n') + '\n';
	report += `\n... *[${skippedCount} actions truncated]* ...\n\n`;
	report += lastLines.join('\n') + '\n\n';
	report += footer;

	// If still too long, reduce shown lines further
	if (report.length > DISCORD_MESSAGE_LIMIT) {
		const reducedFirst = actionLines.slice(0, 3);
		const reducedLast = actionLines.slice(-3);
		const reducedSkipped = actionLines.length - 6;

		report = header;
		report += reducedFirst.join('\n') + '\n';
		report += `\n... *[${reducedSkipped} actions truncated]* ...\n\n`;
		report += reducedLast.join('\n') + '\n\n';
		report += footer;
	}

	return report;
}

module.exports = {
	getAttackStat,
	getDefenseStat,
	performAttack,
	calculateDamage,
	runInitTracker,
	mainCombat,
	writeBattleReport,
	handleCombatBeginSkills,
	handleBeforeAttackSkills,
	handleAfterAttackSkills,
	handleCombatEndSkills,
	handleCombatEnd,
};
