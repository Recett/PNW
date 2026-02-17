const { CronLog, CronSchedule } = require('@root/dbObject');

/**
 * CronJobManager - Utility class for managing cron job lifecycle
 * Provides methods to start, pause, stop, and monitor cron jobs with advanced scheduling
 */
class CronJobManager {
	/**
	 * Generate cron schedule from frequency settings
	 * @param {Object} scheduleConfig - Schedule configuration
	 * @returns {string} Cron schedule pattern
	 */
	static generateCronSchedule(scheduleConfig) {
		const { frequency, interval_value, execution_time, days_of_week, day_of_month, yearly_schedule } = scheduleConfig;
		
		// Parse execution time (HH:MM format)
		let minute = '0';
		let hour = '0';
		if (execution_time) {
			const [h, m] = execution_time.split(':');
			hour = h || '0';
			minute = m || '0';
		}
		
		switch (frequency) {
		case 'once':
			// Run once at specified time daily
			return `${minute} ${hour} * * *`;
		
		case 'minutely':
			// Every X minutes
			return `*/${interval_value} * * * *`;
		
		case 'hourly':
			// Every X hours at specified minute
			return `${minute} */${interval_value} * * *`;
		
		case 'daily':
			// Every X days at specified time
			return `${minute} ${hour} */${interval_value} * *`;
		
		case 'weekly': {
			// Weekly on specified days
			const weekDays = days_of_week ? days_of_week.join(',') : '0';
			return `${minute} ${hour} * * ${weekDays}`;
		}
		
		case 'monthly': {
			// Monthly on specified day
			const monthDay = day_of_month || '1';
			return `${minute} ${hour} ${monthDay} */${interval_value} *`;
		}
		
		case 'yearly': {
			if (yearly_schedule) {
				const { month, day } = yearly_schedule;
				// Yearly on specified date
				return `${minute} ${hour} ${day || 1} ${month || 1} *`;
			}
			// Default to January 1st
			return `${minute} ${hour} 1 1 *`;
		}
		
		case 'custom':
		default:
			// Default to hourly
			return '0 * * * *';
		}
	}
	
	/**
	 * Calculate next run time based on cron schedule
	 * @param {string} cronSchedule - Cron schedule pattern
	 * @param {Date} fromDate - Calculate from this date (default: now)
	 * @returns {Date} Next execution time
	 */
	static calculateNextRun(cronSchedule, fromDate = new Date()) {
		// This is a simplified calculation - in production, you'd use a library like 'node-cron' or 'cron-parser'
		const now = new Date(fromDate);
		const nextRun = new Date(now);
		
		// Add 1 hour as default (this should be replaced with proper cron parsing)
		nextRun.setHours(nextRun.getHours() + 1);
		
		return nextRun;
	}
	
	/**
	 * Check if job should auto-stop based on limits
	 * @param {Object} cronJob - Cron job record with schedule
	 * @returns {boolean} True if job should stop
	 */
	static shouldAutoStop(cronJob) {
		const schedule = cronJob.schedule;
		if (!schedule) return false;
		
		// Check execution limit
		if (schedule.max_executions && cronJob.execution_count >= schedule.max_executions) {
			return true;
		}
		
		// Check runtime limit
		if (schedule.max_runtime_minutes && cronJob.started_at) {
			const runtimeMinutes = (Date.now() - cronJob.started_at.getTime()) / (1000 * 60);
			if (runtimeMinutes >= schedule.max_runtime_minutes) {
				return true;
			}
		}
		
		// Check scheduled stop time
		if (schedule.scheduled_stop_at && Date.now() >= schedule.scheduled_stop_at.getTime()) {
			return true;
		}
		
		return false;
	}
	
	/**
	 * Check if job should auto-start
	 * @param {Object} cronJob - Cron job record with schedule
	 * @returns {boolean} True if job should start
	 */
	static shouldAutoStart(cronJob) {
		const schedule = cronJob.schedule;
		if (!schedule) return false;
		
		// Check if job is scheduled to start
		if (schedule.scheduled_start_at && Date.now() >= schedule.scheduled_start_at.getTime()) {
			return true;
		}
		
		return false;
	}
	/**
	 * Start a cron job with advanced scheduling options
	 * @param {string} jobName - Name of the cron job
	 * @param {Object} scheduleOptions - Advanced scheduling configuration
	 * @param {Object} config - Additional job configuration
	 * @returns {Object} Updated cron log entry with schedule
	 */
	static async startJob(jobName, scheduleOptions = {}, config = {}) {
		const now = new Date();
		
		// Build schedule configuration
		const scheduleConfig = {
			frequency: scheduleOptions.frequency || 'custom',
			interval_value: scheduleOptions.intervalValue || 1,
			execution_time: scheduleOptions.executionTime || null,
			days_of_week: scheduleOptions.daysOfWeek || null,
			day_of_month: scheduleOptions.dayOfMonth || null,
			yearly_schedule: scheduleOptions.yearlySchedule || null,
			timezone: scheduleOptions.timezone || 'UTC',
			max_executions: scheduleOptions.maxExecutions || null,
			max_runtime_minutes: scheduleOptions.maxRuntimeMinutes || null,
			scheduled_start_at: scheduleOptions.scheduledStartAt || null,
			scheduled_stop_at: scheduleOptions.scheduledStopAt || null,
			auto_restart: scheduleOptions.autoRestart || 'never',
			restart_delay_minutes: scheduleOptions.restartDelayMinutes || 0,
			auto_start_on_boot: scheduleOptions.autoStartOnBoot || false,
			priority: scheduleOptions.priority || 5,
		};
		
		// Generate cron schedule from frequency settings
		const cronSchedule = scheduleOptions.schedule || this.generateCronSchedule(scheduleConfig);
		scheduleConfig.schedule = cronSchedule;
		
		// Find or create the job entry
		let cronJob = await CronLog.findOne({
			where: { job_name: jobName },
			include: [{ model: CronSchedule, as: 'schedule' }],
		});
		
		if (!cronJob) {
			// Create new job
			cronJob = await CronLog.create({
				job_name: jobName,
				status: 'running',
				schedule: cronSchedule,
				config: config,
				started_at: now,
				updated_at: now,
				is_enabled: true,
			});
			
			// Create associated schedule
			await CronSchedule.create({
				cron_log_id: cronJob.id,
				...scheduleConfig,
				created_at: now,
				updated_at: now,
			});
		}
		else {
			// Update existing job to running status
			await cronJob.update({
				status: 'running',
				schedule: cronSchedule,
				config: { ...cronJob.config, ...config },
				started_at: now,
				paused_at: null,
				stopped_at: null,
				updated_at: now,
				is_enabled: true,
			});
			
			// Update or create schedule
			if (cronJob.schedule) {
				await cronJob.schedule.update({
					...scheduleConfig,
					updated_at: now,
				});
			}
			else {
				await CronSchedule.create({
					cron_log_id: cronJob.id,
					...scheduleConfig,
					created_at: now,
					updated_at: now,
				});
			}
		}
		
		return cronJob.reload({ include: [{ model: CronSchedule, as: 'schedule' }] });
	}

	/**
	 * Pause a cron job
	 * @param {string} jobName - Name of the cron job
	 * @returns {Object} Updated cron log entry
	 */
	static async pauseJob(jobName) {
		const cronJob = await CronLog.findOne({ where: { job_name: jobName } });
		
		if (!cronJob) {
			throw new Error(`Cron job '${jobName}' not found`);
		}
		
		if (cronJob.status !== 'running') {
			throw new Error(`Cannot pause job '${jobName}' - current status: ${cronJob.status}`);
		}
		
		const now = new Date();
		await cronJob.update({
			status: 'paused',
			paused_at: now,
			updated_at: now,
		});
		
		return cronJob.reload();
	}

	/**
	 * Resume a paused cron job
	 * @param {string} jobName - Name of the cron job
	 * @returns {Object} Updated cron log entry
	 */
	static async resumeJob(jobName) {
		const cronJob = await CronLog.findOne({ where: { job_name: jobName } });
		
		if (!cronJob) {
			throw new Error(`Cron job '${jobName}' not found`);
		}
		
		if (cronJob.status !== 'paused') {
			throw new Error(`Cannot resume job '${jobName}' - current status: ${cronJob.status}`);
		}
		
		const now = new Date();
		await cronJob.update({
			status: 'running',
			paused_at: null,
			updated_at: now,
		});
		
		return cronJob.reload();
	}

	/**
	 * Stop a cron job
	 * @param {string} jobName - Name of the cron job
	 * @returns {Object} Updated cron log entry
	 */
	static async stopJob(jobName) {
		const cronJob = await CronLog.findOne({ where: { job_name: jobName } });
		
		if (!cronJob) {
			throw new Error(`Cron job '${jobName}' not found`);
		}
		
		const now = new Date();
		await cronJob.update({
			status: 'stopped',
			stopped_at: now,
			paused_at: null,
			updated_at: now,
		});
		
		return cronJob.reload();
	}

	/**
	 * Record a successful job execution
	 * @param {string} jobName - Name of the cron job
	 * @param {Date} nextRun - Next scheduled run time
	 * @returns {Object} Updated cron log entry
	 */
	static async recordExecution(jobName, nextRun = null) {
		const cronJob = await CronLog.findOne({ where: { job_name: jobName } });
		
		if (!cronJob) {
			throw new Error(`Cron job '${jobName}' not found`);
		}
		
		const now = new Date();
		await cronJob.update({
			last_run: now,
			next_run: nextRun,
			execution_count: cronJob.execution_count + 1,
			success_count: cronJob.success_count + 1,
			updated_at: now,
		});
		
		return cronJob.reload();
	}

	/**
	 * Record a failed job execution
	 * @param {string} jobName - Name of the cron job
	 * @param {string} error - Error message
	 * @param {Date} nextRun - Next scheduled run time
	 * @returns {Object} Updated cron log entry
	 */
	static async recordError(jobName, error, nextRun = null) {
		const cronJob = await CronLog.findOne({ where: { job_name: jobName } });
		
		if (!cronJob) {
			throw new Error(`Cron job '${jobName}' not found`);
		}
		
		const now = new Date();
		await cronJob.update({
			last_run: now,
			next_run: nextRun,
			execution_count: cronJob.execution_count + 1,
			error_count: cronJob.error_count + 1,
			last_error: error,
			last_error_at: now,
			status: 'error',
			updated_at: now,
		});
		
		return cronJob.reload();
	}

	/**
	 * Enable or disable a cron job
	 * @param {string} jobName - Name of the cron job
	 * @param {boolean} enabled - Whether to enable or disable
	 * @returns {Object} Updated cron log entry
	 */
	static async setJobEnabled(jobName, enabled) {
		const cronJob = await CronLog.findOne({ where: { job_name: jobName } });
		
		if (!cronJob) {
			throw new Error(`Cron job '${jobName}' not found`);
		}
		
		const now = new Date();
		const updateData = {
			is_enabled: enabled,
			updated_at: now,
		};
		
		// If disabling, stop the job
		if (!enabled && cronJob.status === 'running') {
			updateData.status = 'stopped';
			updateData.stopped_at = now;
		}
		
		await cronJob.update(updateData);
		return cronJob.reload();
	}

	/**
	 * Get all cron jobs with their status
	 * @param {string} status - Optional status filter
	 * @returns {Array} List of cron jobs
	 */
	static async getAllJobs(status = null) {
		const whereClause = {};
		if (status) {
			whereClause.status = status;
		}
		
		return await CronLog.findAll({
			where: whereClause,
			order: [['job_name', 'ASC']],
		});
	}

	/**
	 * Get running cron jobs
	 * @returns {Array} List of running cron jobs
	 */
	static async getRunningJobs() {
		return await this.getAllJobs('running');
	}

	/**
	 * Get paused cron jobs
	 * @returns {Array} List of paused cron jobs
	 */
	static async getPausedJobs() {
		return await this.getAllJobs('paused');
	}

	/**
	 * Get job statistics
	 * @param {string} jobName - Name of the cron job
	 * @returns {Object} Job statistics
	 */
	static async getJobStats(jobName) {
		const cronJob = await CronLog.findOne({ where: { job_name: jobName } });
		
		if (!cronJob) {
			throw new Error(`Cron job '${jobName}' not found`);
		}
		
		const successRate = cronJob.execution_count > 0 
			? (cronJob.success_count / cronJob.execution_count * 100).toFixed(2)
			: 0;
			
		return {
			jobName: cronJob.job_name,
			status: cronJob.status,
			totalExecutions: cronJob.execution_count,
			successfulExecutions: cronJob.success_count,
			failedExecutions: cronJob.error_count,
			successRate: `${successRate}%`,
			lastRun: cronJob.last_run,
			nextRun: cronJob.next_run,
			lastError: cronJob.last_error,
			lastErrorAt: cronJob.last_error_at,
			uptime: cronJob.started_at ? this.calculateUptime(cronJob.started_at) : null,
		};
	}

	/**
	 * Calculate uptime for a job
	 * @param {Date} startedAt - When the job was started
	 * @returns {string} Formatted uptime string
	 */
	static calculateUptime(startedAt) {
		if (!startedAt) return null;
		
		const now = new Date();
		const uptimeMs = now - startedAt;
		const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
		const hours = Math.floor((uptimeMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
		const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
		
		if (days > 0) {
			return `${days}d ${hours}h ${minutes}m`;
		}
		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		return `${minutes}m`;
	}

	/**
	 * Update job configuration
	 * @param {string} jobName - Name of the cron job
	 * @param {Object} newConfig - New configuration object
	 * @returns {Object} Updated cron log entry
	 */
	static async updateJobConfig(jobName, newConfig) {
		const cronJob = await CronLog.findOne({ where: { job_name: jobName } });
		
		if (!cronJob) {
			throw new Error(`Cron job '${jobName}' not found`);
		}
		
		const now = new Date();
		await cronJob.update({
			config: { ...cronJob.config, ...newConfig },
			updated_at: now,
		});
		
		return cronJob.reload();
	}

	/**
	 * Create a scheduled job with advanced options
	 * @param {string} jobName - Name of the cron job
	 * @param {Object} scheduleOptions - Advanced scheduling options
	 * @returns {Object} Created cron job entry
	 */
	static async createScheduledJob(jobName, scheduleOptions) {
		const now = new Date();
		
		const jobData = {
			job_name: jobName,
			status: 'stopped',
			description: scheduleOptions.description || '',
			frequency: scheduleOptions.frequency || 'daily',
			interval_value: scheduleOptions.intervalValue || 1,
			execution_time: scheduleOptions.executionTime || '00:00',
			days_of_week: scheduleOptions.daysOfWeek || null,
			day_of_month: scheduleOptions.dayOfMonth || null,
			yearly_schedule: scheduleOptions.yearlySchedule || null,
			timezone: scheduleOptions.timezone || 'UTC',
			max_executions: scheduleOptions.maxExecutions || null,
			max_runtime_minutes: scheduleOptions.maxRuntimeMinutes || null,
			scheduled_start_at: scheduleOptions.scheduledStartAt || null,
			scheduled_stop_at: scheduleOptions.scheduledStopAt || null,
			auto_restart: scheduleOptions.autoRestart || 'never',
			restart_delay_minutes: scheduleOptions.restartDelayMinutes || 0,
			auto_start_on_boot: scheduleOptions.autoStartOnBoot || false,
			priority: scheduleOptions.priority || 5,
			config: scheduleOptions.config || {},
			is_enabled: scheduleOptions.enabled !== false,
			created_at: now,
			updated_at: now,
		};
		
		// Generate cron schedule
		jobData.schedule = this.generateCronSchedule(jobData);
		
		return await CronLog.create(jobData);
	}

	/**
	 * Update job scheduling options
	 * @param {string} jobName - Name of the cron job
	 * @param {Object} scheduleOptions - New scheduling options
	 * @returns {Object} Updated cron job entry
	 */
	static async updateJobSchedule(jobName, scheduleOptions) {
		const cronJob = await CronLog.findOne({ where: { job_name: jobName } });
		
		if (!cronJob) {
			throw new Error(`Cron job '${jobName}' not found`);
		}
		
		const now = new Date();
		const updateData = {
			updated_at: now,
		};
		
		// Update schedule-related fields if provided
		if (scheduleOptions.frequency !== undefined) updateData.frequency = scheduleOptions.frequency;
		if (scheduleOptions.intervalValue !== undefined) updateData.interval_value = scheduleOptions.intervalValue;
		if (scheduleOptions.executionTime !== undefined) updateData.execution_time = scheduleOptions.executionTime;
		if (scheduleOptions.daysOfWeek !== undefined) updateData.days_of_week = scheduleOptions.daysOfWeek;
		if (scheduleOptions.dayOfMonth !== undefined) updateData.day_of_month = scheduleOptions.dayOfMonth;
		if (scheduleOptions.yearlySchedule !== undefined) updateData.yearly_schedule = scheduleOptions.yearlySchedule;
		if (scheduleOptions.timezone !== undefined) updateData.timezone = scheduleOptions.timezone;
		if (scheduleOptions.maxExecutions !== undefined) updateData.max_executions = scheduleOptions.maxExecutions;
		if (scheduleOptions.maxRuntimeMinutes !== undefined) updateData.max_runtime_minutes = scheduleOptions.maxRuntimeMinutes;
		if (scheduleOptions.scheduledStartAt !== undefined) updateData.scheduled_start_at = scheduleOptions.scheduledStartAt;
		if (scheduleOptions.scheduledStopAt !== undefined) updateData.scheduled_stop_at = scheduleOptions.scheduledStopAt;
		if (scheduleOptions.autoRestart !== undefined) updateData.auto_restart = scheduleOptions.autoRestart;
		if (scheduleOptions.restartDelayMinutes !== undefined) updateData.restart_delay_minutes = scheduleOptions.restartDelayMinutes;
		if (scheduleOptions.priority !== undefined) updateData.priority = scheduleOptions.priority;
		
		// Regenerate cron schedule if frequency-related fields changed
		if (scheduleOptions.frequency || scheduleOptions.intervalValue || scheduleOptions.executionTime ||
			scheduleOptions.daysOfWeek || scheduleOptions.dayOfMonth || scheduleOptions.yearlySchedule) {
			updateData.schedule = this.generateCronSchedule({ ...cronJob.dataValues, ...updateData });
		}
		
		await cronJob.update(updateData);
		return cronJob.reload();
	}

	/**
	 * Process scheduled jobs (check for auto-start/stop conditions)
	 * @returns {Array} List of jobs that were automatically started or stopped
	 */
	static async processScheduledJobs() {
		const processedJobs = [];
		const now = new Date();
		
		// Find jobs that should auto-start
		const jobsToStart = await CronLog.findAll({
			where: {
				status: 'stopped',
				is_enabled: true,
				scheduled_start_at: {
					[require('sequelize').Op.lte]: now,
				},
			},
		});
		
		for (const job of jobsToStart) {
			try {
				await job.update({
					status: 'running',
					started_at: now,
					updated_at: now,
				});
				processedJobs.push({ action: 'started', job: job.job_name });
			}
			catch (error) {
				processedJobs.push({ action: 'start_failed', job: job.job_name, error: error.message });
			}
		}
		
		// Find jobs that should auto-stop
		const runningJobs = await CronLog.findAll({
			where: {
				status: 'running',
			},
		});
		
		for (const job of runningJobs) {
			if (this.shouldAutoStop(job)) {
				try {
					await job.update({
						status: 'stopped',
						stopped_at: now,
						updated_at: now,
					});
					processedJobs.push({ action: 'stopped', job: job.job_name, reason: 'auto_stop' });
				}
				catch (error) {
					processedJobs.push({ action: 'stop_failed', job: job.job_name, error: error.message });
				}
			}
		}
		
		return processedJobs;
	}

	/**
	 * Get jobs that should auto-start on boot
	 * @returns {Array} List of jobs to start on boot
	 */
	static async getBootJobs() {
		return await CronLog.findAll({
			where: {
				auto_start_on_boot: true,
				is_enabled: true,
				status: 'stopped',
			},
			order: [['priority', 'ASC']],
		});
	}

	/**
	 * Create a quick job with simple frequency
	 * @param {string} jobName - Name of the job
	 * @param {string} frequency - 'hourly', 'daily', 'weekly', 'monthly'
	 * @param {string} time - Execution time in HH:MM format (for daily+)
	 * @param {Object} options - Additional options
	 * @returns {Object} Created job
	 */
	static async createQuickJob(jobName, frequency, time = '00:00', options = {}) {
		const scheduleOptions = {
			frequency,
			executionTime: time,
			description: options.description || `${frequency} job`,
			maxExecutions: options.maxExecutions,
			...options,
		};
		
		return await this.createScheduledJob(jobName, scheduleOptions);
	}
}

module.exports = CronJobManager;