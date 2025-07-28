const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_quest', {
		character_id: {
			type: Sequelize.STRING,
		},
		quest_id: {
			type: Sequelize.INTEGER,
		},
		status: {
			type: Sequelize.STRING,
			allowNull: false,
			defaultValue: 'in_progress',
		},
		progress: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
	}, {
		timestamps: false,
	});
};