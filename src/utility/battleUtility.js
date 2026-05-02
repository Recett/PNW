'use strict';

const { Op } = require('sequelize');
const {
	GlobalFlag, LocationBase, LocationLink,
	LocationContain, CharacterBase, PendingEncounter, LocationEnemySpawn, CronLog,
} = require('@root/dbObject.js');
const locationUtil = require('@utility/locationUtility.js');
const contentStore = require('@root/contentStore.js');
const gamecon = require('@root/Data/gamecon.json');

// ──────────────────────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────────────────────

// All HMS Divine zones
const HMS_ZONE_IDS = [4, 5, 6, 7, 8];
// Top Deck — crossing point to Arbrance
const BOONG_TREN_ID = 4;
// Main Deck — York's original location
const BOONG_CHINH_ID = 5;
// Living Quarters — battle rally point
const BOONG_SINH_HOAT_ID = 6;

const ARBRANCE_CLUSTER_ID = 'cluster_arbrance';

// Minimum players who must click "Ready" before enemy spawning begins
const MUSTER_REQUIRED = 6;

// ── Morale: enemy kill values ────────────────────────────────────────────────
const ENEMY_MORALE_VALUES = {
	// Common
	'sailor':         1,
	'cutthroat':      1,
	'boarder':        2,
	'man_at_arms':    2,
	'crossbowman':    2,
	'swashbuckler':   2,
	// Elite
	'veteran_sailor': 3,
	// Boss (unique_per_voyage) — each kill also permanently reduces drain baseline by 2
	'enemy_boatswain':  10,
	'master_at_arms':   10,
	'master_gunner':    10,
	'enemy_first_mate': 10,
	'enemy_captain':    10,
	'enemy_head_guard': 10,
	'quartermaster':    10,
};

const BOSS_ENEMIES = new Set([
	'enemy_boatswain', 'master_at_arms', 'master_gunner',
	'enemy_first_mate', 'enemy_captain', 'enemy_head_guard', 'quartermaster',
]);

// ── Officer Cabin: role definitions & in-memory session state ─────────────────
const OFFICER_ROLES = {
	captain: {
		label: 'Fight Captain',
		enemyId: 'enemy_captain',
		defeatFlag: 'global.arb_boss_captain_defeated',
	},
	first_mate: {
		label: 'Fight First Mate',
		enemyId: 'enemy_first_mate',
		defeatFlag: 'global.arb_boss_first_mate_defeated',
	},
	head_guard: {
		label: 'Fight Head Guard',
		enemyId: 'enemy_head_guard',
		defeatFlag: 'global.arb_boss_head_guard_defeated',
	},
};

// In-memory session map: key = officer quarters location ID (number)
// Session shape: { sessionId, assignments, names, channelId, messageId, timeout }
const officerCabinSessions = new Map();

// ── Morale: zone entry thresholds (keyed by zone definition key) ─────────────
const ZONE_MORALE_THRESHOLDS = {
	'arb_main_deck':        20,
	'arb_rigging':          20,
	'arb_cannon_deck':      40,
	'arb_armory':           40,
	'arb_officer_quarters': 40,
};

// Arbrance zone definitions — created by ensureArbranceLocations()
const ARBRANCE_ZONE_DEFS = [
	{ key: 'arb_main_deck', name: 'Boong Ch\u00EDnh La Dauphine', channelName: 'boong-chinh-la-dauphine' },
	{ key: 'arb_cannon_deck', name: 'Boong Ph\u00E1o La Dauphine', channelName: 'boong-phao-la-dauphine' },
	{ key: 'arb_armory', name: 'Kho V\u0169 Kh\u00ED La Dauphine', channelName: 'kho-vu-khi-la-dauphine' },
	{ key: 'arb_officer_quarters', name: 'Khoang S\u0129 Quan La Dauphine', channelName: 'khoang-si-quan-la-dauphine' },
	{ key: 'arb_rigging', name: 'C\u1ED9t Bu\u1ED3m La Dauphine', channelName: 'cot-buom-la-dauphine' },
];

// Zones that participate in random encounter spawning and their hazard pools.
// Use `key` for flag-resolved Arbrance/rigging locations, `id` for static hardcoded locations.
const SPAWN_ZONE_DEFS = [
	{ key: 'arb_main_deck', hazards: ['musket_shot', 'cannon_debris'] },
	{ key: 'arb_rigging', hazards: ['musket_shot'], halfSpawn: true },
	{ key: 'hms_rigging', hazards: ['cannon_debris'], hmsZone: true, halfSpawn: true },
	// HMS Top Deck
	{ id: BOONG_TREN_ID, hazards: ['musket_shot', 'cannon_debris'], hmsZone: true },
	// HMS Main Deck — breach condition only
	{ id: BOONG_CHINH_ID, hazards: ['musket_shot', 'cannon_debris'], hmsZone: true, breachOnly: true },
];

// ──────────────────────────────────────────────────────────────
// GLOBAL FLAG HELPERS
// ──────────────────────────────────────────────────────────────

async function getFlag(flagName) {
	const record = await GlobalFlag.findOne({ where: { flag: flagName } });
	return record ? (parseInt(record.value) || 0) : 0;
}

async function setFlag(flagName, value) {
	await GlobalFlag.upsert({ flag: flagName, value });
}

// ──────────────────────────────────────────────────────────────
// BATTLE STATE
// ──────────────────────────────────────────────────────────────

async function getBattleState() {
	const [
		battleActive, battleInitialized, cycleCount,
		hmsDeckHp, hmsCannonHp, hmsRiggingHp,
		arbMainHp, arbCannonHp, arbRiggingHp,
		morale, arbCommanderSlain,
		hmsSunk, hmsSupplyLoss,
		mustering, readyCount,
	] = await Promise.all([
		getFlag('global.hms_divine_battle_active'),
		getFlag('global.hms_divine_battle_initialized'),
		getFlag('global.hms_divine_cycle_count'),
		getFlag('global.hms_divine_top_deck_hp'),
		getFlag('global.hms_divine_cannon_deck_hp'),
		getFlag('global.hms_divine_rigging_hp'),
		getFlag('global.arb_main_deck_hp'),
		getFlag('global.arb_cannon_deck_hp'),
		getFlag('global.arb_rigging_hp'),
		getFlag('global.hms_divine_morale'),
		getFlag('global.arb_commander_slain'),
		getFlag('global.hms_divine_sunk'),
		getFlag('global.hms_divine_supply_loss'),
		getFlag('global.hms_divine_mustering'),
		getFlag('global.hms_divine_ready_count'),
	]);

	return {
		battleActive, battleInitialized, cycleCount,
		hmsDeckHp, hmsCannonHp, hmsRiggingHp,
		hmsTotalHp: hmsDeckHp + hmsCannonHp + hmsRiggingHp,
		arbMainHp, arbCannonHp, arbRiggingHp,
		arbTotalHp: arbMainHp + arbCannonHp + arbRiggingHp,
		morale, arbCommanderSlain,
		hmsSunk, hmsSupplyLoss,
		mustering, readyCount,
	};
}

// ──────────────────────────────────────────────────────────────
// ARBRANCE LOCATION MANAGEMENT
// ──────────────────────────────────────────────────────────────

async function getArbranceZoneIds() {
	const ids = {};
	for (const def of ARBRANCE_ZONE_DEFS) {
		const id = await getFlag(`global.location_id_${def.key}`);
		if (id) ids[def.key] = id;
	}
	return ids;
}

function getMoraleRequirementForLocation(locationId, arbranceIds) {
	for (const [key, threshold] of Object.entries(ZONE_MORALE_THRESHOLDS)) {
		if (arbranceIds[key] === locationId) return threshold;
	}
	return null;
}

/**
 * Calculate morale-based speed multipliers for combat in a given location.
 * Effective morale = rawMorale - entranceThreshold (0 for locations with no threshold).
 * Below -20 effective morale: enemies gain +5% speed per 20-point tier past -20.
 * Above +20 effective morale: players gain +5% speed per 20-point tier past +20.
 * @param {number|string} locationId
 * @returns {Promise<{playerSpeedMultiplier: number, enemySpeedMultiplier: number}>}
 */
async function getMoraleSpeedMultipliers(locationId) {
	const rawMorale = await getFlag('global.hms_divine_morale');
	const arbranceIds = await getArbranceZoneIds();
	const threshold = getMoraleRequirementForLocation(locationId, arbranceIds) ?? 0;
	const effectiveMorale = rawMorale - threshold;

	if (effectiveMorale < -20) {
		const steps = Math.floor((-effectiveMorale - 20) / 20) + 1;
		return { playerSpeedMultiplier: 1, enemySpeedMultiplier: 1 + steps * 0.05 };
	}
	if (effectiveMorale > 20) {
		const steps = Math.floor((effectiveMorale - 20) / 20) + 1;
		return { playerSpeedMultiplier: 1 + steps * 0.05, enemySpeedMultiplier: 1 };
	}
	return { playerSpeedMultiplier: 1, enemySpeedMultiplier: 1 };
}

async function getArbranceLocations() {
	const arbranceIds = await getArbranceZoneIds();
	const ids = Object.values(arbranceIds).filter(Boolean);
	if (!ids.length) return [];
	return LocationBase.findAll({ where: { id: ids } });
}

async function ensureArbranceLocations() {
	for (const def of ARBRANCE_ZONE_DEFS) {
		const existingId = await getFlag(`global.location_id_${def.key}`);
		if (existingId) {
			const existing = await LocationBase.findByPk(existingId);
			if (existing) continue;
		}
		const zone = await LocationBase.create({
			name: def.name,
			type: 'battle',
			hidden: true,
		});
		await setFlag(`global.location_id_${def.key}`, zone.id);
		console.log('[Battle] Created Arbrance zone:', def.name);
	}
}

/**
 * Create Discord channels and roles for any Arbrance zone locations that are missing them.
 * Mirrors the pattern used by /location sync.
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<{created: string[], failed: string[]}>}
 */
async function syncArbranceLocations(guild) {
	const tlg = require('@root/Data/tlg.json');
	const { PermissionsBitField } = require('discord.js');

	const zones = await getArbranceLocations();
	const arbranceIds = await getArbranceZoneIds();
	const parentChannel = guild.channels.resolve(tlg.alCat);
	if (!parentChannel) {
		throw new Error('[Battle] Parent category (alCat) not found in guild. Check tlg.json.');
	}

	const created = [];
	const failed = [];

	for (const zone of zones) {
		// Skip if both channel and role already exist in Discord
		const existingRole = zone.role ? guild.roles.resolve(String(zone.role)) : null;
		const existingChannel = zone.channel ? guild.channels.resolve(String(zone.channel)) : null;
		if (existingRole && existingChannel) continue;

		let role = existingRole;
		let channel = existingChannel;
		let createdRole = false;
		let createdChannel = false;

		try {
			if (!role) {
				role = await guild.roles.create({ name: zone.name, mentionable: true });
				createdRole = true;
			}

			if (!channel) {
				const zoneKey = Object.keys(arbranceIds).find(k => arbranceIds[k] === zone.id);
				const zoneDef = ARBRANCE_ZONE_DEFS.find(d => d.key === zoneKey);
				const channelName = zoneDef ? zoneDef.channelName : (zoneKey ? zoneKey.replace(/_/g, '-') : 'arb-zone');
				channel = await guild.channels.create({
					name: channelName,
					parent: tlg.alCat,
					permissionOverwrites: [
						// Deny @everyone view access (hidden location)
						{
							id: guild.id,
							deny: [PermissionsBitField.Flags.ViewChannel],
						},
						// Grant the location role view access
						{
							id: role.id,
							allow: [PermissionsBitField.Flags.ViewChannel],
						},
					],
				});
				createdChannel = true;
			}

			const updateData = {};
			if (createdRole) updateData.role = role.id;
			if (createdChannel) updateData.channel = channel.id;
			if (Object.keys(updateData).length > 0) {
				await zone.update(updateData);
			}

			created.push(zone.name);
			console.log(`[Battle] Synced Discord for zone "${zone.name}" — role: ${createdRole}, channel: ${createdChannel}`);
		}
		catch (err) {
			if (createdRole && role) await role.delete().catch(() => undefined);
			if (createdChannel && channel) await channel.delete().catch(() => undefined);
			console.error(`[Battle] Failed to sync zone "${zone.name}":`, err);
			failed.push(zone.name);
		}
	}

	return { created, failed };
}

// ──────────────────────────────────────────────────────────────
// HMS RIGGING LOCATION MANAGEMENT
// ──────────────────────────────────────────────────────────────

async function getHMSRiggingLocation() {
	const id = await getFlag('global.location_id_hms_rigging');
	if (!id) return null;
	return LocationBase.findByPk(id);
}

async function ensureHMSRiggingLocation() {
	let zone = await getHMSRiggingLocation();
	if (!zone) {
		zone = await LocationBase.create({
			name: 'C\u1ED9t Bu\u1ED3m',
			type: 'battle',
			hidden: true,
		});
		await setFlag('global.location_id_hms_rigging', zone.id);
		console.log(`[Battle] Created HMS rigging location (ID ${zone.id})`);
	}
	return zone;
}

/**
 * Create a Discord channel and role for the HMS Rigging zone if missing.
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<{created: string[], failed: string[]}>}
 */
async function syncHMSRiggingLocation(guild) {
	const tlg = require('@root/Data/tlg.json');
	const { PermissionsBitField } = require('discord.js');

	const zone = await getHMSRiggingLocation();
	if (!zone) return { created: [], failed: [] };

	const existingRole = zone.role ? guild.roles.resolve(String(zone.role)) : null;
	const existingChannel = zone.channel ? guild.channels.resolve(String(zone.channel)) : null;
	if (existingRole && existingChannel) return { created: [], failed: [] };

	let role = existingRole;
	let channel = existingChannel;
	let createdRole = false;
	let createdChannel = false;

	try {
		if (!role) {
			role = await guild.roles.create({ name: zone.name, mentionable: true });
			createdRole = true;
		}

		if (!channel) {
			channel = await guild.channels.create({
				name: 'cot-buom',
				parent: tlg.alCat,
				permissionOverwrites: [
					{
						id: guild.id,
						deny: [PermissionsBitField.Flags.ViewChannel],
					},
					{
						id: role.id,
						allow: [PermissionsBitField.Flags.ViewChannel],
					},
				],
			});
			createdChannel = true;
		}

		const updateData = {};
		if (createdRole) updateData.role = role.id;
		if (createdChannel) updateData.channel = channel.id;
		if (Object.keys(updateData).length > 0) {
			await zone.update(updateData);
		}

		console.log(`[Battle] Synced Discord for HMS Rigging \u2014 role: ${createdRole}, channel: ${createdChannel}`);
		return { created: [zone.name], failed: [] };
	}
	catch (err) {
		if (createdRole && role) await role.delete().catch(() => undefined);
		if (createdChannel && channel) await channel.delete().catch(() => undefined);
		console.error('[Battle] Failed to sync HMS Rigging:', err);
		return { created: [], failed: [zone.name] };
	}
}

async function getStrangeShoreLocation() {
	const id = await getFlag('global.strange_shore_location_id');
	if (!id) return null;
	return LocationBase.findByPk(id);
}

async function ensureStrangeShoreLocation() {
	let zone = await getStrangeShoreLocation();
	if (!zone) {
		zone = await LocationBase.create({
			name: 'Strange Shore',
			type: 'outdoor',
			hidden: true,
		});
		await setFlag('global.strange_shore_location_id', zone.id);
		console.log(`[Battle] Created Strange Shore location (ID ${zone.id})`);
	}
	return zone;
}

async function sealBattleLocations() {
	const arbranceZones = await getArbranceLocations();

	// Un-hide Arbrance zones so they appear in the move menu during battle
	for (const zone of arbranceZones) {
		if (zone.hidden) await zone.update({ hidden: false });
	}

	// Link Boong Trên (4) <-> arb-main-deck (boarding entry, bidirectional)
	const sealIds = await getArbranceZoneIds();
	const arbMainDeckId = sealIds.arb_main_deck;
	if (arbMainDeckId) {
		await LocationLink.findOrCreate({ where: { location_id: BOONG_TREN_ID, linked_location_id: arbMainDeckId } });
		await LocationLink.findOrCreate({ where: { location_id: arbMainDeckId, linked_location_id: BOONG_TREN_ID } });
		console.log(`[Battle] Linked Boong Tren <-> arb-main-deck (ID ${arbMainDeckId})`);

		// Hub-and-spoke: all Arbrance zones link to/from arb-main-deck only
		const spokeKeys = ['arb_cannon_deck', 'arb_armory', 'arb_officer_quarters', 'arb_rigging'];
		for (const key of spokeKeys) {
			const spokeId = sealIds[key];
			if (spokeId) {
				await LocationLink.findOrCreate({ where: { location_id: arbMainDeckId, linked_location_id: spokeId } });
				await LocationLink.findOrCreate({ where: { location_id: spokeId, linked_location_id: arbMainDeckId } });
				console.log(`[Battle] Linked arb-main-deck <-> ${key} (ID ${spokeId})`);
			}
		}
	}

	// Un-hide HMS Rigging so it appears in the move menu during battle
	const hmsRigging = await getHMSRiggingLocation();
	if (hmsRigging && hmsRigging.hidden) await hmsRigging.update({ hidden: false });

	// Link Boong Trên (4) <-> HMS Rigging (players can climb to/from the rigging)
	if (hmsRigging) {
		await LocationLink.findOrCreate({ where: { location_id: BOONG_TREN_ID, linked_location_id: hmsRigging.id } });
		await LocationLink.findOrCreate({ where: { location_id: hmsRigging.id, linked_location_id: BOONG_TREN_ID } });
		console.log(`[Battle] Linked Boong Tren <-> HMS Rigging (ID ${hmsRigging.id})`);

		// Link HMS Rigging <-> arb-rigging (rigging-to-rigging boarding point)
		const arbRiggingId = sealIds.arb_rigging;
		if (arbRiggingId) {
			await LocationLink.findOrCreate({ where: { location_id: hmsRigging.id, linked_location_id: arbRiggingId } });
			await LocationLink.findOrCreate({ where: { location_id: arbRiggingId, linked_location_id: hmsRigging.id } });
			console.log(`[Battle] Linked HMS Rigging <-> arb-rigging (ID ${arbRiggingId})`);
		}
	}
}

async function unsealBattleLocations() {
	const arbranceZones = await getArbranceLocations();

	// Re-hide Arbrance zones so they no longer appear in the move menu
	for (const zone of arbranceZones) {
		if (!zone.hidden) await zone.update({ hidden: true });
	}

	// Re-hide HMS Rigging
	const hmsRiggingToHide = await getHMSRiggingLocation();
	if (hmsRiggingToHide && !hmsRiggingToHide.hidden) await hmsRiggingToHide.update({ hidden: true });

	// Remove all Arbrance hub-and-spoke links
	const unsealIds = await getArbranceZoneIds();
	const arbMainDeckId = unsealIds.arb_main_deck;
	if (arbMainDeckId) {
		// Remove Boong Trên <-> arb-main-deck
		await LocationLink.destroy({ where: { location_id: BOONG_TREN_ID, linked_location_id: arbMainDeckId } });
		await LocationLink.destroy({ where: { location_id: arbMainDeckId, linked_location_id: BOONG_TREN_ID } });

		// Remove spoke links
		const spokeKeys = ['arb_cannon_deck', 'arb_armory', 'arb_officer_quarters', 'arb_rigging'];
		for (const key of spokeKeys) {
			const spokeId = unsealIds[key];
			if (spokeId) {
				await LocationLink.destroy({ where: { location_id: arbMainDeckId, linked_location_id: spokeId } });
				await LocationLink.destroy({ where: { location_id: spokeId, linked_location_id: arbMainDeckId } });
			}
		}
	}

	// Remove Boong Trên <-> HMS Rigging and HMS Rigging <-> arb-rigging links
	const hmsRigging = await getHMSRiggingLocation();
	if (hmsRigging) {
		await LocationLink.destroy({ where: { location_id: BOONG_TREN_ID, linked_location_id: hmsRigging.id } });
		await LocationLink.destroy({ where: { location_id: hmsRigging.id, linked_location_id: BOONG_TREN_ID } });
		const arbRiggingId = unsealIds.arb_rigging;
		if (arbRiggingId) {
			await LocationLink.destroy({ where: { location_id: hmsRigging.id, linked_location_id: arbRiggingId } });
			await LocationLink.destroy({ where: { location_id: arbRiggingId, linked_location_id: hmsRigging.id } });
		}
	}
	console.log('[Battle] Battle locations unsealed');
}

// ──────────────────────────────────────────────────────────────
// NPC RELOCATION
// ──────────────────────────────────────────────────────────────

async function relocateNpcsForBattle() {
	// Remove all non-York NPCs from HMS zones
	const removed = await LocationContain.destroy({
		where: {
			location_id: HMS_ZONE_IDS,
			type: gamecon.NPC,
			object_id: { [Op.ne]: 'quartermaster-york' },
		},
	});

	// Move York to Living Quarters
	await LocationContain.update(
		{ location_id: BOONG_SINH_HOAT_ID },
		{ where: { object_id: 'quartermaster-york' } },
	);
	console.log(`[Battle] NPC relocation: removed ${removed} NPCs from HMS zones, York moved to Boong Sinh Hoat.`);
}

async function restoreNpcLocations() {
	// Restore York to Main Deck
	await LocationContain.update(
		{ location_id: BOONG_CHINH_ID },
		{ where: { object_id: 'quartermaster-york' } },
	);
	console.log('[Battle] York restored to Boong Chinh.');
}

// ──────────────────────────────────────────────────────────────
// PLAYER MOVEMENT
// ──────────────────────────────────────────────────────────────

async function assignPlayersToZones(guild) {
	// Move all characters currently in any HMS zone (including rigging) to the rally point
	const hmsRigging = await getHMSRiggingLocation();
	const allHmsIds = hmsRigging ? [...HMS_ZONE_IDS, hmsRigging.id] : HMS_ZONE_IDS;
	const players = await CharacterBase.findAll({
		where: { location_id: allHmsIds },
	});

	let moved = 0;
	for (const char of players) {
		if (char.location_id === BOONG_SINH_HOAT_ID) continue;
		try {
			await locationUtil.moveCharacterToLocation(char.id, BOONG_SINH_HOAT_ID, guild);
			moved++;
		}
		catch (err) {
			console.error(`[Battle] Failed to rally player ${char.id}:`, err);
		}
	}
	console.log(`[Battle] Rallied ${moved} players to Boong Sinh Hoat`);
}

async function forcedWithdrawal(guild) {
	// Move ALL players in any battle zone to Strange Shore — no exceptions
	const strangeShore = await ensureStrangeShoreLocation();
	if (strangeShore && strangeShore.hidden) await strangeShore.update({ hidden: false });

	const arbranceZones = await getArbranceLocations();
	const hmsRigging = await getHMSRiggingLocation();
	const allBattleIds = [...HMS_ZONE_IDS, ...arbranceZones.map(z => z.id)];
	if (hmsRigging) allBattleIds.push(hmsRigging.id);

	const players = await CharacterBase.findAll({ where: { location_id: allBattleIds } });

	for (const char of players) {
		try {
			await locationUtil.moveCharacterToLocation(char.id, strangeShore.id, guild);
		}
		catch (err) {
			console.error(`[Battle] Forced withdrawal failed for ${char.id}:`, err);
		}
	}

	if (players.length > 0) {
		console.log(`[Battle] Forced withdrawal: moved ${players.length} players to Strange Shore (${strangeShore.id})`);
	}
}

// ──────────────────────────────────────────────────────────────
// CANNON EXCHANGE
// ──────────────────────────────────────────────────────────────

/**
 * Simulate a single cannon volley.
 * @param {number} cannonPower - current cannon deck HP (= max damage output)
 * @param {number} attackerMobility - attacker rigging HP / 2
 * @param {number} defenderMobility - defender rigging HP / 2
 * @returns {{ topDeck: number, cannonDeck: number, rigging: number }}
 */
function simulateVolley(cannonPower, attackerMobility, defenderMobility) {
	const shots = Math.round(cannonPower / 10);
	const hitRate = (attackerMobility + 50) / (attackerMobility + defenderMobility + 100);

	let topDeck = 0, cannonDeck = 0, rigging = 0, misses = 0;
	for (let i = 0; i < shots; i++) {
		if (Math.random() >= hitRate) {
			misses++;
			continue;
		}
		const roll = Math.random();
		if (roll < 0.5) topDeck += 10;
		else if (roll < 0.8) cannonDeck += 10;
		else rigging += 10;
	}
	return { topDeck, cannonDeck, rigging, shots, misses, hits: shots - misses };
}

async function runCannonExchange() {
	const state = await getBattleState();

	const hmsMobility = Math.floor(state.hmsRiggingHp / 2);
	const arbMobility = Math.floor(state.arbRiggingHp / 2);

	const hmsDealt = simulateVolley(state.hmsCannonHp, hmsMobility, arbMobility);
	const arbCannonDebuff = await getArmoryCannonDebuff();
	const arbDealt = simulateVolley(Math.floor(state.arbCannonHp * arbCannonDebuff), arbMobility, hmsMobility);
	if (arbCannonDebuff < 1.0) console.log(`[Battle] Arb cannon debuffed to ${Math.round(arbCannonDebuff * 100)}% power (armory debuff)`);

	// Apply damage to Arbrance (clamped at 0)
	const newArbMain = Math.max(0, state.arbMainHp - hmsDealt.topDeck);
	const newArbCannon = Math.max(0, state.arbCannonHp - hmsDealt.cannonDeck);
	const newArbRig = Math.max(0, state.arbRiggingHp - hmsDealt.rigging);

	// Apply damage to HMS Divine (clamped at 0)
	const newHmsDeck = Math.max(0, state.hmsDeckHp - arbDealt.topDeck);
	const newHmsCannon = Math.max(0, state.hmsCannonHp - arbDealt.cannonDeck);
	const newHmsRig = Math.max(0, state.hmsRiggingHp - arbDealt.rigging);

	await Promise.all([
		setFlag('global.arb_main_deck_hp', newArbMain),
		setFlag('global.arb_cannon_deck_hp', newArbCannon),
		setFlag('global.arb_rigging_hp', newArbRig),
		setFlag('global.hms_divine_top_deck_hp', newHmsDeck),
		setFlag('global.hms_divine_cannon_deck_hp', newHmsCannon),
		setFlag('global.hms_divine_rigging_hp', newHmsRig),
	]);

	// HP-based morale: every 100 HP dealt to Arbrance main deck = +2; to HMS top deck = -2
	const arbTopDeckDmg = state.arbMainHp - newArbMain;
	const hmsTopDeckDmg = state.hmsDeckHp - newHmsDeck;
	const moraleFromHp = Math.floor(arbTopDeckDmg / 100) * 2 - Math.floor(hmsTopDeckDmg / 100) * 2;
	if (moraleFromHp !== 0) {
		await updateMorale(moraleFromHp);
	}

	// Morale-based cannon damage bonus: applied to top deck + rigging
	const currentMorale = await getFlag('global.hms_divine_morale');
	if (currentMorale !== 0) {
		const moraleDmg = Math.floor(Math.pow(Math.abs(currentMorale), 1.5) / 20);
		const moraleRiggingDmg = Math.floor(moraleDmg / 4);
		if (currentMorale > 0) {
			// Positive morale damages Arbrance
			const postArbMain = Math.max(0, newArbMain - moraleDmg);
			const postArbRig = Math.max(0, newArbRig - moraleRiggingDmg);
			await Promise.all([
				setFlag('global.arb_main_deck_hp', postArbMain),
				setFlag('global.arb_rigging_hp', postArbRig),
			]);
			console.log(`[Battle] Morale bonus damage -> Arbrance: main=${moraleDmg} rig=${moraleRiggingDmg} (morale=${currentMorale})`);
		}
		else {
			// Negative morale damages HMS Divine
			const postHmsDeck = Math.max(0, newHmsDeck - moraleDmg);
			const postHmsRig = Math.max(0, newHmsRig - moraleRiggingDmg);
			await Promise.all([
				setFlag('global.hms_divine_top_deck_hp', postHmsDeck),
				setFlag('global.hms_divine_rigging_hp', postHmsRig),
			]);
			console.log(`[Battle] Morale penalty damage -> HMS: deck=${moraleDmg} rig=${moraleRiggingDmg} (morale=${currentMorale})`);
		}
	}

	console.log(`[Battle] HMS volley -> Arbrance: main=${hmsDealt.topDeck} cannon=${hmsDealt.cannonDeck} rig=${hmsDealt.rigging}`);
	console.log(`[Battle] Arb volley -> HMS:      deck=${arbDealt.topDeck} cannon=${arbDealt.cannonDeck} rig=${arbDealt.rigging}`);

	return { hmsDealt, arbDealt };
}

/**
 * Post the cannon exchange report embed to the battle channel.
 * @param {import('discord.js').Guild} guild
 * @param {number} cycleCount - cycle number (after increment)
 * @param {{ topDeck: number, cannonDeck: number, rigging: number }} hmsDealt - damage HMS dealt to Arbrance
 * @param {{ topDeck: number, cannonDeck: number, rigging: number }} arbDealt - damage Arbrance dealt to HMS
 */
async function postCannonReport(guild, cycleCount, hmsDealt, arbDealt) {
	const { EmbedBuilder } = require('discord.js');
	const { EMOJI } = require('@root/enums.js');
	const SystemSettingUtil = require('@utility/systemSetting.js');

	const battleChannelId = await SystemSettingUtil.get('channel.battle');
	const battleChannel = battleChannelId
		? await guild.channels.fetch(String(battleChannelId)).catch(() => null)
		: null;
	if (!battleChannel) return;

	const state = await getBattleState();

	function hpBar(current, max, len = 8) {
		const filled = Math.round((current / max) * len);
		return '\u2588'.repeat(Math.max(0, filled)) + '\u2591'.repeat(Math.max(0, len - filled));
	}

	const hmsTotalDmg = arbDealt.topDeck + arbDealt.cannonDeck + arbDealt.rigging;
	const arbTotalDmg = hmsDealt.topDeck + hmsDealt.cannonDeck + hmsDealt.rigging;
	const moraleSign = state.morale >= 0 ? '+' : '';

	function row(label, dmg, hp, max) {
		return `${label.padEnd(12)} -${String(dmg).padStart(3)}  ${hpBar(hp, max)}  ${String(hp).padStart(3)}/${max}`;
	}

	function shotsLine(volley) {
		return `Shots: ${volley.hits}/${volley.shots} hit, ${volley.misses} missed`;
	}

	const embed = new EmbedBuilder()
		.setColor(0x8B4513)
		.setTitle(`${EMOJI.BOOM} Cannon Volley \u2014 Cycle ${cycleCount}`)
		.addFields(
			{
				name: 'HMS Divine \u2190 Arbrance',
				value: [
					'```',
					row('Top Deck', arbDealt.topDeck, state.hmsDeckHp, 400),
					row('Cannon Deck', arbDealt.cannonDeck, state.hmsCannonHp, 300),
					row('Rigging',     arbDealt.rigging,    state.hmsRiggingHp, 300),
					`Total damage: -${hmsTotalDmg}`,
					shotsLine(arbDealt),
					'```',
				].join('\n'),
				inline: false,
			},
			{
				name: 'Arbrance \u2190 HMS Divine',
				value: [
					'```',
					row('Main Deck',   hmsDealt.topDeck,    state.arbMainHp,   800),
					row('Cannon Deck', hmsDealt.cannonDeck, state.arbCannonHp, 450),
					row('Rigging',     hmsDealt.rigging,    state.arbRiggingHp, 250),
					`Total damage: -${arbTotalDmg}`,
					shotsLine(hmsDealt),
					'```',
				].join('\n'),
				inline: false,
			},
			{
				name: 'Morale',
				value: `${moraleSign}${state.morale}`,
				inline: false,
			},
		)
		.setFooter({ text: `HMS Divine: ${state.hmsTotalHp}/1000 \u2502 Arbrance: ${state.arbTotalHp}/1500` });

	await battleChannel.send({ embeds: [embed] });
}

// ──────────────────────────────────────────────────────────────
// MORALE
// ──────────────────────────────────────────────────────────────

async function updateMorale(delta) {
	const current = await getFlag('global.hms_divine_morale');
	const clamped = Math.max(-100, Math.min(100, current + delta));
	await setFlag('global.hms_divine_morale', clamped);
	return clamped;
}

/**
 * Compute the morale drain applied once per player phase (1 hour).
 * Positive morale drains faster; deeply negative morale drains slower.
 * Drain values are halved relative to original to reduce aggressiveness.
 * @param {number} morale
 * @returns {number} negative delta
 */
function calcMoraleDrain(morale, drainReduction = 0) {
	if (morale >= 0) {
		return -(Math.max(1, 10 - drainReduction) + morale * 0.30);
	}
	// Negative morale: dampened baseline drain by bracket
	if (morale >= -20) return Math.min(-1, -10 + drainReduction);
	else if (morale >= -40) return Math.min(-1, -8 + drainReduction);
	else if (morale >= -60) return Math.min(-1, -6 + drainReduction);
	else if (morale >= -80) return Math.min(-1, -4 + drainReduction);
	else return Math.min(-1, -2 + drainReduction);
}

// ──────────────────────────────────────────────────────────────
// END CONDITIONS & OUTCOME TIER
// ──────────────────────────────────────────────────────────────

async function checkEndConditions() {
	const state = await getBattleState();
	if (state.hmsTotalHp <= 0) return { ended: true, reason: 'hms_sunk' };
	if (state.arbTotalHp <= 0) return { ended: true, reason: 'arb_destroyed' };
	if (state.cycleCount >= 10) return { ended: true, reason: 'max_cycles' };
	return { ended: false, reason: null };
}

// ──────────────────────────────────────────────────────────────
// CYCLE
// ──────────────────────────────────────────────────────────────

/**
 * Resolve zone control: for each occupied Arbrance zone, deal boarding damage to that zone's HP flag.
 */
async function resolveZones() {
	const arbranceZones = await getArbranceLocations();

	const ZONE_DAMAGE = {
		'arb_main_deck': { flag: 'global.arb_main_deck_hp', dmg: 50 },
		'arb_cannon_deck': { flag: 'global.arb_cannon_deck_hp', dmg: 60 },
		'arb_rigging': { flag: 'global.arb_rigging_hp', dmg: 30 },
	};

	for (const zone of arbranceZones) {
		if (!Array.isArray(zone.tag)) continue;
		const zoneKey = zone.tag.find(t => ZONE_DAMAGE[t]);
		if (!zoneKey) continue;

		const occupants = await CharacterBase.count({ where: { location_id: zone.id } });
		if (occupants === 0) continue;

		const { flag, dmg } = ZONE_DAMAGE[zoneKey];
		const current = await getFlag(flag);
		const newVal = Math.max(0, current - dmg);
		await setFlag(flag, newVal);
		console.log(`[Battle] Zone resolution: ${zoneKey} occupied by ${occupants} players — dealt ${dmg} damage (${current} → ${newVal})`);
	}
}

async function resetCycleTrackers() {
	// placeholder — add per-cycle resets here as needed
}

/**
 * Run one full battle cycle. Called by cronUtility every 8 hours.
 * @param {import('discord.js').Client} client
 */
async function performHMSDivineBattleCycle(client) {
	const battleActive = await getFlag('global.hms_divine_battle_active');
	if (!battleActive) return;

	console.log('[Battle] Starting cycle...');

	const guild = client.guilds.cache.first() || null;

	// 1. Zone resolution — boarding damage from occupied Arbrance zones
	await resolveZones();

	// 2. Cannon exchange
	const { hmsDealt, arbDealt } = await runCannonExchange();

	// 3. Increment cycle counter
	const cycleCount = await getFlag('global.hms_divine_cycle_count');
	await setFlag('global.hms_divine_cycle_count', cycleCount + 1);

	// 3a. Post cannon exchange report
	if (guild) {
		await postCannonReport(guild, cycleCount + 1, hmsDealt, arbDealt).catch(err =>
			console.error('[Battle] Failed to post cannon report:', err),
		);
	}

	// 4. Hale death announcement — fires once after cycle 2 completes
	if (cycleCount + 1 === 2) {
		const haleAnnouncedAlready = await getFlag('global.hms_divine_hale_dead');
		if (!haleAnnouncedAlready) {
			await setFlag('global.hms_divine_hale_dead', 1);
			await updateMorale(-10);
			if (guild) {
				try {
					const SystemSettingUtil = require('@utility/systemSetting.js');
					const { EmbedBuilder } = require('discord.js');
					const battleChannelId = await SystemSettingUtil.get('channel.battle');
					const battleChannel = battleChannelId
						? await guild.channels.fetch(String(battleChannelId)).catch(() => null)
						: null;
					if (battleChannel) {
						const embed = new EmbedBuilder()
							.setColor(0x8B0000)
							.setTitle('\u2620\uFE0F Đội Trưởng Hàng — Đã Ngã')
							.setDescription(
								'Tin từ boong trước: **Thiếu tướng Hale** đã ngã trong cuộc pháo kích.\n\n'
								+ 'Sự hiện diện của ông không còn là chỗ dựa nữa. Tinh thần các chiến sĩ xuống thấp.',
							)
							.setFooter({ text: 'Tiếp tục chiến đấu.' });
						await battleChannel.send({ embeds: [embed] });
					}
				}
				catch (err) {
					console.error('[Battle] Failed to post Hale death announcement:', err);
				}
			}
		}
	}

	// 6. Check end conditions
	const { ended, reason } = await checkEndConditions();
	if (ended) {
		await endBattle(client, guild, reason);
		return;
	}

	// 7. Reset per-cycle trackers
	await resetCycleTrackers();

	console.log(`[Battle] Cycle ${cycleCount + 1} complete.`);
}

// ──────────────────────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────────────────────

async function _setInitialFlags() {
	const ts = Math.floor(Date.now() / 1000);
	await Promise.all([
		setFlag('global.hms_divine_battle_active', 1),
		setFlag('global.hms_divine_battle_initialized', 1),
		setFlag('global.hms_divine_top_deck_hp', 400),
		setFlag('global.hms_divine_cannon_deck_hp', 300),
		setFlag('global.hms_divine_rigging_hp', 300),
		setFlag('global.arb_main_deck_hp', 800),
		setFlag('global.arb_cannon_deck_hp', 450),
		setFlag('global.arb_rigging_hp', 250),
		setFlag('global.hms_divine_morale', -40),
		setFlag('global.hms_divine_cycle_count', 0),
		setFlag('global.hms_divine_phase_start_ts', ts),
		setFlag('global.arb_commander_slain', 0),
		setFlag('global.hms_divine_sunk', 0),
		setFlag('global.hms_divine_supply_loss', 0),
		setFlag('hms_divine_drain_reduction', 0),
		setFlag('global.arb_armory_wins', 0),
		setFlag('global.arb_armory_secured', 0),
		setFlag('global.arb_armory_budget_x10', 10),
		setFlag('global.arb_armory_wave_counter', 0),
		setFlag('global.arb_main_deck_foothold', 0),
		setFlag('global.hms_divine_mustering', 1),
		setFlag('global.hms_divine_ready_count', 0),
	]);
}

/**
/**
 * Create (or reuse) the battle announcements channel and store its ID in SystemSetting.
 * The channel is public (all members can view, bot-only can send).
 * @param {import('discord.js').Guild} guild
 */
async function ensureBattleChannel(guild) {
	const SystemSettingUtil = require('@utility/systemSetting.js');
	const { PermissionsBitField } = require('discord.js');
	const tlg = require('@root/Data/tlg.json');

	const existing = await SystemSettingUtil.get('channel.battle');
	if (existing) {
		const ch = guild.channels.resolve(String(existing));
		if (ch) return ch;
	}

	try {
		const channel = await guild.channels.create({
			name: 'battle-updates',
			parent: tlg.alCat,
			permissionOverwrites: [
				{
					id: guild.id,
					allow: [PermissionsBitField.Flags.ViewChannel],
					deny: [PermissionsBitField.Flags.SendMessages],
				},
				{
					id: tlg.botRoleID,
					allow: [PermissionsBitField.Flags.SendMessages],
				},
			],
		});
		await SystemSettingUtil.set('channel.battle', channel.id, 'global', null, 'HMS Divine battle announcements channel');
		console.log(`[Battle] Created battle announcements channel: ${channel.id}`);
		return channel;
	}
	catch (err) {
		console.error('[Battle] Failed to create battle announcements channel:', err);
		return null;
	}
}

/**
 * Full battle start: set flags, seal locations, relocate NPCs, rally players, announce.
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Client} client
 */
async function initBattle(guild, client) {
	console.log('[Battle] Initializing HMS Divine battle...');
	await _setInitialFlags();
	await ensureArbranceLocations();
	await ensureHMSRiggingLocation();
	const strangeShoreInit = await ensureStrangeShoreLocation();
	if (strangeShoreInit && !strangeShoreInit.hidden) await strangeShoreInit.update({ hidden: true });
	await sealBattleLocations();
	await relocateNpcsForBattle();
	if (guild) {
		await assignPlayersToZones(guild);
		await ensureBattleChannel(guild);
	}

	const { runActionsOnly } = require('@utility/eventUtility.js');
	// ensureBattleChannel must run before runActionsOnly so 'channel.battle' is set
	await runActionsOnly('hms-divine-battle-commence', '0', client).catch(err => {
		console.error('[Battle] Failed to post commence event:', err);
	});

	// Send the muster call — spawns begin only after MUSTER_REQUIRED players click Ready
	if (guild) {
		await sendMusterMessage(guild, client).catch(err => {
			console.error('[Battle] Failed to send muster message:', err);
		});
	}
	console.log('[Battle] Battle started.');
}

// ──────────────────────────────────────────────────────────────
// MUSTER SYSTEM
// ──────────────────────────────────────────────────────────────

async function sendMusterMessage(guild, _client) {
	const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
	const SystemSettingUtil = require('@utility/systemSetting.js');

	const channelId = await SystemSettingUtil.get('channel.battle');
	if (!channelId) {
		console.warn('[Muster] No battle channel found — skipping muster message');
		return;
	}
	const channel = guild.channels.cache.get(String(channelId));
	if (!channel) return;

	const embed = new EmbedBuilder()
		.setTitle('\u2694\ufe0f Battle Stations!')
		.setDescription(
			'The HMS Divine is within boarding range. All hands report to your positions!\n\n' +
			`Click **Ready** when you are in position. Enemies will not spawn until **${MUSTER_REQUIRED} players** are ready.`,
		)
		.setFooter({ text: `0 / ${MUSTER_REQUIRED} ready` });

	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId('battle_muster_ready')
			.setLabel('Ready')
			.setStyle(ButtonStyle.Success),
	);

	const msg = await channel.send({ embeds: [embed], components: [row] });
	await SystemSettingUtil.set('message.battle_muster', `${channelId}:${msg.id}`);
}

async function activateBattleSpawns(guild, _client) {
	const { EmbedBuilder } = require('discord.js');
	const SystemSettingUtil = require('@utility/systemSetting.js');

	await setFlag('global.hms_divine_mustering', 0);

	// Edit muster message to remove the button and show battle is live
	const ref = await SystemSettingUtil.get('message.battle_muster');
	if (ref) {
		const [channelId, messageId] = ref.split(':');
		try {
			const channel = guild.channels.cache.get(channelId);
			if (channel) {
				const msg = await channel.messages.fetch(messageId);
				const activatedEmbed = new EmbedBuilder()
					.setTitle('\u2694\ufe0f Battle Begins!')
					.setDescription('Enough crew are in position. Enemies are now boarding!')
					.setFooter({ text: `${MUSTER_REQUIRED} / ${MUSTER_REQUIRED} ready \u2014 Battle live` });
				await msg.edit({ embeds: [activatedEmbed], components: [] });
			}
		}
		catch (e) {
			console.error('[Muster] Failed to edit muster message:', e);
		}
	}

	console.log('[Battle] Muster complete — spawns now active.');
}

// ──────────────────────────────────────────────────────────────
// END
// ──────────────────────────────────────────────────────────────

/**
 * End the battle: restore locations, NPCs, post outcome, clear battle_active.
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Guild|null} guild
 * @param {string} [reason] - 'hms_sunk' | 'arb_destroyed' | 'max_cycles'
 */
async function endBattle(client, guild, reason = 'arb_destroyed') {
	console.log(`[Battle] Ending battle. Reason: ${reason}`);

	await unsealBattleLocations();
	await restoreNpcLocations();

	if (guild) {
		await forcedWithdrawal(guild);
	}

	// Clear battle_active last so admins can still query state before it clears
	await setFlag('global.hms_divine_battle_active', 0);
	console.log('[Battle] Battle ended.');
}

// ──────────────────────────────────────────────────────────────
// COMMAND HELPERS
// ──────────────────────────────────────────────────────────────

/**
 * Check if a character is currently in an Arbrance zone.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function isPlayerInArbranceZone(userId) {
	const char = await CharacterBase.findByPk(userId);
	if (!char) return false;
	const zones = await getArbranceLocations();
	const ids = zones.map(z => z.id);
	return ids.includes(char.location_id);
}

/**
 * Check if a character is in any HMS or Arbrance battle zone.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function isPlayerInBattleZone(userId) {
	const char = await CharacterBase.findByPk(userId);
	if (!char) return false;
	const zones = await getArbranceLocations();
	const hmsRigging = await getHMSRiggingLocation();
	const ids = [...HMS_ZONE_IDS, ...zones.map(z => z.id)];
	if (hmsRigging) ids.push(hmsRigging.id);
	return ids.includes(char.location_id);
}

/**
 * Pick a random combat enemy ID for a given location by querying LocationEnemySpawn.
 * Falls back to 'sailor' if no spawn rows are defined for the location.
 * @param {number|string} locationId
 * @returns {Promise<string>}
 */
async function pickEnemyForLocation(locationId) {
	const rows = await LocationEnemySpawn.findAll({ where: { location_id: locationId } });
	if (!rows.length) return 'sailor';

	const totalWeight = rows.reduce((sum, r) => sum + (r.spawn_chance ?? 100), 0);
	let roll = Math.random() * totalWeight;
	for (const row of rows) {
		roll -= (row.spawn_chance ?? 100);
		if (roll <= 0) return row.enemy_base_id;
	}
	return rows[rows.length - 1].enemy_base_id;
}

// ──────────────────────────────────────────────────────────────
// RANDOM ENCOUNTER SYSTEM
// ──────────────────────────────────────────────────────────────

// Regular encounters expire after 30 minutes
const ENCOUNTER_TTL_MS = 30 * 60 * 1000;
// Armory wave encounters expire after 15 minutes
const ARMORY_ENCOUNTER_TTL_MS = 15 * 60 * 1000;
// Armory waves arrive every 30 minutes
const ARMORY_WAVE_INTERVAL_MS = 30 * 60 * 1000;
// 70% enemy encounter, 30% hazard
const ENCOUNTER_ENEMY_CHANCE = 0.7;

// ──────────────────────────────────────────────────────────────
// ARMORY WAVE SYSTEM
// ──────────────────────────────────────────────────────────────

// Enemy pool for armory waves. Cost is derived from level (lv3/4 = 1.0, lv5+ = 1.5).
const ARMORY_WAVE_ENEMY_POOL = [
	{ enemy_id: 'veteran_sailor', spawn_chance: 40 },
	{ enemy_id: 'boarder',        spawn_chance: 35 },
	{ enemy_id: 'man_at_arms',    spawn_chance: 25 },
];

// In-memory timer handle — survives only while the bot is running; CronLog.next_run persists across restarts
let _armoryWaveTimer = null;
let _armoryGuild = null;

/**
 * Schedule the next armory wave setTimeout. Clears any existing timer first.
 * @param {import('discord.js').Guild} guild
 * @param {number} delayMs
 */
function scheduleArmoryWave(guild, delayMs) {
	if (_armoryWaveTimer) clearTimeout(_armoryWaveTimer);
	_armoryGuild = guild;
	_armoryWaveTimer = setTimeout(async () => {
		_armoryWaveTimer = null;
		await spawnArmoryWave(guild).catch(e => console.error('[Armory] Scheduled wave spawn failed:', e));
	}, delayMs);
	console.log(`[Armory] Next wave scheduled in ${Math.round(delayMs / 60000)}m`);
}

/**
 * Get the budget cost for an enemy based on its level (lv3/4 = 1.0, lv5+ = 1.5).
 * @param {string} enemyId
 * @returns {number}
 */
function getArmoryEnemyCost(enemyId) {
	const def = contentStore.enemies.findByPk(enemyId);
	const level = def?.level || 3;
	return level >= 5 ? 1.5 : 1.0;
}

/**
 * Build the enemy list for an armory wave that fits within the given budget.
 * @param {number} budget
 * @returns {string[]} Array of enemy_id strings
 */
function buildArmoryWave(budget) {
	const enemies = [];
	let remaining = budget;
	while (remaining > 0) {
		const candidates = ARMORY_WAVE_ENEMY_POOL.filter(e => getArmoryEnemyCost(e.enemy_id) <= remaining);
		if (!candidates.length) break;
		const totalWeight = candidates.reduce((s, c) => s + c.spawn_chance, 0);
		let roll = Math.random() * totalWeight;
		let picked = candidates[candidates.length - 1];
		for (const c of candidates) {
			roll -= c.spawn_chance;
			if (roll <= 0) { picked = c; break; }
		}
		enemies.push(picked.enemy_id);
		remaining = Math.round((remaining - getArmoryEnemyCost(picked.enemy_id)) * 10) / 10;
	}
	return enemies;
}

/**
 * Spawn an armory wave if players are present and no active wave exists.
 * Called by the encounter cron after spawnEncounters().
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<number|null>} The waveId, or null if no wave was spawned.
 */
async function spawnArmoryWave(guild) {
	const battleActive = await getFlag('global.hms_divine_battle_active');
	if (!battleActive) return null;

	const armorySecured = await getFlag('global.arb_armory_secured');
	if (armorySecured) return null;

	// Find the armory location
	const armoryId = await getFlag('global.location_id_arb_armory');
	const armory = armoryId ? await LocationBase.findByPk(armoryId) : null;
	if (!armory || !armory.channel) return null;

	// Check if players are present — safety reset if none (retaken is handled immediately on departure)
	const players = await CharacterBase.findAll({ where: { location_id: armory.id } });
	if (!players.length) {
		// Safety reset: players left without the departure handler firing cleanly
		clearTimeout(_armoryWaveTimer);
		_armoryWaveTimer = null;
		_armoryGuild = null;
		await CronLog.upsert({
			job_name: 'armory_wave_spawn',
			status: 'stopped',
			next_run: null,
			is_enabled: false,
		});
		await setFlag('global.arb_armory_wins', 0);
		await setFlag('global.arb_armory_wave_counter', 0);
		return null;
	}

	// Check if there's already an active (pending) wave
	const activeWave = await PendingEncounter.findOne({
		where: {
			location_id: armory.id,
			status: 'pending',
			wave_id: { [Op.ne]: null },
		},
	});
	if (activeWave) return null;

	// Compute budget from stored ×10 value
	const budgetX10 = await getFlag('global.arb_armory_budget_x10');
	const budget = (budgetX10 || 10) / 10;

	const waveEnemies = buildArmoryWave(budget);
	if (!waveEnemies.length) return null;

	const waveCounter = await getFlag('global.arb_armory_wave_counter');
	const waveId = waveCounter + 1;

	if (waveId === 1) {
		// First wave — armory was empty when players entered; announce on battle channel
		const { runActionsOnly } = require('@utility/eventUtility.js');
		await runActionsOnly('arb-armory-occupied', '0', guild.client).catch(e =>
			console.error('[Armory] Failed to post occupied announce:', e)
		);
	}

	await setFlag('global.arb_armory_wave_counter', waveId);

	const target = players[Math.floor(Math.random() * players.length)];
	const expiresAt = new Date(Date.now() + ARMORY_ENCOUNTER_TTL_MS);

	const { EMOJI } = require('../enums');
	const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

	const channel = await guild.channels.fetch(String(armory.channel)).catch(() => null);
	if (!channel) return null;

	for (let i = 0; i < waveEnemies.length; i++) {
		const enemyId = waveEnemies[i];
		const record = await PendingEncounter.create({
			target_player_id: target.id,
			enemy_id: enemyId,
			location_id: armory.id,
			channel_id: String(armory.channel),
			expires_at: expiresAt,
			status: 'pending',
			wave_id: waveId,
		});

		const waveLabel = waveEnemies.length > 1 ? ` (${i + 1}/${waveEnemies.length})` : '';
		const embed = new EmbedBuilder()
			.setTitle(`${EMOJI.SWORD} Armory Wave!`)
			.setDescription(`A **${enemyId.replace(/_/g, ' ')}** blocks the armory${waveLabel}!\n\n<@${target.id}> is targeted.`)
			.setFooter({ text: `Wave ${waveId}/10 \u2022 Expires in 15 min` });

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`encounter_fight|${record.id}`)
				.setLabel('Fight')
				.setStyle(ButtonStyle.Danger),
		);

		const msg = await channel.send({ embeds: [embed], components: [row] });
		await record.update({ message_id: msg.id });
	}

	console.log(`[Armory] Spawned wave #${waveId} with enemies: ${waveEnemies.join(', ')} (budget ${budget})`);

	// Persist next wave time and schedule the next wave timer
	const nextWaveAt = new Date(Date.now() + ARMORY_WAVE_INTERVAL_MS);
	await CronLog.upsert({
		job_name: 'armory_wave_spawn',
		status: 'running',
		last_run: new Date(),
		next_run: nextWaveAt,
		is_enabled: true,
	});
	scheduleArmoryWave(guild, ARMORY_WAVE_INTERVAL_MS);

	return waveId;
}

/**
 * Check if all encounters in a wave are resolved.
 * If all are wins → trigger wave win logic. Otherwise silent (next cycle spawns new wave).
 * @param {import('discord.js').Guild} guild
 * @param {number} waveId
 */
async function checkArmoryWaveCompletion(guild, waveId) {
	if (!waveId) return;

	const encounters = await PendingEncounter.findAll({ where: { wave_id: waveId } });
	if (!encounters.length) return;

	const allResolved = encounters.every(e => e.status !== 'pending');
	if (!allResolved) return;

	const allWon = encounters.every(e => e.outcome === 'win');
	if (!allWon) {
		console.log(`[Armory] Wave #${waveId} failed (not all encounters won).`);
		return;
	}

	// Wave win!
	const wins = await getFlag('global.arb_armory_wins');
	const newWins = wins + 1;
	await setFlag('global.arb_armory_wins', newWins);

	// Increase budget by 0.5 (stored ×10, so +5)
	const budgetX10 = await getFlag('global.arb_armory_budget_x10');
	const newBudgetX10 = budgetX10 + 5;
	await setFlag('global.arb_armory_budget_x10', newBudgetX10);

	// Win bonus morale: +N where N = current win count
	await updateMorale(newWins);

	const willSecure = newWins >= 10;
	if (willSecure) {
		await setFlag('global.arb_armory_secured', 1);
	}

	const debuffPct = willSecure ? 30 : newWins * 3;

	// Post announcement to armory channel
	try {
		const armoryAnnounceId = await getFlag('global.location_id_arb_armory');
		const armory = armoryAnnounceId ? await LocationBase.findByPk(armoryAnnounceId) : null;
		if (armory && armory.channel) {
			const { EMOJI } = require('../enums');
			const { EmbedBuilder } = require('discord.js');
			const channel = await guild.channels.fetch(String(armory.channel)).catch(() => null);
			if (channel) {
				const nextBudget = (newBudgetX10 / 10).toFixed(1);
				const embed = new EmbedBuilder()
					.setTitle(willSecure
						? `${EMOJI.SUCCESS} Armory Secured!`
						: `${EMOJI.SUCCESS} Wave Cleared! (${newWins}/10)`)
					.setDescription(willSecure
						? `The armory is now under control after **${newWins}** victories!\n\nEnemy units permanently deal **30% less damage**.`
						: `Wave cleared! **+${newWins} Morale**\n\nEnemies now deal **${debuffPct}% less damage** while players hold the armory.`)
					.setColor(willSecure ? 0xf1c40f : 0x27ae60);
				await channel.send({ embeds: [embed] });
			}
		}
	}
	catch (e) {
		console.error('[Armory] Failed to post wave win announcement:', e);
	}

	// Battle channel narrate for final securing
	if (willSecure) {
		const { runActionsOnly } = require('@utility/eventUtility.js');
		await runActionsOnly('arb-armory-secured', '0', guild.client).catch(e =>
			console.error('[Armory] Failed to post secured announce:', e)
		);
	}

	console.log(`[Armory] Wave #${waveId} won. Total wins: ${newWins}. Next budget: ${(newBudgetX10 / 10).toFixed(1)}. Secured: ${willSecure}`);
}

/**
 * Post a server-wide announcement to the battle channel when the main deck foothold is established.
 * @param {import('discord.js').Guild} guild
 */
async function postMainDeckFootholdAnnouncement(guild) {
	const { EmbedBuilder } = require('discord.js');
	const { EMOJI } = require('../enums');
	const SystemSettingUtil = require('@utility/systemSetting.js');

	const channelId = await SystemSettingUtil.get('channel.battle');
	if (!channelId) return;
	const channel = guild.channels.cache.get(String(channelId));
	if (!channel) return;

	const embed = new EmbedBuilder()
		.setColor(0xe74c3c)
		.setTitle(`${EMOJI.SUCCESS} Foothold Established!`)
		.setDescription(
			`A boarding party has fought through the enemy defenders and seized control of **La Dauphine\u2019s main deck**!\n\n` +
			`The fighting on the main deck has subsided \u2014 the path forward is clear.`
		);
	await channel.send({ embeds: [embed] });
}

/**
 * Compute the enemy damage multiplier for a fight, applying the 20% armory debuff if applicable.
 * - Armory secured: 0.8 (applies everywhere)
 * - Players in armory (not secured): 0.8 (applies only to armory zone)
 * - Otherwise: 1.0
 * @param {number|null} locationId - The location where combat is happening, or null
 * @returns {Promise<number>}
 */
async function getArmoryDamageMultiplier(locationId) {
	const armorySecured = await getFlag('global.arb_armory_secured');
	if (armorySecured) return 0.70; // 10 wins — permanent 30% debuff

	if (locationId != null) {
		const armoryDmgId = await getFlag('global.location_id_arb_armory');
		if (armoryDmgId && armoryDmgId === locationId) {
			// Ramp: 3% per wave win while players hold the armory
			const wins = await getFlag('global.arb_armory_wins');
			if (wins <= 0) return 1.0;
			return Math.max(0.70, 1.0 - wins * 0.03);
		}
	}
	return 1.0;
}



/**
 * Compute the Arbrance cannon power multiplier for the cannon exchange.
 * - Armory secured (permanent): 0.70
 * - Armory currently occupied by players: ramp-based max(0.70, 1.0 - wins * 0.03)
 * - Otherwise: 1.0 (no debuff)
 * @returns {Promise<number>}
 */
async function getArmoryCannonDebuff() {
	const armorySecured = await getFlag('global.arb_armory_secured');
	if (armorySecured) return 0.70;

	const armoryCannonId = await getFlag('global.location_id_arb_armory');
	if (!armoryCannonId) return 1.0;

	const occupants = await CharacterBase.count({ where: { location_id: armoryCannonId } });
	if (occupants === 0) return 1.0;

	const wins = await getFlag('global.arb_armory_wins');
	if (wins <= 0) return 1.0;
	return Math.max(0.70, 1.0 - wins * 0.03);
}

/**
 * Resolve a hazard against a random target player in a zone.
 * Deals damage based on a d1000 stat check. Announces result to the zone channel.
 *
 * @param {import('discord.js').Guild} guild
 * @param {object} targetChar - CharacterBase instance of the target
 * @param {string} hazardId
 * @param {object} locationBase - LocationBase instance of the zone
 */
async function resolveHazard(guild, targetChar, hazardId, locationBase) {
	const { EMOJI } = require('../enums');
	const hazard = contentStore.hazards.findByPk(hazardId);
	if (!hazard) {
		console.warn(`[Encounter] Unknown hazard id: ${hazardId}`);
		return;
	}

	const statValue = targetChar[hazard.stat] ?? 0;
	const roll = Math.floor(Math.random() * 1000) + 1;
	const threshold = Math.floor(statValue * hazard.difficulty_mod * 10);
	const dodged = roll <= threshold;

	let message;
	if (dodged) {
		message = hazard.flavor_dodge.replace('{target}', `<@${targetChar.id}>`);
		message = `${EMOJI.SUCCESS} ${message}`;
	}
	else {
		const dmg = hazard.min_dmg + Math.floor(Math.random() * (hazard.max_dmg - hazard.min_dmg + 1));
		let finalDmg = dmg;
		let resisted = false;
		if (hazard.resist_stat) {
			const resistValue = targetChar[hazard.resist_stat] ?? 0;
			const resistRoll = Math.floor(Math.random() * 1000) + 1;
			const resistThreshold = Math.floor(resistValue * (hazard.resist_mod ?? 1) * 10);
			if (resistRoll <= resistThreshold) {
				finalDmg = Math.floor(dmg / 2);
				resisted = true;
			}
		}
		const newHp = Math.max(0, (targetChar.currentHp ?? 0) - finalDmg);
		await targetChar.update({ currentHp: newHp });
		await updateMorale(1);
		const hitFlavor = (resisted && hazard.flavor_resist) ? hazard.flavor_resist : hazard.flavor_hit;
		message = hitFlavor.replace('{target}', `<@${targetChar.id}>`);
		message = `${EMOJI.WARNING} ${message} (-${finalDmg} HP)`;
		if (newHp <= 0) {
			await locationUtil.moveCharacterToLocation(targetChar.id, BOONG_SINH_HOAT_ID, guild);
			message += `\n${EMOJI.FAILURE} <@${targetChar.id}> has been knocked out and dragged back to the living quarters.`;
		}
	}

	if (locationBase && locationBase.channel) {
		try {
			const channel = await guild.channels.fetch(locationBase.channel).catch(() => null);
			if (channel) await channel.send(message);
		}
		catch (e) {
			console.error('[Encounter] Failed to post hazard result:', e);
		}
	}
}

/**
 * Spawn one random encounter (enemy or hazard) per active battle zone that has players.
 * Called by the 30-min cron job.
 *
 * @param {import('discord.js').Guild} guild
 */
async function spawnEncounters(guild) {
	const battleActive = await getFlag('global.hms_divine_battle_active');
	if (!battleActive) {
		console.log('[SpawnEncounters] Battle not active — skipping.');
		return;
	}

	// Wait for enough players to muster before spawning enemies
	const mustering = await getFlag('global.hms_divine_mustering');
	if (mustering) {
		console.log('[Battle] Still mustering — no spawns yet');
		return;
	}

	const morale = await getFlag('global.hms_divine_morale');
	const allLocations = await LocationBase.findAll();
	const { EMOJI } = require('../enums');
	const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

	let totalEncounters = 0;
	let totalHazards = 0;
	console.log(`[SpawnEncounters] Cycle start — morale: ${morale}, zones: ${SPAWN_ZONE_DEFS.length}`);

	for (const zoneDef of SPAWN_ZONE_DEFS) {
		// Find location by stored ID flag (key-based) or by hardcoded id
		let location;
		if (zoneDef.id != null) {
			location = allLocations.find(loc => loc.id === zoneDef.id);
		}
		else if (zoneDef.key) {
			const flagName = zoneDef.key === 'hms_rigging'
				? 'global.location_id_hms_rigging'
				: `global.location_id_${zoneDef.key}`;
			const id = await getFlag(flagName);
			if (id) location = allLocations.find(loc => loc.id === id);
		}
		if (!location) {
			console.log(`[SpawnEncounters] Zone ${zoneDef.key ?? zoneDef.id} — location not found, skipping.`);
			continue;
		}

		// breachOnly zones only activate when morale < -20 AND HMS top deck HP is below half (200)
		if (zoneDef.breachOnly) {
			const deckHp = await getFlag('global.hms_divine_top_deck_hp');
			if (morale >= -20 || deckHp >= 200) {
				console.log(`[SpawnEncounters] Zone ${zoneDef.key ?? zoneDef.id} — breachOnly not met (morale: ${morale}, deckHp: ${deckHp}), skipping.`);
				continue;
			}
		}

		// Spawn count: 4 base, +1 per 10 negative morale, -1 per 10 positive morale.
		// Zones with a morale entry cost subtract that cost before calculating.
		const moraleCost = ZONE_MORALE_THRESHOLDS[zoneDef.key] ?? 0;
		const effectiveMorale = morale - moraleCost;
		const rawSpawn = Math.max(0, 4 + Math.floor(-effectiveMorale / 10));
		const spawnCount = zoneDef.halfSpawn ? Math.floor(rawSpawn / 2) : rawSpawn;
		if (!spawnCount) {
			console.log(`[SpawnEncounters] Zone ${zoneDef.key ?? zoneDef.id} — spawnCount 0 (effectiveMorale: ${effectiveMorale}), skipping.`);
			continue;
		}

		// Find players present in this zone
		const players = await CharacterBase.findAll({ where: { location_id: location.id } });
		console.log(`[SpawnEncounters] Zone ${zoneDef.key ?? zoneDef.id} — spawnCount: ${spawnCount}, players: ${players.length}`);
		if (!players.length) {
			// Undefended HMS zone: each unchallenged spawn deals -2 morale and -10 ship HP
			if (zoneDef.hmsZone) {
				for (let s = 0; s < spawnCount; s++) {
					if (Math.random() < ENCOUNTER_ENEMY_CHANCE) {
						await updateMorale(-2);
						const currentDeckHp = await getFlag('global.hms_divine_top_deck_hp');
						await setFlag('global.hms_divine_top_deck_hp', Math.max(0, currentDeckHp - 10));
						console.log(`[Battle] Undefended HMS zone ${location.id} — enemy spawned unopposed, -2 morale, -10 ship HP (was ${currentDeckHp}).`);
					}
				}
			}
			// Undefended Arbrance rigging — snipers have line-of-sight to the main deck below
			else if (zoneDef.key === 'arb_rigging') {
				const mainDeckFlagId = await getFlag('global.location_id_arb_main_deck');
				if (mainDeckFlagId) {
					const mainDeckLoc = allLocations.find(loc => loc.id === mainDeckFlagId);
					if (mainDeckLoc) {
						const mainDeckPlayers = await CharacterBase.findAll({ where: { location_id: mainDeckLoc.id } });
						if (mainDeckPlayers.length) {
							for (let s = 0; s < spawnCount; s++) {
								const target = mainDeckPlayers[Math.floor(Math.random() * mainDeckPlayers.length)];
								await resolveHazard(guild, target, 'musket_shot', mainDeckLoc);
							}
							console.log(`[Battle] Undefended arb_rigging — ${spawnCount} musket shot(s) fired at arb_main_deck.`);
						}
					}
				}
			}
			continue;
		}

		const channelId = location.channel;
		if (!channelId) continue;

		const channel = await guild.channels.fetch(channelId).catch(() => null);
		if (!channel) continue;

		for (let s = 0; s < spawnCount; s++) {
			const target = players[Math.floor(Math.random() * players.length)];
			const isEnemy = Math.random() < ENCOUNTER_ENEMY_CHANCE;

			if (isEnemy) {
				// Enemy encounter — post a fight button to the zone channel
				const enemyId = await pickEnemyForLocation(location.id);
				const expiresAt = new Date(Date.now() + ENCOUNTER_TTL_MS);

				const record = await PendingEncounter.create({
					target_player_id: target.id,
					enemy_id: enemyId,
					location_id: location.id,
					channel_id: channelId,
					expires_at: expiresAt,
					status: 'pending',
				});

				try {
					const spawnEnemyData = contentStore.enemies.findByPk(String(enemyId));
					const spawnEnemyLabel = spawnEnemyData?.name || enemyId.replace(/-/g, ' ');
					const embed = new EmbedBuilder()
						.setTitle(`${EMOJI.SWORD} Under Attack!`)
						.setDescription(`A **${spawnEnemyLabel}** has engaged <@${target.id}>.`)
						.setFooter({ text: 'Expires in 30 minutes' });

					const row = new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setCustomId(`encounter_fight|${record.id}`)
							.setLabel('Fight')
							.setStyle(ButtonStyle.Danger),
					);

					const msg = await channel.send({ embeds: [embed], components: [row] });
					await record.update({ message_id: msg.id });
					totalEncounters++;
				}
				catch (e) {
					console.error('[Encounter] Failed to post encounter message:', e);
				}
			}
			else {
				// Hazard encounter — resolve immediately against the target
				if (!zoneDef.hazards.length) continue;
				const hazardId = zoneDef.hazards[Math.floor(Math.random() * zoneDef.hazards.length)];
				await resolveHazard(guild, target, hazardId, location);
				totalHazards++;
			}
		}
	}

	console.log(`[SpawnEncounters] Done — encounters posted: ${totalEncounters}, hazards resolved: ${totalHazards}`);

}

/**
 * Expire and clean up pending encounters that have timed out.
 * Edits the Discord message to remove buttons and mark as expired.
 *
 * @param {import('discord.js').Guild} guild
 */
async function resolveExpiredEncounters(guild) {
	const expired = await PendingEncounter.findAll({
		where: {
			status: 'pending',
			expires_at: { [Op.lt]: new Date() },
		},
	});

	const combatUtil = require('@utility/combatUtility.js');
	const { EMOJI } = require('../enums');
	const { EmbedBuilder } = require('discord.js');

	for (const record of expired) {
		await record.update({ status: 'resolved', fighter_id: record.target_player_id });

		// Remove buttons from original message
		try {
			const channel = await guild.channels.fetch(record.channel_id).catch(() => null);
			if (channel && record.message_id) {
				const msg = await channel.messages.fetch(record.message_id).catch(() => null);
				if (msg) await msg.delete().catch(() => {});
			}
		}
		catch (e) {
			console.error('[Encounter] Failed to remove encounter buttons:', e);
		}

		// Auto-resolve: original target fights the enemy, paying 5 stamina (or half-speed if insufficient)
		try {
			const targetChar = await CharacterBase.findOne({ where: { id: record.target_player_id } });
			const targetStamina = targetChar ? (targetChar.currentStamina ?? 0) : 0;
			const STAMINA_COST = 5;
			let autoSpeedMultiplier = 1;
			if (targetChar) {
				if (targetStamina >= STAMINA_COST) {
					await targetChar.update({ currentStamina: targetStamina - STAMINA_COST });
				}
				else {
					autoSpeedMultiplier = 0.7;
				}
			}
			const armoryDmgMult = await getArmoryDamageMultiplier(record.location_id);
			const moraleMultipliers = await getMoraleSpeedMultipliers(record.location_id);
			const result = await combatUtil.mainCombat(record.target_player_id, record.enemy_id, {
				enemyStartHp: record.enemy_current_hp ?? undefined,
				enemyDamageMultiplier: armoryDmgMult,
				playerSpeedMultiplier: autoSpeedMultiplier * moraleMultipliers.playerSpeedMultiplier,
				enemySpeedMultiplier: moraleMultipliers.enemySpeedMultiplier,
			});
			const won = (result?.finalState?.player?.hp ?? 0) > 0 && (result?.finalState?.enemy?.hp ?? 1) <= 0;
			const autoEnemyData = contentStore.enemies.findByPk(String(record.enemy_id));
			const enemyLabel = autoEnemyData?.name || record.enemy_id.replace(/-/g, ' ');

			// Update battle morale based on auto-resolve result
			const moraleDelta = won ? (ENEMY_MORALE_VALUES[record.enemy_id] ?? 1) : -3;
			await updateMorale(moraleDelta);
			// Boss kill: permanently reduce drain baseline by 2
			if (won && BOSS_ENEMIES.has(record.enemy_id)) {
				const currentReduction = await getFlag('hms_divine_drain_reduction');
				await setFlag('hms_divine_drain_reduction', currentReduction + 2);
			}

			// Armory wave: set outcome and check completion
			if (record.wave_id != null) {
				await record.update({ outcome: won ? 'win' : 'loss' });
				await checkArmoryWaveCompletion(guild, record.wave_id);
			}

			// If defeated, move player to living quarters
			if (!won) {
				await locationUtil.moveCharacterToLocation(record.target_player_id, BOONG_SINH_HOAT_ID, guild);
				console.log(`[Battle] Player ${record.target_player_id} defeated (auto-resolve) — moved to living quarters.`);
			}

			const channel = await guild.channels.fetch(record.channel_id).catch(() => null);
			if (channel) {
				const resultEmbed = new EmbedBuilder()
					.setDescription(won
						? `${EMOJI.SUCCESS} <@${record.target_player_id}> dealt with the **${enemyLabel}**.`
						: `${EMOJI.FAILURE} <@${record.target_player_id}> was bested by the **${enemyLabel}**.`);
				await channel.send({ embeds: [resultEmbed] });
			}
		}
		catch (e) {
			console.error('[Encounter] Failed to auto-resolve expired encounter:', e);
		}
	}
	if (expired.length) {
		console.log(`[Encounter] Auto-resolved ${expired.length} expired encounter(s).`);
	}
}

/**
 * Called when a player enters the armory.
 * If this is the first player (kickstarter), records entry time and spawns an immediate
 * veteran_sailor encounter for them. Wave spawning (waves 1-10) remains with encounterSpawnJob.
 * @param {import('discord.js').Guild} guild
 * @param {string} characterId - Discord user ID of the arriving player
 */
async function onArmoryPlayerArrived(guild, characterId) {
	const battleActive = await getFlag('global.hms_divine_battle_active');
	if (!battleActive) return;
	const armorySecured = await getFlag('global.arb_armory_secured');
	if (armorySecured) return;

	// Gate: if wave timer is already running, this is not the kickstarter
	const existingLog = await CronLog.findOne({ where: { job_name: 'armory_wave_spawn' } });
	if (existingLog && existingLog.status === 'running') return;

	// Persist the wave schedule so the 15-min gate and restart recovery both work
	const nextWaveAt = new Date(Date.now() + ARMORY_WAVE_INTERVAL_MS);
	await CronLog.upsert({
		job_name: 'armory_wave_spawn',
		status: 'running',
		last_run: new Date(),
		next_run: nextWaveAt,
		description: 'Armory wave timer — next_run holds when the next wave should fire',
		is_enabled: true,
	});
	scheduleArmoryWave(guild, ARMORY_WAVE_INTERVAL_MS);
	console.log(`[Armory] First player entered — wave 1 scheduled for ${nextWaveAt.toISOString()}`);

	// Spawn an immediate veteran_sailor encounter for the kickstarting player
	try {
		const kickstartArmoryId = await getFlag('global.location_id_arb_armory');
		const armory = kickstartArmoryId ? await LocationBase.findByPk(kickstartArmoryId) : null;
		if (!armory || !armory.channel) return;

		const { EMOJI } = require('../enums');
		const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

		const expiresAt = new Date(Date.now() + ENCOUNTER_TTL_MS);
		const record = await PendingEncounter.create({
			target_player_id: characterId,
			enemy_id: 'veteran_sailor',
			location_id: armory.id,
			channel_id: String(armory.channel),
			expires_at: expiresAt,
			status: 'pending',
			wave_id: null,
		});

		const channel = await guild.channels.fetch(String(armory.channel)).catch(() => null);
		if (!channel) return;

		const embed = new EmbedBuilder()
			.setTitle(`${EMOJI.SWORD} A Guard!`)
			.setDescription(`A **Veteran Sailor** bars the way into the armory!\n\n<@${characterId}> must deal with them before the others notice.`)
			.setFooter({ text: 'Entry guard \u2022 Expires in 30 min' });

		const row = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`encounter_fight|${record.id}`)
				.setLabel('Fight')
				.setStyle(ButtonStyle.Danger),
		);

		const msg = await channel.send({ embeds: [embed], components: [row] });
		await record.update({ message_id: msg.id });
		console.log(`[Armory] Spawned entry guard (veteran_sailor) for kickstarter ${characterId} (encounter #${record.id})`);
	}
	catch (e) {
		console.error('[Armory] Failed to spawn entry guard:', e);
	}
}

/**
 * Called when a player leaves the armory.
 * If the last player departed, fires arb-armory-retaken immediately and resets wave state.
 * @param {number} armoryLocationId
 * @param {import('discord.js').Client} client
 */
/**
 * Called when a player leaves the armory.
 * - If the departing player had pending wave encounters:
 *     - Other players still present → retarget each encounter immediately with a 5-min expiry
 *     - No players left → wave fail: cancel encounters, fall through to full reset
 * - If this was the last player: cancel wave timer, fire arb-armory-retaken, reset wave state.
 * @param {number} armoryLocationId
 * @param {string} characterId - Discord user ID of the departing player
 * @param {import('discord.js').Client} client
 */
async function onArmoryPlayerDeparted(armoryLocationId, characterId, client) {
	const remaining = await CharacterBase.findAll({ where: { location_id: armoryLocationId } });

	// Find pending wave encounters targeting the departing player
	const pendingWaveEncs = await PendingEncounter.findAll({
		where: {
			location_id: armoryLocationId,
			target_player_id: characterId,
			status: 'pending',
			wave_id: { [Op.ne]: null },
		},
	});

	if (pendingWaveEncs.length > 0) {
		if (remaining.length > 0) {
			// Retarget each encounter immediately to a random remaining player (5-min TTL)
			const { EMOJI } = require('../enums');
			const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

			for (const enc of pendingWaveEncs) {
				const newTarget = remaining[Math.floor(Math.random() * remaining.length)];
				const newExpiry = new Date(Date.now() + 5 * 60 * 1000);

				// Delete old message
				try {
					if (enc.channel_id && enc.message_id) {
						const ch = await client.channels.fetch(String(enc.channel_id)).catch(() => null);
						if (ch) {
							const oldMsg = await ch.messages.fetch(String(enc.message_id)).catch(() => null);
							if (oldMsg) await oldMsg.delete().catch(() => {});
						}
					}
				}
				catch (_) { /* ignore */ }

				await enc.update({ target_player_id: newTarget.id, expires_at: newExpiry, message_id: null });

				// Post new embed targeting the new player
				try {
					const ch = await client.channels.fetch(String(enc.channel_id)).catch(() => null);
					if (ch) {
						const enemyLabel = enc.enemy_id.replace(/_/g, ' ');
						const enemyHp = enc.enemy_current_hp ?? 0;
						const enemyData = contentStore.enemies.findByPk(String(enc.enemy_id));
						const enemyMaxHp = enemyData?.stat?.health || 100;

						const embed = new EmbedBuilder()
							.setTitle(`${EMOJI.SWORD} Retargeted!`)
							.setDescription(`A **${enemyLabel}** turns its attention to <@${newTarget.id}>!`)
.setFooter({ text: `HP: ${enemyHp}/${enemyMaxHp} \u2022 Expires in 5 min` });

						const row = new ActionRowBuilder().addComponents(
							new ButtonBuilder()
								.setCustomId(`encounter_fight|${enc.id}`)
								.setLabel('Fight')
								.setStyle(ButtonStyle.Danger),
						);

						const msg = await ch.send({ embeds: [embed], components: [row] });
						await enc.update({ message_id: msg.id });
					}
				}
				catch (e) {
					console.error('[Armory] Failed to post retarget encounter message:', e);
				}

				console.log(`[Armory] Wave encounter #${enc.id} retargeted from ${characterId} to ${newTarget.id}.`);
			}
		}
		else {
			// No remaining players — wave fail: cancel all encounters in the affected waves
			const waveIds = [...new Set(pendingWaveEncs.map(e => e.wave_id))];
			for (const waveId of waveIds) {
				const allWaveEncs = await PendingEncounter.findAll({ where: { wave_id: waveId, status: 'pending' } });
				for (const enc of allWaveEncs) {
					try {
						if (enc.channel_id && enc.message_id) {
							const ch = await client.channels.fetch(String(enc.channel_id)).catch(() => null);
							if (ch) {
								const msg = await ch.messages.fetch(String(enc.message_id)).catch(() => null);
								if (msg) await msg.delete().catch(() => {});
							}
						}
					}
					catch (_) { /* ignore */ }
					await enc.update({ status: 'cancelled' });
				}
				console.log(`[Armory] Wave #${waveId} cancelled — no remaining players to retarget.`);
			}
		}
	}

	if (remaining.length > 0) return; // others still inside

	// Last player departed — cancel the wave timer and reset state
	clearTimeout(_armoryWaveTimer);
	_armoryWaveTimer = null;
	_armoryGuild = null;
	await CronLog.upsert({
		job_name: 'armory_wave_spawn',
		status: 'stopped',
		next_run: null,
		is_enabled: false,
	});

	const waveCounter = await getFlag('global.arb_armory_wave_counter');

	if (waveCounter > 0) {
		// Waves had started — announce that Arbrance retook the armory
		const { runActionsOnly } = require('@utility/eventUtility.js');
		await runActionsOnly('arb-armory-retaken', '0', client).catch(e =>
			console.error('[Armory] Failed to post retaken announce:', e)
		);
		await setFlag('global.arb_armory_wins', 0);
		await setFlag('global.arb_armory_wave_counter', 0);
		console.log('[Armory] Last player left — wave state reset.');
	}
}

/**
 * Dry-run through spawnEncounters and return a human-readable report of what
 * each spawn zone would do, without creating any encounters or dealing any damage.
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<string[]>} Array of status lines, one per zone
 */
async function diagnoseSpawn(guild) {
	const lines = [];
	const battleActive = await getFlag('global.hms_divine_battle_active');
	lines.push(`battle_active: **${battleActive ? 'YES' : 'NO'}**`);
	if (!battleActive) return lines;

	const mustering = await getFlag('global.hms_divine_mustering');
	const readyCount = await getFlag('global.hms_divine_ready_count');
	lines.push(`mustering: **${mustering ? `YES (${readyCount}/${MUSTER_REQUIRED} ready)` : 'NO'}**`);
	if (mustering) return lines;

	const morale = await getFlag('global.hms_divine_morale');
	const deckHp = await getFlag('global.hms_divine_top_deck_hp');
	lines.push(`morale: **${morale}**, top deck HP: **${deckHp}**\n`);

	const allLocations = await LocationBase.findAll();

	for (const zoneDef of SPAWN_ZONE_DEFS) {
		const label = zoneDef.key ?? `id:${zoneDef.id}`;

		let location;
		if (zoneDef.id != null) {
			location = allLocations.find(loc => loc.id === zoneDef.id);
		}
		else if (zoneDef.key) {
			const flagName = zoneDef.key === 'hms_rigging'
				? 'global.location_id_hms_rigging'
				: `global.location_id_${zoneDef.key}`;
			const id = await getFlag(flagName);
			if (id) location = allLocations.find(loc => loc.id === id);
		}

		if (!location) {
			lines.push(`**${label}**: \u274C location not found`);
			continue;
		}

		if (zoneDef.breachOnly) {
			if (morale >= -20 || deckHp >= 200) {
				lines.push(`**${label}**: \u23ED breach condition not met (morale=${morale}, deckHp=${deckHp})`);
				continue;
			}
		}

		const moraleCost = ZONE_MORALE_THRESHOLDS[zoneDef.key] ?? 0;
		const effectiveMorale = morale - moraleCost;
		const rawSpawn = Math.max(0, 4 + Math.floor(-effectiveMorale / 10));
		const spawnCount = zoneDef.halfSpawn ? Math.floor(rawSpawn / 2) : rawSpawn;
		if (!spawnCount) {
			lines.push(`**${label}**: \u23ED spawn count is 0 (effectiveMorale=${effectiveMorale})`);
			continue;
		}

		const players = await CharacterBase.findAll({ where: { location_id: location.id } });
		const channelId = location.channel;
		const channelOk = channelId ? (guild.channels.resolve(channelId) != null ? '\u2705' : '\u26A0\uFE0F not in cache') : '\u274C not set';

		lines.push(
			`**${label}** (loc ${location.id}): spawns=${spawnCount}, players=${players.length}, channel=${channelId ?? 'null'} ${channelOk}`,
		);
	}

	return lines;
}

module.exports = {
	// Flag helpers
	getFlag,
	setFlag,
	// State
	getBattleState,
	// Locations
	getArbranceLocations,
	getArbranceZoneIds,
	ensureArbranceLocations,
	syncArbranceLocations,
	getHMSRiggingLocation,
	ensureHMSRiggingLocation,
	syncHMSRiggingLocation,
	sealBattleLocations,
	unsealBattleLocations,
	// NPCs
	relocateNpcsForBattle,
	restoreNpcLocations,
	// Players
	assignPlayersToZones,
	forcedWithdrawal,
	isPlayerInArbranceZone,
	isPlayerInBattleZone,
	// Combat mechanics
	runCannonExchange,
	updateMorale,
	checkEndConditions,
	// Cycle
	resolveZones,
	resetCycleTrackers,
	performHMSDivineBattleCycle,
	// Muster system
	sendMusterMessage,
	activateBattleSpawns,
	MUSTER_REQUIRED,
	// Lifecycle
	initBattle,
	endBattle,
	// Command helpers
	pickEnemyForLocation,
	// Random encounters
	spawnEncounters,
	diagnoseSpawn,
	resolveExpiredEncounters,
	// Armory wave system
	spawnArmoryWave,
	scheduleArmoryWave,
	checkArmoryWaveCompletion,
	getArmoryDamageMultiplier,
	onArmoryPlayerArrived,
	onArmoryPlayerDeparted,
	// Main deck boarding
	postMainDeckFootholdAnnouncement,
	// Constants
	HMS_ZONE_IDS,
	BOONG_TREN_ID,
	BOONG_CHINH_ID,
	BOONG_SINH_HOAT_ID,
	ARBRANCE_CLUSTER_ID,
	ENEMY_MORALE_VALUES,
	BOSS_ENEMIES,
	getMoraleRequirementForLocation,
	getMoraleSpeedMultipliers,
	calcMoraleDrain,
	getFlag,
	setFlag,
	// Officer Cabin
	OFFICER_ROLES,
	officerCabinSessions,
};
