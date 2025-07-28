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
		},
		illustration: {
			type: Sequelize.STRING,
		},
		type: {
			type: Sequelize.STRING,
		},
		start_event: {
			type: Sequelize.STRING,
		},
		status:  Sequelize.STRING,
	}, {
		timestamps: false,
	});
};