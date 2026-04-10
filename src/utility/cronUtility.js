const { CronJob } = require('cron');

// This job runs every day at 00:00 (midnight)
const { CronLog, NpcPurchase, GlobalFlag } = require('@root/dbObject.js');
const contentStore = require('@root/contentStore.js');
const taskUtility = require('./taskUtility');
const { getCronMonitor } = require('./cronMonitor');
const { eventProcessor } = require('./eventUtility');

let _discordClient = null;

const CRON_TIMEZONE = 'Asia/Ho_Chi_Minh';
// Always use this factory — it enforces the server timezone on every job
const makeCronJob = (schedule, fn) => new CronJob(schedule, fn, null, false, CRON_TIMEZONE);

const GALEBY_APPEAR_CHANCE = 25; // 25% per hour → ~6 visible hours per 24h

const job = makeCronJob('0 0 * * *', async () => {
	await performCronJob();
});

const hourlyJob = makeCronJob('0 * * * *', async () => {
	// Each subtask runs independently — a failure in one does not abort the others
	await performCharacterRegen();
	await performPendingDeleteCleanup();
	await performGalebyCycle();
	await performHourlyTasks();
});

// This job runs every Sunday at 00:00 — resets NPC shop purchase counts
const weeklyStockResetJob = makeCronJob('0 0 * * 0', async () => {
	await performWeeklyStockReset();
});

// This job runs every day at 01:00 — processes daily tasks (offset from midnight job)
const dailyTaskJob = makeCronJob('0 1 * * *', async () => {
	await performDailyTasks();
});

// This job runs every 30 minutes — health monitoring and alerting
const healthMonitorJob = makeCronJob('*/30 * * * *', async () => {
	await performHealthCheck();
});

// Do NOT start the job automatically

async function performCronJob() {
	const jobName = 'midnight_job';
	try {
		// Mark job as running
		await CronLog.upsert({
			job_name: jobName,
			status: 'running',
			last_run: new Date(),
		});

		// Place your scheduled code here
		await performBilgeEcosystemDailyCycle();

		// Mark job as stopped (success)
		const job = await CronLog.findOne({ where: { job_name: jobName } });
		await job.update({
			status: 'stopped',
			execution_count: (job.execution_count || 0) + 1,
			success_count: (job.success_count || 0) + 1,
		});
	}
	catch (error) {
		console.error(`Error in ${jobName}:`, error);
		// Mark job as error
		const job = await CronLog.findOne({ where: { job_name: jobName } });
		if (job) {
			await job.update({
				status: 'error',
				execution_count: (job.execution_count || 0) + 1,
				error_count: (job.error_count || 0) + 1,
				last_error: error.message,
				last_error_at: new Date(),
			});
		}
		throw error;
	}
}

const { CharacterBase, CharacterSetting } = require('@root/dbObject.js');

async function performCharacterRegen() {
	const jobName = 'character_regen';
	const monitor = getCronMonitor();
	let tracker = null;
	try {
		tracker = await monitor.startExecution(jobName, {
			description: 'Hourly HP/Stamina regeneration for characters in town',
			expected_duration_ms: 5000,
		});
		await CronLog.upsert({ job_name: jobName, status: 'running', last_run: new Date() });

		const nowSeconds = Math.floor(Date.now() / 1000);

		const staminaResult = await CharacterBase.sequelize.query(`
			UPDATE character_bases
			SET currentStamina = MIN(maxStamina, currentStamina + CAST((maxStamina * 0.10 + 0.999) AS INTEGER))
			WHERE maxStamina IS NOT NULL 
				AND currentStamina IS NOT NULL
				AND location_id IN (SELECT id FROM location_bases WHERE LOWER(type) = 'town');
		`);
		monitor.logDatabaseOperation(tracker.id, staminaResult[1] || 0);

		// TODO: KO mechanic temporarily disabled — wake-up and regen-block logic skipped
		// await CharacterBase.sequelize.query(`
		// 	UPDATE character_bases SET currentHp = 1
		// 	WHERE id IN (SELECT character_id FROM character_statuses
		// 		WHERE status_id = 'knocked_out' AND expires_at <= datetime('now')) AND currentHp <= 0;
		// `);
		// await CharacterBase.sequelize.query(`
		// 	DELETE FROM character_statuses WHERE status_id = 'knocked_out' AND expires_at <= datetime('now');
		// `);

		const hpResult = await CharacterBase.sequelize.query(`
			UPDATE character_bases
			SET currentHp = MIN(maxHp, currentHp + CAST((maxHp * 0.20 + 0.999) AS INTEGER))
			WHERE maxHp IS NOT NULL 
				AND currentHp IS NOT NULL
				AND location_id IN (SELECT id FROM location_bases WHERE LOWER(type) = 'town');
		`);
		monitor.logDatabaseOperation(tracker.id, hpResult[1] || 0);

		const job = await CronLog.findOne({ where: { job_name: jobName } });
		await job.update({
			status: 'stopped',
			execution_count: (job.execution_count || 0) + 1,
			success_count: (job.success_count || 0) + 1,
		});
		await monitor.completeExecution(tracker.id, {
			stamina_updates: staminaResult[1] || 0,
			hp_updates: hpResult[1] || 0,
		});
	}
	catch (error) {
		console.error('[CharacterRegen] Error:', error);
		if (tracker) await monitor.failExecution(tracker.id, error);
		const job = await CronLog.findOne({ where: { job_name: jobName } });
		if (job) {
			await job.update({
				status: 'error',
				execution_count: (job.execution_count || 0) + 1,
				error_count: (job.error_count || 0) + 1,
				last_error: error.message,
				last_error_at: new Date(),
			});
		}
	}
}

async function performGalebyCycle() {
	const jobName = 'galeby_cycle';
	const monitor = getCronMonitor();
	let tracker = null;
	try {
		tracker = await monitor.startExecution(jobName, {
			description: 'Hourly Galeby presence roll (25% chance to appear)',
			expected_duration_ms: 1000,
		});
		await CronLog.upsert({ job_name: jobName, status: 'running', last_run: new Date() });

		const roll = Math.floor(Math.random() * 100) + 1;
		const present = roll <= GALEBY_APPEAR_CHANCE;
		await GlobalFlag.upsert({ flag: 'galeby_present', value: present ? 1 : 0 });
		console.log(`[Galeby] Hour roll: ${present ? 'present' : 'absent'} (${roll}/100)`);

		const job = await CronLog.findOne({ where: { job_name: jobName } });
		await job.update({
			status: 'stopped',
			execution_count: (job.execution_count || 0) + 1,
			success_count: (job.success_count || 0) + 1,
		});
		await monitor.completeExecution(tracker.id, { roll, present });
	}
	catch (error) {
		console.error('[Galeby] Error in performGalebyCycle:', error);
		if (tracker) await monitor.failExecution(tracker.id, error);
		const job = await CronLog.findOne({ where: { job_name: jobName } });
		if (job) {
			await job.update({
				status: 'error',
				execution_count: (job.execution_count || 0) + 1,
				error_count: (job.error_count || 0) + 1,
				last_error: error.message,
				last_error_at: new Date(),
			});
		}
	}
}

async function performPendingDeleteCleanup() {
	if (!_discordClient) return;
	const jobName = 'pending_delete_cleanup';
	const monitor = getCronMonitor();
	let tracker = null;
	const ONE_HOUR_MS = 60 * 60 * 1000;
	let cleaned = 0;
	try {
		tracker = await monitor.startExecution(jobName, {
			description: 'Clean up stale deferred Discord message deletions',
			expected_duration_ms: 3000,
		});
		await CronLog.upsert({ job_name: jobName, status: 'running', last_run: new Date() });

		const rows = await CharacterSetting.findAll({ where: { setting: '_pending_delete' } });
		for (const row of rows) {
			const parts = row.value.split('|');
			if (parts.length >= 3) {
				const age = Date.now() - parseInt(parts[2], 10);
				if (age < ONE_HOUR_MS) continue;
			}
			try {
				const channel = await _discordClient.channels.fetch(parts[0]).catch(() => null);
				if (channel) {
					const msg = await channel.messages.fetch(parts[1]).catch(() => null);
					if (msg) await msg.delete().catch(() => {});
				}
			}
			catch (e) { /* channel or message may not exist */ }
			await row.destroy();
			cleaned++;
		}
		if (cleaned > 0) console.log(`[PendingDeleteCleanup] Cleaned ${cleaned} stale pending deletion(s).`);
		monitor.logDatabaseOperation(tracker.id, cleaned);

		const job = await CronLog.findOne({ where: { job_name: jobName } });
		await job.update({
			status: 'stopped',
			execution_count: (job.execution_count || 0) + 1,
			success_count: (job.success_count || 0) + 1,
		});
		await monitor.completeExecution(tracker.id, { cleaned });
	}
	catch (error) {
		console.error('[PendingDeleteCleanup] Error:', error);
		if (tracker) await monitor.failExecution(tracker.id, error);
		const job = await CronLog.findOne({ where: { job_name: jobName } });
		if (job) {
			await job.update({
				status: 'error',
				execution_count: (job.execution_count || 0) + 1,
				error_count: (job.error_count || 0) + 1,
				last_error: error.message,
				last_error_at: new Date(),
			});
		}
	}
}

async function performHourlyTasks() {
	const jobName = 'hourly_tasks';
	const monitor = getCronMonitor();
	let tracker = null;
	try {
		tracker = await monitor.startExecution(jobName, {
			description: 'Hourly YAML task processor',
			expected_duration_ms: 5000,
		});
		await CronLog.upsert({ job_name: jobName, status: 'running', last_run: new Date() });

		const results = await taskUtility.processScheduledTasks('hourly');
		monitor.logDatabaseOperation(tracker.id, results.charactersProcessed || 0);

		const job = await CronLog.findOne({ where: { job_name: jobName } });
		await job.update({
			status: 'stopped',
			execution_count: (job.execution_count || 0) + 1,
			success_count: (job.success_count || 0) + 1,
		});
		await monitor.completeExecution(tracker.id, {
			tasks_processed: results.tasksProcessed || 0,
			characters_processed: results.charactersProcessed || 0,
		});
	}
	catch (error) {
		console.error('[HourlyTasks] Error:', error);
		if (tracker) await monitor.failExecution(tracker.id, error);
		const job = await CronLog.findOne({ where: { job_name: jobName } });
		if (job) {
			await job.update({
				status: 'error',
				execution_count: (job.execution_count || 0) + 1,
				error_count: (job.error_count || 0) + 1,
				last_error: error.message,
				last_error_at: new Date(),
			});
		}
	}
}

async function performWeeklyStockReset() {
	const jobName = 'weekly_stock_reset';
	try {
		await CronLog.upsert({
			job_name: jobName,
			status: 'running',
			last_run: new Date(),
		});

		// Clear all NPC purchase records — restocks all shops to YAML max
		const deleted = await NpcPurchase.destroy({ where: {} });
		console.log(`[WeeklyStockReset] Cleared ${deleted} purchase record(s).`);

		// Process weekly YAML tasks
		const weeklyTaskResults = await taskUtility.processScheduledTasks('weekly');
		console.log(`[WeeklyStockReset] Processed ${weeklyTaskResults.tasksProcessed} weekly task(s) for ${weeklyTaskResults.charactersProcessed} character(s).`);

		const job = await CronLog.findOne({ where: { job_name: jobName } });
		await job.update({
			status: 'stopped',
			execution_count: (job.execution_count || 0) + 1,
			success_count: (job.success_count || 0) + 1,
		});
	}
	catch (error) {
		console.error(`Error in ${jobName}:`, error);
		const job = await CronLog.findOne({ where: { job_name: jobName } });
		if (job) {
			await job.update({
				status: 'error',
				execution_count: (job.execution_count || 0) + 1,
				error_count: (job.error_count || 0) + 1,
				last_error: error.message,
				last_error_at: new Date(),
			});
		}
		throw error;
	}
}

async function performBilgeEcosystemDailyCycle() {
	const RAT_COUNT = 50;
	const KING_MAX_HP = 400; // matches rat_king_undead stat.health
	const KING_HP_REGEN = 200;
	const KING_HP_FLAG = 'global.rat_king_undead_hp';

	const slainRecord = await GlobalFlag.findOne({ where: { flag: 'global.undead_rat_king_slain' } });
	const isSlain = slainRecord ? parseInt(slainRecord.value) || 0 : 0;
	const originalBilgeClearedRecord = await GlobalFlag.findOne({ where: { flag: 'global.bilge_cleared' } });
	const originalBilgeCleared = originalBilgeClearedRecord ? parseInt(originalBilgeClearedRecord.value) || 0 : 0;

	// Skip entirely if the undead event has already been cleared
	const clearedRecord = await GlobalFlag.findOne({ where: { flag: 'global.undead_bilge_cleared' } });
	const isCleared = clearedRecord ? parseInt(clearedRecord.value) || 0 : 0;
	if (isCleared && !isSlain && clearedRecord) {
		await clearedRecord.update({ value: 0 });
		console.warn('[BilgeEcosystem] Found stale undead_bilge_cleared flag while Rat King is alive. Resetting flag.');
	}
	if (isCleared && isSlain) {
		console.log('[BilgeEcosystem] Undead event already cleared — skipping daily cycle.');
		return;
	}

	const kingHpRecord = await GlobalFlag.findOne({ where: { flag: KING_HP_FLAG } });

	// Skip if the original bilge arc is not complete and there is no undead progress yet.
	const ratCountRecord = await GlobalFlag.findOne({ where: { flag: 'global.undead_rat_count' } });
	const hasUndeadProgress = Boolean(ratCountRecord || kingHpRecord || slainRecord || clearedRecord || originalBilgeCleared);
	if (!hasUndeadProgress) {
		console.log('[BilgeEcosystem] Undead event not yet active — skipping daily cycle.');
		return;
	}

	if (!ratCountRecord && !isSlain) {
		await GlobalFlag.upsert({ flag: 'global.undead_rat_count', value: String(RAT_COUNT) });
		console.log('[BilgeEcosystem] Bootstrapped undead rat pool.');
	}

	// Reset the undead rat pool every midnight
	await GlobalFlag.upsert({ flag: 'global.undead_rat_count', value: String(RAT_COUNT) });

	// Rat King does NOT respawn once slain — only regenerate HP if still alive
	if (!isSlain) {
		const currentHp = kingHpRecord ? parseInt(kingHpRecord.value) || KING_MAX_HP : KING_MAX_HP;
		const newHp = Math.min(KING_MAX_HP, currentHp + KING_HP_REGEN);
		await GlobalFlag.upsert({ flag: KING_HP_FLAG, value: String(newHp) });
		console.log(`[BilgeEcosystem] Undead Rat King HP regen: ${currentHp} -> ${newHp} (max ${KING_MAX_HP})`);
	}

	console.log(`[BilgeEcosystem] Daily reset — undead_rat_count: ${RAT_COUNT}, king slain: ${isSlain}`);
}

async function performDailyTasks() {
	const jobName = 'daily_task_processor';
	const monitor = getCronMonitor();
	let tracker = null;

	try {
		// Start enhanced monitoring
		tracker = await monitor.startExecution(jobName, {
			description: 'Daily automated task processing for all characters',
			expected_duration_ms: 30000, // Expected ~30 seconds
		});

		// Mark job as running (legacy CronLog)
		await CronLog.upsert({
			job_name: jobName,
			status: 'running',
			last_run: new Date(),
		});

		// Execute all daily tasks using taskUtility
		console.log('[DailyTaskProcessor] Starting daily task processing...');
		const results = await taskUtility.processScheduledTasks('daily', { verbose: true });
		
		// Log monitoring data
		monitor.logDatabaseOperation(tracker.id, results.charactersProcessed);
		
		console.log(`[DailyTaskProcessor] Completed: ${results.tasksProcessed} tasks, ${results.charactersProcessed} characters processed, ${results.succeeded} succeeded, ${results.failed} failed`);

		// Check for any failures and log warnings
		if (results.failed > 0) {
			monitor.logWarning(tracker.id, `${results.failed} task executions failed during daily processing`);
		}

		// Mark job as stopped (success) - legacy CronLog
		const job = await CronLog.findOne({ where: { job_name: jobName } });
		await job.update({
			status: 'stopped',
			execution_count: (job.execution_count || 0) + 1,
			success_count: (job.success_count || 0) + 1,
		});

		// Complete monitoring
		await monitor.completeExecution(tracker.id, {
			tasks_processed: results.tasksProcessed,
			characters_processed: results.charactersProcessed,
			succeeded: results.succeeded,
			failed: results.failed,
			task_details: results.taskResults || [],
		});

	}
	catch (error) {
		console.error(`Error in ${jobName}:`, error);
		
		// Handle monitoring failure
		if (tracker) {
			await monitor.failExecution(tracker.id, error);
		}

		// Mark job as error - legacy CronLog
		const job = await CronLog.findOne({ where: { job_name: jobName } });
		if (job) {
			await job.update({
				status: 'error',
				execution_count: (job.execution_count || 0) + 1,
				error_count: (job.error_count || 0) + 1,
				last_error: error.message,
				last_error_at: new Date(),
			});
		}
		throw error;
	}
}

async function performHealthCheck() {
	const jobName = 'health_monitor';
	const monitor = getCronMonitor();
	let tracker = null;

	try {
		// Ensure a CronLog row exists for this meta-job (required by FK on cron_execution_logs)
		await CronLog.upsert({
			job_name: jobName,
			status: 'running',
			last_run: new Date(),
		});

		// Start lightweight monitoring (no console capture for monitoring job)
		tracker = await monitor.startExecution(jobName, {
			description: 'Health monitoring and alert checking for all cron jobs',
			expected_duration_ms: 5000, // Expected ~5 seconds
		});

		console.log('[HealthMonitor] Starting scheduled health check...');

		// Get list of all jobs to monitor
		const allJobs = await CronLog.findAll({
			attributes: ['job_name'],
		});

		let healthyCount = 0;
		let warningCount = 0;
		let criticalCount = 0;

		// Update health status for each job
		for (const job of allJobs) {
			if (job.job_name === 'health_monitor') continue; // Skip self-monitoring

			try {
				await monitor.updateHealthStatus(job.job_name);
				monitor.logDatabaseOperation(tracker.id, 1);
				
				// Get latest health status for counting
				const { CronHealthCheck } = require('@root/dbObject.js');
				const latestHealth = await CronHealthCheck.findOne({
					where: { job_name: job.job_name },
					order: [['check_time', 'DESC']],
				});

				if (latestHealth) {
					switch (latestHealth.health_status) {
					case 'healthy':
						healthyCount++;
						break;
					case 'warning':
						warningCount++;
						break;
					case 'critical':
						criticalCount++;
						break;
					}
				}
			}
			catch (error) {
				monitor.logWarning(tracker.id, `Failed to update health for ${job.job_name}: ${error.message}`);
			}
		}

		console.log(`[HealthMonitor] Health check completed: ${healthyCount} healthy, ${warningCount} warnings, ${criticalCount} critical`);

		// Log warnings for any critical jobs
		if (criticalCount > 0) {
			monitor.logWarning(tracker.id, `Found ${criticalCount} jobs in critical status requiring attention`);
		}

		// Complete monitoring
		await monitor.completeExecution(tracker.id, {
			jobs_checked: allJobs.length - 1, // Exclude self
			healthy_count: healthyCount,
			warning_count: warningCount,
			critical_count: criticalCount,
		});

	}
	catch (error) {
		console.error(`Error in ${jobName}:`, error);
		
		if (tracker) {
			await monitor.failExecution(tracker.id, error);
		}
	}
}

async function startCronJob(client) {
	_discordClient = client || null;
	// Helper for catch-up: replay missed character regen ticks
	async function performCharacterRegenForTime(runTime) {
		const jobName = 'character_regen';
		try {
			await CronLog.upsert({
				job_name: jobName,
				last_run: runTime,
			});

			await CharacterBase.sequelize.query(`
			UPDATE character_bases
			SET currentStamina = MIN(maxStamina, currentStamina + CAST((maxStamina * 0.10 + 0.999) AS INTEGER))
			WHERE maxStamina IS NOT NULL 
				AND currentStamina IS NOT NULL
				AND location_id IN (SELECT id FROM location_bases WHERE LOWER(type) = 'town');
		`);
			// TODO: KO mechanic temporarily disabled — wake-up and regen-block logic skipped
			const catchUpNow = Math.floor(runTime instanceof Date ? runTime.getTime() / 1000 : Date.now() / 1000);
			// await CharacterBase.sequelize.query(`
			// 	UPDATE character_bases SET currentHp = 1
			// 	WHERE id IN (SELECT character_id FROM character_statuses
			// 		WHERE status_id = 'knocked_out' AND expires_at <= datetime(${catchUpNow}, 'unixepoch')) AND currentHp <= 0;
			// `);
			// await CharacterBase.sequelize.query(`
			// 	DELETE FROM character_statuses WHERE status_id = 'knocked_out'
			// 		AND expires_at <= datetime(${catchUpNow}, 'unixepoch');
			// `);

			// Increase every character's currentHp by 20% of maxHp, up to maxHp (only in town locations)
			await CharacterBase.sequelize.query(`
			UPDATE character_bases
			SET currentHp = MIN(maxHp, currentHp + CAST((maxHp * 0.20 + 0.999) AS INTEGER))
			WHERE maxHp IS NOT NULL 
				AND currentHp IS NOT NULL
				AND location_id IN (SELECT id FROM location_bases WHERE LOWER(type) = 'town');
		`);

			// Increment execution count for catch-up runs
			const job = await CronLog.findOne({ where: { job_name: jobName } });
			if (job) {
				await job.update({
					execution_count: (job.execution_count || 0) + 1,
					success_count: (job.success_count || 0) + 1,
				});
			}
		}
		catch (error) {
			console.error(`Error in ${jobName} catch-up for ${runTime}:`, error);
			// Log error but don't throw - continue with other catch-up runs
			const job = await CronLog.findOne({ where: { job_name: jobName } });
			if (job) {
				await job.update({
					execution_count: (job.execution_count || 0) + 1,
					error_count: (job.error_count || 0) + 1,
					last_error: error.message,
					last_error_at: new Date(),
				});
			}
		}
	}

	if (!job.running) {
		// Initialize midnight job in database
		await CronLog.upsert({
			job_name: 'midnight_job',
			status: 'stopped',
			schedule: '0 0 * * *',
			description: 'Daily midnight maintenance job',
			is_enabled: true,
		});

		// Midnight job catch-up
		const last = await CronLog.findOne({ where: { job_name: 'midnight_job' } });
		let needsCatchUp = false;
		if (!last || !last.last_run) {
			needsCatchUp = true;
		}
		else {
			const lastRun = new Date(last.last_run);
			const now = new Date();
			const diff = now - lastRun;
			if (diff > 24 * 60 * 60 * 1000) {
				needsCatchUp = true;
			}
		}
		if (needsCatchUp) {
			await performCronJob();
		}

		job.start();
		console.log('Midnight cron job started.');
	}

	if (!hourlyJob.running) {
		// Register all hourly sub-jobs independently
		await CronLog.upsert({ job_name: 'character_regen', status: 'stopped', schedule: '0 * * * *', description: 'Hourly HP/Stamina regeneration for characters in town', is_enabled: true });
		await CronLog.upsert({ job_name: 'galeby_cycle', status: 'stopped', schedule: '0 * * * *', description: 'Hourly Galeby presence roll', is_enabled: true });
		await CronLog.upsert({ job_name: 'pending_delete_cleanup', status: 'stopped', schedule: '0 * * * *', description: 'Hourly cleanup of stale deferred message deletions', is_enabled: true });
		await CronLog.upsert({ job_name: 'hourly_tasks', status: 'stopped', schedule: '0 * * * *', description: 'Hourly YAML task processor', is_enabled: true });

		// Catch-up: only character_regen needs replay (stat accumulation is cumulative)
		const lastRegen = await CronLog.findOne({ where: { job_name: 'character_regen' } });
		let lastRun = lastRegen && lastRegen.last_run ? new Date(lastRegen.last_run) : null;
		const now = new Date();
		if (!lastRun) {
			lastRun = new Date(now.getTime() - 25 * 60 * 60 * 1000);
		}
		lastRun.setMinutes(0, 0, 0);
		lastRun.setHours(lastRun.getHours() + 1);
		while (lastRun <= now) {
			await performCharacterRegenForTime(lastRun);
			lastRun.setHours(lastRun.getHours() + 1);
		}

		hourlyJob.start();
		console.log('Hourly cron jobs started (character_regen, galeby_cycle, pending_delete_cleanup, hourly_tasks).');
	}

	if (!weeklyStockResetJob.running) {
		// Initialize weekly stock reset job in database
		await CronLog.upsert({
			job_name: 'weekly_stock_reset',
			status: 'stopped',
			schedule: '0 0 * * 0',
			description: 'Weekly NPC shop stock reset (every Sunday at 00:00)',
			is_enabled: true,
		});

		// Catch-up: if last run was more than 7 days ago, run now
		const lastWeekly = await CronLog.findOne({ where: { job_name: 'weekly_stock_reset' } });
		if (!lastWeekly || !lastWeekly.last_run || (Date.now() - new Date(lastWeekly.last_run).getTime()) > 7 * 24 * 60 * 60 * 1000) {
			await performWeeklyStockReset();
		}

		weeklyStockResetJob.start();
		console.log('Weekly stock reset cron job started.');
	}

	if (!dailyTaskJob.running) {
		// Initialize daily task job in database
		await CronLog.upsert({
			job_name: 'daily_task_processor',
			status: 'stopped',
			schedule: '0 1 * * *',
			description: 'Daily task processor for character progression (runs at 01:00)',
			is_enabled: true,
		});

		// Catch-up: if last run was more than 24 hours ago, run now
		const lastDaily = await CronLog.findOne({ where: { job_name: 'daily_task_processor' } });
		if (!lastDaily || !lastDaily.last_run || (Date.now() - new Date(lastDaily.last_run).getTime()) > 24 * 60 * 60 * 1000) {
			console.log('[DailyTaskProcessor] Running catch-up for missed daily tasks...');
			await performDailyTasks();
		}

		dailyTaskJob.start();
		console.log('Daily task processor cron job started.');
	}

	// Start health monitoring job
	healthMonitorJob.start();
	console.log('Health monitor cron job started (runs every 30 minutes).');

	// Run pending deletion cleanup immediately on startup to catch any stragglers from previous session
	performPendingDeleteCleanup().catch(e => console.error('[PendingDeleteCleanup] Startup run failed:', e));

	// Restore location activity message IDs so the bot can delete them even after a restart
	const { loadLocationActivityMessages } = require('@utility/locationUtility.js');
	loadLocationActivityMessages().catch(e => console.error('[LocationActivity] Startup restore failed:', e));

}

module.exports = {
	job,
	hourlyJob,
	weeklyStockResetJob,
	dailyTaskJob,
	healthMonitorJob,
	startCronJob,
	performHealthCheck,
};
