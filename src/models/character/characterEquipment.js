module.exports = (sequelize, DataTypes) => {
	return sequelize.define('character_equipment', {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		head: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		body: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		leg: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		mainhand: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		offhand: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		trinket: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		belt: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		backpack: {
			type: DataTypes.STRING,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};