const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('location_cluster', {
		id: {
			type: Sequelize.INTEGER,
			allowNull: false,
			primaryKey: true,
			unique: false,
		},
		location_id: {
			type: Sequelize.STRING,
			allowNull: false,
			primaryKey: true,
			unique: false,
		},
	}, {
		timestamps: false,
	});
};