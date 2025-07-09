const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_combat_stat', {
		character_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		defense: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		evade: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		speed: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		currentWeight: {
			type: Sequelize.INTEGER,
		},
		maxWeight: {
			type: Sequelize.INTEGER,
		},
	}, {
		timestamps: false,
	});
};