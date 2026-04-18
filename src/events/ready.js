const { Events } = require('discord.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);
		// client.developerMode = (await client.util.config()).developerMode;

		// Migrate character_skills.skill_id from legacy numeric IDs to subtype strings
		await migrateSkillIds();

		// Clean up orphan TradeItem rows left behind by previously failed trade executions
		await cleanupOrphanTradeItems();

		// Restart spawn timers for any active raids
		await restartActiveRaidTimers(client);
	},
};

/**
 * One-time migration: convert character_skills.skill_id from legacy numeric IDs
 * (e.g. "5") to subtype-based string IDs (e.g. "rapier").
 * Idempotent — rows that already use subtype IDs are unaffected.
 */
async function migrateSkillIds() {
	try {
		const { sequelize } = require('../dbObject');
		const idMap = {
			'1': 'axe',
			'2': 'dagger',
			'3': 'longbow',
			'4': 'mace',
			'5': 'rapier',
			'6': 'shield',
			'7': 'shortbow',
			'8': 'spear',
			'9': 'sword',
			'10': 'heavy',
			'11': 'light',
			'12': 'medium',
		};
		let migrated = 0;
		for (const [oldId, newId] of Object.entries(idMap)) {
			const [, meta] = await sequelize.query(
				'UPDATE character_skills SET skill_id = ? WHERE skill_id = ?',
				{ replacements: [newId, oldId] },
			);
			migrated += meta?.changes ?? 0;
		}
		if (migrated > 0) console.log(`[Ready] Migrated ${migrated} character_skill row(s) to subtype-based skill IDs.`);
	}
	catch (error) {
		console.error('[Ready] Error migrating skill IDs:', error);
	}
}

/**
 * Remove TradeItem rows for cancelled/completed trades.
 * These are left behind when executeTrade fails mid-transaction — the rollback
 * restores the rows but the old catch block only cancelled the trade without
 * deleting the items, leaving them as orphans that cause FK violations on future trades.
 */
async function cleanupOrphanTradeItems() {
	try {
		const { Trade, TradeItem } = require('../dbObject');
		const allItems = await TradeItem.findAll();
		if (allItems.length === 0) return;

		const tradeIds = [...new Set(allItems.map(ti => ti.trade_id))];
		let cleaned = 0;
		for (const tradeId of tradeIds) {
			const trade = await Trade.findByPk(tradeId);
			if (!trade || trade.status === 'cancelled' || trade.status === 'completed') {
				await TradeItem.destroy({ where: { trade_id: tradeId } });
				cleaned++;
			}
		}
		if (cleaned > 0) console.log(`[Ready] Cleaned up orphan TradeItems for ${cleaned} finished trade(s).`);
	}
	catch (error) {
		console.error('[Ready] Error cleaning up orphan trade items:', error);
	}
}

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
