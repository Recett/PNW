// Utility functions for handling combat logic
const { CharacterBase, MonsterBaseStat, MonsterAttackLib, MonsterBase } = require('@root/dbObject.js');
const characterUtility = require('./characterUtility');

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

	// Simple formula: damage = attack - defense (minimum 1)
	return Math.max(1, attack - defense);
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
	const attackVal = tracker.attack || 0;
	const defenseVal = ignoreDefense ? 0 : (target.defense || 0);
	let baseDamage = Math.max(1, attackVal - defenseVal);
	return Math.floor(baseDamage * critMultiplier);
}

async function runInitTracker(actors, options = {}) {
	const maxTicks = options.maxTicks || 100;
	const combatLog = [];

	// Track initiative and HP for each attack
	const attackTrackers = [];
	const actorMap = {};
	for (const actor of actors) {
		actorMap[actor.id] = { ...actor };
		console.log(`=== DEBUG: Actor ${actor.name || actor.id} has ${actor.attacks.length} attacks ===`);
		for (const attack of actor.attacks) {
			console.log(`Adding attack tracker: ${attack.name || attack.id} (speed: ${attack.speed}, cooldown: ${attack.cooldown})`);
			attackTrackers.push({
				actorId: actor.id,
				actorName: actor.name || actor.id,
				attackId: attack.id,
				attackName: attack.name || attack.id,
				speed: attack.speed,
				cooldown: attack.cooldown,
				// Add small random starting initiative to stagger attacks
				initiative: Math.floor(Math.random() * (attack.speed || 10)),
				attack: attack.attack,
				accuracy: attack.accuracy,
				crit: attack.crit,
			});
		}
	}
	console.log(`=== DEBUG: Total attack trackers created: ${attackTrackers.length} ===`);

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
				const evd = target.evade || 0;
				let hitRate = 100;
				if (tohit - evd !== 0) {
					hitRate = ((2 * tohit - evd) / (tohit - evd)) * 100;
				}
				hitRate = Math.max(0, Math.min(100, hitRate));
				const roll = Math.floor(Math.random() * 100);
				const hitResult = roll < hitRate;
				let crit = false;
				let damage = 0;
				if (hitResult) {
					// Crit calculation
					const critStat = tracker.crit || 0;
					const critRate = critStat > 0 ? (critStat / (critStat + 100)) * 100 : 0;
					const critRoll = Math.random() * 100;
					crit = critRoll < critRate;
					if (crit) {
						damage = calculateDamage(attacker, tracker, target, true, 1.5);
					}
					else {
						damage = calculateDamage(attacker, tracker, target);
					}
					target.hp = Math.max(0, target.hp - damage);
				}
				// === Call skill triggers: After Attack ===
				if (options.handleAfterAttackSkills) {
					await options.handleAfterAttackSkills(attacker, target, tracker, { hit: hitResult, crit, damage });
				}

				combatLog.push({
					tick,
					attacker: tracker.actorName,
					target: target.name || target.id,
					attack: tracker.attackName,
					hitRate,
					roll,
					hit: hitResult,
					crit,
					damage,
					targetHp: target.hp,
				});
				tracker.initiative -= tracker.cooldown;
				if (target.hp <= 0) break;
			}
		}
		// End combat if all but one actor is dead
		const alive = Object.values(actorMap).filter(a => a.hp > 0);
		if (alive.length <= 1) break;
	}

	return { combatLog, actors: actorMap };
}

async function mainCombat(playerId, enemyId) {
	const playerAttacks = await getAttackStat(playerId);
	if (!playerAttacks || playerAttacks.length === 0) throw new Error('Player has no attacks');

	// Get player combat stats for speed
	const playerCombatStats = await getDefenseStat(playerId);

	// Get Monster base info and stats
	const monsterBase = await MonsterBase.findOne({ where: { id: enemyId } });
	if (!monsterBase) throw new Error('Enemy not found');

	const monsterBaseStat = await MonsterBaseStat.findOne({ where: { monster_id: enemyId } });
	if (!monsterBaseStat) throw new Error('Enemy stats not found');

	// Get Monster attacks through the many-to-many relationship
	const monsterWithAttacks = await MonsterBase.findOne({
		where: { id: enemyId },
		include: [{
			model: MonsterAttackLib,
			as: 'attackLibs',
			through: { attributes: ['damage_modifier', 'accuracy_modifier', 'cooldown_modifier', 'priority'] },
		}],
	});

	if (!monsterWithAttacks || !monsterWithAttacks.attackLibs || monsterWithAttacks.attackLibs.length === 0) {
		throw new Error('Enemy has no attacks');
	}

	const playerBase = await CharacterBase.findOne({ where: { id: playerId } });
	if (!playerBase) throw new Error('Player not found');

	// Get player's agility/speed from combat stats
	const playerSpeed = playerCombatStats ? (playerCombatStats.agi || playerCombatStats.agility || 15) : 15;

	const player = {
		id: 'player',
		name: playerBase.name || 'Player',
		hp: playerBase.currentHp || playerBase.maxHp || 100,
		attacks: await Promise.all(playerAttacks.map(async (atk) => {
			// Get weapon name from ItemLib if item_id exists
			let attackName = 'Attack';
			if (atk.item_id) {
				const { ItemLib } = require('@root/dbObject.js');
				const item = await ItemLib.findOne({ where: { id: atk.item_id } });
				if (item) {
					attackName = item.name;
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
				crit: atk.crit || 0,
			};
		})),
	};

	const monster = {
		id: 'monster',
		name: monsterBase.name || monsterBase.fullname || 'Unknown Enemy',
		hp: monsterBaseStat.health || 100,
		defense: monsterBaseStat.defense || 0,
		evade: monsterBaseStat.evade || 0,
		attacks: monsterWithAttacks.attackLibs.map(atk => {
			// Get modifiers from the junction table
			const junction = atk.MonsterAttack || {};
			const damageModifier = junction.damage_modifier || 0;
			const accuracyModifier = junction.accuracy_modifier || 0;
			const cooldownModifier = junction.cooldown_modifier || 0;
			
			return {
				id: atk.id,
				name: atk.name || 'Attack',
				// Use monster's speed from base stats
				speed: monsterBaseStat.speed || 12,
				// Apply cooldown modifier from junction table
				cooldown: Math.max(10, (atk.cooldown || 90) + cooldownModifier),
				// Apply damage modifier from junction table
				attack: (atk.base_damage || 0) + damageModifier,
				// Apply accuracy modifier from junction table
				accuracy: (atk.accuracy || 0) + accuracyModifier,
				crit: atk.critical_chance || 0,
			};
		}),
	};

	// === Call skill triggers: Combat Begin ===
	await handleCombatBeginSkills([player, monster]);

	// Patch runInitTracker to support skill hooks
	const { combatLog, actors } = await runInitTracker(
		[player, monster],
		{
			maxTicks: 100,
			handleBeforeAttackSkills,
			handleAfterAttackSkills,
		},
	);

	// === Call skill triggers: Combat End ===
	await handleCombatEndSkills(Object.values(actors));

	// Update player's HP in the database
	if (actors.player) {
		await CharacterBase.update(
			{ currentHp: actors.player.hp },
			{ where: { id: playerId } },
		);
	}
	return {
		combatLog,
		finalState: actors,
		battleReport: writeBattleReport(combatLog, actors),
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

function writeBattleReport(combatLog, actors) {
	let report = '⚔️ **BATTLE REPORT** ⚔️\n\n';
	
	// Group consecutive attacks to reduce spam
	const groupedLogs = [];
	let currentGroup = null;
	
	for (const log of combatLog) {
		if (currentGroup &&
			currentGroup.attacker === log.attacker &&
			currentGroup.target === log.target &&
			currentGroup.attack === log.attack) {
			// Same attack sequence, just track the results
			currentGroup.attempts++;
			currentGroup.totalDamage += log.damage;
			currentGroup.hits += log.hit ? 1 : 0;
			currentGroup.crits += log.crit ? 1 : 0;
			currentGroup.finalTargetHp = log.targetHp;
		}
		else {
			// New attack sequence
			if (currentGroup) groupedLogs.push(currentGroup);
			currentGroup = {
				attacker: log.attacker,
				target: log.target,
				attack: log.attack,
				attempts: 1,
				hits: log.hit ? 1 : 0,
				crits: log.crit ? 1 : 0,
				totalDamage: log.damage,
				finalTargetHp: log.targetHp,
				hitRate: log.hitRate,
			};
		}
	}
	if (currentGroup) groupedLogs.push(currentGroup);

	// Generate RPG-style combat narrative
	for (const group of groupedLogs) {
		if (group.attempts === 1) {
			// Single attack
			if (group.hits > 0) {
				let attackText = `${group.attacker} attacks ${group.target} with ${group.attack}`;
				if (group.crits > 0) {
					attackText += ' **CRITICAL HIT!** 💥';
				}
				attackText += ` dealing ${group.totalDamage} damage!`;
				report += `${attackText}\n`;
				report += `└─ ${group.target} HP: ${group.finalTargetHp}\n\n`;
			}
			else {
				report += `${group.attacker} attacks ${group.target} with ${group.attack} but misses! 💨\n\n`;
			}
		}
		else {
			// Multiple attacks
			const critText = group.crits > 0 ? ` (${group.crits} crits! 💥)` : '';
			report += `${group.attacker} unleashes ${group.attempts} ${group.attack} attacks on ${group.target}!\n`;
			report += `└─ ${group.hits}/${group.attempts} hits${critText} - Total damage: ${group.totalDamage}\n`;
			report += `└─ ${group.target} HP: ${group.finalTargetHp}\n\n`;
		}
	}

	// Show final battle outcome
	report += '🏆 **BATTLE OUTCOME** 🏆\n';
	const survivors = Object.values(actors).filter(a => a.hp > 0);
	const defeated = Object.values(actors).filter(a => a.hp <= 0);
	
	if (survivors.length > 0) {
		report += `**Victorious:** ${survivors.map(a => `${a.name} (${a.hp} HP)`).join(', ')}\n`;
	}
	if (defeated.length > 0) {
		report += `**Defeated:** ${defeated.map(a => a.name).join(', ')}\n`;
	}
	
	console.log(report);
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
};
