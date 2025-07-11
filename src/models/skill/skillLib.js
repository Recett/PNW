const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('skill_lib', {
		skill_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		type: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		level: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		stat: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		effect: {
			type: Sequelize.STRING,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};