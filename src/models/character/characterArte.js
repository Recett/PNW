const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_art', {
		character_id: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		art_id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			unique: false,
		},
	}, {
		timestamps: false,
	});
};