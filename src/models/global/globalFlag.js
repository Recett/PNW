const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('global_flag', {
		flag: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		value: Sequelize.INTEGER,
	}, {
		timestamps: false,
	});
};