const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('art_lib', {
		skill_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		skill_name: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		type: {
			type: Sequelize.STRING,
			allowNull: true,
		},
	}, {
		timestamps: false,
	});
};