const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_setting', {
		character_id: {
			type: Sequelize.STRING,
		},
		setting: {
			type: Sequelize.STRING,
		},
		value: Sequelize.STRING,
	}, {
		timestamps: false,
	});
};