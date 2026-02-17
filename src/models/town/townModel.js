const Sequelize = require('sequelize');

const townProject = (sequelize) => {
	return sequelize.define('town_project', {
		project_id: { type: Sequelize.INTEGER, allowNull: false },
		target_level: { type: Sequelize.INTEGER, defaultValue: 1 },
		current_progress: { type: Sequelize.INTEGER, defaultValue: 0 },
		required_progress: { type: Sequelize.INTEGER, allowNull: false },
		resources_contributed: { type: Sequelize.JSON, defaultValue: {} },
		is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
	}, { timestamps: false });
};

const townResource = (sequelize) => {
	return sequelize.define('town_resource', {
		resource_type: { type: Sequelize.STRING, allowNull: false },
		current_amount: { type: Sequelize.INTEGER, defaultValue: 0 },
		max_storage: { type: Sequelize.INTEGER, defaultValue: 1000 },
		production_rate: { type: Sequelize.INTEGER, defaultValue: 0 },
		consumption_rate: { type: Sequelize.INTEGER, defaultValue: 0 },
		last_updated: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
	}, { timestamps: false });
};

const townBuilding = (sequelize) => {
	return sequelize.define('town_building', {
		project_id: { type: Sequelize.INTEGER, allowNull: false },
		current_level: { type: Sequelize.INTEGER, defaultValue: 1 },
		condition: { type: Sequelize.INTEGER, defaultValue: 100 },
		total_investment: { type: Sequelize.INTEGER, defaultValue: 0 },
		active_effects: { type: Sequelize.JSON, defaultValue: {} },
		completed_date: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
		upgrade_history: { type: Sequelize.JSON, defaultValue: [] },
	}, { timestamps: false });
};

const townDefense = (sequelize) => {
	return sequelize.define('town_defense', {
		current_hp: { type: Sequelize.INTEGER, allowNull: false },
		max_hp: { type: Sequelize.INTEGER, allowNull: false },
		armor: { type: Sequelize.INTEGER, defaultValue: 0 },
		moat_strength: { type: Sequelize.INTEGER, defaultValue: 0 },
		tower_damage: { type: Sequelize.INTEGER, defaultValue: 0 },
		garrison_size: { type: Sequelize.INTEGER, defaultValue: 0 },
		garrison_quality: { type: Sequelize.INTEGER, defaultValue: 0 },
		balista_shot: { type: Sequelize.INTEGER, defaultValue: 0 },
		is_under_siege: { type: Sequelize.BOOLEAN, defaultValue: false },
		defensive_structures: { type: Sequelize.JSON, defaultValue: [] },
		last_updated: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
	}, { timestamps: false });
};

module.exports = {
	townProject,
	townResource,
	townBuilding,
	townDefense,
};