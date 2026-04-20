const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { CharacterBase } = require('@root/dbObject.js');
const eventUtil = require('@utility/eventUtility.js');
const { EMOJI } = require('../../enums');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('unstuck')
		.setDescription('Clear your current event lock if an interaction got stuck.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const character = await CharacterBase.findOne({ where: { id: interaction.user.id } });
		if (!character) {
			return interaction.editReply({
				content: `${EMOJI.FAILURE} You do not have a registered character.`,
			});
		}

		const { wasLocked } = eventUtil.unlockCharacter(interaction.user.id);

		if (wasLocked) {
			return interaction.editReply({
				content: `${EMOJI.SUCCESS} Your active event lock has been cleared. You can try the interaction again.`,
			});
		}

		return interaction.editReply({
			content: `${EMOJI.WARNING} You were not locked in any active event.`,
		});
	},
};