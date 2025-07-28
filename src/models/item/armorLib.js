const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('armor_lib', {
		item_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		slot: {
			type: Sequelize.STRING,
		},
		defense: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		defense_percent: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		crit_resistance: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		evade: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		evade_percent: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		weight: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		special: {
			type: Sequelize.JSON,
		},
		special_value: {
			type: Sequelize.JSON,
		},
	}, {
		timestamps: false,
	});
};