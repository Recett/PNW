// Utility functions for handling combat logic
const { CharacterBase, NpcBaseStat, NpcAttackStat, NpcBase } = require('@root/dbObject.js');
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
		for (const attack of actor.attacks) {
			attackTrackers.push({
				actorId: actor.id,
				actorName: actor.name || actor.id,
				attackId: attack.id,
				attackName: attack.name || attack.id,
				speed: attack.speed,
				cooldown: attack.cooldown,
				initiative: 0,
				attack: attack.attack,
				defense: attack.defense,
			});
		}
	}

	for (let tick = 1; tick <= maxTicks; tick++) {
		for (const tracker of attackTrackers) {
			tracker.initiative += tracker.speed;
			while (tracker.initiative >= tracker.cooldown) {
				// === Call skill triggers: Before Attack ===
				await handleBeforeAttackSkills(attacker, target, tracker, options);
				// Only two actors: actors[0] and actors[1]
				const attacker = actorMap[tracker.actorId];
				const target = tracker.actorId === actors[0].id ? actorMap[actors[1].id] : actorMap[actors[0].id];
				if (!attacker || !target || target.hp <= 0) break;
				// Calculate hit rate
				const tohit = tracker.tohit || 0;
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
				await handleAfterAttackSkills(attacker, target, tracker, { hit: hitResult, crit, damage });

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

	// Get NPC base info and stats
	const npcBase = await NpcBase.findOne({ where: { id: enemyId } });
	if (!npcBase) throw new Error('Enemy not found');

	const npcBaseStat = await NpcBaseStat.findOne({ where: { npc_id: enemyId } });
	if (!npcBaseStat) throw new Error('Enemy stats not found');

	// Get NPC attacks through the many-to-many relationship
	const npcWithAttacks = await NpcBase.findOne({
		where: { id: enemyId },
		include: [{
			model: NpcAttackStat,
			as: 'attackStats',
			through: { attributes: [] },
		}],
	});

	if (!npcWithAttacks || !npcWithAttacks.attackStats || npcWithAttacks.attackStats.length === 0) {
		throw new Error('Enemy has no attacks');
	}

	const playerBase = await CharacterBase.findOne({ where: { id: playerId } });
	if (!playerBase) throw new Error('Player not found');

	const player = {
		id: 'player',
		name: playerBase.name || 'Player',
		hp: playerBase.currentHp || playerBase.maxHp || 100,
		attacks: playerAttacks.map(atk => ({
			id: atk.item_id || atk.id,
			name: atk.name || 'Attack',
			speed: atk.speed || atk.agi || 10,
			cooldown: atk.cooldown || 100,
			attack: atk.attack || 0,
			accuracy: atk.accuracy || 0,
			crit: atk.crit || 0,
		})),
	};

	const monster = {
		id: 'monster',
		name: npcBase.name || npcBase.fullname || 'Unknown Enemy',
		hp: npcBaseStat.health || 100,
		defense: npcBaseStat.defense || 0,
		evade: npcBaseStat.evade || 0,
		attacks: npcWithAttacks.attackStats.map(atk => ({
			id: atk.id,
			name: atk.name || 'Attack',
			speed: 10,
			cooldown: atk.cooldown || 100,
			attack: atk.attack || 0,
			accuracy: atk.accuracy || 0,
			crit: atk.critical || 0,
		})),
	};

	// === Call skill triggers: Combat Begin ===
	await handleCombatBeginSkills([player, monster], { playerId, enemyId });

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
	await handleCombatEndSkills(Object.values(actors), { playerId, enemyId });

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
	let report = '=== Battle Report ===\n';
	for (const log of combatLog) {
		report += `Turn ${log.tick}: ${log.attacker} attacks ${log.target} with ${log.attack}\n`;
		report += `  Hit Rate: ${log.hitRate.toFixed(1)}% | Roll: ${log.roll}${log.hit ? ' | HIT' : ' | MISS'}\n`;
		if (log.hit) {
			report += log.crit ? '  CRITICAL HIT! ' : '';
			report += `Damage: ${log.damage}\n`;
			report += `  ${log.target} HP: ${log.targetHp}\n`;
		}
		else {
			report += '  No damage dealt.\n';
		}
		report += '\n';
	}
	// Show final status
	report += '--- Final Status ---\n';
	for (const id in actors) {
		const a = actors[id];
		report += `${a.name || a.id}: HP ${a.hp}\n`;
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
