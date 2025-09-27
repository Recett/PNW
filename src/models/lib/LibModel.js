const Sequelize = require('sequelize');

const weaponLib = (sequelize) => {
	return sequelize.define('weapon_lib', {
		slot: { type: Sequelize.STRING, allowNull: false },
		base_damage: { type: Sequelize.INTEGER, defaultValue: 0, allowNull: false },
		scaling: { type: Sequelize.INTEGER, defaultValue: 0, allowNull: false },
		hit_mod: { type: Sequelize.INTEGER, defaultValue: 0, allowNull: false },
		cooldown: { type: Sequelize.INTEGER, defaultValue: 0, allowNull: false },
		special: { type: Sequelize.STRING },
		special_value: { type: Sequelize.INTEGER, defaultValue: 0, allowNull: false },
	}, { timestamps: false });
};

const armorLib = (sequelize) => {
	return sequelize.define('armor_lib', {
		slot: { type: Sequelize.STRING, allowNull: false },
		defense: { type: Sequelize.INTEGER, defaultValue: 0 },
		defense_percent: { type: Sequelize.INTEGER, defaultValue: 0 },
		crit_resistance: { type: Sequelize.INTEGER, defaultValue: 0 },
		special: { type: Sequelize.JSON },
		special_value: { type: Sequelize.JSON },
	}, { timestamps: false });
};

const itemLib = (sequelize) => {
	return sequelize.define('item_lib', {
		name: { type: Sequelize.STRING, allowNull: false },
		description: { type: Sequelize.STRING },
		item_type: { type: Sequelize.STRING, allowNull: false },
		value: { type: Sequelize.INTEGER, defaultValue: 0 },
		weight: { type: Sequelize.INTEGER, defaultValue: 0 },
		tag: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

const artLib = (sequelize) => {
	return sequelize.define('art_lib', {
		name: { type: Sequelize.STRING, allowNull: false },
		description: { type: Sequelize.STRING },
		category: { type: Sequelize.STRING },
		skill_id: { type: Sequelize.INTEGER, allowNull: false },
		skill_level_required: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
		power: { type: Sequelize.INTEGER, defaultValue: 0 },
		special: { type: Sequelize.JSON },
		timing: { type: Sequelize.STRING },
	}, { timestamps: false });
};

const skillLib = (sequelize) => {
	return sequelize.define('skill_lib', {
		name: { type: Sequelize.STRING, allowNull: false },
		description: { type: Sequelize.STRING },
		parent_skill_id: { type: Sequelize.INTEGER, allowNull: true },
		bonus: { type: Sequelize.STRING },
		bonus_value: { type: Sequelize.INTEGER, defaultValue: 0 },
	}, { timestamps: false });
};

const questLib = (sequelize) => {
	return sequelize.define('quest_lib', {
		name: { type: Sequelize.STRING, allowNull: false },
		description: { type: Sequelize.STRING },
		type: { type: Sequelize.STRING },
		reward: { type: Sequelize.JSON },
		requirement: { type: Sequelize.JSON },
	}, { timestamps: false });
};

const resourceNodeLib = (sequelize) => {
	return sequelize.define('resource_node_lib', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		name: { type: Sequelize.STRING, allowNull: false },
		description: { type: Sequelize.STRING },
		node_type: { type: Sequelize.STRING, allowNull: false },
		resource_item_id: { type: Sequelize.INTEGER, allowNull: false },
		min_yield: { type: Sequelize.INTEGER, defaultValue: 1 },
		max_yield: { type: Sequelize.INTEGER, defaultValue: 1 },
		respawn_time: { type: Sequelize.INTEGER, defaultValue: 300 },
		required_tool: { type: Sequelize.STRING, allowNull: true },
		skill_required: { type: Sequelize.STRING, allowNull: true },
		skill_level: { type: Sequelize.INTEGER, defaultValue: 0 },
		depletion_chance: { type: Sequelize.INTEGER, defaultValue: 0 },
		interaction_text: { type: Sequelize.STRING, allowNull: true },
		success_text: { type: Sequelize.STRING, allowNull: true },
		failure_text: { type: Sequelize.STRING, allowNull: true },
		avatar: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

module.exports = {
	weaponLib,
	armorLib,
	itemLib,
	artLib,
	skillLib,
	questLib,
	resourceNodeLib,
};
