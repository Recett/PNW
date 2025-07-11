const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_status', {
		character_id: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		status: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		// This field is used to store the type of status, e.g., 'debuff', 'buff', 'effect', 'combat-only', 'adventure-only', etc.
		// It helps in categorizing the status effects and can be used for filtering or applying
		type: {
			type: Sequelize.STRING,
		},
		// This field is used to store the value of the status, which can be a string or a number.
		// For example, it can be used to store the level of a status effect or
		value: Sequelize.STRING,
	}, {
		timestamps: false,
	});
};