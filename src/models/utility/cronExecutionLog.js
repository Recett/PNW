const Sequelize = require('sequelize');

module.exports = (sequelize) => {
	return sequelize.define('cron_execution_log', {
		id: {
			type: Sequelize.INTEGER,
			primaryKey: true,
			autoIncrement: true,
		},
		// Which job this execution belongs to
		job_name: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		// Execution result: 'started', 'success', 'error', 'timeout', 'interrupted'
		status: {
			type: Sequelize.STRING,
			allowNull: false,
		},
		// When execution started
		started_at: {
			type: Sequelize.DATE,
			allowNull: false,
			defaultValue: Sequelize.NOW,
		},
		// When execution finished
		finished_at: {
			type: Sequelize.DATE,
			allowNull: true,
		},
		// Execution duration in milliseconds
		duration_ms: {
			type: Sequelize.INTEGER,
			allowNull: true,
		},
		// Memory usage at start (RSS in bytes)
		memory_start_mb: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		// Memory usage at end (RSS in bytes)
		memory_end_mb: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		// Peak memory during execution
		memory_peak_mb: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		// CPU usage percentage (approximate)
		cpu_usage_percent: {
			type: Sequelize.FLOAT,
			allowNull: true,
		},
		// Number of database operations
		db_operations: {
			type: Sequelize.INTEGER,
			allowNull: true,
			defaultValue: 0,
		},
		// Number of affected records (for batch operations)
		records_processed: {
			type: Sequelize.INTEGER,
			allowNull: true,
			defaultValue: 0,
		},
		// Error details if execution failed
		error_message: {
			type: Sequelize.TEXT,
			allowNull: true,
		},
		// Full error stack trace
		error_stack: {
			type: Sequelize.TEXT,
			allowNull: true,
		},
		// Error code/type for categorization
		error_type: {
			type: Sequelize.STRING,
			allowNull: true,
		},
		// Console output during execution
		console_output: {
			type: Sequelize.TEXT,
			allowNull: true,
		},
		// Warnings generated during execution
		warnings: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		// Detailed execution context and metrics
		execution_context: {
			type: Sequelize.JSON,
			allowNull: true,
		},
		// Server environment info when executed
		server_info: {
			type: Sequelize.JSON,
			allowNull: true,
		},
	}, {
		timestamps: true,
		createdAt: 'created_at',
		updatedAt: 'updated_at',
		indexes: [
			{
				fields: ['job_name', 'started_at'],
			},
			{
				fields: ['status'],
			},
			{
				fields: ['started_at'],
			},
		],
	});
};