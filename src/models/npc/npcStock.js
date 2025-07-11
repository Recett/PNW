const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('npc_stock', {
		npc_id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			unique: false,
		},
		item_id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			unique: false,
		},
		amount: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 1,
		},
		price: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
	}, {
		timestamps: false,
	});
};
