// Enhanced cron monitoring and logging utility
const { CronLog, CronExecutionLog, CronHealthCheck } = require('@root/dbObject.js');
const { EMOJI } = require('../enums');

class CronMonitor {
	constructor() {
		this.activeExecutions = new Map(); // Track active executions
		this.consoleOutputs = new Map(); // Capture console output
		this.originalConsole = {}; // Store original console methods
	}

	/**
	 * Start monitoring a cron job execution
	 * @param {string} jobName - Name of the cron job
	 * @param {Object} context - Additional execution context
	 * @returns {Object} Execution tracker
	 */
	async startExecution(jobName, context = {}) {
		const executionId = `${jobName}_${Date.now()}`;
		const startTime = new Date();
		const memoryStart = process.memoryUsage();
		
		// Create execution log entry
		const executionLog = await CronExecutionLog.create({
			job_name: jobName,
			status: 'started',
			started_at: startTime,
			memory_start_mb: Math.round(memoryStart.rss / 1024 / 1024 * 100) / 100,
			execution_context: {
				...context,
				node_version: process.version,
				platform: process.platform,
				pid: process.pid,
			},
			server_info: {
				uptime: process.uptime(),
				memory: memoryStart,
				cpu_arch: process.arch,
			},
		});

		// Set up execution tracker
		const tracker = {
			id: executionId,
			jobName,
			startTime,
			executionLogId: executionLog.id,
			memoryStart,
			dbOperations: 0,
			recordsProcessed: 0,
			warnings: [],
			consoleOutput: [],
		};

		this.activeExecutions.set(executionId, tracker);
		this.setupConsoleCapture(executionId);

		console.log(`[CronMonitor] Started execution tracking for ${jobName} (ID: ${executionId})`);
		return tracker;
	}

	/**
	 * Log database operations for performance tracking
	 */
	logDatabaseOperation(executionId, recordCount = 0) {
		const tracker = this.activeExecutions.get(executionId);
		if (tracker) {
			tracker.dbOperations++;
			tracker.recordsProcessed += recordCount;
		}
	}

	/**
	 * Log warnings during execution
	 */
	logWarning(executionId, warning) {
		const tracker = this.activeExecutions.get(executionId);
		if (tracker) {
			tracker.warnings.push({
				timestamp: new Date(),
				message: warning,
				stack: new Error().stack,
			});
		}
	}

	/**
	 * Complete a successful execution
	 */
	async completeExecution(executionId, results = {}) {
		const tracker = this.activeExecutions.get(executionId);
		if (!tracker) {
			console.error(`[CronMonitor] No tracker found for execution ID: ${executionId}`);
			return;
		}

		const endTime = new Date();
		const memoryEnd = process.memoryUsage();
		const duration = endTime - tracker.startTime;

		// Clean up console capture
		this.cleanupConsoleCapture(executionId);

		// Update execution log
		await CronExecutionLog.update({
			status: 'success',
			finished_at: endTime,
			duration_ms: duration,
			memory_end_mb: Math.round(memoryEnd.rss / 1024 / 1024 * 100) / 100,
			memory_peak_mb: Math.round(Math.max(tracker.memoryStart.rss, memoryEnd.rss) / 1024 / 1024 * 100) / 100,
			db_operations: tracker.dbOperations,
			records_processed: tracker.recordsProcessed,
			console_output: tracker.consoleOutput.join('\n'),
			warnings: tracker.warnings.length > 0 ? tracker.warnings : null,
			execution_context: {
				...tracker.execution_context,
				results,
				performance: {
					execution_time_ms: duration,
					memory_delta_mb: Math.round((memoryEnd.rss - tracker.memoryStart.rss) / 1024 / 1024 * 100) / 100,
				},
			},
		}, {
			where: { id: tracker.executionLogId },
		});

		console.log(`[CronMonitor] ${EMOJI.SUCCESS} Completed execution ${executionId} in ${duration}ms`);
		console.log(`[CronMonitor] ${EMOJI.INFO} DB operations: ${tracker.dbOperations}, Records: ${tracker.recordsProcessed}, Warnings: ${tracker.warnings.length}`);

		// Clean up
		this.activeExecutions.delete(executionId);

		// Update health check
		await this.updateHealthStatus(tracker.jobName);

		return {
			duration,
			memoryUsed: memoryEnd.rss - tracker.memoryStart.rss,
			dbOperations: tracker.dbOperations,
			recordsProcessed: tracker.recordsProcessed,
		};
	}

	/**
	 * Handle execution failure
	 */
	async failExecution(executionId, error) {
		const tracker = this.activeExecutions.get(executionId);
		if (!tracker) {
			console.error(`[CronMonitor] No tracker found for execution ID: ${executionId}`);
			return;
		}

		const endTime = new Date();
		const memoryEnd = process.memoryUsage();
		const duration = endTime - tracker.startTime;

		// Clean up console capture
		this.cleanupConsoleCapture(executionId);

		// Determine error type
		let errorType = 'unknown';
		if (error.name === 'SequelizeError') errorType = 'database';
		else if (error.name === 'ValidationError') errorType = 'validation';
		else if (error.name === 'TimeoutError') errorType = 'timeout';
		else if (error.code === 'ECONNREFUSED') errorType = 'connection';

		// Update execution log
		await CronExecutionLog.update({
			status: 'error',
			finished_at: endTime,
			duration_ms: duration,
			memory_end_mb: Math.round(memoryEnd.rss / 1024 / 1024 * 100) / 100,
			db_operations: tracker.dbOperations,
			records_processed: tracker.recordsProcessed,
			error_message: error.message,
			error_stack: error.stack,
			error_type: errorType,
			console_output: tracker.consoleOutput.join('\n'),
			warnings: tracker.warnings.length > 0 ? tracker.warnings : null,
		}, {
			where: { id: tracker.executionLogId },
		});

		console.error(`[CronMonitor] ${EMOJI.FAILURE} Failed execution ${executionId} after ${duration}ms: ${error.message}`);
		
		// Clean up
		this.activeExecutions.delete(executionId);

		// Update health check
		await this.updateHealthStatus(tracker.jobName, error);

		return {
			duration,
			errorType,
			dbOperations: tracker.dbOperations,
		};
	}

	/**
	 * Set up console output capture for debugging
	 */
	setupConsoleCapture(executionId) {
		const tracker = this.activeExecutions.get(executionId);
		if (!tracker) return;

		// Store original console methods if not already done
		if (!this.originalConsole.log) {
			this.originalConsole.log = console.log;
			this.originalConsole.error = console.error;
			this.originalConsole.warn = console.warn;
		}

		// Override console methods to capture output
		const originalLog = this.originalConsole.log;
		const originalError = this.originalConsole.error;
		const originalWarn = this.originalConsole.warn;

		console.log = (...args) => {
			tracker.consoleOutput.push(`[LOG] ${args.join(' ')}`);
			originalLog.apply(console, args);
		};

		console.error = (...args) => {
			tracker.consoleOutput.push(`[ERROR] ${args.join(' ')}`);
			originalError.apply(console, args);
		};

		console.warn = (...args) => {
			tracker.consoleOutput.push(`[WARN] ${args.join(' ')}`);
			originalWarn.apply(console, args);
		};
	}

	/**
	 * Clean up console capture
	 */
	cleanupConsoleCapture(executionId) {
		if (this.originalConsole.log) {
			console.log = this.originalConsole.log;
			console.error = this.originalConsole.error;
			console.warn = this.originalConsole.warn;
		}
	}

	/**
	 * Update health status for a job
	 */
	async updateHealthStatus(jobName, lastError = null) {
		try {
			// Get recent execution statistics
			const recentLogs = await CronExecutionLog.findAll({
				where: { job_name: jobName },
				order: [['started_at', 'DESC']],
				limit: 50,
			});

			if (recentLogs.length === 0) {
				return; // No data to analyze
			}

			// Calculate health metrics
			const last24h = recentLogs.filter(log => 
				log.started_at > new Date(Date.now() - 24 * 60 * 60 * 1000)
			);
			const last7d = recentLogs.filter(log => 
				log.started_at > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
			);

			const successCount24h = last24h.filter(log => log.status === 'success').length;
			const successCount7d = last7d.filter(log => log.status === 'success').length;

			const successRate24h = last24h.length > 0 ? (successCount24h / last24h.length) * 100 : 0;
			const successRate7d = last7d.length > 0 ? (successCount7d / last7d.length) * 100 : 0;

			// Find last successful execution
			const lastSuccess = recentLogs.find(log => log.status === 'success');
			const minutesSinceSuccess = lastSuccess ? 
				Math.floor((Date.now() - lastSuccess.started_at) / (1000 * 60)) : null;

			// Calculate average execution time
			const successfulRuns = recentLogs
				.filter(log => log.status === 'success' && log.duration_ms)
				.slice(0, 10);
			const avgExecutionTime = successfulRuns.length > 0 ?
				successfulRuns.reduce((sum, log) => sum + log.duration_ms, 0) / successfulRuns.length : null;

			// Count consecutive failures
			let consecutiveFailures = 0;
			for (const log of recentLogs) {
				if (log.status === 'error') {
					consecutiveFailures++;
				} else {
					break;
				}
			}

			// Determine health status
			let healthStatus = 'healthy';
			let alertLevel = 'none';

			if (consecutiveFailures >= 3) {
				healthStatus = 'critical';
				alertLevel = 'critical';
			} else if (successRate24h < 50 || consecutiveFailures >= 2) {
				healthStatus = 'critical';
				alertLevel = 'warning';
			} else if (successRate24h < 80 || (minutesSinceSuccess && minutesSinceSuccess > 1440)) { // 24 hours
				healthStatus = 'warning';
				alertLevel = 'info';
			}

			// Memory trend analysis
			const recentMemoryUsage = last24h
				.filter(log => log.memory_end_mb)
				.map(log => log.memory_end_mb);

			let memoryTrend = 'stable';
			if (recentMemoryUsage.length >= 5) {
				const first = recentMemoryUsage.slice(-5, -2).reduce((a, b) => a + b, 0) / 3;
				const last = recentMemoryUsage.slice(-3).reduce((a, b) => a + b, 0) / 3;
				const change = (last - first) / first;
				
				if (change > 0.1) memoryTrend = 'increasing';
				else if (change < -0.1) memoryTrend = 'decreasing';
			}

			// Calculate performance score (0-100)
			let performanceScore = 100;
			performanceScore -= Math.max(0, (100 - successRate7d)); // Success rate impact
			performanceScore -= consecutiveFailures * 10; // Failure penalty
			if (avgExecutionTime && avgExecutionTime > 30000) { // > 30s is slow
				performanceScore -= Math.min(20, (avgExecutionTime - 30000) / 1000);
			}
			performanceScore = Math.max(0, Math.min(100, performanceScore));

			// Create or update health check entry
			await CronHealthCheck.create({
				job_name: jobName,
				health_status: healthStatus,
				check_time: new Date(),
				last_success: lastSuccess ? lastSuccess.started_at : null,
				minutes_since_success: minutesSinceSuccess,
				success_rate_24h: successRate24h,
				success_rate_7d: successRate7d,
				avg_execution_time_ms: avgExecutionTime,
				max_execution_time_24h: last24h.length > 0 ? 
					Math.max(...last24h.filter(log => log.duration_ms).map(log => log.duration_ms)) : null,
				consecutive_failures: consecutiveFailures,
				last_error_summary: lastError ? lastError.message : null,
				avg_memory_usage_mb: recentMemoryUsage.length > 0 ?
					recentMemoryUsage.reduce((a, b) => a + b, 0) / recentMemoryUsage.length : null,
				memory_trend: memoryTrend,
				performance_score: performanceScore,
				alert_level: alertLevel,
				health_details: {
					total_executions_24h: last24h.length,
					total_executions_7d: last7d.length,
					error_types: this.categorizeErrors(last24h),
					performance_trends: {
						avg_execution_time_trend: this.calculateTrend(successfulRuns.map(log => log.duration_ms)),
						memory_trend: memoryTrend,
					},
					recommendations: this.generateRecommendations(healthStatus, successRate24h, avgExecutionTime, consecutiveFailures),
				},
				next_check: new Date(Date.now() + 60 * 60 * 1000), // Next check in 1 hour
			});

		} catch (error) {
			console.error('[CronMonitor] Error updating health status:', error);
		}
	}

	/**
	 * Categorize errors by type
	 */
	categorizeErrors(logs) {
		const errorTypes = {};
		logs.filter(log => log.status === 'error').forEach(log => {
			const type = log.error_type || 'unknown';
			errorTypes[type] = (errorTypes[type] || 0) + 1;
		});
		return errorTypes;
	}

	/**
	 * Calculate trend direction for numeric values
	 */
	calculateTrend(values) {
		if (!values || values.length < 3) return 'insufficient_data';
		
		const mid = Math.floor(values.length / 2);
		const first = values.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
		const second = values.slice(mid).reduce((a, b) => a + b, 0) / (values.length - mid);
		
		const change = (second - first) / first;
		if (change > 0.1) return 'increasing';
		if (change < -0.1) return 'decreasing';
		return 'stable';
	}

	/**
	 * Generate health recommendations
	 */
	generateRecommendations(healthStatus, successRate, avgTime, consecutiveFailures) {
		const recommendations = [];

		if (healthStatus === 'critical') {
			recommendations.push('URGENT: This job is failing consistently. Check error logs immediately.');
		}
		
		if (successRate < 80) {
			recommendations.push('Consider investigating frequent failures and adding more error handling.');
		}
		
		if (avgTime && avgTime > 30000) {
			recommendations.push('Job is running slowly. Consider optimization or adding timeout handling.');
		}
		
		if (consecutiveFailures > 0) {
			recommendations.push(`${consecutiveFailures} consecutive failures detected. Check logs for patterns.`);
		}

		return recommendations;
	}

	/**
	 * Get comprehensive job statistics
	 */
	async getJobStats(jobName, days = 7) {
		const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
		
		const [logs, latestHealth] = await Promise.all([
			CronExecutionLog.findAll({
				where: { 
					job_name: jobName,
					started_at: { [require('sequelize').Op.gte]: since },
				},
				order: [['started_at', 'DESC']],
			}),
			CronHealthCheck.findOne({
				where: { job_name: jobName },
				order: [['check_time', 'DESC']],
			}),
		]);

		return {
			jobName,
			period: `${days} days`,
			totalExecutions: logs.length,
			successfulExecutions: logs.filter(log => log.status === 'success').length,
			failedExecutions: logs.filter(log => log.status === 'error').length,
			successRate: logs.length > 0 ? (logs.filter(log => log.status === 'success').length / logs.length * 100).toFixed(1) : 0,
			avgExecutionTime: logs.filter(log => log.duration_ms).length > 0 ?
				Math.round(logs.filter(log => log.duration_ms).reduce((sum, log) => sum + log.duration_ms, 0) / logs.filter(log => log.duration_ms).length) : null,
			totalRecordsProcessed: logs.reduce((sum, log) => sum + (log.records_processed || 0), 0),
			totalDbOperations: logs.reduce((sum, log) => sum + (log.db_operations || 0), 0),
			latestHealth,
			recentErrors: logs.filter(log => log.status === 'error').slice(0, 5),
		};
	}
}

// Singleton instance
let cronMonitor = null;

function getCronMonitor() {
	if (!cronMonitor) {
		cronMonitor = new CronMonitor();
	}
	return cronMonitor;
}

module.exports = {
	getCronMonitor,
	CronMonitor,
};