const Sequelize = require('sequelize');

const locationBase = (sequelize) => {
	return sequelize.define('location_base', {
		name: { type: Sequelize.STRING, allowNull: false },
		channel: { type: Sequelize.STRING, allowNull: false },
		description: Sequelize.STRING,
		type: Sequelize.STRING,
		role: Sequelize.STRING,
		lock: Sequelize.BOOLEAN,
		tag: Sequelize.JSON,
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
	}, { timestamps: false });
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

const locationInstanceMonster = (sequelize) => {
	return sequelize.define('location_instance_monster', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		instance_id: { type: Sequelize.STRING, allowNull: false },
		monster_instance_id: { type: Sequelize.INTEGER, allowNull: false },
		position_x: { type: Sequelize.FLOAT, allowNull: true },
		position_y: { type: Sequelize.FLOAT, allowNull: true },
		spawn_time: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
		respawn_at: { type: Sequelize.DATE, allowNull: true },
		is_boss: { type: Sequelize.BOOLEAN, defaultValue: false },
		custom_behavior: { type: Sequelize.JSON, allowNull: true },
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

const locationMonsterSpawn = (sequelize) => {
	return sequelize.define('location_monster_spawn', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		location_id: { type: Sequelize.STRING, allowNull: false },
		monster_base_id: { type: Sequelize.INTEGER, allowNull: false },
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

module.exports = {
	locationBase,
	locationCluster,
	locationLink,
	locationContain,
	locationInstance,
	locationInstanceResourceNode,
	locationInstanceMonster,
	locationResourceNodeSpawn,
	locationMonsterSpawn,
};
