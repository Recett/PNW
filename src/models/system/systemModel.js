const Sequelize = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('system_setting', {
		key: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		value: { type: Sequelize.JSON, allowNull: true },
		description: { type: Sequelize.STRING, allowNull: true },
		created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
		updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
	}, {
		timestamps: false,
	});
};