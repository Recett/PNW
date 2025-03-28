module.exports = (sequelize, DataTypes) => {
	return sequelize.define('item_lib', {
		item_id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		type: {
			type: DataTypes.String,
			allowNull: false,
		},
	}, {
		timestamps: false,
	});
};