const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('event_flag', {
		event_id: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		// resolution_id = 0 mean the flag will be modified instantly upon receiving the event
		resolution_id: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		flag: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		amount: Sequelize.INTEGER,
		method: Sequelize.STRING,
		external: Sequelize.BOOLEAN,
		global: {
			type: Sequelize.BOOLEAN,
			defaultValue: false,
		},
	}, {
		timestamps: false,
	});
};