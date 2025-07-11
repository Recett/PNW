const Sequelize = require('sequelize');
const monsterAttackStat = require('./monsterAttackStat');
module.exports = (sequelize) => {
	return sequelize.define('monster_base_stat', {
		id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		health: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		defense: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		evade: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		accuracy: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		monsterAttack_id: {
			type: Sequelize.JSON,
		}
	}, {
		timestamps: false,
	});
};