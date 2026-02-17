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
		// Job status: 'stopped', 'running', 'paused', 'error'
		status: {
			type: Sequelize.STRING,
			allowNull: false,
			defaultValue: 'stopped',
		},
		// Cron schedule pattern (e.g., '0 */6 * * *')
		schedule: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		// Description of what the job does
		description: {
			type: Sequelize.TEXT,
			allowNull: true,
		},
		// Last execution timestamp
		last_run: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// Next scheduled run timestamp
		next_run: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// When the job was started
		started_at: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// When the job was paused (if paused)
		paused_at: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// When the job was stopped
		stopped_at: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// Total number of executions
		execution_count: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
		},
		// Number of successful executions
		success_count: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
		},
		// Number of failed executions
		error_count: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
		},
		// Last error message (if any)
		last_error: {
			type: Sequelize.TEXT,
			allowNull: true,
		},
		// Last error timestamp
		last_error_at: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// JSON field for additional job configuration
		config: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		// Whether the job is enabled/disabled
		is_enabled: {
			type: Sequelize.BOOLEAN,
			defaultValue: true,
		},
		// Created timestamp
		created_at: {
			type: Sequelize.DATE,
			defaultValue: Sequelize.NOW,
		},
		// Last updated timestamp
		updated_at: {
			type: Sequelize.DATE,
			defaultValue: Sequelize.NOW,
		},
	}, {
		timestamps: false,
		indexes: [
			{ fields: ['job_name'] },
			{ fields: ['status'] },
			{ fields: ['is_enabled'] },
			{ fields: ['next_run'] },
		],
	});
};
