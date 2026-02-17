const { Raid, RaidBoss, RaidMonster, RaidMonsterLib, RaidStage, EnemyBase, EnemyBaseStat, EventBase, CronLog } = require('@root/dbObject');
const { EmbedBuilder } = require('discord.js');
const CronJobManager = require('./cronJobManager');

/**
 * RaidManager - Utility class for managing raid operations
 * Handles raid creation, boss spawning, participant management, and progression
 */
class RaidManager {
	// Track active spawn intervals by raid ID
	static spawnIntervals = new Map();

	/**
	 * Create a new raid
	 * @param {Object} raidData - Raid configuration
	 * @param {Array} raidData.eventPool - Array of event IDs for random events
	 * @returns {Object} Created raid
	 */
	static async createRaid(raidData) {
		const raid = await Raid.create({
			name: raidData.name,
			description: raidData.description || '',
			channel_id: raidData.channelId,
			thread_id: raidData.threadId || null,
			spawn_interval_minutes: raidData.spawnIntervalMinutes || 5,
			config: raidData.config || {},
			event_pool: raidData.eventPool || [],
			scheduled_start_at: raidData.scheduledStartAt || null,
			updated_at: new Date(),
		});

		return raid;
	}

	/**
	 * Add a boss to a raid
	 * @param {number} raidId - Raid ID
	 * @param {Object} bossData - Boss configuration
	 * @returns {Object} Created raid boss
	 */
	static async addRaidBoss(raidId, bossData) {
		const boss = await RaidBoss.create({
			raid_id: raidId,
			name: bossData.name,
			description: bossData.description || '',
			boss_type: bossData.bossType || 'normal',
			level: bossData.level || 1,
			max_health: bossData.maxHealth,
			current_health: bossData.maxHealth,
			attack: bossData.attack || 0,
			defense: bossData.defense || 0,
			speed: bossData.speed || 0,
			abilities: bossData.abilities || {},
			resistances: bossData.resistances || {},
			weaknesses: bossData.weaknesses || {},
			loot_table: bossData.lootTable || {},
			exp_reward: bossData.expReward || 0,
			spawn_conditions: bossData.spawnConditions || {},
			max_phases: bossData.maxPhases || 1,
			avatar: bossData.avatar || null,
			created_at: new Date(),
			updated_at: new Date(),
		});

		return boss;
	}

	/**
	 * Start a raid
	 * @param {number} raidId - Raid ID
	 * @returns {Object} Updated raid
	 */
	static async startRaid(raidId) {
		const raid = await Raid.findByPk(raidId);
		if (!raid) {
			throw new Error('Raid not found');
		}

		if (raid.status !== 'inactive' && raid.status !== 'preparing') {
			throw new Error(`Cannot start raid with status: ${raid.status}`);
		}

		const now = new Date();

		await raid.update({
			status: 'active',
			started_at: now,
			updated_at: now,
		});

		return raid.reload();
	}

	/**
	 * Start the spawn timer for a raid
	 * @param {number} raidId - Raid ID
	 * @param {Object} client - Discord client
	 */
	static async startSpawnTimer(raidId, client) {
		// Clear any existing timer
		await this.stopSpawnTimer(raidId);

		// Get raid to check interval
		const raid = await Raid.findByPk(raidId);
		if (!raid || raid.status !== 'active') return;

		const intervalMinutes = raid.spawn_interval_minutes || 5;
		const intervalMs = intervalMinutes * 60 * 1000;
		const jobName = `raid_spawn_${raidId}`;

		console.log(`[RaidManager] Starting spawn timer for raid ${raidId}: every ${intervalMinutes} minutes`);

		// Register with CronJobManager
		try {
			await CronJobManager.startJob(jobName, {
				raidId: raidId,
				intervalMinutes: intervalMinutes,
			}, {
				frequency: 'minutely',
				intervalValue: intervalMinutes,
				autoStartOnBoot: true,
			});
		}
		catch (error) {
			console.error(`[RaidManager] Failed to register cron job for raid ${raidId}:`, error);
		}

		const timer = setInterval(async () => {
			try {
				// Check if raid is still active
				const currentRaid = await Raid.findByPk(raidId);
				if (!currentRaid || currentRaid.status !== 'active') {
					console.log(`[RaidManager] Raid ${raidId} no longer active, stopping spawn timer`);
					await this.stopSpawnTimer(raidId);
					return;
				}

				// Record execution in cron log
				try {
					await CronJobManager.recordExecution(jobName);
				}
				catch (e) {
					// Ignore cron log errors
				}

				// Spawn a monster
				console.log(`[RaidManager] Auto-spawning monster for raid ${raidId}`);
				await this.spawnMonster(raidId, client);
			}
			catch (error) {
				console.error(`[RaidManager] Error in spawn timer for raid ${raidId}:`, error);
				try {
					await CronJobManager.recordError(jobName, error.message);
				}
				catch (e) {
					// Ignore cron log errors
				}
			}
		}, intervalMs);

		this.spawnIntervals.set(raidId, timer);
	}

	/**
	 * Stop the spawn timer for a raid
	 * @param {number} raidId - Raid ID
	 */
	static async stopSpawnTimer(raidId) {
		const timer = this.spawnIntervals.get(raidId);
		if (timer) {
			clearInterval(timer);
			this.spawnIntervals.delete(raidId);
			console.log(`[RaidManager] Stopped spawn timer for raid ${raidId}`);
		}

		// Stop in CronJobManager
		const jobName = `raid_spawn_${raidId}`;
		try {
			await CronJobManager.stopJob(jobName);
		}
		catch (error) {
			// Job might not exist, ignore
		}
	}

	/**
	 * End a raid
	 * @param {number} raidId - Raid ID
	 * @param {string} endStatus - End status ('completed' or 'failed')
	 * @returns {Object} Updated raid
	 */
	static async endRaid(raidId, endStatus = 'completed') {
		// Stop the spawn timer first
		this.stopSpawnTimer(raidId);

		const raid = await Raid.findByPk(raidId, {
			include: [
				{ model: RaidBoss, as: 'bosses' },
				{ model: RaidMonster, as: 'monsters' },
			],
		});
		
		if (!raid) {
			throw new Error('Raid not found');
		}

		const now = new Date();

		// Set all active monsters to despawned
		for (const monster of raid.monsters) {
			if (monster.status === 'active') {
				await monster.update({
					status: 'despawned',
					updated_at: now,
				});
			}
		}

		// Set all active bosses to inactive
		for (const boss of raid.bosses) {
			if (boss.status === 'active') {
				await boss.update({
					status: 'inactive',
					updated_at: now,
				});
			}
		}

		await raid.update({
			status: endStatus,
			ended_at: now,
			updated_at: now,
		});

		return raid.reload({ 
			include: [
				{ model: RaidBoss, as: 'bosses' },
				{ model: RaidMonster, as: 'monsters' },
			],
		});
	}

	/**
	 * Spawn a specific boss in the raid (triggered by act/agenda system)
	 * @param {number} raidId - Raid ID
	 * @param {number} bossId - Boss ID to spawn (required)
	 * @returns {Object} Spawned boss
	 */
	static async spawnBoss(raidId, bossId) {
		if (!bossId) {
			throw new Error('Boss ID is required - bosses are spawned via act/agenda system');
		}

		const raid = await Raid.findByPk(raidId, {
			include: [{ model: RaidBoss, as: 'bosses' }],
		});

		if (!raid) {
			throw new Error('Raid not found');
		}

		if (raid.status !== 'active') {
			throw new Error('Cannot spawn boss in inactive raid');
		}

		const boss = raid.bosses.find(b => b.id === bossId);
		if (!boss) {
			throw new Error('Boss not found');
		}

		if (boss.status !== 'inactive') {
			throw new Error(`Boss is already ${boss.status}`);
		}

		const now = new Date();
		await boss.update({
			status: 'active',
			current_health: boss.max_health,
			current_phase: 1,
			spawned_at: now,
			updated_at: now,
		});

		// Update raid timestamp
		await raid.update({
			updated_at: now,
		});

		return boss.reload();
	}

	/**
	 * Defeat a boss
	 * @param {number} bossId - Boss ID
	 * @param {string} defeatedBy - Character ID who defeated the boss
	 * @returns {Object} Updated boss and loot
	 */
	static async defeatBoss(bossId, defeatedBy) {
		const boss = await RaidBoss.findByPk(bossId, {
			include: [{ model: Raid, as: 'raid' }],
		});

		if (!boss) {
			throw new Error('Boss not found');
		}

		if (boss.status !== 'active') {
			throw new Error('Boss is not active');
		}

		const now = new Date();
		await boss.update({
			status: 'defeated',
			current_health: 0,
			defeated_at: now,
			defeated_by: defeatedBy,
			updated_at: now,
		});

		// Update raid progress
		const raid = boss.raid;
		await raid.update({
			monsters_defeated: raid.monsters_defeated + 1,
			progress: Math.min(100, raid.progress + 10),
			updated_at: now,
		});

		// Generate loot (simplified)
		const loot = this.generateLoot(boss.loot_table);

		return {
			boss: boss.reload(),
			loot,
			expReward: boss.exp_reward,
		};
	}

	/**
	 * Get active raids
	 * @returns {Array} List of active raids
	 */
	static async getActiveRaids() {
		return await Raid.findAll({
			where: { status: 'active' },
			include: [{ model: RaidBoss, as: 'bosses' }],
			order: [['started_at', 'ASC']],
		});
	}

	/**
	 * Get raids by thread ID
	 * @param {string} threadId - Thread ID
	 * @returns {Array} List of raids in the thread
	 */
	static async getRaidsByThread(threadId) {
		return await Raid.findAll({
			where: { thread_id: threadId },
			include: [{ model: RaidBoss, as: 'bosses' }],
			order: [['created_at', 'DESC']],
		});
	}

	/**
	 * Get active raid in a specific thread
	 * @param {string} threadId - Thread ID
	 * @returns {Object|null} Active raid in the thread or null
	 */
	static async getActiveRaidInThread(threadId) {
		return await Raid.findOne({
			where: {
				thread_id: threadId,
				status: 'active',
			},
			include: [{ model: RaidBoss, as: 'bosses' }],
		});
	}

	/**
	 * Get all active raids (for processing spawns via cron job)
	 * @returns {Array} List of active raids
	 */
	static async getActiveRaidsForSpawn() {
		return await Raid.findAll({
			where: {
				status: 'active',
			},
			include: [
				{ model: RaidBoss, as: 'bosses' },
				{ model: RaidMonsterLib, as: 'monsterLib' },
			],
		});
	}

	/**
	 * Generate loot from loot table
	 * @param {Object} lootTable - Loot table configuration
	 * @returns {Array} Generated loot items
	 */
	static generateLoot(lootTable) {
		if (!lootTable || !lootTable.items) {
			return [];
		}

		const loot = [];
		for (const item of lootTable.items) {
			const chance = Math.random() * 100;
			if (chance <= (item.dropChance || 0)) {
				loot.push({
					itemId: item.itemId,
					quantity: item.quantity || 1,
					rarity: item.rarity || 'common',
				});
			}
		}

		return loot;
	}

	/**
	 * Check if raid should end (final act or agenda completed)
	 * @param {number} raidId - Raid ID
	 * @returns {Object} { shouldEnd: boolean, reason: 'victory'|'defeat'|null }
	 */
	static async shouldRaidEnd(raidId) {
		const raid = await Raid.findByPk(raidId);
		if (!raid || raid.status !== 'active') {
			return { shouldEnd: false, reason: null };
		}

		// Check if current act stage goal is met
		const currentActStage = await RaidStage.findOne({
			where: {
				raid_id: raidId,
				stage_type: 'act',
				stage_number: raid.current_act,
			},
		});

		if (currentActStage && raid.current_act_points >= currentActStage.goal_points) {
			// Act goal reached - check if it's the final act
			if (currentActStage.is_final) {
				return { shouldEnd: true, reason: 'victory' };
			}
		}

		// Check if current agenda stage goal is met
		const currentAgendaStage = await RaidStage.findOne({
			where: {
				raid_id: raidId,
				stage_type: 'agenda',
				stage_number: raid.current_agenda,
			},
		});

		if (currentAgendaStage && raid.current_agenda_points >= currentAgendaStage.goal_points) {
			// Agenda goal reached - check if it's the final agenda
			if (currentAgendaStage.is_final) {
				return { shouldEnd: true, reason: 'defeat' };
			}
		}

		return { shouldEnd: false, reason: null };
	}

	/**
	 * Attempt to advance act or agenda stage after points are added
	 * @param {number} raidId - Raid ID
	 * @param {string} stageType - 'act' or 'agenda'
	 * @returns {Object} { advanced: boolean, newStage: number|null, isComplete: boolean }
	 */
	static async tryAdvanceStage(raidId, stageType) {
		const raid = await Raid.findByPk(raidId);
		if (!raid || raid.status !== 'active') {
			return { advanced: false, newStage: null, isComplete: false };
		}

		const currentStageNum = stageType === 'act' ? raid.current_act : raid.current_agenda;
		const currentPoints = stageType === 'act' ? raid.current_act_points : raid.current_agenda_points;

		// Get current stage
		const currentStage = await RaidStage.findOne({
			where: {
				raid_id: raidId,
				stage_type: stageType,
				stage_number: currentStageNum,
			},
		});

		if (!currentStage) {
			return { advanced: false, newStage: null, isComplete: false };
		}

		// Check if we've reached the goal
		if (currentPoints < currentStage.goal_points) {
			return { advanced: false, newStage: null, isComplete: false };
		}

		// Goal reached - check if final
		if (currentStage.is_final) {
			return { advanced: false, newStage: currentStageNum, isComplete: true };
		}

		// Try to advance to next stage
		const nextStage = await RaidStage.findOne({
			where: {
				raid_id: raidId,
				stage_type: stageType,
				stage_number: currentStageNum + 1,
			},
		});

		if (!nextStage) {
			// No next stage defined - treat current as final
			return { advanced: false, newStage: currentStageNum, isComplete: true };
		}

		// Advance to next stage, carry over excess points
		const excessPoints = currentPoints - currentStage.goal_points;
		const updateData = {
			updated_at: new Date(),
		};

		if (stageType === 'act') {
			updateData.current_act = currentStageNum + 1;
			updateData.current_act_points = excessPoints;
		}
		else {
			updateData.current_agenda = currentStageNum + 1;
			updateData.current_agenda_points = excessPoints;
		}

		await raid.update(updateData);

		return { advanced: true, newStage: currentStageNum + 1, isComplete: false, effects: nextStage.effects };
	}

	/**
	 * Trigger a random event from the raid's event pool
	 * @param {number} raidId - Raid ID
	 * @returns {Object} Triggered event data
	 */
	static async triggerRandomEvent(raidId) {
		const raid = await Raid.findByPk(raidId);
		if (!raid) {
			throw new Error('Raid not found');
		}

		if (raid.status !== 'active') {
			throw new Error('Cannot trigger event in inactive raid');
		}

		if (!raid.event_pool || raid.event_pool.length === 0) {
			throw new Error('No events in event pool');
		}

		// Select random event ID from pool
		const eventId = raid.event_pool[Math.floor(Math.random() * raid.event_pool.length)];

		// Fetch event from EventBase model
		const event = await EventBase.findByPk(eventId);
		if (!event) {
			throw new Error(`Event with ID ${eventId} not found`);
		}

		const now = new Date();
		await raid.update({
			events_triggered: raid.events_triggered + 1,
			updated_at: now,
		});

		return {
			...event.toJSON(),
			triggeredAt: now,
			raidId: raid.id,
		};
	}

	/**
	 * Get all monsters in the raid's lib
	 * @param {number} raidId - Raid ID
	 * @returns {Array} Monster lib entries
	 */
	static async getMonsterLib(raidId) {
		return await RaidMonsterLib.findAll({
			where: { raid_id: raidId },
			include: [{ model: EnemyBase, as: 'enemy' }],
		});
	}

	/**
	 * Process raid events (check for end conditions)
	 * Called by cron job
	 * @returns {Array} List of processed events
	 */
	static async processRaidEvents() {
		const events = [];

		// Check for raids that should end
		const activeRaids = await this.getActiveRaids();
		for (const raid of activeRaids) {
			const endCheck = await this.shouldRaidEnd(raid.id);
			if (endCheck.shouldEnd) {
				const endStatus = endCheck.reason === 'victory' ? 'completed' : 'failed';
				await this.endRaid(raid.id, endStatus);
				events.push({ type: 'raid_ended', raidId: raid.id, reason: endCheck.reason });
			}
		}

		return events;
	}

	/**
	 * Determine what type of spawn should occur
	 * @param {Object} raid - Raid data
	 * @returns {string} Spawn type: 'monster' or 'event'
	 */
	static determineSpawnType(raid) {
		const config = raid.config || {};
		const monsterChance = config.monsterSpawnChance || 80;
		const eventChance = config.eventSpawnChance || 20;

		// Normalize chances to ensure they add up to 100%
		const total = monsterChance + eventChance;
		const normalizedMonster = (monsterChance / total) * 100;

		const roll = Math.random() * 100;

		if (roll < normalizedMonster) {
			return 'monster';
		}
		return 'event';
	}

	// ============================================================================
	// RAID MONSTER SPAWNING SYSTEM
	// ============================================================================

	/**
	 * Get the currently active monster in a raid (the one displayed with reactions)
	 * @param {number} raidId - Raid ID
	 * @returns {Object|null} Active monster or null
	 */
	static async getActiveMonster(raidId) {
		return await RaidMonster.findOne({
			where: {
				raid_id: raidId,
				status: 'active',
			},
			include: [{ model: EnemyBase, as: 'enemy' }],
		});
	}

	/**
	 * Get monsters in the queue for a raid
	 * @param {number} raidId - Raid ID
	 * @returns {Array} Queued monsters
	 */
	static async getQueuedMonsters(raidId) {
		return await RaidMonster.findAll({
			where: {
				raid_id: raidId,
				status: 'queued',
			},
			include: [{ model: EnemyBase, as: 'enemy' }],
			order: [['queue_position', 'ASC']],
		});
	}

	/**
	 * Spawn a monster into the raid channel using RaidMonsterLib
	 * If there's already an active monster, add to queue instead
	 * @param {number} raidId - Raid ID
	 * @param {Object} client - Discord client for sending messages
	 * @param {number} libId - (Optional) Specific lib ID to spawn, otherwise weighted random
	 * @returns {Object} Spawned or queued monster
	 */
	static async spawnMonster(raidId, client, libId = null) {
		const raid = await Raid.findByPk(raidId);
		if (!raid) {
			throw new Error('Raid not found');
		}

		if (raid.status !== 'active') {
			throw new Error('Cannot spawn monster in inactive raid');
		}

		// Get monster lib entries for this raid
		const monsterLibs = await RaidMonsterLib.findAll({
			where: { raid_id: raidId },
			include: [{ model: EnemyBase, as: 'enemy', include: [{ model: EnemyBaseStat, as: 'baseStat' }] }],
		});

		if (monsterLibs.length === 0) {
			throw new Error('No monsters configured in raid monster lib');
		}

		// Select lib entry (specific or weighted random)
		let selectedLib;
		if (libId) {
			selectedLib = monsterLibs.find(l => l.id === libId);
			if (!selectedLib) {
				throw new Error(`Monster lib with ID ${libId} not found`);
			}
		}
		else {
			// Weighted random selection
			const totalWeight = monsterLibs.reduce((sum, l) => sum + (l.spawn_weight || 1), 0);
			let roll = Math.random() * totalWeight;
			for (const lib of monsterLibs) {
				roll -= (lib.spawn_weight || 1);
				if (roll <= 0) {
					selectedLib = lib;
					break;
				}
			}
			selectedLib = selectedLib || monsterLibs[0];
		}

		const enemy = selectedLib.enemy;
		if (!enemy) {
			throw new Error(`Enemy with ID ${selectedLib.enemy_id} not found`);
		}

		// Check if there's already an active monster
		const activeMonster = await this.getActiveMonster(raidId);

		// Get next queue position
		const queuedMonsters = await this.getQueuedMonsters(raidId);
		const nextPosition = queuedMonsters.length > 0
			? Math.max(...queuedMonsters.map(m => m.queue_position)) + 1
			: 0;

		// Get HP from enemy stats
		const maxHp = enemy.baseStat?.health || 100;

		// Create the monster record
		const raidMonster = await RaidMonster.create({
			raid_id: raidId,
			lib_id: selectedLib.id,
			enemy_id: selectedLib.enemy_id,
			status: activeMonster ? 'queued' : 'active',
			current_hp: maxHp,
			max_hp: maxHp,
			queue_position: activeMonster ? nextPosition : 0,
			spawned_at: activeMonster ? null : new Date(),
			agenda_accumulated: 0,
		});

		// If no active monster, display it in the channel
		if (!activeMonster) {
			await this.displayMonster(raidMonster.id, raid, enemy, client);
		}

		// Update raid timestamp
		const now = new Date();
		await raid.update({
			updated_at: now,
		});

		return raidMonster.reload({
			include: [
				{ model: EnemyBase, as: 'enemy' },
				{ model: RaidMonsterLib, as: 'lib' },
			],
		});
	}

	/**
	 * Display a monster in the raid channel with buttons
	 * @param {number} raidMonsterId - Raid monster ID
	 * @param {Object} raid - Raid object
	 * @param {Object} enemy - Enemy object
	 * @param {Object} client - Discord client
	 */
	static async displayMonster(raidMonsterId, raid, enemy, client) {
		const channelId = raid.thread_id || raid.channel_id;
		const channel = await client.channels.fetch(channelId);
		if (!channel) {
			throw new Error(`Channel ${channelId} not found`);
		}

		const raidMonster = await RaidMonster.findByPk(raidMonsterId);

		// Build the monster embed
		const embed = new EmbedBuilder()
			.setTitle(`⚔️ ${enemy.fullname || enemy.name}`)
			.setDescription(enemy.description || 'A monster has appeared!')
			.setColor(0xFF4444)
			.addFields(
				{ name: 'Level', value: `${enemy.lv || 1}`, inline: true },
				{ name: 'HP', value: `${raidMonster.current_hp}/${raidMonster.max_hp}`, inline: true },
			);

		if (enemy.avatar) {
			embed.setThumbnail(enemy.avatar);
		}

		// Add queue info
		const queuedMonsters = await this.getQueuedMonsters(raid.id);
		if (queuedMonsters.length > 0) {
			embed.setFooter({ text: `${queuedMonsters.length} monster(s) in queue` });
		}

		const message = await channel.send({
			embeds: [embed],
		});

		// Add reaction buttons
		await message.react('⚔️');
		await message.react('🏃');

		// Update the monster with message ID
		await raidMonster.update({
			message_id: message.id,
			spawned_at: new Date(),
		});
	}

	/**
	 * Handle fight action - get monster info for combat
	 * @param {number} raidMonsterId - Raid monster ID
	 * @returns {Object} Result with monster data for combat
	 */
	static async handleFight(raidMonsterId) {
		const raidMonster = await RaidMonster.findByPk(raidMonsterId, {
			include: [
				{ model: EnemyBase, as: 'enemy' },
				{ model: Raid, as: 'raid' },
				{ model: RaidMonsterLib, as: 'lib' },
			],
		});

		if (!raidMonster) {
			return { success: false, error: 'Monster not found.' };
		}

		if (raidMonster.status !== 'active') {
			return { success: false, error: 'This monster is no longer available.' };
		}

		return {
			success: true,
			monster: raidMonster,
			enemy: raidMonster.enemy,
			raid: raidMonster.raid,
			lib: raidMonster.lib,
		};
	}

	/**
	 * Execute combat between a character and a raid monster
	 * @param {number} raidMonsterId - Raid monster ID
	 * @param {string} characterId - Character ID (Discord user ID)
	 * @param {Object} client - Discord client
	 * @returns {Object} Combat result with battle report
	 */
	static async executeRaidCombat(raidMonsterId, characterId, client) {
		const combatUtil = require('./combatUtility');

		// Get the raid monster with all needed data
		const raidMonster = await RaidMonster.findByPk(raidMonsterId, {
			include: [
				{ model: EnemyBase, as: 'enemy', include: [{ model: EnemyBaseStat, as: 'baseStat' }] },
				{ model: Raid, as: 'raid' },
				{ model: RaidMonsterLib, as: 'lib' },
			],
		});

		if (!raidMonster) {
			return { success: false, error: 'Monster not found.' };
		}

		if (raidMonster.status !== 'active') {
			return { success: false, error: 'This monster is no longer available.' };
		}

		// Mark monster as being fought
		await raidMonster.update({
			status: 'fighting',
			fighting_character_id: characterId,
		});

		try {
			// Run combat using the existing combat system
			const result = await combatUtil.mainCombat(characterId, raidMonster.enemy_id);

			// Calculate damage dealt to raid monster
			// Sum up all damage the player dealt to enemy
			const damageToMonster = result.combatLog
				.filter(log => log.attacker === 'Player' || log.attacker === result.finalState.player?.name)
				.filter(log => log.hit)
				.reduce((sum, log) => sum + (log.damage || 0), 0);

			// Apply damage to raid monster HP
			const newHp = Math.max(0, raidMonster.current_hp - damageToMonster);
			await raidMonster.update({
				current_hp: newHp,
				status: newHp <= 0 ? 'defeated' : 'active',
				fighting_character_id: null,
			});

			// Update the monster message display
			await this.updateMonsterMessage(raidMonsterId, client);

			// Check if monster was defeated
			if (newHp <= 0) {
				// Monster defeated - award points and handle queue
				await this.defeatMonster(raidMonsterId, characterId, client);

				return {
					success: true,
					defeated: true,
					damageDealt: damageToMonster,
					playerHp: result.finalState.player?.hp || 0,
					battleReport: result.battleReport,
					battleReportPages: result.battleReportPages,
					lootResults: result.lootResults,
				};
			}

			return {
				success: true,
				defeated: false,
				damageDealt: damageToMonster,
				monsterHpRemaining: newHp,
				playerHp: result.finalState.player?.hp || 0,
				battleReport: result.battleReport,
				battleReportPages: result.battleReportPages,
			};
		}
		catch (error) {
			// Reset monster status on error
			await raidMonster.update({
				status: 'active',
				fighting_character_id: null,
			});
			throw error;
		}
	}

	/**
	 * Mark a monster as defeated and spawn next from queue
	 * @param {number} raidMonsterId - Raid monster ID
	 * @param {string} defeatedBy - Character ID who defeated it
	 * @param {Object} client - Discord client
	 * @returns {Object} Result with next monster if any
	 */
	static async defeatMonster(raidMonsterId, defeatedBy, client) {
		const raidMonster = await RaidMonster.findByPk(raidMonsterId, {
			include: [
				{ model: Raid, as: 'raid' },
				{ model: RaidMonsterLib, as: 'lib' },
			],
		});

		if (!raidMonster) {
			return { success: false, error: 'Monster not found.' };
		}

		const raid = raidMonster.raid;
		const lib = raidMonster.lib;

		// Mark as defeated
		await raidMonster.update({
			status: 'defeated',
			defeated_at: new Date(),
			defeated_by: defeatedBy,
			fighting_character_id: null,
		});

		// Update raid stats - add act_score from lib
		const actScore = lib?.act_score || 1;
		await raid.update({
			monsters_defeated: raid.monsters_defeated + 1,
			current_act_points: (raid.current_act_points || 0) + actScore,
			updated_at: new Date(),
		});

		// Check for next monster in queue
		const nextMonster = await RaidMonster.findOne({
			where: {
				raid_id: raid.id,
				status: 'queued',
			},
			include: [{ model: EnemyBase, as: 'enemy' }],
			order: [['queue_position', 'ASC']],
		});

		if (nextMonster) {
			// Activate next monster
			await nextMonster.update({
				status: 'active',
				spawned_at: new Date(),
			});

			// Display it
			await this.displayMonster(nextMonster.id, raid, nextMonster.enemy, client);

			return {
				success: true,
				nextMonster: nextMonster,
			};
		}

		return { success: true, nextMonster: null };
	}

	// ============================================================================
	// MONSTER AGENDA SYSTEM
	// ============================================================================

	/**
	 * Process agenda tick for all alive monsters in an active raid
	 * Called periodically to accumulate agenda points and trigger actions
	 * @param {number} raidId - Raid ID
	 * @param {Object} client - Discord client (for messages if needed)
	 * @returns {Array} List of actions performed
	 */
	static async processAgendaTick(raidId, client) {
		const raid = await Raid.findByPk(raidId);
		if (!raid || raid.status !== 'active') {
			return [];
		}

		// Get all alive monsters (active + queued) with their lib config
		const aliveMonsters = await RaidMonster.findAll({
			where: {
				raid_id: raidId,
				status: ['active', 'queued'],
			},
			include: [
				{ model: EnemyBase, as: 'enemy' },
				{ model: RaidMonsterLib, as: 'lib' },
			],
		});

		const actions = [];

		for (const monster of aliveMonsters) {
			const lib = monster.lib;
			if (!lib) continue;

			// Accumulate agenda points using lib's agenda_score
			const newAccumulated = (monster.agenda_accumulated || 0) + (lib.agenda_score || 1);
			await monster.update({ agenda_accumulated: newAccumulated });

			// Check if cap is reached using lib's agenda_cap
			if (lib.agenda_cap && newAccumulated >= lib.agenda_cap) {
				const actionResult = await this.executeMonsterAgendaAction(monster, lib, raid, client);
				actions.push(actionResult);
			}
		}

		return actions;
	}

	/**
	 * Execute a monster's agenda action when cap is reached
	 * @param {Object} monster - RaidMonster record
	 * @param {Object} lib - RaidMonsterLib record (for action config)
	 * @param {Object} raid - Raid record
	 * @param {Object} client - Discord client
	 * @returns {Object} Action result
	 */
	static async executeMonsterAgendaAction(monster, lib, raid, client) {
		const action = lib.agenda_action || { type: 'agenda', value: 1 };
		const result = {
			monsterId: monster.id,
			actionType: action.type,
			success: true,
		};

		if (action.type === 'agenda') {
			// Add points to raid agenda
			const value = action.value || 1;
			const newAgendaPoints = (raid.current_agenda_points || 0) + value;
			await raid.update({
				current_agenda_points: newAgendaPoints,
				updated_at: new Date(),
			});
			result.value = value;
			result.newAgendaPoints = newAgendaPoints;
		}
		// Can add more action types here in the future

		// Reset accumulated agenda after action
		await monster.update({ agenda_accumulated: 0 });

		return result;
	}

	/**
	 * Update the monster message to show current state
	 * @param {number} raidMonsterId - Raid monster ID
	 * @param {Object} client - Discord client
	 */
	static async updateMonsterMessage(raidMonsterId, client) {
		const raidMonster = await RaidMonster.findByPk(raidMonsterId, {
			include: [
				{ model: EnemyBase, as: 'enemy' },
				{ model: Raid, as: 'raid' },
			],
		});

		if (!raidMonster || !raidMonster.message_id) return;

		try {
			const channel = await client.channels.fetch(raidMonster.raid.channel_id);
			const message = await channel.messages.fetch(raidMonster.message_id);

			const enemy = raidMonster.enemy;

			const embed = new EmbedBuilder()
				.setTitle(`⚔️ ${enemy.fullname || enemy.name}`)
				.setDescription(enemy.description || 'A monster has appeared!')
				.setColor(raidMonster.status === 'defeated' ? 0x00FF00 : 0xFF4444)
				.addFields(
					{ name: 'Level', value: `${enemy.lv || 1}`, inline: true },
					{ name: 'HP', value: `${raidMonster.current_hp}/${raidMonster.max_hp}`, inline: true },
				);

			if (enemy.avatar) {
				embed.setThumbnail(enemy.avatar);
			}

			const queuedMonsters = await this.getQueuedMonsters(raidMonster.raid.id);
			if (queuedMonsters.length > 0) {
				embed.setFooter({ text: `${queuedMonsters.length} monster(s) in queue` });
			}

			await message.edit({
				embeds: [embed],
			});

			// Remove reactions if monster is no longer active
			if (raidMonster.status !== 'active') {
				try {
					await message.reactions.removeAll();
				}
				catch (e) {
					// Ignore if we can't remove reactions
				}
			}
		}
		catch (error) {
			console.error('Failed to update monster message:', error);
		}
	}
}

module.exports = RaidManager;