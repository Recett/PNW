const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('weapon_lib', {
		item_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		slot: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		base_damage: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		scaling: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		graze: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		hit_mod: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		cooldown: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		weight: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		weapon_type: {
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