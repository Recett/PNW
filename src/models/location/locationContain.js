const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('location_contain', {
		location_id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			unique: false,
		},
		object_id: {
			type: Sequelize.STRING,
			allowNull: false,
			primaryKey: true,
			unique: false,
		},
		type: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		amount: {
			type: Sequelize.STRING,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};