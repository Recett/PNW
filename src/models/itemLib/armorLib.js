module.exports = (sequelize, DataTypes) => {
	return sequelize.define('armor_lib', {
		item_id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		slot: {
			type: DataTypes.String,
			allowNull: false,
		},
		defense: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		evade: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		evade_percent: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		weight: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};