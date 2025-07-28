const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_art', {
		character_id: {
			type: Sequelize.STRING,
		},
		art_id: {
			type: Sequelize.INTEGER,
		},
	}, {
		timestamps: false,
	});
};