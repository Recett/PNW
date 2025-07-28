const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('location_link', {
		id_from: {
			type: Sequelize.STRING,
		},
		id_to: {
			type: Sequelize.STRING,
		},
	}, {
		timestamps: false,
	});
};