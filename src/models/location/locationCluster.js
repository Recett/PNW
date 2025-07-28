const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('location_cluster', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
		},
		location_id: {
			type: Sequelize.STRING,
		},
	}, {
		timestamps: false,
	});
};