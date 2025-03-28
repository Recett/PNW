const { SlashCommandBuilder } = require('discord.js');
const Ultility = require("@utilities.js");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stat')
		.setDescription('Check your stat'),
	async execute(interaction) {
		ia.option.getUser()
		let characterId = await ia.client.characterUtil.characterId(ia.user.id);
		let characterBase = await ia.client.characterUtil.characterId(ia.user.id);
		let characterCombatStat = await ia.client.characterUtil.characterId(ia.user.id);
		let characterId = await ia.client.characterUtil.characterId(ia.user.id);
		await ia.embed
	      .setTitle(characterBase.fullmame)
	      .setThumbnail(characterBase.avatar)
	      .addFields(
        		{ name: 'Level', value: 'Some value here' },
        		{ name: '\u200B', value: '\u200B' },
        		{ name: 'Hp', value: characterBase.currentHp + '/'+ characterBase.maxHp, inline: true },
        		{ name: 'Stamina', value: characterBase.currentStamina + '/'+ characterBase.maxStamina, inline: true },
				{ name: '\u200B', value: '\u200B' },
				{ name: 'Str', value: characterBase.currentHp + '/'+ characterBase.maxHp, inline: true },
        		{ name: 'Dex', value: characterBase.currentStamina + '/'+ characterBase.maxStamina, inline: true },
        		{ name: 'Agi', value: characterBase.currentHp + '/'+ characterBase.maxHp, inline: true },
        		{ name: 'Con', value: characterBase.currentStamina + '/'+ characterBase.maxStamina, inline: true },
      );
	},
};
