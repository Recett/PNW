module.exports = (sequelize, DataTypes) => {
	return sequelize.define('character', {
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
		},
		fullname: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		nickname: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		level: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		str: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		dex: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		agi: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		con: {
			type: DataTypes.STRING,
			allowNull: false,
		}
	}, {
		timestamps: false,
	});
};