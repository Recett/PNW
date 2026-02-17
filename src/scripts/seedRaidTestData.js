/**
 * Seed Test Raid Data Script
 * 
 * Creates test data for the raid system:
 * - Test enemies (Goblin Scout, Goblin Warrior, Orc Brute)
 * - Test raid with stages (acts and agendas)
 * - Monster library for the raid
 * 
 * Usage: node scripts/seedRaidTestData.js
 */

const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
	dialect: 'sqlite',
	logging: false,
	storage: path.join(__dirname, '..', 'database.sqlite'),
});

// Import models
const enemyModels = require('../models/enemy/enemyModel.js');
const EnemyBase = enemyModels.enemyBase(sequelize);
const EnemyBaseStat = enemyModels.enemyBaseStat(sequelize);

const raidModels = require('../models/raid/raidModel.js');
const Raid = raidModels.raid(sequelize);
const RaidStage = raidModels.raidStage(sequelize);
const RaidMonsterLib = raidModels.raidMonsterLib(sequelize);
const RaidBoss = raidModels.raidBoss(sequelize);

// Test Enemy Data
const TEST_ENEMIES = [
	{
		id: 1001,
		fullname: 'Goblin Scout',
		name: 'Goblin Scout',
		unknown_name: 'Small Creature',
		avatar: null,
		lv: 1,
		enemy_type: 'minion',
		tag: { type: 'goblin', difficulty: 'easy' },
		reward: { gold: 10, exp: 5 },
		stats: {
			health: 30,
			defense: 2,
			defense_percent: 0,
			crit_resistance: 0,
			evade: 10,
			speed: 15,
		},
	},
	{
		id: 1002,
		fullname: 'Goblin Warrior',
		name: 'Goblin Warrior',
		unknown_name: 'Green Creature',
		avatar: null,
		lv: 3,
		enemy_type: 'soldier',
		tag: { type: 'goblin', difficulty: 'normal' },
		reward: { gold: 25, exp: 15 },
		stats: {
			health: 60,
			defense: 5,
			defense_percent: 5,
			crit_resistance: 5,
			evade: 5,
			speed: 12,
		},
	},
	{
		id: 1003,
		fullname: 'Orc Brute',
		name: 'Orc Brute',
		unknown_name: 'Large Beast',
		avatar: null,
		lv: 5,
		enemy_type: 'elite',
		tag: { type: 'orc', difficulty: 'hard' },
		reward: { gold: 50, exp: 30 },
		stats: {
			health: 120,
			defense: 10,
			defense_percent: 10,
			crit_resistance: 10,
			evade: 0,
			speed: 8,
		},
	},
];

// Test Raid Configuration
const TEST_RAID = {
	id: 1,
	name: 'Goblin Incursion',
	description: 'A horde of goblins has been spotted near the town! Defend the settlement before they overwhelm the defenses.',
	status: 'inactive',
	channel_id: 'PLACEHOLDER', // Will be set when starting the raid
	thread_id: null,
	spawn_interval_minutes: 1, // Fast spawns for testing
	current_act: 1,
	current_act_points: 0,
	current_agenda: 1,
	current_agenda_points: 0,
	monsters_defeated: 0,
	events_triggered: 0,
	config: {
		monsterSpawnChance: 90,
		eventSpawnChance: 10,
		maxMonstersInQueue: 5,
	},
	event_pool: [], // No events for basic test
};

// Test Raid Stages (Acts = Player Progress, Agendas = Enemy Progress)
const TEST_STAGES = [
	// Acts (Player victory conditions)
	{
		raid_id: 1,
		stage_type: 'act',
		stage_number: 1,
		name: 'First Blood',
		description: 'Defeat the initial wave of scouts.',
		goal_points: 10,
		effects: { message: 'The scouts have been routed!' },
		is_final: false,
	},
	{
		raid_id: 1,
		stage_type: 'act',
		stage_number: 2,
		name: 'Push Back',
		description: 'Drive the goblin forces back.',
		goal_points: 25,
		effects: { message: 'The goblins are retreating!' },
		is_final: false,
	},
	{
		raid_id: 1,
		stage_type: 'act',
		stage_number: 3,
		name: 'Victory',
		description: 'Complete the final push and secure victory.',
		goal_points: 40,
		effects: { message: 'VICTORY! The goblin horde has been defeated!' },
		is_final: true,
	},
	// Agendas (Enemy victory conditions)
	{
		raid_id: 1,
		stage_type: 'agenda',
		stage_number: 1,
		name: 'Gathering Forces',
		description: 'The goblins are massing their troops.',
		goal_points: 15,
		effects: { message: 'Warning: The goblin forces grow stronger!' },
		is_final: false,
	},
	{
		raid_id: 1,
		stage_type: 'agenda',
		stage_number: 2,
		name: 'Overwhelming Numbers',
		description: 'The horde grows too large to contain.',
		goal_points: 30,
		effects: { message: 'DEFEAT! The town has been overrun!' },
		is_final: true,
	},
];

// Monster Library (which enemies can spawn and their scoring)
const TEST_MONSTER_LIB = [
	{
		raid_id: 1,
		enemy_id: 1001, // Goblin Scout
		spawn_weight: 5, // Most common
		act_score: 2, // Points added to act when defeated
		agenda_score: 1, // Points accumulated per tick
		agenda_cap: 5, // Triggers action when accumulated
		agenda_action: { type: 'agenda', value: 1 }, // Adds 1 to raid agenda
	},
	{
		raid_id: 1,
		enemy_id: 1002, // Goblin Warrior
		spawn_weight: 3,
		act_score: 5,
		agenda_score: 2,
		agenda_cap: 4,
		agenda_action: { type: 'agenda', value: 2 },
	},
	{
		raid_id: 1,
		enemy_id: 1003, // Orc Brute
		spawn_weight: 1, // Rare
		act_score: 10,
		agenda_score: 3,
		agenda_cap: 3,
		agenda_action: { type: 'agenda', value: 5 },
	},
];

// Test Boss (Optional - spawned via acts/agenda system)
const TEST_BOSS = {
	raid_id: 1,
	name: 'Grakthor the Goblin Chief',
	description: 'The leader of the goblin horde, a cunning and brutal commander.',
	status: 'inactive',
	boss_type: 'chief',
	level: 10,
	current_health: 500,
	current_phase: 1,
	total_phases: 2,
	avatar: null,
};

async function seedData() {
	try {
		console.log('Starting raid test data seeding...\n');

		// Seed Enemies
		console.log('Creating test enemies...');
		for (const enemy of TEST_ENEMIES) {
			const { stats, ...enemyData } = enemy;
			
			// Upsert enemy base
			await EnemyBase.upsert(enemyData);
			console.log(`  ✓ Created/Updated enemy: ${enemy.fullname} (ID: ${enemy.id})`);

			// Upsert enemy stats
			await EnemyBaseStat.upsert({
				enemy_id: enemy.id,
				...stats,
			});
			console.log(`    → Stats: HP=${stats.health}, DEF=${stats.defense}, SPD=${stats.speed}`);
		}

		// Seed Raid
		console.log('\nCreating test raid...');
		await Raid.upsert(TEST_RAID);
		console.log(`  ✓ Created/Updated raid: ${TEST_RAID.name} (ID: ${TEST_RAID.id})`);

		// Seed Raid Stages - Delete existing and recreate to avoid unique constraint issues
		console.log('\nCreating raid stages...');
		// First, delete all existing stages for this raid
		await RaidStage.destroy({ where: { raid_id: 1 } });
		console.log('  → Cleared existing stages for raid 1');
		
		for (const stage of TEST_STAGES) {
			await RaidStage.create(stage);
			console.log(`  ✓ Created ${stage.stage_type} ${stage.stage_number}: ${stage.name}`);
		}

		// Seed Monster Library
		console.log('\nCreating monster library...');
		for (const lib of TEST_MONSTER_LIB) {
			// Check if entry exists
			const existing = await RaidMonsterLib.findOne({
				where: {
					raid_id: lib.raid_id,
					enemy_id: lib.enemy_id,
				},
			});

			const enemy = TEST_ENEMIES.find(e => e.id === lib.enemy_id);
			
			if (existing) {
				await existing.update(lib);
				console.log(`  ✓ Updated lib entry: ${enemy?.fullname} (weight: ${lib.spawn_weight})`);
			} else {
				await RaidMonsterLib.create(lib);
				console.log(`  ✓ Created lib entry: ${enemy?.fullname} (weight: ${lib.spawn_weight})`);
			}
		}

		// Seed Boss (optional)
		console.log('\nCreating test boss...');
		const existingBoss = await RaidBoss.findOne({
			where: { raid_id: TEST_BOSS.raid_id, name: TEST_BOSS.name },
		});

		if (existingBoss) {
			await existingBoss.update(TEST_BOSS);
			console.log(`  ✓ Updated boss: ${TEST_BOSS.name}`);
		} else {
			await RaidBoss.create(TEST_BOSS);
			console.log(`  ✓ Created boss: ${TEST_BOSS.name}`);
		}

		console.log('\n' + '='.repeat(50));
		console.log('✅ Raid test data seeding complete!');
		console.log('='.repeat(50));
		console.log('\nYou can now use /testraid to start the raid in a channel.');
		console.log('Test raid ID: 1');
		console.log('Test enemies: IDs 1001-1003');

	} catch (error) {
		console.error('❌ Error seeding raid test data:', error);
		throw error;
	} finally {
		await sequelize.close();
	}
}

// Run if executed directly
if (require.main === module) {
	seedData();
}

module.exports = { seedData, TEST_RAID, TEST_ENEMIES, TEST_STAGES, TEST_MONSTER_LIB, TEST_BOSS };
