const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('location_contain', {
		location_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		object_id: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		type: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		amount: {
			type: Sequelize.STRING,
		},
	}, {
		timestamps: false,
	});
};