const Sequelize = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('monster_ability', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		monster_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		description: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		effect: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		cooldown: {
			type: Sequelize.INTEGER,
			allowNull: true,
			defaultValue: 0,
		},
	}, {
		timestamps: false,
	});
};
