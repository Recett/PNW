const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('location_base', {
		name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		channel: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		description: {
			type: Sequelize.STRING,
		},
		type: {
			type: Sequelize.STRING,
		},
		role: Sequelize.STRING,
		lock: Sequelize.BOOLEAN,
	}, {
		timestamps: false,
	});
};