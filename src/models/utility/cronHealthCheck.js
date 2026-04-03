const Sequelize = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('cron_health_check', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		// Job being monitored
		job_name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		// Health status: 'healthy', 'warning', 'critical', 'unknown'
		health_status: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		// Time this health check was performed
		check_time: {
			type: Sequelize.DATE,
			allowNull: false,
			defaultValue: Sequelize.NOW,
		},
		// Last successful execution time
		last_success: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// Time since last successful run (in minutes)
		minutes_since_success: {
			type: Sequelize.INTEGER,
			allowNull: true,
		},
		// Success rate over last 24 hours (0-100)
		success_rate_24h: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		// Success rate over last 7 days (0-100)
		success_rate_7d: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		// Average execution time in last 10 runs (ms)
		avg_execution_time_ms: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		// Slowest execution in last 24h (ms)
		max_execution_time_24h: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		// Number of consecutive failures
		consecutive_failures: {
			type: Sequelize.INTEGER,
			defaultValue: 0,
		},
		// Last error message (if any)
		last_error_summary: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		// Expected vs actual execution frequency
		expected_frequency_hours: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		actual_frequency_hours: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		// Memory and performance trends
		avg_memory_usage_mb: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		memory_trend: {
			type: Sequelize.STRING, // 'increasing', 'stable', 'decreasing'
			allowNull: true,
		},
		// Performance score (0-100, higher is better)
		performance_score: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		// Health check details and recommendations
		health_details: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		// Whether alerts should be sent
		alert_level: {
			type: Sequelize.STRING, // 'none', 'info', 'warning', 'critical'
			allowNull: false,
			defaultValue: 'none',
		},
		// Next health check time
		next_check: {
			type: Sequelize.DATE,
			allowNull: true,
		},
	}, {
		timestamps: true,
		createdAt: 'created_at',
		updatedAt: 'updated_at',
		indexes: [
			{
				fields: ['job_name', 'check_time'],
			},
			{
				fields: ['health_status'],
			},
			{
				fields: ['alert_level'],
			},
		],
	});
};