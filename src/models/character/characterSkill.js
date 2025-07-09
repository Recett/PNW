const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_skill', {
		character_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		skill_id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
		},
		lv: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		xp: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		type: {
			type: Sequelize.STRING,
		},
		// 'type' is used to distinguish between different types of skills, e.g.,
		aptitude: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
	}, {
		timestamps: false,
	});
};