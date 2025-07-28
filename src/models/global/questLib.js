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
		},
		type: {
			type: Sequelize.STRING,
		},
		completion: {
			type: Sequelize.STRING,
		},
		completion_flag: {
			type: Sequelize.STRING,
		},
	}, {
		timestamps: false,
	});
};
