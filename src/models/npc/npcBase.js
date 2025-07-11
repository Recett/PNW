const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('npc_base', {
		id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		fullname: {
			type: Sequelize.STRING,
			allowNull: false,
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
		npc_type: {
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