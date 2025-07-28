const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('event_tag', {
		event_id: {
			type: Sequelize.STRING,
		},
		tag: {
			type: Sequelize.STRING,
		},
		tier: Sequelize.INTEGER,
	}, {
		timestamps: false,
	});
};