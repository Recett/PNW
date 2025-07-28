const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_attack_stat', {
		character_id: {
			type: Sequelize.STRING,
		},
		item_id: {
			type: Sequelize.INTEGER,
		},
		attack: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		accuracy: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		critical: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		critical_damage: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 150,
		},
		cooldown: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
	}, {
		timestamps: false,
	});
};