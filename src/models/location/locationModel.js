const Sequelize = require('sequelize');

const locationBase = (sequelize) => {
	return sequelize.define('location_base', {
		name: { type: Sequelize.STRING, allowNull: false },
		channel: { type: Sequelize.STRING },
		description: Sequelize.STRING,
		type: Sequelize.STRING,
		role: Sequelize.STRING,
		lock: Sequelize.BOOLEAN,
		tag: Sequelize.JSON,
		time: Sequelize.STRING,
	}, { timestamps: false });
};

const locationCluster = (sequelize) => {
	return sequelize.define('location_cluster', {
		cluster_id: { type: Sequelize.STRING },
	}, { timestamps: false });
};

const locationLink = (sequelize) => {
	return sequelize.define('location_link', {
		location_id: Sequelize.STRING,
		linked_location_id: Sequelize.STRING,
	}, { timestamps: false });
};

const locationContain = (sequelize) => {
	return sequelize.define('location_contain', {
		location_id: Sequelize.STRING,
		object_id: Sequelize.STRING,
		type: Sequelize.STRING,
		time: Sequelize.STRING,
	}, { timestamps: false });
};

const locationResourceNodeSpawn = (sequelize) => {
	return sequelize.define('location_resource_node_spawn', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		location_id: { type: Sequelize.STRING, allowNull: false },
		resource_node_lib_id: { type: Sequelize.INTEGER, allowNull: false },
		spawn_chance: { type: Sequelize.INTEGER, defaultValue: 100 },
		min_count: { type: Sequelize.INTEGER, defaultValue: 1 },
		max_count: { type: Sequelize.INTEGER, defaultValue: 1 },
		// Rarity: 1=Common, 2=Uncommon, 3=Rare, 4=Epic, 5=Legendary
		rarity: { type: Sequelize.INTEGER, defaultValue: 1 },
		spawn_conditions: { type: Sequelize.JSON, allowNull: true },
		is_guaranteed: { type: Sequelize.BOOLEAN, defaultValue: false },
	}, { timestamps: false });
};

const locationEnemySpawn = (sequelize) => {
	return sequelize.define('location_enemy_spawn', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		location_id: { type: Sequelize.STRING, allowNull: false },
		enemy_base_id: { type: Sequelize.INTEGER, allowNull: false },
		spawn_chance: { type: Sequelize.INTEGER, defaultValue: 100 },
		min_count: { type: Sequelize.INTEGER, defaultValue: 1 },
		max_count: { type: Sequelize.INTEGER, defaultValue: 1 },
		// Rarity: 1=Common, 2=Uncommon, 3=Rare, 4=Epic, 5=Legendary
		rarity: { type: Sequelize.INTEGER, defaultValue: 1 },
		is_boss: { type: Sequelize.BOOLEAN, defaultValue: false },
		level_modifier: { type: Sequelize.INTEGER, defaultValue: 0 },
		spawn_conditions: { type: Sequelize.JSON, allowNull: true },
		respawn_time: { type: Sequelize.INTEGER, defaultValue: 600 },
		is_guaranteed: { type: Sequelize.BOOLEAN, defaultValue: false },
	}, { timestamps: false });
};

const locationEnemy = (sequelize) => {
	return sequelize.define('location_enemy', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		location_id: { type: Sequelize.STRING, allowNull: false },
		enemy_base_id: { type: Sequelize.INTEGER, allowNull: false },

		// Enemy availability and spawn settings
		min_level: { type: Sequelize.INTEGER, defaultValue: 1 },
		max_level: { type: Sequelize.INTEGER, defaultValue: 99 },
		encounter_weight: { type: Sequelize.INTEGER, defaultValue: 100 },

		// Enemy classification - 'common', 'elite', 'boss', 'rare'
		enemy_category: { type: Sequelize.STRING, allowNull: true },
		// 1-10 threat rating
		threat_level: { type: Sequelize.INTEGER, defaultValue: 1 },

		// Encounter conditions
		// Environmental or quest conditions
		spawn_conditions: { type: Sequelize.JSON, allowNull: true },
		// Day/night, seasonal restrictions
		time_restrictions: { type: Sequelize.JSON, allowNull: true },
		// Can appear in groups
		group_encounter: { type: Sequelize.BOOLEAN, defaultValue: false },

		// Scaling and modifiers
		// Scale with player level
		level_scaling: { type: Sequelize.BOOLEAN, defaultValue: true },
		// Location-specific stat modifications
		stat_modifiers: { type: Sequelize.JSON, allowNull: true },

		// Drop and reward modifiers
		// Location-specific loot changes
		loot_table_modifiers: { type: Sequelize.JSON, allowNull: true },
		// XP multiplier for this location
		experience_modifier: { type: Sequelize.FLOAT, defaultValue: 1.0 },

		// Administrative and metadata
		// Why this enemy appears here
		description: { type: Sequelize.TEXT, allowNull: true },
		is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
		added_by: { type: Sequelize.STRING, allowNull: true },
		created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
		updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
	}, {
		timestamps: false,
		indexes: [
			{ fields: ['location_id'] },
			{ fields: ['enemy_base_id'] },
			{ fields: ['enemy_category'] },
			{ fields: ['threat_level'] },
			{ fields: ['is_active'] },
			{ fields: ['encounter_weight'] },
		],
	});
};

const locationEvent = (sequelize) => {
	return sequelize.define('location_event', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		location_id: { type: Sequelize.STRING, allowNull: false },
		// Reference to the event system
		event_id: { type: Sequelize.STRING, allowNull: false },
		event_name: { type: Sequelize.STRING, allowNull: false },
		// Event type: 'combat', 'resource', 'special', 'exploration'
		event_type: { type: Sequelize.STRING, allowNull: false },
		// Probability weight for random selection
		event_weight: { type: Sequelize.INTEGER, defaultValue: 100 },

		// Event configuration
		// Flexible config for different event types
		event_config: { type: Sequelize.JSON, allowNull: true },

		// Requirements and conditions
		level_requirement: { type: Sequelize.INTEGER, defaultValue: 1 },
		// Required skills and levels
		skill_requirements: { type: Sequelize.JSON, allowNull: true },
		// Required items in inventory
		item_requirements: { type: Sequelize.JSON, allowNull: true },
		// Required character/global flags
		flag_requirements: { type: Sequelize.JSON, allowNull: true },
		// Time-based availability
		time_restrictions: { type: Sequelize.JSON, allowNull: true },

		// Availability and scheduling
		is_repeatable: { type: Sequelize.BOOLEAN, defaultValue: true },
		// Cooldown in seconds
		cooldown_time: { type: Sequelize.INTEGER, defaultValue: 0 },
		// Max times this event can happen
		max_occurrences: { type: Sequelize.INTEGER, allowNull: true },
		// Season/time restrictions
		seasonal_availability: { type: Sequelize.JSON, allowNull: true },
		// Administrative fields
		is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
	}, {
		timestamps: false,
		indexes: [
			{ fields: ['location_id'] },
			{ fields: ['event_type'] },
			{ fields: ['is_active'] },
			{ fields: ['event_weight'] },
		],
	});
};

const locationInstance = (sequelize) => {
	return sequelize.define('location_instance', {
		id: { type: Sequelize.STRING, primaryKey: true },
		base_location_id: { type: Sequelize.STRING, allowNull: false },
		character_id: { type: Sequelize.STRING, allowNull: false, unique: true },
		instance_name: { type: Sequelize.STRING, allowNull: true },
		instance_description: { type: Sequelize.STRING, allowNull: true },
		generated_content: { type: Sequelize.JSON, allowNull: true },
		seed_value: { type: Sequelize.STRING, allowNull: true },
		created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
		last_accessed: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
		auto_cleanup: { type: Sequelize.BOOLEAN, defaultValue: true },
		cleanup_delay: { type: Sequelize.INTEGER, defaultValue: 300 },
		is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
	}, { timestamps: false });
};

const locationInstanceResourceNode = (sequelize) => {
	return sequelize.define('location_instance_resource_node', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		instance_id: { type: Sequelize.STRING, allowNull: false },
		resource_node_lib_id: { type: Sequelize.INTEGER, allowNull: false },
		position_x: { type: Sequelize.FLOAT, allowNull: true },
		position_y: { type: Sequelize.FLOAT, allowNull: true },
		current_yield: { type: Sequelize.INTEGER, allowNull: false },
		max_yield: { type: Sequelize.INTEGER, allowNull: false },
		last_harvested: { type: Sequelize.DATE, allowNull: true },
		respawn_at: { type: Sequelize.DATE, allowNull: true },
		is_depleted: { type: Sequelize.BOOLEAN, defaultValue: false },
		custom_properties: { type: Sequelize.JSON, allowNull: true },
	}, { timestamps: false });
};

const locationInstanceEnemy = (sequelize) => {
	return sequelize.define('location_instance_enemy', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		instance_id: { type: Sequelize.STRING, allowNull: false },
		enemy_instance_id: { type: Sequelize.INTEGER, allowNull: false },
		spawn_time: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
		respawn_at: { type: Sequelize.DATE, allowNull: true },
		is_boss: { type: Sequelize.BOOLEAN, defaultValue: false },
		custom_behavior: { type: Sequelize.JSON, allowNull: true },
	}, { timestamps: false });
};

module.exports = {
	locationBase,
	locationCluster,
	locationLink,
	locationContain,
	locationInstance,
	locationInstanceResourceNode,
	locationInstanceEnemy,
	locationResourceNodeSpawn,
	locationEnemySpawn,
	locationEnemy,
	locationEvent,
};
