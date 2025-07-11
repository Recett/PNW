const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('event_tag', {
		event_id: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		tag: {
			type: Sequelize.STRING,
			primaryKey: true,
			unique: false,
		},
		tier: Sequelize.INTEGER,
	}, {
		timestamps: false,
	});
};