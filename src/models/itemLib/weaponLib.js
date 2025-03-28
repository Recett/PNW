module.exports = (sequelize, DataTypes) => {
	return sequelize.define('weapon_lib', {
		item_id: Sequelize.INTEGER,
		slot: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		base_damage: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		scaling: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		graze: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		hit_mod: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		cooldown: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		weight: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};