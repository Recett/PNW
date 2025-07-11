const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('location_link', {
		id_from: {
			type: Sequelize.STRING,
			allowNull: false,
			primaryKey: true,
			unique: false,
		},
		id_to: {
			type: Sequelize.STRING,
			allowNull: false,
			primaryKey: true,
			unique: false,
		},
	}, {
		timestamps: false,
	});
};