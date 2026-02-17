const { CronJob } = require('cron');

// This job runs every day at 00:00 (midnight)
const { CronLog } = require('@root/dbObject.js');

const job = new CronJob('0 0 * * *', async () => {
	await performCronJob();
});

const hourlyJob = new CronJob('0 * * * *', async () => {
	await performHourlyJob();
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

const { CharacterBase } = require('@root/dbObject.js');

async function performHourlyJob() {
	const jobName = 'hourly_job';
	try {
		// Mark job as running
		await CronLog.upsert({
			job_name: jobName,
			status: 'running',
			last_run: new Date(),
		});

		// Increase every character's currentStamina by 5% of maxStamina, up to maxStamina (only in town locations)
		await CharacterBase.sequelize.query(`
			UPDATE character_bases
			SET currentStamina = MIN(maxStamina, currentStamina + CAST((maxStamina * 0.05 + 0.999) AS INTEGER))
			WHERE maxStamina IS NOT NULL 
				AND currentStamina IS NOT NULL
				AND location_id IN (SELECT id FROM location_bases WHERE type = 'town');
		`);
		// Increase every character's currentHp by 5% of maxHp, up to maxHp (only in town locations)
		await CharacterBase.sequelize.query(`
			UPDATE character_bases
			SET currentHp = MIN(maxHp, currentHp + CAST((maxHp * 0.05 + 0.999) AS INTEGER))
			WHERE maxHp IS NOT NULL 
				AND currentHp IS NOT NULL
				AND location_id IN (SELECT id FROM location_bases WHERE type = 'town');
		`);

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

async function startCronJob() {
	// Helper for catch-up: run hourly job for a specific time
	async function performHourlyJobForTime(runTime) {
		const jobName = 'hourly_job';
		try {
			// Update last_run without changing status (catch-up doesn't need full status tracking)
			await CronLog.upsert({
				job_name: jobName,
				last_run: runTime,
			});

			// Increase every character's currentStamina by 5% of maxStamina, up to maxStamina (only in town locations)
			await CharacterBase.sequelize.query(`
			UPDATE character_bases
			SET currentStamina = MIN(maxStamina, currentStamina + CAST((maxStamina * 0.05 + 0.999) AS INTEGER))
			WHERE maxStamina IS NOT NULL 
				AND currentStamina IS NOT NULL
				AND location_id IN (SELECT id FROM location_bases WHERE type = 'town');
		`);
			// Increase every character's currentHp by 5% of maxHp, up to maxHp (only in town locations)
			await CharacterBase.sequelize.query(`
			UPDATE character_bases
			SET currentHp = MIN(maxHp, currentHp + CAST((maxHp * 0.05 + 0.999) AS INTEGER))
			WHERE maxHp IS NOT NULL 
				AND currentHp IS NOT NULL
				AND location_id IN (SELECT id FROM location_bases WHERE type = 'town');
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
		// Initialize hourly job in database
		await CronLog.upsert({
			job_name: 'hourly_job',
			status: 'stopped',
			schedule: '0 * * * *',
			description: 'Hourly HP/Stamina regeneration for characters in town',
			is_enabled: true,
		});

		// Hourly job catch-up
		const lastHourly = await CronLog.findOne({ where: { job_name: 'hourly_job' } });
		let lastRun = lastHourly && lastHourly.last_run ? new Date(lastHourly.last_run) : null;
		const now = new Date();
		if (!lastRun) {
			// If never run, pick a reasonable start time (e.g., 25 hours ago)
			lastRun = new Date(now.getTime() - 25 * 60 * 60 * 1000);
		}
		// Align to the next hour after lastRun
		lastRun.setMinutes(0, 0, 0);
		lastRun.setHours(lastRun.getHours() + 1);
		while (lastRun <= now) {
			await performHourlyJobForTime(lastRun);
			lastRun.setHours(lastRun.getHours() + 1);
		}

		hourlyJob.start();
		console.log('Hourly cron job started.');
	}

}

module.exports = {
	job,
	hourlyJob,
	startCronJob,
};
