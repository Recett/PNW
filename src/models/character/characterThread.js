const { Sequelize } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('character_threads', {
		character_id: {
			type: Sequelize.INTEGER,
		},
		location_id: {
			type: Sequelize.INTEGER,
		},
		thread_id: {
			type: Sequelize.STRING,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};

