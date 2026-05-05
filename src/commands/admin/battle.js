const {
	SlashCommandBuilder, EmbedBuilder, InteractionContextType,
	MessageFlags, PermissionFlagsBits,
} = require('discord.js');
const battleUtil = require('@utility/battleUtility.js');
const { LocationEnemySpawn } = require('@root/dbObject.js');
const { EMOJI } = require('../../enums');

// HMS Top Deck is a hardcoded location ID in battleUtility
const HMS_TOP_DECK_ID = battleUtil.BOONG_TREN_ID;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('battle')
		.setDescription('[Admin] Manage the Battle of HMS Divine event.')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(sub =>
			sub.setName('init')
				.setDescription('Create Arbrance locations, seal the field, and rally players to Living Quarters.'))
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
			sub.setName('reset')
				.setDescription('Reset ship HPs to full, morale to -40, and cycle count to 1 (does not change active/init state).'))
		.addSubcommand(sub =>
			sub.setName('end')
				.setDescription('End the battle immediately, post outcome, and restore all locations.'))
		.addSubcommand(sub =>
			sub.setName('diagnose')
				.setDescription('Dry-run the spawn logic and report what each zone would do, without spawning.'))
		.addSubcommand(sub =>
			sub.setName('forcespawn')
				.setDescription('Immediately trigger one encounter spawn cycle.'))
		.addSubcommand(sub =>
			sub.setName('reseed-spawns')
				.setDescription('Wipe and reinsert location_enemy_spawns rows with corrected weights (fixes man-at-arms rate).'))
		.addSubcommand(sub =>
			sub.setName('reset-armory')
				.setDescription('Reset armory wave state: cancel timer, clear flags, destroy pending wave encounters.'))
		.addSubcommand(sub =>
			sub.setName('stop-armory')
				.setDescription('Stop the armory wave timer and destroy pending wave encounters (does not reset progress flags).')),



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
				await battleUtil.relocateNpcsForBattle();
				await battleUtil.assignPlayersToZones(interaction.guild);

				const allCreated = [...syncArbResult.created, ...syncHmsResult.created];
				const allFailed = [...syncArbResult.failed, ...syncHmsResult.failed];

				const syncSummary = allCreated.length > 0
					? `\nDiscord synced: ${allCreated.join(', ')}`
					: '\nDiscord channels/roles already up to date.';
				const failSummary = allFailed.length > 0
					? `\n${EMOJI.FAILURE} Sync failed for: ${allFailed.join(', ')}`
					: '';

				await interaction.editReply({
					content: `${EMOJI.SUCCESS} Arbrance locations created and sealed. Players rallied to Living Quarters.${syncSummary}${failSummary}\nRun \`/battle start\` to begin the battle.`,
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
								`Mustering: **${state.mustering ? `YES (${state.readyCount} ready)` : 'NO'}**`,
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
							name: 'HMS Outcome',
							value: [
								`Sunk: **${state.hmsSunk ? 'YES' : 'NO'}**`,
								`Supply Loss: **${state.hmsSupplyLoss}**`,
							].join('\n'),
							inline: true,
						},
						{
							name: 'Armory Wave',
							value: [
								`Secured: **${state.armorySecured ? 'YES' : 'NO'}**`,
								`Wins: **${state.armoryWins}**`,
								`Budget: **${state.armoryBudget}**`,
								`Wave ID: **${state.armoryWaveCounter}**`,
								`Active Encounters: **${state.armoryWaveEncounters.length}**`,
								...state.armoryWaveEncounters.map(e =>
									`\u2022 <@${e.target_player_id}> vs \`${e.enemy_id}\` \u2014 ${e.status}`),
							].join('\n'),
							inline: false,
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
			else if (sub === 'diagnose') {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const lines = await battleUtil.diagnoseSpawn(interaction.guild);
				const embed = new EmbedBuilder()
					.setTitle('Spawn Diagnose')
					.setDescription(lines.join('\n'))
					.setColor(0x3498db);
				await interaction.editReply({ embeds: [embed] });
			}
			else if (sub === 'forcespawn') {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const battleActive = await battleUtil.getFlag('global.hms_divine_battle_active');
				if (!battleActive) {
					return await interaction.editReply({ content: `${EMOJI.FAILURE} No active battle.` });
				}
				await battleUtil.spawnEncounters(interaction.guild);
				await interaction.editReply({ content: `${EMOJI.SUCCESS} Encounter spawn cycle triggered.` });
			}
			else if (sub === 'reseed-spawns') {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });

				// Corrected spawn weights — HMS zones are beginner areas
				const SPAWN_TEMPLATE = [
					// ARB Main Deck
					{ locationId: String(battleUtil.ARB_MAIN_DECK_ID), enemy_base_id: 'boarder', spawn_chance: 30 },
					{ locationId: String(battleUtil.ARB_MAIN_DECK_ID), enemy_base_id: 'veteran_sailor', spawn_chance: 25 },
					{ locationId: String(battleUtil.ARB_MAIN_DECK_ID), enemy_base_id: 'sailor', spawn_chance: 20 },
					{ locationId: String(battleUtil.ARB_MAIN_DECK_ID), enemy_base_id: 'man_at_arms', spawn_chance: 15 },
					{ locationId: String(battleUtil.ARB_MAIN_DECK_ID), enemy_base_id: 'crossbowman', spawn_chance: 10 },
					// ARB Cannon Deck
					{ locationId: String(battleUtil.ARB_CANNON_DECK_ID), enemy_base_id: 'boarder', spawn_chance: 45 },
					{ locationId: String(battleUtil.ARB_CANNON_DECK_ID), enemy_base_id: 'man_at_arms', spawn_chance: 35 },
					{ locationId: String(battleUtil.ARB_CANNON_DECK_ID), enemy_base_id: 'veteran_sailor', spawn_chance: 20 },
					// ARB Officer Quarters
					{ locationId: String(battleUtil.ARB_OFFICER_QUARTERS_ID), enemy_base_id: 'man_at_arms', spawn_chance: 50 },
					{ locationId: String(battleUtil.ARB_OFFICER_QUARTERS_ID), enemy_base_id: 'veteran_sailor', spawn_chance: 35 },
					{ locationId: String(battleUtil.ARB_OFFICER_QUARTERS_ID), enemy_base_id: 'boarder', spawn_chance: 15 },
					// ARB Rigging
					{ locationId: String(battleUtil.ARB_RIGGING_ID), enemy_base_id: 'cutthroat', spawn_chance: 30 },
					{ locationId: String(battleUtil.ARB_RIGGING_ID), enemy_base_id: 'veteran_sailor', spawn_chance: 25 },
					{ locationId: String(battleUtil.ARB_RIGGING_ID), enemy_base_id: 'swashbuckler', spawn_chance: 25 },
					{ locationId: String(battleUtil.ARB_RIGGING_ID), enemy_base_id: 'crossbowman', spawn_chance: 20 },
					// HMS Rigging — beginner area
					{ locationId: String(battleUtil.HMS_RIGGING_ID), enemy_base_id: 'cutthroat', spawn_chance: 55 },
					{ locationId: String(battleUtil.HMS_RIGGING_ID), enemy_base_id: 'sailor', spawn_chance: 35 },
					{ locationId: String(battleUtil.HMS_RIGGING_ID), enemy_base_id: 'swashbuckler', spawn_chance: 10 },
					// HMS Top Deck — beginner area (hardcoded ID)
					{ locationId: String(HMS_TOP_DECK_ID), enemy_base_id: 'sailor', spawn_chance: 55 },
					{ locationId: String(HMS_TOP_DECK_ID), enemy_base_id: 'boarder', spawn_chance: 30 },
					{ locationId: String(HMS_TOP_DECK_ID), enemy_base_id: 'veteran_sailor', spawn_chance: 10 },
					{ locationId: String(HMS_TOP_DECK_ID), enemy_base_id: 'man_at_arms', spawn_chance: 5 },
				];

				const rows = SPAWN_TEMPLATE.map(r => ({
					location_id: r.locationId,
					enemy_base_id: r.enemy_base_id,
					spawn_chance: r.spawn_chance,
					is_boss: false,
				}));

				const deleted = await LocationEnemySpawn.destroy({ where: {} });
				await LocationEnemySpawn.bulkCreate(rows);

				const lines = [
					`Deleted: **${deleted}** old rows`,
					`Inserted: **${rows.length}** rows`,
				];

				await interaction.editReply({ content: lines.join('\n') });
			}
			else if (sub === 'reset') {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const ts = Math.floor(Date.now() / 1000);
				await Promise.all([
					// Ship HP
					battleUtil.setFlag('global.hms_divine_top_deck_hp', 400),
					battleUtil.setFlag('global.hms_divine_cannon_deck_hp', 300),
					battleUtil.setFlag('global.hms_divine_rigging_hp', 300),
					battleUtil.setFlag('global.arb_main_deck_hp', 800),
					battleUtil.setFlag('global.arb_cannon_deck_hp', 450),
					battleUtil.setFlag('global.arb_rigging_hp', 250),
					// Battle state
					battleUtil.setFlag('global.hms_divine_morale', -40),
					battleUtil.setFlag('global.hms_divine_cycle_count', 0),
					battleUtil.setFlag('global.hms_divine_phase_start_ts', ts),
					battleUtil.setFlag('global.hms_divine_sunk', 0),
					battleUtil.setFlag('global.hms_divine_supply_loss', 0),
					battleUtil.setFlag('hms_divine_drain_reduction', 0),
					// Cannon countdown: reset to 12
					battleUtil.setFlag('global.hms_divine_cannon_countdown', 12),
					// Arbrance state
					battleUtil.setFlag('global.arb_main_deck_foothold', 0),
					// Armory state
					battleUtil.setFlag('global.arb_armory_wins', 0),
					battleUtil.setFlag('global.arb_armory_secured', 0),
					battleUtil.setFlag('global.arb_armory_budget_x10', 10),
					battleUtil.setFlag('global.arb_armory_wave_counter', 0),
				]);
				await interaction.editReply({
					content: [
						`${EMOJI.SUCCESS} Battle state reset:`,
						'HMS Divine \u2014 Top Deck: 400, Cannon Deck: 300, Rigging: 300',
						'Arbrance \u2014 Main Deck: 800, Cannon Deck: 450, Rigging: 250',
						'Morale: -40 | Cycle: 0 | Sunk: 0 | Supply Loss: 0',
						'Cannon countdown: 12.',
						'Arb commander, foothold, armory progress all cleared.',
					].join('\n'),
				});
			}
			else if (sub === 'reset-armory') {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				await battleUtil.resetArmoryState(interaction.client);
				await interaction.editReply({ content: `${EMOJI.SUCCESS} Armory state reset: flags cleared, pending wave encounters removed, timer restarted from wave 1.` });
			}
			else if (sub === 'stop-armory') {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				await battleUtil.stopArmoryWave();
				await interaction.editReply({ content: `${EMOJI.SUCCESS} Armory wave stopped: timer cancelled, pending wave encounters removed. Progress flags preserved.` });
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
				await interaction.editReply({ content: msg }).catch(err => console.error('[/battle] reply error:', err));
			}
			else {
				await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(err => console.error('[/battle] reply error:', err));
			}
		}
	},
};
