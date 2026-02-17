const { Events } = require('discord.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		// client.developerMode = (await client.util.config()).developerMode;

		// Restart spawn timers for any active raids
		await restartActiveRaidTimers(client);
	},
};

/**
 * Restart spawn timers for all active raids on bot startup
 * Uses CronLog to find raid_spawn jobs that should be running
 */
async function restartActiveRaidTimers(client) {
	try {
		const { Raid, CronLog } = require('../dbObject');
		const RaidManager = require('../utility/raidManager');

		// Find all raid spawn cron jobs that were running
		const runningCronJobs = await CronLog.findAll({
			where: {
				job_name: { [require('sequelize').Op.like]: 'raid_spawn_%' },
				status: 'running',
			},
		});

		if (runningCronJobs.length > 0) {
			console.log(`[Ready] Found ${runningCronJobs.length} raid spawn job(s) in CronLog to restart...`);

			for (const cronJob of runningCronJobs) {
				// Extract raid ID from job name (raid_spawn_123 -> 123)
				const raidId = parseInt(cronJob.job_name.replace('raid_spawn_', ''));

				// Verify raid is still active
				const raid = await Raid.findByPk(raidId);
				if (raid && raid.status === 'active') {
					await RaidManager.startSpawnTimer(raidId, client);
					console.log(`[Ready] Restarted timer for raid ${raidId}: ${raid.name}`);
				}
				else {
					// Raid no longer active, mark job as stopped
					await cronJob.update({ status: 'stopped', stopped_at: new Date() });
					console.log(`[Ready] Raid ${raidId} no longer active, marked job as stopped`);
				}
			}
		}
		else {
			// Fallback: check for active raids without cron entries
			const activeRaids = await Raid.findAll({
				where: { status: 'active' },
			});

			if (activeRaids.length === 0) {
				console.log('[Ready] No active raids to restart timers for.');
				return;
			}

			console.log(`[Ready] Found ${activeRaids.length} active raid(s), restarting spawn timers...`);

			for (const raid of activeRaids) {
				await RaidManager.startSpawnTimer(raid.id, client);
				console.log(`[Ready] Restarted timer for raid ${raid.id}: ${raid.name}`);
			}
		}
	}
	catch (error) {
		console.error('[Ready] Error restarting raid timers:', error);
	}
}
