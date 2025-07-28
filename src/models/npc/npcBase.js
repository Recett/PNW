const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('npc_base', {
		id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		fullname: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		unknown_name: Sequelize.STRING,
		avatar: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		npc_type: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		start_event: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		status:  Sequelize.STRING,
	}, {
		timestamps: false,
	});
};