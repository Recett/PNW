const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { CharacterBase, CharacterEquipment, CharacterCombatStat, CharacterAttackStat, CharacterFlag, CharacterItem, CharacterQuest, CharacterRelation, CharacterSetting, CharacterSkill, CharacterStatus, LocationBase, LocationContain } = require('@root/dbObject.js');
const characterUtility = require('@root/utility/characterUtility.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deletechar')
		.setDescription('Delete your character and all associated data.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const userId = interaction.user.id;
			const character = await CharacterBase.findOne({ where: { id: userId } });
			if (!character) {
				return await interaction.editReply({ content: 'Character not found.' });
			}

			// Remove location role before deleting character
			try {
				const currentLocationId = await characterUtility.getCharacterCurrentLocationId(userId);
				if (currentLocationId) {
					const location = await LocationBase.findOne({ where: { id: currentLocationId } });
					if (location && location.role) {
						const member = await interaction.guild.members.fetch(userId);
						try {
							await member.roles.remove(location.role);
						}
						catch {
							// Ignore if role not present or error
						}
					}
				}
			}
			catch (error) {
				console.log('Error removing location role:', error);
				// Continue with character deletion even if role removal fails
			}

			// Delete all related data
			await Promise.all([
				CharacterEquipment.destroy({ where: { character_id: userId } }),
				CharacterCombatStat.destroy({ where: { character_id: userId } }),
				CharacterAttackStat.destroy({ where: { character_id: userId } }),
				CharacterFlag.destroy({ where: { character_id: userId } }),
				CharacterItem.destroy({ where: { character_id: userId } }),
				CharacterQuest.destroy({ where: { character_id: userId } }),
				CharacterRelation.destroy({ where: { character_id: userId } }),
				CharacterSetting.destroy({ where: { character_id: userId } }),
				CharacterSkill.destroy({ where: { character_id: userId } }),
				CharacterStatus.destroy({ where: { character_id: userId } }),
				LocationContain.destroy({ where: { object_id: userId } }),
			]);
			await CharacterBase.destroy({ where: { id: userId } });

			await interaction.editReply({ content: 'Your character and all associated data have been deleted.' });
		}
		catch (error) {
			console.error('Error in deletechar command:', error);
			try {
				if (interaction.deferred) {
					await interaction.editReply({ content: 'An error occurred while deleting your character.' });
				}
				else {
					await interaction.reply({ content: 'An error occurred while deleting your character.', flags: MessageFlags.Ephemeral });
				}
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},
};
