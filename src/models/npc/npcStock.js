const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('npc_stock', {
		npc_id: {
			type: Sequelize.INTEGER,
		},
		item_id: {
			type: Sequelize.INTEGER,
		},
		amount: {
			type: Sequelize.INTEGER,
			defaultValue: 1,
		},
		price: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
		},
	}, {
		timestamps: false,
	});
};
