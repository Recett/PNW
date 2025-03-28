module.exports = (sequelize, DataTypes) => {
	return sequelize.define('user', {
		user_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		character_id: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};