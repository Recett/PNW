const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_setting', {
		character_id: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		setting: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		value: Sequelize.STRING,
	}, {
		timestamps: false,
	});
};