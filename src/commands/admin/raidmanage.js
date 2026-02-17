const { SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { Raid, RaidStage, RaidMonsterLib, RaidBoss, RaidMonster, EnemyBase } = require('@root/dbObject.js');
const RaidManager = require('../../utility/raidManager.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('raidmanage')
		.setDescription('[Admin] Manage raids in this server.')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(subcommand =>
			subcommand
				.setName('start')
				.setDescription('Start a raid in this channel')
				.addIntegerOption(option =>
					option.setName('raid_id')
						.setDescription('Raid ID to start')
						.setRequired(true))
				.addIntegerOption(option =>
					option.setName('spawn_interval')
						.setDescription('Monster spawn interval in minutes (overrides default)')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('stop')
				.setDescription('Stop the active raid in this channel')
				.addStringOption(option =>
					option.setName('reason')
						.setDescription('Reason for stopping the raid')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('status')
				.setDescription('Show detailed status of the active raid'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('List all available raids'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('active')
				.setDescription('Show all currently active raids in this server')),

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
				case 'list':
					await handleList(interaction);
					break;
				case 'active':
					await handleActive(interaction);
					break;
			}
		}
		catch (error) {
			console.error('Error in raidmanage command:', error);
			const content = `❌ Error: ${error.message}`;
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply({ content });
			}
			else {
				await interaction.reply({ content, flags: MessageFlags.Ephemeral });
			}
		}
	},
};

async function handleStart(interaction) {
	await interaction.deferReply();

	const raidId = interaction.options.getInteger('raid_id');
	const spawnIntervalOverride = interaction.options.getInteger('spawn_interval');
	const channelId = interaction.channelId;
	const guildId = interaction.guildId;

	// Check if there's already an active raid in this channel
	const existingRaid = await Raid.findOne({
		where: {
			channel_id: channelId,
			status: 'active',
		},
	});

	if (existingRaid) {
		await interaction.editReply({
			content: `⚠️ There's already an active raid in this channel: **${existingRaid.name}** (ID: ${existingRaid.id})\nUse \`/raidmanage stop\` to end it first.`,
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
			content: `❌ Raid with ID ${raidId} not found.`,
		});
		return;
	}

	// Update raid with current channel/guild and reset state
	const updateData = {
		channel_id: channelId,
		guild_id: guildId,
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
	};

	// Override spawn interval if provided
	if (spawnIntervalOverride) {
		updateData.spawn_interval_minutes = spawnIntervalOverride;
	}

	// Clean up any leftover monsters from previous runs
	await RaidMonster.update(
		{ status: 'despawned', updated_at: new Date() },
		{ where: { raid_id: raidId, status: 'active' } }
	);

	await raid.update(updateData);

	// Start the raid
	await RaidManager.startRaid(raidId);

	// Start the automatic spawn timer
	await RaidManager.startSpawnTimer(raidId, interaction.client);

	// Reload raid to get updated values
	await raid.reload();

	// Get stage info
	const actStages = raid.stages.filter(s => s.stage_type === 'act').sort((a, b) => a.stage_number - b.stage_number);
	const agendaStages = raid.stages.filter(s => s.stage_type === 'agenda').sort((a, b) => a.stage_number - b.stage_number);

	// Build announcement embed
	const embed = new EmbedBuilder()
		.setTitle(`⚔️ ${raid.name} - RAID BEGINS!`)
		.setDescription(raid.description || 'A great challenge awaits!')
		.setColor(0xFF4444)
		.addFields(
			{
				name: '📊 Current Progress',
				value: `**Act ${raid.current_act}:** ${raid.current_act_points}/${actStages[0]?.goal_points || '?'} pts\n**Agenda ${raid.current_agenda}:** ${raid.current_agenda_points}/${agendaStages[0]?.goal_points || '?'} pts`,
				inline: true,
			},
			{
				name: '⚙️ Settings',
				value: `Spawn Interval: ${raid.spawn_interval_minutes} min\nMonster Pool: ${raid.monsterLib?.length || 0} types`,
				inline: true,
			},
		)
		.setFooter({ text: `Raid ID: ${raid.id} | Started by ${interaction.user.username}` })
		.setTimestamp();

	if (raid.image_url) {
		embed.setImage(raid.image_url);
	}

	await interaction.editReply({ embeds: [embed] });

	// Auto-spawn first monster
	try {
		const monster = await RaidManager.spawnMonster(raidId, interaction.client);
		console.log(`[RaidManage] First monster spawned: ${monster.enemy?.fullname || 'Unknown'}`);
	}
	catch (spawnError) {
		console.error('[RaidManage] Failed to spawn first monster:', spawnError);
		await interaction.followUp({
			content: `⚠️ Raid started but failed to spawn first monster: ${spawnError.message}`,
			flags: MessageFlags.Ephemeral,
		});
	}
}

async function handleStop(interaction) {
	await interaction.deferReply();

	const channelId = interaction.channelId;
	const reason = interaction.options.getString('reason') || 'Manually stopped by admin';

	// Find active raid in this channel
	const raid = await Raid.findOne({
		where: {
			channel_id: channelId,
			status: 'active',
		},
		include: [
			{ model: RaidMonster, as: 'monsters' },
		],
	});

	if (!raid) {
		await interaction.editReply({
			content: '❌ No active raid found in this channel.',
		});
		return;
	}

	// Count stats before ending
	const monstersDefeated = raid.monsters_defeated;
	const eventsTriggered = raid.events_triggered;
	const actPoints = raid.current_act_points;
	const agendaPoints = raid.current_agenda_points;
	const startedAt = raid.started_at;

	// Calculate duration
	let duration = 'Unknown';
	if (startedAt) {
		const durationMs = Date.now() - new Date(startedAt).getTime();
		const minutes = Math.floor(durationMs / 60000);
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		duration = hours > 0 ? `${hours}h ${remainingMinutes}m` : `${minutes}m`;
	}

	// End the raid
	await RaidManager.endRaid(raid.id, 'completed');

	const embed = new EmbedBuilder()
		.setTitle(`🏁 ${raid.name} - RAID ENDED`)
		.setDescription(reason)
		.setColor(0x00FF00)
		.addFields(
			{ name: '⏱️ Duration', value: duration, inline: true },
			{ name: '👾 Monsters Defeated', value: `${monstersDefeated}`, inline: true },
			{ name: '📜 Events Triggered', value: `${eventsTriggered}`, inline: true },
			{ name: '🎭 Final Act Points', value: `${actPoints}`, inline: true },
			{ name: '⚠️ Final Agenda Points', value: `${agendaPoints}`, inline: true },
		)
		.setFooter({ text: `Stopped by ${interaction.user.username}` })
		.setTimestamp();

	await interaction.editReply({ embeds: [embed] });
}

async function handleStatus(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const channelId = interaction.channelId;

	// Find raid in this channel
	const raid = await Raid.findOne({
		where: { channel_id: channelId },
		include: [
			{ model: RaidStage, as: 'stages' },
			{ model: RaidBoss, as: 'bosses' },
			{ model: RaidMonster, as: 'monsters' },
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

	// Calculate uptime if active
	let uptime = 'N/A';
	if (raid.status === 'active' && raid.started_at) {
		const uptimeMs = Date.now() - new Date(raid.started_at).getTime();
		const minutes = Math.floor(uptimeMs / 60000);
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		uptime = hours > 0 ? `${hours}h ${remainingMinutes}m` : `${minutes}m`;
	}

	const statusColors = {
		inactive: 0x808080,
		preparing: 0xFFFF00,
		active: 0x00FF00,
		completed: 0x5865F2,
		failed: 0xFF0000,
	};

	const statusEmojis = {
		inactive: '⏸️',
		preparing: '🔄',
		active: '✅',
		completed: '🏆',
		failed: '❌',
	};

	const embed = new EmbedBuilder()
		.setTitle(`📊 ${raid.name} - Raid Status`)
		.setDescription(`**Status:** ${statusEmojis[raid.status] || '❓'} ${raid.status.toUpperCase()}`)
		.setColor(statusColors[raid.status] || 0x808080)
		.addFields(
			{
				name: `🎭 Act ${raid.current_act}: ${currentAct?.name || 'Unknown'}`,
				value: `Progress: ${raid.current_act_points}/${currentAct?.goal_points || '?'} pts\n${currentAct?.description || 'No description'}`,
				inline: false,
			},
			{
				name: `⚠️ Agenda ${raid.current_agenda}: ${currentAgenda?.name || 'Unknown'}`,
				value: `Progress: ${raid.current_agenda_points}/${currentAgenda?.goal_points || '?'} pts\n${currentAgenda?.description || 'No description'}`,
				inline: false,
			},
			{
				name: '📈 Statistics',
				value: `Monsters Defeated: ${raid.monsters_defeated}\nEvents Triggered: ${raid.events_triggered}\nUptime: ${uptime}`,
				inline: true,
			},
			{
				name: '👾 Current Monster',
				value: activeMonster
					? `${activeMonster.enemy?.fullname || 'Unknown'}\nHP: ${activeMonster.current_hp}/${activeMonster.max_hp}`
					: 'None active',
				inline: true,
			},
			{
				name: '📋 Monster Queue',
				value: queuedMonsters.length > 0
					? queuedMonsters.slice(0, 5).map((m, i) => `${i + 1}. ${m.enemy?.fullname || 'Unknown'}`).join('\n') +
					  (queuedMonsters.length > 5 ? `\n... and ${queuedMonsters.length - 5} more` : '')
					: 'Empty',
				inline: true,
			},
		)
		.setFooter({ text: `Raid ID: ${raid.id} | Spawn Interval: ${raid.spawn_interval_minutes}min` })
		.setTimestamp();

	await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const raids = await Raid.findAll({
		include: [
			{ model: RaidStage, as: 'stages' },
			{ model: RaidMonsterLib, as: 'monsterLib' },
		],
		order: [['id', 'ASC']],
	});

	if (raids.length === 0) {
		await interaction.editReply({
			content: '❌ No raids configured in the database.',
		});
		return;
	}

	const embed = new EmbedBuilder()
		.setTitle('📚 Available Raids')
		.setDescription('Use `/raidmanage start raid_id:<id>` to start a raid')
		.setColor(0x5865F2);

	for (const raid of raids.slice(0, 15)) {
		const actCount = raid.stages.filter(s => s.stage_type === 'act').length;
		const agendaCount = raid.stages.filter(s => s.stage_type === 'agenda').length;
		const monsterCount = raid.monsterLib?.length || 0;

		const statusIcon = raid.status === 'active' ? '🟢' : raid.status === 'completed' ? '✅' : '⚪';

		embed.addFields({
			name: `${statusIcon} ${raid.id}. ${raid.name}`,
			value: `${raid.description || 'No description'}\n` +
				`Acts: ${actCount} | Agendas: ${agendaCount} | Monsters: ${monsterCount} | Interval: ${raid.spawn_interval_minutes}min`,
			inline: false,
		});
	}

	if (raids.length > 15) {
		embed.setFooter({ text: `Showing 15 of ${raids.length} raids` });
	}

	await interaction.editReply({ embeds: [embed] });
}

async function handleActive(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const guildId = interaction.guildId;

	// Find all active raids in this guild
	const activeRaids = await Raid.findAll({
		where: {
			guild_id: guildId,
			status: 'active',
		},
		include: [
			{ model: RaidMonster, as: 'monsters' },
		],
		order: [['started_at', 'DESC']],
	});

	if (activeRaids.length === 0) {
		await interaction.editReply({
			content: '❌ No active raids in this server.',
		});
		return;
	}

	const embed = new EmbedBuilder()
		.setTitle('🔴 Active Raids in This Server')
		.setColor(0xFF4444);

	for (const raid of activeRaids) {
		const activeMonsters = raid.monsters?.filter(m => m.status === 'active').length || 0;
		const queuedMonsters = raid.monsters?.filter(m => m.status === 'queued').length || 0;

		let uptime = 'Unknown';
		if (raid.started_at) {
			const uptimeMs = Date.now() - new Date(raid.started_at).getTime();
			const minutes = Math.floor(uptimeMs / 60000);
			const hours = Math.floor(minutes / 60);
			uptime = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
		}

		embed.addFields({
			name: `⚔️ ${raid.name} (ID: ${raid.id})`,
			value: `Channel: <#${raid.channel_id}>\n` +
				`Uptime: ${uptime} | Defeated: ${raid.monsters_defeated}\n` +
				`Active: ${activeMonsters} | Queued: ${queuedMonsters}`,
			inline: false,
		});
	}

	embed.setFooter({ text: `${activeRaids.length} active raid(s)` });
	await interaction.editReply({ embeds: [embed] });
}
