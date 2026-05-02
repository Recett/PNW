const {
	SlashCommandBuilder, EmbedBuilder, InteractionContextType,
	MessageFlags, PermissionFlagsBits,
} = require('discord.js');
const battleUtil = require('@utility/battleUtility.js');
const { EMOJI } = require('../../enums');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('battle')
		.setDescription('[Admin] Manage the Battle of HMS Divine event.')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(sub =>
			sub.setName('init')
				.setDescription('Create Arbrance locations and set up the field (no player movement or announcements).'))
		.addSubcommand(sub =>
			sub.setName('start')
				.setDescription('Start the battle: set all flags, seal locations, rally players, and post the announcement.'))
		.addSubcommand(sub =>
			sub.setName('status')
				.setDescription('Show current battle state and all HMS Divine global flags.'))
		.addSubcommand(sub =>
			sub.setName('advance')
				.setDescription('Force one battle cycle immediately (cannon exchange, morale update, cycle report).'))
		.addSubcommand(sub =>
			sub.setName('set')
				.setDescription('Set an individual battle flag by name.')
				.addStringOption(opt =>
					opt.setName('flag')
						.setDescription('Flag name (without global. prefix)')
						.setRequired(true))
				.addIntegerOption(opt =>
					opt.setName('value')
						.setDescription('Integer value to set')
						.setRequired(true)))
		.addSubcommand(sub =>
			sub.setName('end')
				.setDescription('End the battle immediately, post outcome, and restore all locations.')),

	async execute(interaction) {
		const sub = interaction.options.getSubcommand();

		try {
			if (sub === 'init') {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				await battleUtil.ensureArbranceLocations();
				await battleUtil.ensureHMSRiggingLocation();
				const syncArbResult = await battleUtil.syncArbranceLocations(interaction.guild);
				const syncHmsResult = await battleUtil.syncHMSRiggingLocation(interaction.guild);
				await battleUtil.sealBattleLocations();

				const allCreated = [...syncArbResult.created, ...syncHmsResult.created];
				const allFailed  = [...syncArbResult.failed,  ...syncHmsResult.failed];

				const syncSummary = allCreated.length > 0
					? `\nDiscord synced: ${allCreated.join(', ')}`
					: '\nDiscord channels/roles already up to date.';
				const failSummary = allFailed.length > 0
					? `\n${EMOJI.FAILURE} Sync failed for: ${allFailed.join(', ')}`
					: '';

				await interaction.editReply({
					content: `${EMOJI.SUCCESS} Arbrance locations created and sealed.${syncSummary}${failSummary}\nRun \`/battle start\` to begin the battle.`,
				});
			}
			else if (sub === 'start') {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				await battleUtil.initBattle(interaction.guild, interaction.client);
				await interaction.editReply({ content: `${EMOJI.SUCCESS} Battle of HMS Divine started.` });
			}
			else if (sub === 'status') {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const state = await battleUtil.getBattleState();

				const embed = new EmbedBuilder()
					.setTitle('Battle of HMS Divine \u2014 Status')
					.setColor(state.battleActive ? 0xe74c3c : 0x95a5a6)
					.addFields(
						{
							name: 'Battle',
							value: [
								`Active: **${state.battleActive ? 'YES' : 'NO'}**`,
								`Initialized: **${state.battleInitialized ? 'YES' : 'NO'}**`,
							`Cycle: **${state.cycleCount}**`,
							`Morale: **${state.morale}**`,
						].join('\n'),
							inline: true,
						},
						{
							name: 'HMS Divine HP',
							value: [
								`Top Deck: **${state.hmsDeckHp}** / 400`,
								`Cannon Deck: **${state.hmsCannonHp}** / 300`,
								`Rigging: **${state.hmsRiggingHp}** / 300`,
								`Total: **${state.hmsTotalHp}** / 1000`,
							].join('\n'),
							inline: true,
						},
						{
							name: 'Arbrance HP',
							value: [
								`Main Deck: **${state.arbMainHp}** / 800`,
								`Cannon Deck: **${state.arbCannonHp}** / 450`,
								`Rigging: **${state.arbRiggingHp}** / 250`,
								`Total: **${state.arbTotalHp}** / 1500`,
							].join('\n'),
							inline: true,
						},
						{
							name: 'Arbrance State',
							value: [
								`Commander Slain: **${state.arbCommanderSlain ? 'YES' : 'NO'}**`,
							].join('\n'),
							inline: true,
						},
						{
							name: 'HMS Outcome',
							value: [
								`Sunk: **${state.hmsSunk ? 'YES' : 'NO'}**`,
								`Supply Loss: **${state.hmsSupplyLoss}**`,
							].join('\n'),
							inline: true,
						},
					);

				await interaction.editReply({ embeds: [embed] });
			}
			else if (sub === 'advance') {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const battleActive = await battleUtil.getFlag('global.hms_divine_battle_active');
				if (!battleActive) {
					return await interaction.editReply({ content: `${EMOJI.FAILURE} No active battle to advance.` });
				}
				await battleUtil.performHMSDivineBattleCycle(interaction.client);
				await interaction.editReply({ content: `${EMOJI.SUCCESS} Battle cycle advanced.` });
			}
			else if (sub === 'set') {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const flagName = `global.${interaction.options.getString('flag')}`;
				const value = interaction.options.getInteger('value');
				await battleUtil.setFlag(flagName, value);
				await interaction.editReply({ content: `${EMOJI.SUCCESS} Set \`${flagName}\` = \`${value}\`` });
			}
			else if (sub === 'end') {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const battleActive = await battleUtil.getFlag('global.hms_divine_battle_active');
				if (!battleActive) {
					return await interaction.editReply({ content: `${EMOJI.FAILURE} No active battle to end.` });
				}
				await battleUtil.endBattle(interaction.client, interaction.guild, 'max_cycles');
				await interaction.editReply({ content: `${EMOJI.SUCCESS} Battle of HMS Divine ended.` });
			}
		}
		catch (error) {
			console.error('[/battle] Error:', error);
			const msg = `${EMOJI.FAILURE} An error occurred: ${error.message}`;
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply({ content: msg }).catch(() => {});
			}
			else {
				await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => {});
			}
		}
	},
};
