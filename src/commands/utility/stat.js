const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const characterUtil = require('@utility/characterUtility.js');
const { CharacterEquipment, CharacterCombatStat, CharacterAttackStat } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stat')
		.setDescription("Show your character's stats and equipped items.")
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		const userId = interaction.user.id;
		const character = await characterUtil.getCharacterBase(userId);
		if (!character) {
			return interaction.reply({ content: 'Character not found.', ephemeral: true });
		}

		// Gather base stats
		const stats = [
			`HP: ${character.currentHp}/${character.maxHp}`,
			`Stamina: ${character.currentStamina}/${character.maxStamina}`,
			`STR: ${character.str}`,
			`DEX: ${character.dex}`,
			`AGI: ${character.agi}`,
			`CON: ${character.con}`,
			`Gender: ${character.gender}`,
			`Age: ${character.age}`
		];

		// Get combat stats
		const combatStats = await CharacterCombatStat.findAll({ where: { character_id: userId } });
		let combatList = combatStats.length > 0
			? combatStats.map(stat => `- ${stat.stat_name || stat.name}: ${stat.value}`).join('\n')
			: 'None';

		// Get attack stats
		const attackStats = await CharacterAttackStat.findAll({ where: { character_id: userId } });
		let attackList = attackStats.length > 0
			? attackStats.map(stat => `- ${stat.attack_name || stat.name}: ${stat.value}`).join('\n')
			: 'None';

		// Get equipped items
		const equipment = await CharacterEquipment.findAll({
			where: { character_id: userId, equipped: true },
		});
		let equipList = equipment.length > 0
			? equipment.map(eq => `- ${eq.item_name || eq.itemId || eq.item_id}`).join('\n')
			: 'None';

		const embed = {
			title: `${character.name}'s Stats`,
			description: stats.join('\n'),
			fields: [
				{ name: 'Combat Stats', value: combatList },
				{ name: 'Attack Stats', value: attackList },
				{ name: 'Equipped Items', value: equipList }
			]
		};
		await interaction.reply({ embeds: [embed], ephemeral: true });
	},
};
