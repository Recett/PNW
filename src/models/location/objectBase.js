const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('object_base', {
		id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		unknown_name: Sequelize.STRING,
		avatar: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		illustration: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		type: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		start_event: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		status:  Sequelize.STRING,
	}, {
		timestamps: false,
	});
};