const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('event_base', {
		id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		title: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		avatar: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		illustration: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		text: Sequelize.STRING,
		default_child_event_id: {
			type: Sequelize.STRING,
		},
		choose_placeholder: {
			type: Sequelize.STRING,
		},
		hidden: Sequelize.BOOLEAN,
		npc: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		check: Sequelize.BOOLEAN,
	}, {
		timestamps: false,
	});
};