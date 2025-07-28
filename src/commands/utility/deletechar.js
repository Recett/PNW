const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { CharacterBase, CharacterEquipment, CharacterCombatStat, CharacterAttackStat, CharacterFlag, CharacterItem, CharacterQuest, CharacterRelation, CharacterSetting, CharacterSkill, CharacterStatus } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('deletechar')
		.setDescription('Delete your character and all associated data.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		const userId = interaction.user.id;
		const character = await CharacterBase.findOne({ where: { id: userId } });
		if (!character) {
			return interaction.reply({ content: 'Character not found.', flags: MessageFlags.Ephemeral });
		}

		// Delete all related data
		const { LocationContain } = require('@root/dbObject.js');
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
			LocationContain.destroy({ where: { object_id: userId } })
		]);
		await CharacterBase.destroy({ where: { id: userId } });

		await interaction.reply({ content: 'Your character and all associated data have been deleted.', flags: MessageFlags.Ephemeral });
	},
};
