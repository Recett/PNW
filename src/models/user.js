module.exports = (sequelize, DataTypes) => {
	return sequelize.define('user', {
		user_id: {
			type: DataTypes.STRING,
			primaryKey: true,
		},
		character_id: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};