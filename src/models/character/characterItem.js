const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_item', {
		character_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		item_id: {
			type: Sequelize.INTEGER,
		},
		amount: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 1,
		},
		equipped: {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
	}, {
		timestamps: false,
	});
};