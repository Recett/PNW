module.exports = (sequelize, DataTypes) => {
	return sequelize.define('character_item', {
		character_id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
		},
		item_id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
		},
		amount: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 1,
		},
	}, {
		timestamps: false,
	});
};