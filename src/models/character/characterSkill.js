module.exports = (sequelize, DataTypes) => {
	return sequelize.define('character_skill', {
		character_id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		skill_id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		lv: {
			type: DataTypes.INTEGER,
			allowNull: false,
			'default': 0,
		},
		xp: {
			type: DataTypes.INTEGER,
			allowNull: false,
			'default': 0,
		},
	}, {
		timestamps: false,
	});
};