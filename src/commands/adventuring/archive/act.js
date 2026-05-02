const {
	SlashCommandBuilder, InteractionContextType, MessageFlags,
} = require('discord.js');
const { CharacterBase } = require('@root/dbObject.js');
const characterUtil = require('@utility/characterUtility.js');
const battleUtil = require('@utility/battleUtility.js');

const STAMINA_COST = 5;

// Zone tag → objective event mapping
const ZONE_OBJECTIVE_MAP = {
	'arb_cannon_deck':      'hms-spike-guns',
	'arb_armory':           'hms-sever-supply',
	'arb_officer_quarters': 'hms-assassinate-commander',
};

module.exports = {
	data: new SlashCommandBuilder()
		.setName('act')
		.setDescription('Perform a tactical objective in your current zone aboard the enemy vessel.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			const userId = interaction.user.id;

			const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
			if (unregistered === 1) {
				return await interaction.reply({
					content: 'You must complete registration before acting.',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Check battle is active
			const battleActive = await battleUtil.getFlag('global.hms_divine_battle_active');
			if (!battleActive) {
				return await interaction.reply({
					content: 'There is no active battle. This command is only available during the Battle of HMS Divine.',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Check player is in an Arbrance zone
			const arbranceZones = await battleUtil.getArbranceLocations();
			const character = await CharacterBase.findOne({ where: { id: userId } });
			if (!character) {
				return await interaction.reply({ content: 'Character not found.', flags: MessageFlags.Ephemeral });
			}

			const currentZone = arbranceZones.find(z => z.id === character.location_id);
			if (!currentZone) {
				return await interaction.reply({
					content: 'You must be aboard the enemy vessel to use this command.',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Get the zone sub-tag
			const zoneTag = Array.isArray(currentZone.tag)
				? currentZone.tag.find(t => t !== battleUtil.ARBRANCE_TAG)
				: null;

			const objectiveEventId = ZONE_OBJECTIVE_MAP[zoneTag];
			if (!objectiveEventId) {
				return await interaction.reply({
					content: 'There is no special objective available in this zone.',
					flags: MessageFlags.Ephemeral,
				});
			}

			// If in officer quarters, check if commander is already slain
			if (zoneTag === 'arb_officer_quarters') {
				const commanderSlain = await battleUtil.getFlag('global.arb_commander_slain');
				if (commanderSlain === 1) {
					return await interaction.reply({
						content: 'The Arbrance commander has already been dealt with.',
						flags: MessageFlags.Ephemeral,
					});
				}
			}

			// Stamina check
			if ((character.currentStamina || 0) < STAMINA_COST) {
				return await interaction.reply({
					content: `Not enough stamina. You need ${STAMINA_COST} stamina to act (you have ${character.currentStamina || 0}).`,
					flags: MessageFlags.Ephemeral,
				});
			}

			await character.update({ currentStamina: character.currentStamina - STAMINA_COST });

			const eventUtil = interaction.client.eventUtil;
			await eventUtil.processEvent(objectiveEventId, interaction, userId, { ephemeral: false });
		}
		catch (error) {
			console.error('Error in act command:', error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
			}
			else {
				await interaction.editReply({ content: 'An error occurred.' }).catch((editError) => {
					console.error('Failed to edit act error reply:', editError);
				});
			}
		}
	},
};
