const Sequelize = require('sequelize');

const raid = (sequelize) => {
	return sequelize.define('raid', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		description: {
			type: Sequelize.TEXT,
			allowNull: true,
		},
		// Raid status: 'inactive', 'preparing', 'active', 'completed', 'failed'
		status: {
			type: Sequelize.ENUM('inactive', 'preparing', 'active', 'completed', 'failed'),
			defaultValue: 'inactive',
			allowNull: false,
		},
		// Channel ID where the raid takes place
		channel_id: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		// Thread ID for organizing raid within a thread (optional)
		thread_id: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		// Interval between monster spawns in minutes
		spawn_interval_minutes: {
			type: Sequelize.INTEGER,
			defaultValue: 5,
			allowNull: false,
		},

		// ============ ACT/AGENDA PROGRESS SYSTEM ============
		// Act = Player progress (good outcome if completed)
		current_act: {
			type: Sequelize.INTEGER,
			defaultValue: 1,
			allowNull: false,
		},
		current_act_points: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		// Agenda = Enemy progress (bad outcome if completed)
		current_agenda: {
			type: Sequelize.INTEGER,
			defaultValue: 1,
			allowNull: false,
		},
		current_agenda_points: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},

		// Monsters defeated count
		monsters_defeated: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		// Events triggered count
		events_triggered: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		// Raid configuration (spawn tables, event chances, etc.)
		config: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		// Event pool for random events (JSON array of event IDs)
		event_pool: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		// When the raid was scheduled to start
		scheduled_start_at: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// When raid actually started
		started_at: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// When raid ended
		ended_at: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// Last updated timestamp
		updated_at: {
			type: Sequelize.DATE,
			defaultValue: Sequelize.NOW,
		},
	}, {
		timestamps: false,
		indexes: [
			{ fields: ['status'] },
			{ fields: ['channel_id'] },
			{ fields: ['thread_id'] },
			{ fields: ['scheduled_start_at'] },
		],
	});
};

// Defines act/agenda stages for a raid
// Act = player progress milestones (completing final act = victory)
// Agenda = enemy progress milestones (completing final agenda = defeat)
const raidStage = (sequelize) => {
	return sequelize.define('raid_stage', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		raid_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		// 'act' (player progress) or 'agenda' (enemy progress)
		stage_type: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		// Stage number (1, 2, 3...)
		stage_number: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		description: {
			type: Sequelize.TEXT,
			allowNull: true,
		},
		// Points needed to complete this stage and advance to next
		goal_points: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 100,
		},
		// Effects when this stage is reached (JSON)
		// Examples: { "spawn_boss": 5, "difficulty_modifier": 1.5, "message": "The horde grows stronger!" }
		effects: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		// Is this the final stage? Reaching it ends the raid
		is_final: {
			type: Sequelize.BOOLEAN,
			defaultValue: false,
		},
	}, {
		timestamps: false,
		indexes: [
			{ fields: ['raid_id'] },
			{ fields: ['stage_type'] },
			{ fields: ['raid_id', 'stage_type', 'stage_number'] },
		],
	});
};

// Tracks the currently active monster in a raid channel
const raidMonster = (sequelize) => {
	return sequelize.define('raid_monster', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		raid_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		// Reference to raid_monster_lib (spawn config)
		lib_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		// Reference to enemy_base (copied from lib for convenience)
		enemy_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		// Discord message ID where the monster is displayed
		message_id: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		// Monster status: 'queued', 'active', 'fighting', 'defeated'
		status: {
			type: Sequelize.STRING,
			defaultValue: 'queued',
			allowNull: false,
		},
		// Current HP
		current_hp: {
			type: Sequelize.INTEGER,
			allowNull: true,
		},
		// Max HP (copied from enemy for this instance)
		max_hp: {
			type: Sequelize.INTEGER,
			allowNull: true,
		},
		// Who is currently fighting this monster (character_id)
		fighting_character_id: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		// Queue position (lower = spawns first)
		queue_position: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
		},
		// Accumulated agenda points (resets after action)
		agenda_accumulated: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
		},
		// Spawned timestamp
		spawned_at: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// Defeated timestamp
		defeated_at: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// Who defeated (character_id)
		defeated_by: {
			type: Sequelize.STRING,
			allowNull: true,
		},
	}, {
		timestamps: false,
		indexes: [
			{ fields: ['raid_id'] },
			{ fields: ['lib_id'] },
			{ fields: ['status'] },
			{ fields: ['message_id'] },
			{ fields: ['queue_position'] },
		],
	});
};

// Defines which monsters can spawn in a raid and their scoring config
// Replaces the old monster_pool JSON array
const raidMonsterLib = (sequelize) => {
	return sequelize.define('raid_monster_lib', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		raid_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		// Reference to enemy_base
		enemy_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		// Spawn weight (higher = more likely to spawn)
		spawn_weight: {
			type: Sequelize.INTEGER,
			defaultValue: 1,
		},
		// Points added to act when this monster is defeated
		act_score: {
			type: Sequelize.INTEGER,
			defaultValue: 1,
		},
		// Points added to agenda per tick while alive
		agenda_score: {
			type: Sequelize.INTEGER,
			defaultValue: 1,
		},
		// When accumulated reaches this cap, monster performs agenda_action
		agenda_cap: {
			type: Sequelize.INTEGER,
			defaultValue: 10,
		},
		// Action to perform when agenda_cap is reached
		// { type: "agenda", value: 5 } = add 5 points to raid agenda
		agenda_action: {
			type: Sequelize.JSON,
			defaultValue: { type: 'agenda', value: 1 },
		},
	}, {
		timestamps: false,
		indexes: [
			{ fields: ['raid_id'] },
			{ fields: ['enemy_id'] },
			{ fields: ['raid_id', 'enemy_id'] },
		],
	});
};

const raidBoss = (sequelize) => {
	return sequelize.define('raid_boss', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		raid_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		description: {
			type: Sequelize.TEXT,
			allowNull: true,
		},
		// Boss status: 'inactive', 'active', 'defeated'
		status: {
			type: Sequelize.ENUM('inactive', 'active', 'defeated'),
			defaultValue: 'inactive',
			allowNull: false,
		},
		// Boss type/category
		boss_type: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		// Boss level
		level: {
			type: Sequelize.INTEGER,
			defaultValue: 1,
			allowNull: false,
		},
		// Current health (tracked across all phases)
		current_health: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		// Phase information (for multi-phase bosses)
		current_phase: {
			type: Sequelize.INTEGER,
			defaultValue: 1,
			allowNull: false,
		},
		total_phases: {
			type: Sequelize.INTEGER,
			defaultValue: 1,
			allowNull: false,
		},
		// Avatar/image for the boss
		avatar: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		// Who defeated the boss (character ID)
		defeated_by: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		// Created timestamp
		created_at: {
			type: Sequelize.DATE,
			defaultValue: Sequelize.NOW,
		},
		// Last updated timestamp
		updated_at: {
			type: Sequelize.DATE,
			defaultValue: Sequelize.NOW,
		},
	}, {
		timestamps: false,
		indexes: [
			{ fields: ['raid_id'] },
			{ fields: ['status'] },
			{ fields: ['level'] },
			{ fields: ['boss_type'] },
		],
	});
};

const raidBossPhase = (sequelize) => {
	return sequelize.define('raid_boss_phase', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		raid_boss_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		phase_number: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		description: {
			type: Sequelize.TEXT,
			allowNull: true,
		},
		// Health stats for this phase
		max_health: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		// Attack stats for this phase
		attack: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		defense: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		speed: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		// Special abilities and resistances for this phase (JSON)
		abilities: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		resistances: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		weaknesses: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		// Loot table for this phase (JSON)
		loot_table: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		// Experience reward for completing this phase
		exp_reward: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		// Phase transition conditions (JSON)
		transition_conditions: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		// Avatar/image for this phase
		avatar: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		// Phase status: 'inactive', 'active', 'completed'
		status: {
			type: Sequelize.ENUM('inactive', 'active', 'completed'),
			defaultValue: 'inactive',
			allowNull: false,
		},
		// Created timestamp
		created_at: {
			type: Sequelize.DATE,
			defaultValue: Sequelize.NOW,
		},
		// Last updated timestamp
		updated_at: {
			type: Sequelize.DATE,
			defaultValue: Sequelize.NOW,
		},
	}, {
		timestamps: false,
		indexes: [
			{ fields: ['raid_boss_id'] },
			{ fields: ['phase_number'] },
			{ fields: ['status'] },
			{ fields: ['raid_boss_id', 'phase_number'], unique: true },
		],
	});
};

module.exports = { raid, raidStage, raidMonster, raidMonsterLib, raidBoss, raidBossPhase };