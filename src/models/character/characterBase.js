const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_base', {
		id: {
			type: Sequelize.INTEGER,
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
		}
	}, {
		timestamps: false,
	});
};