const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('quest_lib', {
		quest_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		quest_name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		description: {
			type: Sequelize.TEXT,
			allowNull: false,
		},
		type: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		completion: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		completion_flag: {
			type: Sequelize.STRING,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};
