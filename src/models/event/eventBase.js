const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('event_base', {
		event_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},		
		event_text: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		default_child_event_id: {
			type: Sequelize.STRING,
		},		
		choose_placeholder: {
			type: Sequelize.STRING,
		}
	}, {
		timestamps: false,
	});
};