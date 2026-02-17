const Sequelize = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('cron_schedule', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		cron_log_id: {
			type: Sequelize.INTEGER,
			allowNull: false,
		},
		// Cron schedule pattern (e.g., '0 */6 * * *')
		schedule: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		// Execution frequency: 'once', 'minutely', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'custom'
		frequency: {
			type: Sequelize.STRING,
			allowNull: false,
			defaultValue: 'custom',
		},
		// Interval value (e.g., every 15 minutes, every 2 hours, every 3 days)
		interval_value: {
			type: Sequelize.INTEGER,
			defaultValue: 1,
		},
		// Specific time to run (HH:MM format, e.g., '14:30' for 2:30 PM)
		execution_time: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		// Days of week for weekly frequency (JSON array: [0,1,2,3,4,5,6] where 0=Sunday)
		days_of_week: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		// Day of month for monthly frequency (1-31)
		day_of_month: {
			type: Sequelize.INTEGER,
			allowNull: true,
		},
		// Month and day for yearly frequency (JSON: {month: 1-12, day: 1-31})
		yearly_schedule: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		// Timezone for scheduling (e.g., 'America/New_York', 'UTC')
		timezone: {
			type: Sequelize.STRING,
			defaultValue: 'UTC',
		},
		// Auto-stop after this many executions (null = no limit)
		max_executions: {
			type: Sequelize.INTEGER,
			allowNull: true,
		},
		// Auto-stop after this duration in minutes (null = no limit)
		max_runtime_minutes: {
			type: Sequelize.INTEGER,
			allowNull: true,
		},
		// Scheduled start time for the job (null = start immediately when enabled)
		scheduled_start_at: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// Scheduled stop time for the job (null = no scheduled stop)
		scheduled_stop_at: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// Auto-restart policy: 'never', 'on_error', 'on_complete', 'always'
		auto_restart: {
			type: Sequelize.STRING,
			defaultValue: 'never',
		},
		// Delay before auto-restart in minutes
		restart_delay_minutes: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
		},
		// Whether job should auto-start when system starts
		auto_start_on_boot: {
			type: Sequelize.BOOLEAN,
			defaultValue: false,
		},
		// Priority level (1-10, where 1 is highest priority)
		priority: {
			type: Sequelize.INTEGER,
			defaultValue: 5,
		},
		// Whether this schedule is active
		is_active: {
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
			{ fields: ['cron_log_id'] },
			{ fields: ['frequency'] },
			{ fields: ['scheduled_start_at'] },
			{ fields: ['scheduled_stop_at'] },
			{ fields: ['priority'] },
			{ fields: ['auto_start_on_boot'] },
			{ fields: ['is_active'] },
		],
	});
};