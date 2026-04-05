const { SlashCommandBuilder, InteractionContextType, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { CharacterBase } = require('@root/dbObject.js');
const characterUtil = require('@utility/characterUtility.js');
const combatUtil = require('@utility/combatUtility.js');
const itemUtility = require('@utility/itemUtility.js');
const { getCharacterSetting } = require('@utility/characterSettingUtility.js');
const { EMOJI } = require('../../enums');

const STAMINA_COST = 2;
const CHALLENGE_TIMEOUT_MS = 60000;

/**
 * Build a combat actor object from a player's current stats.
 * Uses maxHp so the spar starts at full health without modifying the character.
 * @param {string} playerId - Discord user ID of the player
 * @param {string} actorId - Unique ID string used internally by runInitTracker
 * @returns {Object} Actor object for runInitTracker
 */
async function buildPlayerActor(playerId, actorId) {
	const [attacks, combatStats, base] = await Promise.all([
		combatUtil.getAttackStat(playerId),
		combatUtil.getDefenseStat(playerId),
		characterUtil.getCharacterBase(playerId),
	]);

	if (!base) throw new Error(`Character not found for player ${playerId}`);

	const speed = combatStats ? (combatStats.agi || combatStats.agility || 15) : 15;

	return {
		id: actorId,
		name: base.name || 'Unknown',
		hp: base.maxHp ?? 100,
		defense: combatStats?.defense || 0,
		evade: combatStats?.evade || 0,
		critResistance: combatStats?.crit_resistance || 0,
		shieldStrength: 0,
		shieldIsGreatshield: false,
		attacks: await Promise.all((attacks || []).map(async (atk) => {
			let attackName = 'Unarmed';
			let isShield = false;
			let isGreatshield = false;

			if (atk.item_id) {
				const itemDetails = await itemUtility.getItemWithDetails(atk.item_id);
				if (itemDetails) {
					attackName = itemDetails.name;
					if (itemDetails.weapon?.subtype?.toLowerCase() === 'shield') {
						isShield = true;
						if (itemDetails.tag) {
							const tags = Array.isArray(itemDetails.tag) ? itemDetails.tag : [itemDetails.tag];
							isGreatshield = tags.some(t => t?.toLowerCase().includes('greatshield'));
						}
					}
				}
			}

			return {
				id: atk.item_id || atk.id,
				name: attackName,
				speed,
				cooldown: atk.cooldown || 80,
				attack: atk.attack || 0,
				accuracy: atk.accuracy || 0,
				crit: atk.critical || 0,
				isShield,
				isGreatshield,
			};
		})),
	};
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('spar')
		.setDescription('Challenge another player to a friendly sparring match.')
		.setContexts(InteractionContextType.Guild)
		.addUserOption(option =>
			option.setName('target')
				.setDescription('The player to challenge.')
				.setRequired(true)),

	async execute(interaction) {
		const challengerId = interaction.user.id;
		const target = interaction.options.getUser('target');

		try {
			// Self-challenge guard
			if (target.id === challengerId) {
				return await interaction.reply({
					content: 'You cannot spar with yourself.',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Bot guard
			if (target.bot) {
				return await interaction.reply({
					content: 'You cannot spar with a bot.',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Challenger: registration + character
			const challengerUnregistered = await characterUtil.getCharacterFlag(challengerId, 'unregistered');
			if (challengerUnregistered === 1) {
				return await interaction.reply({
					content: 'You must complete registration before sparring.',
					flags: MessageFlags.Ephemeral,
				});
			}

			const challengerChar = await CharacterBase.findOne({ where: { id: challengerId } });
			if (!challengerChar) {
				return await interaction.reply({
					content: 'Character not found.',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Stamina check (upfront)
			if ((challengerChar.currentStamina || 0) < STAMINA_COST) {
				return await interaction.reply({
					content: `Not enough stamina. You need ${STAMINA_COST} stamina to spar (you have ${challengerChar.currentStamina || 0}).`,
					flags: MessageFlags.Ephemeral,
				});
			}

			// Target: character + registration
			const targetChar = await CharacterBase.findOne({ where: { id: target.id } });
			if (!targetChar) {
				return await interaction.reply({
					content: `<@${target.id}> does not have a character.`,
					flags: MessageFlags.Ephemeral,
				});
			}

			const targetUnregistered = await characterUtil.getCharacterFlag(target.id, 'unregistered');
			if (targetUnregistered === 1) {
				return await interaction.reply({
					content: `<@${target.id}> has not completed character registration yet.`,
					flags: MessageFlags.Ephemeral,
				});
			}

			// Same-location check
			if (challengerChar.location_id !== targetChar.location_id) {
				return await interaction.reply({
					content: `You must be in the same location as **${targetChar.name}** to spar.`,
					flags: MessageFlags.Ephemeral,
				});
			}

			// Post challenge message with buttons
			const row = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('spar_accept')
					.setLabel('Accept')
					.setStyle(ButtonStyle.Success),
				new ButtonBuilder()
					.setCustomId('spar_decline')
					.setLabel('Decline')
					.setStyle(ButtonStyle.Danger),
			);

			const challengeMsg = await interaction.reply({
				content: `${EMOJI.SWORD} **${challengerChar.name}** challenges **${targetChar.name}** (<@${target.id}>) to a sparring match! Do you accept?\n*(This challenge expires in 60 seconds.)*`,
				components: [row],
				fetchReply: true,
			});

			const collector = challengeMsg.createMessageComponentCollector({
				componentType: ComponentType.Button,
				time: CHALLENGE_TIMEOUT_MS,
				filter: i => i.user.id === target.id,
				max: 1,
			});

			collector.on('collect', async (i) => {
				if (i.customId === 'spar_decline') {
					await i.deferUpdate();
					await challengeMsg.edit({
						content: `${EMOJI.FAILURE} **${targetChar.name}** declined the sparring challenge.`,
						components: [],
					});
					return;
				}

				// Accepted — deduct stamina and run combat
				await i.deferUpdate();
				await challengeMsg.edit({
					content: `${EMOJI.SWORD} **${challengerChar.name}** vs **${targetChar.name}** — the spar begins!`,
					components: [],
				});

				await challengerChar.update({ currentStamina: challengerChar.currentStamina - STAMINA_COST });

				try {
					const [actor1, actor2] = await Promise.all([
						buildPlayerActor(challengerId, 'challenger'),
						buildPlayerActor(target.id, 'opponent'),
					]);

					const { combatLog, actors } = await combatUtil.runInitTracker(
						[actor1, actor2],
						{ maxTicks: 400 },
					);

					// Use the challenger's combat_log display setting
					const combatLogSetting = await getCharacterSetting(challengerId, 'combat_log') || 'short';
					const reportResult = combatUtil.writeBattleReport(combatLog, actors, null, combatLogSetting);

					const pages = reportResult.pages || [reportResult];
					for (const page of pages) {
						await interaction.followUp({ content: page });
					}
				}
				catch (combatErr) {
					console.error('[Spar] Combat error:', combatErr);
					await interaction.followUp({ content: `${EMOJI.FAILURE} An error occurred during the sparring match.` });
				}
			});

			collector.on('end', async (collected) => {
				if (collected.size === 0) {
					await challengeMsg.edit({
						content: `${EMOJI.WARNING} The sparring challenge from **${challengerChar.name}** to **${targetChar.name}** has expired.`,
						components: [],
					}).catch((editErr) => { console.error('[Spar] Failed to edit challenge message on timeout:', editErr); });
				}
			});
		}
		catch (error) {
			console.error('[Spar] Error:', error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: `${EMOJI.FAILURE} An error occurred.`, flags: MessageFlags.Ephemeral });
			}
			else {
				await interaction.editReply({ content: `${EMOJI.FAILURE} An error occurred.` }).catch((replyErr) => { console.error('[Spar] Reply error:', replyErr); });
			}
		}
	},
};
