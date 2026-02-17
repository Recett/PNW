const { SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { CharacterBase, CharacterEquipment, CharacterCombatStat, CharacterAttackStat, CharacterFlag, CharacterItem, CharacterQuest, CharacterRelation, CharacterSetting, CharacterSkill, CharacterStatus, CharacterThread, LocationBase, LocationContain } = require('@root/dbObject.js');
const characterUtility = require('@root/utility/characterUtility.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deletechar')
		.setDescription('Delete your character and all associated data.')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('(Admin only) The user whose character to delete')
				.setRequired(false))
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			// Check if a user was specified (admin feature)
			const targetUser = interaction.options.getUser('user');
			const userId = targetUser ? targetUser.id : interaction.user.id;

			// If deleting someone else's character, require Administrator permission
			if (targetUser && targetUser.id !== interaction.user.id) {
				const member = await interaction.guild.members.fetch(interaction.user.id);
				if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
					return await interaction.editReply({ content: 'You need Administrator permission to delete another user\'s character.' });
				}
			}

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

			// Delete all character threads (including interview thread)
			try {
				const threads = await CharacterThread.findAll({ 
					where: { character_id: userId } 
				});
				
				for (const threadRecord of threads) {
					if (threadRecord.thread_id) {
						try {
							const thread = await interaction.guild.channels.fetch(threadRecord.thread_id);
							if (thread && thread.isThread()) {
								await thread.delete();
								console.log(`Deleted thread ${threadRecord.thread_id} for user ${userId}`);
							}
						}
						catch (threadError) {
							console.log('Error deleting thread:', threadError.message);
							// Thread might already be deleted or archived, continue anyway
						}
					}
				}
			}
			catch (error) {
				console.log('Error handling thread deletion:', error);
				// Continue with character deletion even if thread deletion fails
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
				CharacterThread.destroy({ where: { character_id: userId } }),
				LocationContain.destroy({ where: { object_id: userId } }),
			]);
			await CharacterBase.destroy({ where: { id: userId } });

			const message = targetUser && targetUser.id !== interaction.user.id
				? `Character for ${targetUser.username} has been deleted.`
				: 'Your character and all associated data have been deleted.';
			
			await interaction.editReply({ content: message });
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
