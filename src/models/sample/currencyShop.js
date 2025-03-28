module.exports = (sequelize, DataTypes) => {
	return sequelize.define('currency_shop', {
		name: {
			type: Sequelize.STRING,
			unique: true,
		},
		cost: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};