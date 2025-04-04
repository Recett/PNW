const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stat')
		.setDescription('Check your stat'),
	async execute(interaction) {
		let characterBase = await ia.client.characterUtil.characterBase(ia.user.id);
		let characterCombatStat = await ia.client.characterUtil.characterId(ia.user.id);
		await ia.embed
	        .setTitle(characterBase.fullmame)
	        .setThumbnail(characterBase.avatar)
	        .addFields(
        		{ name: 'Level', value: characterBase.level },
        		{ name: '\u200B', value: '\u200B' },
        		{ name: 'Hp', value: characterBase.currentHp + '/'+ characterBase.maxHp, inline: true },
        		{ name: 'Stamina', value: characterBase.currentStamina + '/'+ characterBase.maxStamina, inline: true },
				{ name: '\u200B', value: '\u200B', inline: true },
				{ name: 'Str', value: characterBase.currentHp + '/'+ characterBase.maxHp, inline: true },
        		{ name: 'Dex', value: characterBase.currentStamina + '/'+ characterBase.maxStamina, inline: true },
        		{ name: '\u200B', value: '\u200B', inline: true },
        		{ name: 'Agi', value: characterBase.currentHp + '/'+ characterBase.maxHp, inline: true },
        		{ name: 'Con', value: characterBase.currentStamina + '/'+ characterBase.maxStamina, inline: true },
        );
	},
};
