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
	await CronLog.upsert({
		job_name: 'midnight_job',
		last_run: new Date(),
	});
	// Place your scheduled code here
}

const { CharacterBase } = require('@root/dbObject.js');

async function performHourlyJob() {
	await CronLog.upsert({
		job_name: 'hourly_job',
		last_run: new Date(),
	});
	// Increase every character's currentStamina by 5% of maxStamina, up to maxStamina
	await CharacterBase.sequelize.query(`
		UPDATE character_bases
		SET currentStamina = LEAST(maxStamina, currentStamina + CEIL(maxStamina * 0.05))
		WHERE maxStamina IS NOT NULL AND currentStamina IS NOT NULL;
	`);
	// Increase every character's currentHp by 10% of maxHp, up to maxHp
	await CharacterBase.sequelize.query(`
		UPDATE character_bases
		SET currentHp = LEAST(maxHp, currentHp + CEIL(maxHp * 0.1))
		WHERE maxHp IS NOT NULL AND currentHp IS NOT NULL;
	`);
}

async function startCronJob() {
	if (!job.running) {
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

	// Helper for catch-up: run hourly job for a specific time
	async function performHourlyJobForTime(runTime) {
		await CronLog.upsert({
			job_name: 'hourly_job',
			last_run: runTime,
		});
		// Increase every character's currentStamina by 5% of maxStamina, up to maxStamina
		await CharacterBase.sequelize.query(`
		UPDATE character_bases
		SET currentStamina = LEAST(maxStamina, currentStamina + CEIL(maxStamina * 0.05))
		WHERE maxStamina IS NOT NULL AND currentStamina IS NOT NULL;
	`);
		// Increase every character's currentHp by 10% of maxHp, up to maxHp
		await CharacterBase.sequelize.query(`
		UPDATE character_bases
		SET currentHp = LEAST(maxHp, currentHp + CEIL(maxHp * 0.1))
		WHERE maxHp IS NOT NULL AND currentHp IS NOT NULL;
	`);
	}

}

module.exports = {
	job,
	hourlyJob,
	startCronJob,
};
