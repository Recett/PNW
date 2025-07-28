const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('skill_lib', {
		skill_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		type: {
			type: Sequelize.STRING,
		},
		name: {
			type: Sequelize.STRING,
		},
		level: {
			type: Sequelize.INTEGER,
		},
		stat: {
			type: Sequelize.STRING,
		},
		effect: {
			type: Sequelize.STRING,
		},
	}, {
		timestamps: false,
	});
};