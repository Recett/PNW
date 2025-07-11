const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('monster_attack_stat', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
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
		cooldown: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		description: {
			type: Sequelize.STRING,
			allowNull: true,
		},
	}, {
		timestamps: false,
	});
};