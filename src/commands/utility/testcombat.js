const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { CharacterBase, MonsterBase } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('testcombat')
		.setDescription('Initiate combat with NPC ID 2 from the database.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			await interaction.deferReply({ ephemeral: true });

			const userId = interaction.user.id;
			const character = await CharacterBase.findOne({ where: { id: userId } });
			if (!character) {
				await interaction.editReply({ content: 'You do not have a character.' });
				return;
			}

			// Find Monster with ID 2
			const monster = await MonsterBase.findOne({ where: { id: 2 } });
			if (!monster) {
				await interaction.editReply({ content: 'Monster with ID 2 not found in the database.' });
				return;
			}

			// Use mainCombat function from combatUtil
			const combatUtil = require('../../utility/combatUtility');
			let result;
			try {
				if (typeof combatUtil.mainCombat === 'function') {
					result = await combatUtil.mainCombat(userId, 2);
				}
				else {
					result = 'Combat logic not implemented.';
				}
			}
			catch (combatError) {
				console.error('Combat error:', combatError);
				result = `Combat failed: ${combatError.message}`;
			}

			await interaction.editReply({
				content: `**Combat initiated with ${monster.name || monster.fullname || 'Unknown Enemy'}!**\n\n${typeof result === 'object' && result.battleReport ? result.battleReport : JSON.stringify(result, null, 2)}`,
			});
		}
		catch (error) {
			console.error('Error in testcombat command:', error);
			try {
				if (interaction.deferred) {
					await interaction.editReply({ content: 'An error occurred while initiating combat.' });
				}
				else {
					await interaction.reply({ content: 'An error occurred while initiating combat.', flags: MessageFlags.Ephemeral });
				}
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},
};
