const { CronJob } = require('cron');

// This job runs every day at 00:00 (midnight)
const { CronLog, NpcPurchase, GlobalFlag } = require('@root/dbObject.js');
const battleUtil = require('@utility/battleUtility.js');
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
	await performBattleHourlyTasks();
});

// This job runs every Sunday at 00:00 — resets NPC shop purchase counts
const weeklyStockResetJob = makeCronJob('0 0 * * 0', async () => {
	await performWeeklyStockReset();
});

// This job runs every day at 01:00 — processes daily tasks (offset from midnight job)
const dailyTaskJob = makeCronJob('0 1 * * *', async () => {
	await performDailyTasks();
});

// Battle cycle is now driven by a 12-hour countdown in performBattleHourlyTasks().
// This stub keeps the export contract intact but the job is never started.
const battleCycleJob = makeCronJob('0 0 31 2 *', async () => { /* disabled — countdown-driven */ });

// This job runs every 30 minutes — health monitoring, encounter spawn, and related half-hourly tasks
// Consolidated to avoid concurrent DB writes from multiple same-schedule jobs
const healthMonitorJob = makeCronJob('*/30 * * * *', async () => {
	await performHealthCheck();
	if (_discordClient) await performEncounterSpawn();
	else console.warn('[EncounterSpawn] Skipped — Discord client not ready.');
});

// Do NOT start the job automatically

async function performEncounterSpawn() {
	const jobName = 'encounter_spawn';
	const monitor = getCronMonitor();
	let tracker = null;
	try {
		console.log('[EncounterSpawn] Cycle starting...');
		tracker = await monitor.startExecution(jobName, {
			description: 'Spawn random encounters and resolve expired ones',
			expected_duration_ms: 10000,
		});
		await CronLog.upsert({ job_name: jobName, status: 'running', last_run: new Date() });

		const guild = _discordClient.guilds.cache.first() || null;
		if (!guild) {
			console.warn('[EncounterSpawn] No guild found — skipping.');
			return;
		}

		await battleUtil.resolveExpiredEncounters(guild);
		await battleUtil.spawnEncounters(guild);
		console.log('[EncounterSpawn] Cycle complete.');

		const logRow = await CronLog.findOne({ where: { job_name: jobName } });
		await logRow.update({
			status: 'stopped',
			execution_count: (logRow.execution_count || 0) + 1,
			success_count: (logRow.success_count || 0) + 1,
		});
		await monitor.completeExecution(tracker.id, {});
	}
	catch (error) {
		console.error('[EncounterSpawn] Error:', error);
		if (tracker) await monitor.failExecution(tracker.id, error);
		const logRow = await CronLog.findOne({ where: { job_name: jobName } });
		if (logRow) {
			await logRow.update({
				status: 'error',
				execution_count: (logRow.execution_count || 0) + 1,
				error_count: (logRow.error_count || 0) + 1,
				last_error: error.message,
				last_error_at: new Date(),
			});
		}
	}
}

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

		const battleActiveRecord = await GlobalFlag.findOne({ where: { flag: 'global.hms_divine_battle_active' } });
		const isBattle = battleActiveRecord && parseInt(battleActiveRecord.value) === 1;

		let staminaCount = 0;
		let hpCount = 0;

		if (isBattle) {
			// === Battle ruleset ===
			// Stamina +20% for ALL players (game-wide rule, not zone-specific)
			const s1 = await CharacterBase.sequelize.query(`
				UPDATE character_bases
				SET currentStamina = MIN(maxStamina, currentStamina + CAST((maxStamina * 0.20 + 0.999) AS INTEGER))
				WHERE maxStamina IS NOT NULL
					AND currentStamina IS NOT NULL;
			`);
			staminaCount += s1[1] || 0;

			// Stamina extra +20% for Boong Sinh Hoat (doubles rate to +40% total)
			const s2 = await CharacterBase.sequelize.query(`
				UPDATE character_bases
				SET currentStamina = MIN(maxStamina, currentStamina + CAST((maxStamina * 0.20 + 0.999) AS INTEGER))
				WHERE maxStamina IS NOT NULL
					AND currentStamina IS NOT NULL
					AND location_id = ${battleUtil.BOONG_SINH_HOAT_ID};
			`);
			staminaCount += s2[1] || 0;

			// HP +50% for Boong Sinh Hoat; 0-HP players recover only 1 HP (forced rest tick)
			const h1 = await CharacterBase.sequelize.query(`
				UPDATE character_bases
				SET currentHp = MIN(maxHp, CASE WHEN currentHp = 0 THEN 1 ELSE currentHp + CAST((maxHp * 0.50 + 0.999) AS INTEGER) END)
				WHERE maxHp IS NOT NULL
					AND currentHp IS NOT NULL
					AND location_id = ${battleUtil.BOONG_SINH_HOAT_ID};
			`);
			hpCount += h1[1] || 0;
		}

		monitor.logDatabaseOperation(tracker.id, staminaCount + hpCount);

		const job = await CronLog.findOne({ where: { job_name: jobName } });
		await job.update({
			status: 'stopped',
			execution_count: (job.execution_count || 0) + 1,
			success_count: (job.success_count || 0) + 1,
		});
		await monitor.completeExecution(tracker.id, {
			battle_mode: isBattle,
			stamina_updates: staminaCount,
			hp_updates: hpCount,
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

async function resetNpcStockPurchases(npcId = null) {
	const where = npcId ? { npc_id: String(npcId) } : {};
	return NpcPurchase.destroy({ where });
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
		const deleted = await resetNpcStockPurchases();
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
	const ratKingEnemy = contentStore.enemies.findByPk('rat_king_undead');
	const KING_MAX_HP = ratKingEnemy?.stat?.health ?? 1000;
	const KING_HP_REGEN = ratKingEnemy?.regen_per_day ?? 200;

	// Skip entirely if the undead event has already been cleared
	const clearedRecord = await GlobalFlag.findOne({ where: { flag: 'global.undead_bilge_cleared' } });
	const isCleared = clearedRecord ? parseInt(clearedRecord.value) || 0 : 0;
	if (isCleared) {
		console.log('[BilgeEcosystem] Undead event already cleared — skipping daily cycle.');
		return;
	}

	// The undead phase is active while the undead Rat King is still alive.
	const hpRecord = await GlobalFlag.findOne({ where: { flag: 'global.rat_king_undead_hp' } });
	if (!hpRecord) {
		console.log('[BilgeEcosystem] Undead event not yet active — skipping daily cycle.');
		return;
	}

	// Reset the undead rat pool every midnight
	await GlobalFlag.upsert({ flag: 'global.undead_rat_count', value: String(RAT_COUNT) });

	// Rat King does NOT respawn once slain — only regenerate HP if still alive
	const slainRecord = await GlobalFlag.findOne({ where: { flag: 'global.undead_rat_king_slain' } });
	const isSlain = slainRecord ? parseInt(slainRecord.value) || 0 : 0;
	if (!isSlain) {
		const currentHp = hpRecord ? parseInt(hpRecord.value) || KING_MAX_HP : KING_MAX_HP;
		const newHp = Math.min(KING_MAX_HP, currentHp + KING_HP_REGEN);
		await GlobalFlag.upsert({ flag: 'global.rat_king_undead_hp', value: String(newHp) });
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

			const battleActiveRecord = await GlobalFlag.findOne({ where: { flag: 'global.hms_divine_battle_active' } });
			const isBattle = battleActiveRecord && parseInt(battleActiveRecord.value) === 1;

			if (isBattle) {
				// Battle ruleset catch-up
				// Stamina +20% for ALL players (game-wide rule, not zone-specific)
				await CharacterBase.sequelize.query(`
					UPDATE character_bases
					SET currentStamina = MIN(maxStamina, currentStamina + CAST((maxStamina * 0.20 + 0.999) AS INTEGER))
					WHERE maxStamina IS NOT NULL AND currentStamina IS NOT NULL;
				`);
				// Stamina extra +20% for Boong Sinh Hoat (total +40%)
				await CharacterBase.sequelize.query(`
					UPDATE character_bases
					SET currentStamina = MIN(maxStamina, currentStamina + CAST((maxStamina * 0.20 + 0.999) AS INTEGER))
					WHERE maxStamina IS NOT NULL AND currentStamina IS NOT NULL
						AND location_id = ${battleUtil.BOONG_SINH_HOAT_ID};
				`);
				await CharacterBase.sequelize.query(`
					UPDATE character_bases
					SET currentHp = MIN(maxHp, CASE WHEN currentHp = 0 THEN 1 ELSE currentHp + CAST((maxHp * 0.50 + 0.999) AS INTEGER) END)
					WHERE maxHp IS NOT NULL AND currentHp IS NOT NULL
						AND location_id = ${battleUtil.BOONG_SINH_HOAT_ID};
				`);
			}
			else {
				// Normal ruleset catch-up
				// TODO: KO mechanic temporarily disabled
				await CharacterBase.sequelize.query(`
					UPDATE character_bases
					SET currentStamina = MIN(maxStamina, currentStamina + CAST((maxStamina * 0.10 + 0.999) AS INTEGER))
					WHERE maxStamina IS NOT NULL AND currentStamina IS NOT NULL
						AND location_id IN (SELECT id FROM location_bases WHERE LOWER(type) = 'town');
				`);
				await CharacterBase.sequelize.query(`
					UPDATE character_bases
					SET currentHp = MIN(maxHp, currentHp + CAST((maxHp * 0.20 + 0.999) AS INTEGER))
					WHERE maxHp IS NOT NULL AND currentHp IS NOT NULL
						AND location_id IN (SELECT id FROM location_bases WHERE LOWER(type) = 'town');
				`);
			}

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

	// Start health monitoring + encounter spawn job (consolidated half-hourly job)
	healthMonitorJob.start();
	console.log('Half-hourly cron job started (health monitor + encounter spawn, runs every 30 minutes).');

	// Battle cycle is countdown-driven (12 hours) — battleCycleJob cron is disabled.

	// Run pending deletion cleanup immediately on startup to catch any stragglers from previous session
	performPendingDeleteCleanup().catch(e => console.error('[PendingDeleteCleanup] Startup run failed:', e));

	// Restore location activity message IDs so the bot can delete them even after a restart
	const { loadLocationActivityMessages } = require('@utility/locationUtility.js');
	loadLocationActivityMessages().catch(e => console.error('[LocationActivity] Startup restore failed:', e));

	// Armory wave restart recovery: if next_run is past, fire immediately; otherwise restore setTimeout
	(async () => {
		try {
			const waveLog = await CronLog.findOne({ where: { job_name: 'armory_wave_spawn' } });
			if (waveLog && waveLog.status === 'running' && waveLog.next_run) {
				const guild = _discordClient && _discordClient.guilds.cache.first();
				if (guild) {
					const remaining = new Date(waveLog.next_run).getTime() - Date.now();
					if (remaining <= 0) {
						console.log('[Armory] Restart catch-up: wave overdue, firing spawnArmoryWave now.');
						await battleUtil.spawnArmoryWave(guild);
					}
					else {
						battleUtil.scheduleArmoryWave(guild, remaining);
						console.log(`[Armory] Restart recovery: next wave in ${Math.round(remaining / 60000)}m, setTimeout restored.`);
					}
				}
			}
		}
		catch (e) {
			console.error('[Armory] Restart recovery failed:', e);
		}
	})();

}

async function performHMSDivineBattleCycle() {
	if (!_discordClient) return;
	await battleUtil.performHMSDivineBattleCycle(_discordClient);
}

async function performBattleHourlyTasks() {
	const battleActive = await GlobalFlag.findOne({ where: { flag: 'global.hms_divine_battle_active' } });
	if (!battleActive || parseInt(battleActive.value) !== 1) return;

	// Regen is handled by performCharacterRegen (sole authority)
	// This function only handles battle-specific morale drain
	const currentMorale = await battleUtil.getFlag('global.hms_divine_morale');
	const drainReduction = await battleUtil.getFlag('hms_divine_drain_reduction');
	const moraleDrain = battleUtil.calcMoraleDrain(currentMorale, drainReduction);
	await battleUtil.updateMorale(moraleDrain);
	console.log(`[Battle] Hourly morale drain: ${moraleDrain.toFixed(1)}`);

	// Cannon countdown: decrements each hour; fires battle cycle at 0 then resets to 12
	let countdown = await battleUtil.getFlag('global.hms_divine_cannon_countdown');
	if (countdown === null || countdown === undefined || countdown <= 0) {
		// First hour or countdown expired — fire cycle and reset
		if (countdown !== null && countdown !== undefined && countdown <= 0) {
			console.log('[Battle] Cannon countdown reached 0 — firing battle cycle.');
			if (_discordClient) await performHMSDivineBattleCycle();
		}
		await battleUtil.setFlag('global.hms_divine_cannon_countdown', 12);
		console.log('[Battle] Cannon countdown initialised/reset to 12.');
	}
	else {
		const newCountdown = countdown - 1;
		await battleUtil.setFlag('global.hms_divine_cannon_countdown', newCountdown);
		console.log(`[Battle] Cannon countdown: ${newCountdown} hour(s) remaining.`);
		if (newCountdown <= 0) {
			console.log('[Battle] Cannon countdown reached 0 — firing battle cycle.');
			if (_discordClient) await performHMSDivineBattleCycle();
			await battleUtil.setFlag('global.hms_divine_cannon_countdown', 12);
			console.log('[Battle] Cannon countdown reset to 12.');
		}
	}
}

module.exports = {
	job,
	hourlyJob,
	weeklyStockResetJob,
	dailyTaskJob,
	healthMonitorJob,
	battleCycleJob,
	startCronJob,
	resetNpcStockPurchases,
	performHealthCheck,
	performHMSDivineBattleCycle,
	performBattleHourlyTasks,
};
