module.exports = (sequelize, DataTypes) => {
	return sequelize.define('skill_lib', {
		skill_id: {
			type: DataTypes.String,
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