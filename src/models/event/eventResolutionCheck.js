const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('event_resolution_check', {
		event_id: {
			type: Sequelize.STRING,
		},
		resolution_id: {
			type: Sequelize.STRING,
		},
		flag: Sequelize.STRING,
		flag_origin: Sequelize.STRING,
		flag_local: Sequelize.BOOLEAN,
		condition: Sequelize.STRING,
		value: Sequelize.INTEGER,
	}, {
		timestamps: false,
	});
};