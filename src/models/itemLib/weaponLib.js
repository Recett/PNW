module.exports = (sequelize, DataTypes) => {
	return sequelize.define('weapon_lib', {
		item_id: DataTypes.INTEGER,
		slot: {
			type: DataTypes.String,
			allowNull: false,
		},
		base_damage: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		scaling: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		graze: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		hit_mod: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		cooldown: {
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