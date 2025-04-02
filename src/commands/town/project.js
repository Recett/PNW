const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('town-project')
		.setDescription('Invest in a project'),
	async execute(interaction) {
		let characterId = await ia.client.characterUtil.characterId(ia.user.id);
		let characterBase = await ia.client.characterUtil.characterBase(characterId);
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
