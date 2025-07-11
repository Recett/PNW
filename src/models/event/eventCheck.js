const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('event_check', {
		event_id: {
			type: Sequelize.STRING,
		},
		// The source of the check, e.g., 'flag', 'location', 'attribute', 'object', etc.
		check_source: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		// The type of check, e.g., 'EQUAL', 'NOT_EQUAL', 'GREATER', 'LESSER' etc.
		check_type: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		event_if_true: {
			type: Sequelize.STRING,
		},
		event_if_false: {
			type: Sequelize.STRING,
		},
	}, {
		timestamps: false,
	});
};