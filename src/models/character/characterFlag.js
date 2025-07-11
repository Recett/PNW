const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_flag', {
		character_id: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		flag: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		value: Sequelize.INTEGER,
	}, {
		timestamps: false,
	});
};