const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('character_equipment', {
		character_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		item_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		slot: {
			type: Sequelize.STRING,
		},
		// Slots can be: head, body, leg, mainhand, offhand,
	}, {
		timestamps: false,
	});
};