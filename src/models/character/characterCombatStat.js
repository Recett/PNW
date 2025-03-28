module.exports = (sequelize, DataTypes) => {
	return sequelize.define('character_combat_stat', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
		},
		fullname: {
			type: Sequelize.STRING,
			allowNull: false,
		}
	}, {
		timestamps: false,
	});
};