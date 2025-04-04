const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_skill', {
		character_id: {
			type: Sequelize.INTEGER,
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
		aptitude: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
	}, {
		timestamps: false,
	});
};