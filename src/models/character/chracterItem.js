module.exports = (sequelize, DataTypes) => {
	return sequelize.define('character_item', {
		character_id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		item_id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		amount: {
			type: DataTypes.INTEGER,
			allowNull: false,
			'default': 0,
		},
	}, {
		timestamps: false,
	});
};