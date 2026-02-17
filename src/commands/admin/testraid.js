const { SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { Raid, RaidStage, RaidMonsterLib, RaidBoss, RaidMonster, EnemyBase } = require('@root/dbObject.js');
const RaidManager = require('../../utility/raidManager.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('testraid')
		.setDescription('[Admin] Start a test raid in the current channel.')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(subcommand =>
			subcommand
				.setName('start')
				.setDescription('Start the test raid in this channel')
				.addIntegerOption(option =>
					option.setName('raid_id')
						.setDescription('Raid ID to start (default: 1)')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('stop')
				.setDescription('Stop the active raid in this channel'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('status')
				.setDescription('Show the status of the active raid'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('spawn')
				.setDescription('Manually spawn a monster in the active raid'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('info')
				.setDescription('Show available test raids'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('swap')
				.setDescription('Swap a queued monster to the front')
				.addIntegerOption(option =>
					option.setName('position')
						.setDescription('Queue position to bring to front (1 = first in queue)')
						.setRequired(true))),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		try {
			switch (subcommand) {
				case 'start':
					await handleStart(interaction);
					break;
				case 'stop':
					await handleStop(interaction);
					break;
				case 'status':
					await handleStatus(interaction);
					break;
				case 'spawn':
					await handleSpawn(interaction);
					break;
				case 'info':
					await handleInfo(interaction);
					break;
				case 'swap':
					await handleSwap(interaction);
					break;
			}
		} catch (error) {
			console.error('Error in testraid command:', error);
			const content = `❌ Error: ${error.message}`;
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply({ content });
			} else {
				await interaction.reply({ content, flags: MessageFlags.Ephemeral });
			}
		}
	},
};

async function handleStart(interaction) {
	await interaction.deferReply();

	const raidId = interaction.options.getInteger('raid_id') || 1;
	const channelId = interaction.channelId;

	// Check if there's already an active raid in this channel
	const existingRaid = await Raid.findOne({
		where: {
			channel_id: channelId,
			status: 'active',
		},
	});

	if (existingRaid) {
		await interaction.editReply({
			content: `⚠️ There's already an active raid in this channel: **${existingRaid.name}** (ID: ${existingRaid.id})\nUse \`/testraid stop\` to end it first.`,
		});
		return;
	}

	// Find the raid
	const raid = await Raid.findByPk(raidId, {
		include: [
			{ model: RaidStage, as: 'stages' },
			{ model: RaidMonsterLib, as: 'monsterLib', include: [{ model: EnemyBase, as: 'enemy' }] },
			{ model: RaidBoss, as: 'bosses' },
		],
	});

	if (!raid) {
		await interaction.editReply({
			content: `❌ Raid with ID ${raidId} not found.\nRun \`node scripts/seedRaidTestData.js\` to create test data.`,
		});
		return;
	}

	// Clean up any leftover monsters from previous runs
	await RaidMonster.update(
		{ status: 'despawned', updated_at: new Date() },
		{ where: { raid_id: raidId, status: 'active' } }
	);

	// Update raid with current channel and reset state
	await raid.update({
		channel_id: channelId,
		thread_id: null,
		status: 'inactive',
		current_act: 1,
		current_act_points: 0,
		current_agenda: 1,
		current_agenda_points: 0,
		monsters_defeated: 0,
		events_triggered: 0,
		started_at: null,
		ended_at: null,
		updated_at: new Date(),
	});

	// Start the raid
	await RaidManager.startRaid(raidId);

	// Start the automatic spawn timer
	await RaidManager.startSpawnTimer(raidId, interaction.client);

	// Get stage info
	const actStages = raid.stages.filter(s => s.stage_type === 'act').sort((a, b) => a.stage_number - b.stage_number);
	const agendaStages = raid.stages.filter(s => s.stage_type === 'agenda').sort((a, b) => a.stage_number - b.stage_number);

	// Build embed
	const embed = new EmbedBuilder()
		.setTitle(`⚔️ ${raid.name} - RAID STARTED!`)
		.setDescription(raid.description || 'A raid has begun!')
		.setColor(0xFF4444)
		.addFields(
			{
				name: '📊 Progress',
				value: `**Act ${raid.current_act}:** ${raid.current_act_points}/${actStages[0]?.goal_points || '?'} pts\n**Agenda ${raid.current_agenda}:** ${raid.current_agenda_points}/${agendaStages[0]?.goal_points || '?'} pts`,
				inline: true,
			},
			{
				name: '👾 Monster Pool',
				value: raid.monsterLib.map(m => `• ${m.enemy?.fullname || 'Unknown'} (Lv.${m.enemy?.lv || '?'})`).join('\n') || 'None configured',
				inline: true,
			},
			{
				name: '⚙️ Settings',
				value: `Spawn Interval: ${raid.spawn_interval_minutes} min\nMonster Chance: ${raid.config?.monsterSpawnChance || 80}%`,
				inline: true,
			},
		)
		.setFooter({ text: `Raid ID: ${raid.id} | Use /testraid spawn to manually spawn monsters` })
		.setTimestamp();

	await interaction.editReply({ embeds: [embed] });

	// Auto-spawn first monster
	try {
		const monster = await RaidManager.spawnMonster(raidId, interaction.client);
		console.log(`[TestRaid] First monster spawned: ${monster.enemy?.fullname || 'Unknown'}`);
	} catch (spawnError) {
		console.error('[TestRaid] Failed to spawn first monster:', spawnError);
		await interaction.followUp({
			content: `⚠️ Raid started but failed to spawn first monster: ${spawnError.message}`,
			flags: MessageFlags.Ephemeral,
		});
	}
}

async function handleStop(interaction) {
	await interaction.deferReply();

	const channelId = interaction.channelId;

	// Find active raid in this channel
	const raid = await Raid.findOne({
		where: {
			channel_id: channelId,
			status: 'active',
		},
	});

	if (!raid) {
		await interaction.editReply({
			content: '❌ No active raid found in this channel.',
		});
		return;
	}

	// End the raid
	await RaidManager.endRaid(raid.id, 'completed');

	const embed = new EmbedBuilder()
		.setTitle(`🏁 ${raid.name} - RAID ENDED`)
		.setDescription('The raid has been manually stopped.')
		.setColor(0x00FF00)
		.addFields(
			{ name: 'Monsters Defeated', value: `${raid.monsters_defeated}`, inline: true },
			{ name: 'Events Triggered', value: `${raid.events_triggered}`, inline: true },
			{ name: 'Final Act Points', value: `${raid.current_act_points}`, inline: true },
		)
		.setTimestamp();

	await interaction.editReply({ embeds: [embed] });
}

async function handleStatus(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const channelId = interaction.channelId;

	// Find raid in this channel (active or recent)
	const raid = await Raid.findOne({
		where: { channel_id: channelId },
		include: [
			{ model: RaidStage, as: 'stages' },
			{ model: RaidBoss, as: 'bosses' },
		],
		order: [['updated_at', 'DESC']],
	});

	if (!raid) {
		await interaction.editReply({
			content: '❌ No raid found in this channel.',
		});
		return;
	}

	const actStages = raid.stages.filter(s => s.stage_type === 'act').sort((a, b) => a.stage_number - b.stage_number);
	const agendaStages = raid.stages.filter(s => s.stage_type === 'agenda').sort((a, b) => a.stage_number - b.stage_number);
	const currentAct = actStages.find(s => s.stage_number === raid.current_act);
	const currentAgenda = agendaStages.find(s => s.stage_number === raid.current_agenda);

	// Get active/queued monsters
	const activeMonster = await RaidManager.getActiveMonster(raid.id);
	const queuedMonsters = await RaidManager.getQueuedMonsters(raid.id);

	const statusColors = {
		inactive: 0x808080,
		preparing: 0xFFFF00,
		active: 0x00FF00,
		completed: 0x00FF00,
		failed: 0xFF0000,
	};

	const embed = new EmbedBuilder()
		.setTitle(`📊 ${raid.name} - Status`)
		.setDescription(`**Status:** ${raid.status.toUpperCase()}`)
		.setColor(statusColors[raid.status] || 0x808080)
		.addFields(
			{
				name: `🎭 Act ${raid.current_act}: ${currentAct?.name || 'Unknown'}`,
				value: `Progress: ${raid.current_act_points}/${currentAct?.goal_points || '?'} pts\n${currentAct?.description || ''}`,
				inline: false,
			},
			{
				name: `⚠️ Agenda ${raid.current_agenda}: ${currentAgenda?.name || 'Unknown'}`,
				value: `Progress: ${raid.current_agenda_points}/${currentAgenda?.goal_points || '?'} pts\n${currentAgenda?.description || ''}`,
				inline: false,
			},
			{
				name: '📈 Statistics',
				value: `Monsters Defeated: ${raid.monsters_defeated}\nEvents Triggered: ${raid.events_triggered}`,
				inline: true,
			},
			{
				name: '👾 Current Monster',
				value: activeMonster ? `${activeMonster.enemy?.fullname || 'Unknown'} (HP: ${activeMonster.current_hp}/${activeMonster.max_hp})` : 'None active',
				inline: true,
			},
			{
				name: '📋 Monster Queue',
				value: queuedMonsters.length > 0 
					? queuedMonsters.map((m, i) => `${i + 1}. ${m.enemy?.fullname || 'Unknown'}`).join('\n')
					: 'Empty',
				inline: true,
			},
		)
		.setFooter({ text: `Raid ID: ${raid.id}` })
		.setTimestamp();

	await interaction.editReply({ embeds: [embed] });
}

async function handleSpawn(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const channelId = interaction.channelId;

	// Find active raid in this channel
	const raid = await Raid.findOne({
		where: {
			channel_id: channelId,
			status: 'active',
		},
	});

	if (!raid) {
		await interaction.editReply({
			content: '❌ No active raid found in this channel. Use `/testraid start` first.',
		});
		return;
	}

	try {
		const monster = await RaidManager.spawnMonster(raid.id, interaction.client);
		const enemy = monster.enemy;

		await interaction.editReply({
			content: `✅ Spawned: **${enemy?.fullname || 'Unknown Monster'}** (Lv.${enemy?.lv || '?'})\nStatus: ${monster.status === 'queued' ? '📋 Added to queue' : '⚔️ Now active'}`,
		});
	} catch (error) {
		await interaction.editReply({
			content: `❌ Failed to spawn monster: ${error.message}`,
		});
	}
}

async function handleInfo(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	// Get all raids
	const raids = await Raid.findAll({
		include: [
			{ model: RaidStage, as: 'stages' },
			{ model: RaidMonsterLib, as: 'monsterLib' },
		],
		order: [['id', 'ASC']],
	});

	if (raids.length === 0) {
		await interaction.editReply({
			content: '❌ No raids found in the database.\nRun `node scripts/seedRaidTestData.js` to create test data.',
		});
		return;
	}

	const embed = new EmbedBuilder()
		.setTitle('📚 Available Raids')
		.setDescription('Use `/testraid start raid_id:<id>` to start a raid')
		.setColor(0x5865F2);

	for (const raid of raids.slice(0, 10)) { // Limit to 10 raids
		const actCount = raid.stages.filter(s => s.stage_type === 'act').length;
		const agendaCount = raid.stages.filter(s => s.stage_type === 'agenda').length;
		const monsterCount = raid.monsterLib.length;

		embed.addFields({
			name: `${raid.id}. ${raid.name} [${raid.status.toUpperCase()}]`,
			value: `${raid.description || 'No description'}\n` +
				`Acts: ${actCount} | Agendas: ${agendaCount} | Monsters: ${monsterCount}`,
			inline: false,
		});
	}

	await interaction.editReply({ embeds: [embed] });
}

async function handleSwap(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const channelId = interaction.channelId;
	const position = interaction.options.getInteger('position');

	// Find active raid in this channel
	const raid = await Raid.findOne({
		where: {
			channel_id: channelId,
			status: 'active',
		},
	});

	if (!raid) {
		await interaction.editReply({
			content: '❌ No active raid found in this channel.',
		});
		return;
	}

	// Get current active monster
	const activeMonster = await RaidManager.getActiveMonster(raid.id);

	// Get queued monsters
	const queuedMonsters = await RaidManager.getQueuedMonsters(raid.id);

	if (queuedMonsters.length === 0) {
		await interaction.editReply({
			content: '❌ No monsters in the queue to swap.',
		});
		return;
	}

	if (position < 1 || position > queuedMonsters.length) {
		await interaction.editReply({
			content: `❌ Invalid position. Queue has ${queuedMonsters.length} monster(s). Use a number between 1 and ${queuedMonsters.length}.`,
		});
		return;
	}

	// Get the monster to swap in (0-indexed from position)
	const monsterToActivate = queuedMonsters[position - 1];

	// If there's an active monster, move it to the back of the queue
	if (activeMonster) {
		const maxQueuePos = queuedMonsters.length > 0 
			? Math.max(...queuedMonsters.map(m => m.queue_position)) + 1 
			: 1;

		await activeMonster.update({
			status: 'queued',
			queue_position: maxQueuePos,
		});

		// Remove reactions from the old monster message
		try {
			const channel = await interaction.client.channels.fetch(raid.channel_id);
			if (channel && activeMonster.message_id) {
				const oldMessage = await channel.messages.fetch(activeMonster.message_id);
				await oldMessage.reactions.removeAll();
			}
		}
		catch (e) {
			// Ignore if can't remove reactions
		}
	}

	// Activate the selected monster
	await monsterToActivate.update({
		status: 'active',
		spawned_at: new Date(),
	});

	// Display the new active monster
	const enemy = await EnemyBase.findByPk(monsterToActivate.enemy_id);
	await RaidManager.displayMonster(monsterToActivate.id, raid, enemy, interaction.client);

	// Build response
	const swappedName = enemy?.fullname || enemy?.name || 'Unknown Monster';
	const previousName = activeMonster?.enemy?.fullname || activeMonster?.enemy?.name || 'None';

	await interaction.editReply({
		content: `✅ Swapped monsters!\n**Now Active:** ${swappedName}\n**Moved to Queue:** ${previousName}`,
	});
}
