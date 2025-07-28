const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('item_lib', {
		id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		type: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		description: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		tag: {
			type: Sequelize.STRING,
		},
	}, {
		timestamps: false,
	});
};