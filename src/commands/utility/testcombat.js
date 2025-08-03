const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { CharacterBase, MonsterAbility } = require('@root/dbObject.js');
const monsterAbility = require('../../models/location/monsterAbility');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('testcombat')
		.setDescription('Initiate combat with the first monster found in the database.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		const userId = interaction.user.id;
		const character = await CharacterBase.findOne({ where: { id: userId } });
		if (!character) {
			return interaction.reply({ content: 'You do not have a character.', flags: MessageFlags.Ephemeral });
		}

		const monster = await MonsterAbility.findOne();
		if (!monster) {
			return interaction.reply({ content: 'No monsters found in the database.', flags: MessageFlags.Ephemeral });
		}

		// Use mainCombat function from combatUtil
		const combatUtil = require('../../utility/combatUtility');
		let result;
		if (typeof combatUtil.mainCombat === 'function') {
			result = await combatUtil.mainCombat(userId, monster.monster_id);
		} else {
			result = 'Combat logic not implemented.';
		}

		await interaction.reply({
			content: `Combat initiated with monster: ${monster.name}\nResult: ${result}`,
			flags: MessageFlags.Ephemeral
		});
	},
};
