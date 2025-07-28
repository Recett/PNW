const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_flag', {
		character_id: {
			type: Sequelize.STRING,
		},
		flag: {
			type: Sequelize.STRING,
		},
		value: Sequelize.INTEGER,
	}, {
		timestamps: false,
	});
};