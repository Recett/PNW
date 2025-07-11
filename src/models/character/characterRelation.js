const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_relation', {
		character_id: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		npc_id: {
			type: Sequelize.STRING,
		},
		xp: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		level: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		value: Sequelize.STRING,
	}, {
		timestamps: false,
	});
};