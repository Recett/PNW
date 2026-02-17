const { SlashCommandBuilder, InteractionContextType, MessageFlags, EmbedBuilder } = require('discord.js');
const { Raid, RaidStage, RaidMonster, EnemyBase } = require('@root/dbObject.js');
const RaidManager = require('../../utility/raidManager.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('raid')
		.setDescription('Raid commands for participants.')
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(subcommand =>
			subcommand
				.setName('switch')
				.setDescription('Switch the current monster with one from the queue')
				.addIntegerOption(option =>
					option.setName('position')
						.setDescription('Queue position to bring forward (1 = first in queue)')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('status')
				.setDescription('View the current raid status'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('queue')
				.setDescription('View the monster queue')),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		try {
			switch (subcommand) {
			case 'switch':
				await handleSwitch(interaction);
				break;
			case 'status':
				await handleStatus(interaction);
				break;
			case 'queue':
				await handleQueue(interaction);
				break;
			}
		}
		catch (error) {
			console.error('Error in raid command:', error);
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

async function handleSwitch(interaction) {
	await interaction.deferReply();

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
			content: '❌ No active raid in this channel.',
		});
		return;
	}

	// Get current active monster
	const activeMonster = await RaidManager.getActiveMonster(raid.id);

	// Get queued monsters
	const queuedMonsters = await RaidManager.getQueuedMonsters(raid.id);

	if (queuedMonsters.length === 0) {
		await interaction.editReply({
			content: '❌ No monsters in the queue to switch to.',
		});
		return;
	}

	if (position < 1 || position > queuedMonsters.length) {
		const queueList = queuedMonsters.map((m, i) => `${i + 1}. ${m.enemy?.fullname || 'Unknown'}`).join('\n');
		await interaction.editReply({
			content: `❌ Invalid position. Choose a number between 1 and ${queuedMonsters.length}.\n\n**Queue:**\n${queueList}`,
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
		content: `🔄 **${interaction.user.displayName}** switched monsters!\n**Now Active:** ${swappedName}\n**Moved to Queue:** ${previousName}`,
	});
}

async function handleStatus(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const channelId = interaction.channelId;

	// Find active raid in this channel
	const raid = await Raid.findOne({
		where: {
			channel_id: channelId,
			status: 'active',
		},
		include: [
			{ model: RaidStage, as: 'stages' },
		],
	});

	if (!raid) {
		await interaction.editReply({
			content: '❌ No active raid in this channel.',
		});
		return;
	}

	const actStages = raid.stages.filter(s => s.stage_type === 'act').sort((a, b) => a.stage_number - b.stage_number);
	const agendaStages = raid.stages.filter(s => s.stage_type === 'agenda').sort((a, b) => a.stage_number - b.stage_number);
	const currentAct = actStages.find(s => s.stage_number === raid.current_act);
	const currentAgenda = agendaStages.find(s => s.stage_number === raid.current_agenda);

	// Get active monster
	const activeMonster = await RaidManager.getActiveMonster(raid.id);
	const queuedMonsters = await RaidManager.getQueuedMonsters(raid.id);

	const embed = new EmbedBuilder()
		.setTitle(`⚔️ ${raid.name}`)
		.setDescription(raid.description || 'An ongoing raid!')
		.setColor(0xFF4444)
		.addFields(
			{
				name: `🎭 Act ${raid.current_act}: ${currentAct?.name || 'Unknown'}`,
				value: `Progress: ${raid.current_act_points}/${currentAct?.goal_points || '?'} pts`,
				inline: true,
			},
			{
				name: `⚠️ Agenda ${raid.current_agenda}`,
				value: `Progress: ${raid.current_agenda_points}/${currentAgenda?.goal_points || '?'} pts`,
				inline: true,
			},
			{
				name: '📈 Statistics',
				value: `Monsters Defeated: ${raid.monsters_defeated}`,
				inline: true,
			},
			{
				name: '👾 Current Monster',
				value: activeMonster
					? `**${activeMonster.enemy?.fullname || 'Unknown'}**\nHP: ${activeMonster.current_hp}/${activeMonster.max_hp}`
					: 'None active',
				inline: true,
			},
			{
				name: '📋 Queue',
				value: `${queuedMonsters.length} monster(s) waiting`,
				inline: true,
			},
		)
		.setFooter({ text: 'Use /raid switch to swap monsters • React ⚔️ to fight' })
		.setTimestamp();

	await interaction.editReply({ embeds: [embed] });
}

async function handleQueue(interaction) {
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
			content: '❌ No active raid in this channel.',
		});
		return;
	}

	// Get active monster
	const activeMonster = await RaidManager.getActiveMonster(raid.id);
	const queuedMonsters = await RaidManager.getQueuedMonsters(raid.id);

	const embed = new EmbedBuilder()
		.setTitle(`📋 Monster Queue - ${raid.name}`)
		.setColor(0x5865F2);

	// Current monster
	if (activeMonster) {
		embed.addFields({
			name: '⚔️ Currently Active',
			value: `**${activeMonster.enemy?.fullname || 'Unknown'}** (Lv.${activeMonster.enemy?.lv || '?'})\nHP: ${activeMonster.current_hp}/${activeMonster.max_hp}`,
			inline: false,
		});
	}
	else {
		embed.addFields({
			name: '⚔️ Currently Active',
			value: 'No active monster',
			inline: false,
		});
	}

	// Queue
	if (queuedMonsters.length > 0) {
		const queueList = queuedMonsters.map((m, i) => {
			return `**${i + 1}.** ${m.enemy?.fullname || 'Unknown'} (Lv.${m.enemy?.lv || '?'})`;
		}).join('\n');

		embed.addFields({
			name: '📋 Waiting in Queue',
			value: queueList,
			inline: false,
		});

		embed.setFooter({ text: 'Use /raid switch position:<number> to bring a queued monster forward' });
	}
	else {
		embed.addFields({
			name: '📋 Waiting in Queue',
			value: 'Queue is empty',
			inline: false,
		});
	}

	await interaction.editReply({ embeds: [embed] });
}
