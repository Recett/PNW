const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('event_resolution', {
		event_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		resolution_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		resolution_text: Sequelize.STRING,
		required_flag: Sequelize.BOOLEAN,
		child_event_id: Sequelize.STRING,
		tier: Sequelize.INTEGER,
	}, {
		timestamps: false,
	});
};