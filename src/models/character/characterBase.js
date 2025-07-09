const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_base', {
		id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		fullname: {
			type: Sequelize.STRING,
		},
		name: {
			type: Sequelize.STRING,
		},
		nickname: Sequelize.STRING,
		avatar: {
			type: Sequelize.STRING,
		},
		age: {
			type: Sequelize.INTEGER,
		},
		gender: {
			type: Sequelize.STRING,
		},
		gold: {
			type: Sequelize.INTEGER,
		},
		str: {
			type: Sequelize.INTEGER,
		},
		dex: {
			type: Sequelize.INTEGER,
		},
		agi: {
			type: Sequelize.INTEGER,
		},
		con: {
			type: Sequelize.INTEGER,
		},
		currentHp: {
			type: Sequelize.INTEGER,
		},
		maxHp: {
			type: Sequelize.INTEGER,
		},
		currentStamina: {
			type: Sequelize.INTEGER,
		},
		maxStamina: {
			type: Sequelize.INTEGER,
		},
		free_point: {
			type: Sequelize.INTEGER,
		},
		xp: {
			type: Sequelize.INTEGER,
		}
	}, {
		timestamps: false,
	});
};