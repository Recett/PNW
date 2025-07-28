const Sequelize = require('sequelize');
module.exports = (sequelize) => {
	return sequelize.define('cron_log', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		job_name: {
			type: Sequelize.STRING,
			allowNull: false,
			unique: true,
		},
		last_run: {
			type: Sequelize.DATE,
		},
	}, {
		timestamps: false,
	});
};
