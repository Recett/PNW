module.exports = (sequelize) => {
	return sequelize.define('armor_lib', {
		item_id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
		},
		slot: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		defense: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		evade: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
			allowNull: false,
		},
		evade_percent: {
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