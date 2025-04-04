const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('event_flag', {
		event_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		flag: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		// resolution_id = 0 mean the flag will be modified instantly upon receiving the event
		resolution_id: {
			type: Sequelize.STRING,
			defaultValue: 0,
			primaryKey: true,
		},
		set: Sequelize.INTEGER,
		add: Sequelize.INTEGER,
		external: Sequelize.BOOLEAN,
	}, {
		timestamps: false,
	});
};