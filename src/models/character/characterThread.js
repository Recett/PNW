const { Sequelize } = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('character_threads', {
		character_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
			primaryKey: true,
		},
		location_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
			primaryKey: true,
		},
		thread_id: {
			type: Sequelize.STRING,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};

