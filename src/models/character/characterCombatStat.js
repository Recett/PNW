const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_combat_stat', {
		character_id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
		},
		fullname: {
			type: Sequelize.STRING,
			allowNull: false,
		}
	}, {
		timestamps: false,
	});
};