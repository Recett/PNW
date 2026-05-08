const contentStore = require('@root/contentStore.js');
const characterUtility = require('./characterUtility');
const itemUtility = require('./itemUtility');

const getDbModels = () => require('@root/dbObject.js');

const PARRY_PMAX_BY_PERK = {
	'rapier-prise-de-fer': 0.40,
	'rapier-parry-1': 0.44,
	'rapier-parry-2': 0.48,
	'rapier-parry-3': 0.52,
	'rapier-parry-4': 0.56,
	'rapier-parry-5': 0.60,
};

const RIPOSTE_MULT_BY_PERK = {
	'rapier-riposte-1': 0.50,
	'rapier-riposte-2': 0.70,
	'rapier-riposte-3': 0.90,
	'rapier-riposte-4': 1.20,
	'rapier-riposte-5': 1.50,
};

function calculateDamage(attacker, tracker, target, ignoreDefense = false, critMultiplier = 1) {
	let attackVal = tracker.attack || 0;
	const defenseVal = ignoreDefense ? 0 : (target.defense || 0);

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

function getLivingActors(actorMap) {
	return Object.values(actorMap).filter(actor => (actor.hp || 0) > 0);
}

function getLivingOpponents(actorMap, actor) {
	return getLivingActors(actorMap).filter(candidate => candidate.side !== actor.side);
}

function getDefaultTargetStrategyForSide(side) {
	if (side === 'players') return 'focus-fire';
	if (side === 'enemies') return 'spread-pressure';
	return 'focus-fire';
}

function getHpRatio(actor) {
	const maxHp = actor.maxHp || actor.hp || 1;
	return maxHp > 0 ? ((actor.hp || 0) / maxHp) : 0;
}

function compareActorsForFocusFire(left, right) {
	if (getHpRatio(left) !== getHpRatio(right)) {
		return getHpRatio(left) - getHpRatio(right);
	}
	if ((left.hp || 0) !== (right.hp || 0)) {
		return (left.hp || 0) - (right.hp || 0);
	}
	if ((right.maxAttack || 0) !== (left.maxAttack || 0)) {
		return (right.maxAttack || 0) - (left.maxAttack || 0);
	}
	return String(left.id).localeCompare(String(right.id));
}

function compareActorsForSpreadPressure(left, right, context) {
	const leftPressure = context.targetPressure[left.id] || 0;
	const rightPressure = context.targetPressure[right.id] || 0;
	if (leftPressure !== rightPressure) {
		return leftPressure - rightPressure;
	}
	if ((right.maxAttack || 0) !== (left.maxAttack || 0)) {
		return (right.maxAttack || 0) - (left.maxAttack || 0);
	}
	if (getHpRatio(left) !== getHpRatio(right)) {
		return getHpRatio(left) - getHpRatio(right);
	}
	return String(left.id).localeCompare(String(right.id));
}

function normalizeTargetStrategy(strategy, attacker) {
	if (!strategy || strategy === 'default') {
		return getDefaultTargetStrategyForSide(attacker.side);
	}

	if (typeof strategy === 'string') {
		if (strategy === 'lowest-hp') return 'focus-fire';
		return strategy;
	}

	if (typeof strategy === 'object') {
		const sideStrategy = strategy[attacker.side] || strategy.default;
		if (!sideStrategy || sideStrategy === 'default') {
			return getDefaultTargetStrategyForSide(attacker.side);
		}
		if (sideStrategy === 'lowest-hp') return 'focus-fire';
		return sideStrategy;
	}

	return getDefaultTargetStrategyForSide(attacker.side);
}

function chooseTarget(actorMap, attacker, strategy = 'default', context = { targetPressure: {} }) {
	const opponents = getLivingOpponents(actorMap, attacker);
	if (opponents.length === 0) return null;
	const normalizedStrategy = normalizeTargetStrategy(strategy, attacker);

	if (normalizedStrategy === 'random') {
		return opponents[Math.floor(Math.random() * opponents.length)];
	}

	if (normalizedStrategy === 'highest-attack') {
		return opponents
			.slice()
			.sort((left, right) => (right.maxAttack || 0) - (left.maxAttack || 0))[0];
	}

	if (normalizedStrategy === 'spread-pressure') {
		return opponents
			.slice()
			.sort((left, right) => compareActorsForSpreadPressure(left, right, context))[0];
	}

	return opponents
		.slice()
		.sort(compareActorsForFocusFire)[0];
}

function getLivingSides(actorMap) {
	return new Set(getLivingActors(actorMap).map(actor => actor.side));
}

function buildMinimalSummary(actorMap, options = {}) {
	const actors = Object.values(actorMap)
		.map(actor => ({
			id: actor.id,
			name: actor.name,
			side: actor.side,
			hp: actor.hp,
			maxHp: actor.maxHp || actor.hp,
			status: actor.hp > 0 ? 'alive' : 'defeated',
		}))
		.sort((left, right) => String(left.id).localeCompare(String(right.id)));

	const survivingActors = actors.filter(actor => actor.hp > 0);
	const defeatedActors = actors.filter(actor => actor.hp <= 0);

	return {
		winningSide: options.winningSide || null,
		endReason: options.endReason || 'unknown',
		ticksElapsed: options.ticksElapsed || 0,
		survivingActors,
		defeatedActors,
		actors,
	};
}

function formatMinimalSummary(summary) {
	const lines = [];
	lines.push(`Winning side: ${summary.winningSide || 'none'}`);
	lines.push(`End reason: ${summary.endReason}`);
	lines.push(`Ticks elapsed: ${summary.ticksElapsed}`);
	lines.push('Final HP:');
	for (const actor of summary.actors) {
		lines.push(`- [${actor.side}] ${actor.name}: ${actor.hp}/${actor.maxHp} (${actor.status})`);
	}
	return lines.join('\n');
}

async function buildPlayerAttackEntries(playerId, playerBase, playerCombatStats, playerAttacks) {
	const playerSpeed = playerCombatStats ? (playerCombatStats.speed || 15) : 15;

	return await Promise.all(playerAttacks.map(async (atk) => {
		let attackName = 'Attack';
		let isShield = false;
		let isGreatshield = false;
		let isLongbow = false;
		let isRapier = false;
		let parryRating = 0;

		if (atk.item_id) {
			const itemDetails = await itemUtility.getItemWithDetails(atk.item_id);
			if (itemDetails) {
				attackName = itemDetails.name;
				const subtype = itemDetails.weapon?.subtype?.toLowerCase();
				if (subtype === 'shield') {
					isShield = true;
					if (itemDetails.tag) {
						const tags = Array.isArray(itemDetails.tag) ? itemDetails.tag : [itemDetails.tag];
						isGreatshield = tags.some(tag => tag && tag.toLowerCase().includes('greatshield'));
					}
				}
				else if (subtype === 'longbow') {
					isLongbow = true;
				}
				else if (subtype === 'rapier') {
					isRapier = true;
					parryRating = itemDetails.weapon.special?.parry_rating || 0;
				}
			}
		}
		else {
			attackName = 'Unarmed';
		}

		return {
			id: atk.item_id || atk.id,
			name: attackName,
			speed: playerSpeed,
			cooldown: atk.cooldown || 80,
			attack: atk.attack || 0,
			accuracy: atk.accuracy || 0,
			crit: atk.critical || 0,
			isShield,
			isGreatshield,
			isRapier,
			parryRating,
			initBonus: isLongbow ? 8 * (playerBase.dex || 0) : 0,
		};
	}));
}

async function buildDraftPlayerActor(playerId, options = {}) {
	if (!playerId) throw new Error('Player ID is required');

	const playerBase = await characterUtility.getCharacterBase(playerId);
	if (!playerBase) throw new Error(`Player not found: ${playerId}`);
	if ((playerBase.currentHp ?? 0) <= 0) {
		throw new Error(`Character is knocked out and cannot fight: ${playerId}`);
	}

	await characterUtility.calculateCombatStat(playerId);
	await characterUtility.calculateAttackStat(playerId);

	const { CharacterAttackStat, CharacterCombatStat, CharacterPerk, CharacterSkill } = getDbModels();
	const playerCombatStats = await CharacterCombatStat.findOne({ where: { character_id: playerId } });
	const playerAttacks = await CharacterAttackStat.findAll({ where: { character_id: playerId } });
	if (!playerAttacks || playerAttacks.length === 0) throw new Error(`Player has no attacks: ${playerId}`);

	const allEquippedPerks = await CharacterPerk.findAll({ where: { character_id: playerId, status: 'equipped' } });
	const rapierPerkIds = new Set(allEquippedPerks.filter(perk => perk.perk_id.startsWith('rapier-')).map(perk => perk.perk_id));
	const rapierSkillDef = contentStore.skills.findOne({ where: { subtype: 'rapier' } });
	const rapierSkillRow = rapierSkillDef
		? await CharacterSkill.findOne({ where: { character_id: playerId, skill_id: rapierSkillDef.id } })
		: null;
	const rapierSkillLevel = rapierSkillRow ? (rapierSkillRow.lv || 0) : 0;
	const hasEnGarde = rapierPerkIds.has('rapier-prise-de-fer');

	let parryPmax = 0;
	for (const [perkId, pmax] of Object.entries(PARRY_PMAX_BY_PERK)) {
		if (rapierPerkIds.has(perkId) && pmax > parryPmax) parryPmax = pmax;
	}

	let riposteMultiplier = 0;
	for (const [perkId, multiplier] of Object.entries(RIPOSTE_MULT_BY_PERK)) {
		if (rapierPerkIds.has(perkId) && multiplier > riposteMultiplier) riposteMultiplier = multiplier;
	}

	const attacks = await buildPlayerAttackEntries(playerId, playerBase, playerCombatStats, playerAttacks);
	const rapierAttackEntries = attacks.filter(attack => attack.isRapier);
	const hasRapierEquipped = rapierAttackEntries.length > 0;

	const actor = {
		id: options.actorId || `player:${playerId}`,
		name: playerBase.name || `Player ${playerId}`,
		side: options.side || 'players',
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
		attacks,
		maxAttack: Math.max(...attacks.map(attack => attack.attack || 0), 0),
	};

	actor.parryEnabled = hasEnGarde && hasRapierEquipped;
	if (actor.parryEnabled) {
		const rapierParryRating = Math.max(...rapierAttackEntries.map(a => a.parryRating || 0), 0);
		let maxParryPower = Math.floor((playerBase.dex || 0) * rapierParryRating * (1 + rapierSkillLevel * 0.04));
		if (rapierAttackEntries.length >= 2) maxParryPower = Math.floor(maxParryPower / 2);
		actor.maxParryPower = maxParryPower;
		actor.parryPower = maxParryPower;
		actor.parryPmax = parryPmax > 0 ? parryPmax : 0.40;
		actor.riposteMultiplier = riposteMultiplier;
	}
	else {
		actor.maxParryPower = 0;
		actor.parryPower = 0;
		actor.parryPmax = 0;
		actor.riposteMultiplier = 0;
	}

	return actor;
}

function buildDraftEnemyActor(enemyId, options = {}) {
	if (!enemyId) throw new Error('Enemy ID is required');

	const enemyBase = contentStore.enemies.findByPk(String(enemyId));
	if (!enemyBase) throw new Error(`Enemy not found: ${enemyId}`);
	const enemyBaseStat = enemyBase.stat;
	if (!enemyBaseStat) throw new Error(`Enemy stats not found: ${enemyId}`);

	let enemyAttacks = Array.isArray(enemyBase.attack) ? enemyBase.attack : [];
	if (enemyAttacks.length === 0) throw new Error(`Enemy has no attacks: ${enemyId}`);

	const enemyTags = Array.isArray(enemyBase.tag) ? enemyBase.tag : [];
	if (enemyTags.includes('pick_one') && enemyAttacks.length > 1) {
		const pickedIndex = Math.floor(Math.random() * enemyAttacks.length);
		enemyAttacks = [enemyAttacks[pickedIndex]];
	}

	const attacks = enemyAttacks.map((attack, index) => ({
		id: attack.id || `${enemyId}:attack:${index}`,
		name: attack.name || 'Attack',
		speed: enemyBaseStat.speed || 12,
		cooldown: Math.max(10, attack.cooldown || 90),
		attack: attack.base_damage || 0,
		accuracy: attack.accuracy || 0,
		crit: attack.critical_chance || 0,
	}));

	return {
		id: options.actorId || `enemy:${enemyId}:${options.occurrence || 1}`,
		name: options.name || enemyBase.name || enemyBase.fullname || `Enemy ${enemyId}`,
		side: options.side || 'enemies',
		enemyId: String(enemyId),
		hp: options.enemyStartHp != null ? options.enemyStartHp : (enemyBaseStat.health || 100),
		maxHp: enemyBaseStat.health || 100,
		defense: enemyBaseStat.defense || 0,
		evade: enemyBaseStat.evade || 0,
		critResistance: enemyBaseStat.crit_resistance || 0,
		shieldStrength: 0,
		shieldIsGreatshield: false,
		attacks,
		maxAttack: Math.max(...attacks.map(attack => attack.attack || 0), 0),
		parryEnabled: false,
		parryPower: 0,
		parryPmax: 0,
		riposteMultiplier: 0,
	};
}

async function buildDraftActors(playerIds = [], enemyIds = [], options = {}) {
	if (!Array.isArray(playerIds) || playerIds.length === 0) {
		throw new Error('At least one player ID is required');
	}
	if (!Array.isArray(enemyIds) || enemyIds.length === 0) {
		throw new Error('At least one enemy ID is required');
	}

	const playerActors = await Promise.all(playerIds.map((playerId, index) => {
		return buildDraftPlayerActor(playerId, {
			actorId: `player:${playerId}`,
			side: options.playerSide || 'players',
			occurrence: index + 1,
		});
	}));

	const enemyOccurrences = new Map();
	const enemyActors = enemyIds.map(enemyId => {
		const count = (enemyOccurrences.get(String(enemyId)) || 0) + 1;
		enemyOccurrences.set(String(enemyId), count);
		return buildDraftEnemyActor(enemyId, {
			actorId: `enemy:${enemyId}:${count}`,
			side: options.enemySide || 'enemies',
			occurrence: count,
		});
	});

	return [...playerActors, ...enemyActors];
}

async function runTeamCombatEngine(actors, options = {}) {
	const maxTicks = options.maxTicks || 400;
	const targetStrategy = options.targetStrategy || 'default';
	const combatLog = [];
	const actorMap = {};
	const attackTrackers = [];
	const targetPressure = {};

	for (const actor of actors) {
		actorMap[actor.id] = { ...actor };
		for (const attack of actor.attacks || []) {
			attackTrackers.push({
				actorId: actor.id,
				actorName: actor.name || actor.id,
				attackId: attack.id,
				attackName: attack.name || attack.id,
				speed: attack.speed,
				cooldown: attack.cooldown,
				initiative: Math.floor(Math.random() * (attack.speed || 10)) + (attack.initBonus || 0),
				attack: attack.attack,
				accuracy: attack.accuracy,
				crit: attack.crit,
				isShield: attack.isShield || false,
				isGreatshield: attack.isGreatshield || false,
				firstStrikeReady: (attack.initBonus || 0) > 0,
			});
		}
	}

	let endReason = 'max_ticks';
	let ticksElapsed = maxTicks;

	outer:
	for (let tick = 1; tick <= maxTicks; tick++) {
		for (const actorId of Object.keys(targetPressure)) {
			targetPressure[actorId] = Math.max(0, targetPressure[actorId] - 1);
		}

		for (const tracker of attackTrackers) {
			tracker.initiative += tracker.speed;
			while (tracker.initiative >= tracker.cooldown) {
				const attacker = actorMap[tracker.actorId];
				if (!attacker || attacker.hp <= 0) break;

				const target = chooseTarget(actorMap, attacker, targetStrategy, { targetPressure });
				if (!target) {
					endReason = 'side_eliminated';
					ticksElapsed = tick;
					break outer;
				}
				targetPressure[target.id] = (targetPressure[target.id] || 0) + 2;

				if (attacker.parryEnabled) {
					attacker.parryPower = attacker.maxParryPower;
				}

				const isShieldAction = tracker.isShield || false;

				// Calculate hit rate (shield actions always succeed)
				const tohit = tracker.accuracy || 0;
				const evd = target.evade || 1;
				let hitRate = 100;
				if (!isShieldAction) {
					const rate = tohit > 0 ? (evd / tohit) : Infinity;
					if (rate >= 4) {
						hitRate = 0;
					}
					else {
						const x = (rate - 1) / 3;
						hitRate = ((1 - x) / (1 + x)) * 100;
					}
				}

				const roll = Math.floor(Math.random() * 100);
				const hitResult = isShieldAction || (roll < hitRate);
				let crit = false;
				let critResisted = false;
				let critResistedDamage = 0;
				let damage = 0;
				let shieldGranted = 0;
				let shieldAbsorbed = 0;
				let parryTier = null;
				let parryReduced = 0;
				let riposteDamage = 0;

				if (hitResult) {
					if (isShieldAction) {
						const shieldValue = tracker.attack || 0;
						attacker.shieldStrength = (attacker.shieldStrength || 0) + shieldValue;
						attacker.shieldIsGreatshield = tracker.isGreatshield || false;
						shieldGranted = shieldValue;
					}
					else {
						const critStat = tracker.crit || 0;
						let critRate = critStat > 0 ? critStat : 0;
						critRate = hitRate > 0 ? critRate * hitRate / 100 : critRate;
						const targetCritResist = (target.critResistance || 0) * 10;
						const critRoll = Math.random() * 1000;

						if (critRoll < critRate) {
							if (critRoll < targetCritResist) {
								critResisted = true;
								const critDamage = calculateDamage(attacker, tracker, target, true, 2);
								const normalDamage = calculateDamage(attacker, tracker, target);
								critResistedDamage = critDamage - normalDamage;
								damage = normalDamage;
							}
							else {
								crit = true;
								damage = calculateDamage(attacker, tracker, target, true, 2);
							}
						}
						else {
							damage = calculateDamage(attacker, tracker, target);
						}

						if (target.shieldStrength > 0 && damage > 0) {
							if (target.shieldIsGreatshield) {
								shieldAbsorbed = Math.min(target.shieldStrength, damage);
								damage -= shieldAbsorbed;
								target.shieldStrength -= shieldAbsorbed;
							}
							else {
								shieldAbsorbed = Math.min(target.shieldStrength, damage);
								damage -= shieldAbsorbed;
								target.shieldStrength = 0;
							}
						}

						if (damage > 0 && target.parryEnabled && target.parryPower > 0) {
							const ratio = Math.max(1, damage / (target.parryPower * 2));
							const rawChance = Math.pow(0.6, ratio);
							const parryChance = Math.min(target.parryPmax, rawChance);
							const parryRoll = Math.random();
							let reductionFraction = 0;
							if (parryRoll < parryChance * 0.10) {
								parryTier = 'perfect';
								reductionFraction = 1.0;
							}
							else if (parryRoll < parryChance * 0.40) {
								parryTier = 'good';
								reductionFraction = 0.75;
							}
							else if (parryRoll < parryChance) {
								parryTier = 'basic';
								reductionFraction = 0.50;
							}

							if (parryTier) {
								parryReduced = Math.floor(damage * reductionFraction);
								damage -= parryReduced;
								if (target.riposteMultiplier > 0) {
									const rapierAttacks = (target.attacks || []).filter(attack => attack.isRapier).map(attack => attack.attack);
									const rapierAttack = rapierAttacks.length > 0 ? Math.max(...rapierAttacks) : 0;
									riposteDamage = Math.max(0, Math.floor(rapierAttack * target.riposteMultiplier) - (attacker.defense || 0));
								}
							}
							target.parryPower = Math.floor(target.parryPower * 0.3);
						}

						target.hp = Math.max(0, target.hp - damage);
					}
				}

				let attackDisplayName = tracker.attackName;
				if (tracker.firstStrikeReady) {
					attackDisplayName = 'First Strike';
					tracker.firstStrikeReady = false;
				}

				combatLog.push({
					tick,
					attacker: attacker.name,
					attackerId: attacker.id,
					attackerSide: attacker.side,
					target: target.name,
					targetId: target.id,
					targetSide: target.side,
					attack: attackDisplayName,
					hit: hitResult,
					crit,
					critResisted,
					critResistedDamage,
					damage,
					targetHp: target.hp,
					isShieldAction,
					shieldGranted,
					shieldAbsorbed,
					parryTier,
					parryReduced,
					attackerShield: attacker.shieldStrength || 0,
				});

				if (riposteDamage > 0 && attacker.hp > 0) {
					attacker.hp = Math.max(0, attacker.hp - riposteDamage);
					combatLog.push({
						type: 'riposte',
						tick,
						attacker: target.name,
						attackerId: target.id,
						attackerSide: target.side,
						target: attacker.name,
						targetId: attacker.id,
						targetSide: attacker.side,
						damage: riposteDamage,
						targetHp: attacker.hp,
					});
				}

				tracker.initiative -= tracker.cooldown;

				if (getLivingSides(actorMap).size <= 1) {
					endReason = 'side_eliminated';
					ticksElapsed = tick;
					break outer;
				}
			}
		}
	}

	const livingSides = Array.from(getLivingSides(actorMap));
	const winningSide = livingSides.length === 1 ? livingSides[0] : null;
	const summary = buildMinimalSummary(actorMap, { winningSide, endReason, ticksElapsed });

	return {
		combatLog,
		actors: actorMap,
		winningSide,
		endReason,
		ticksElapsed,
		targetStrategy,
		summary,
		summaryText: formatMinimalSummary(summary),
	};
}

async function runTeamCombatDraft(options = {}) {
	const playerIds = options.playerIds || [];
	const enemyIds = options.enemyIds || [];
	const actors = await buildDraftActors(playerIds, enemyIds, options);
	return await runTeamCombatEngine(actors, options);
}

module.exports = {
	calculateDamage,
	buildDraftPlayerActor,
	buildDraftEnemyActor,
	buildDraftActors,
	runTeamCombatEngine,
	runTeamCombatDraft,
	buildMinimalSummary,
	formatMinimalSummary,
};