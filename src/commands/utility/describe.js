const { SlashCommandBuilder } = require('discord.js');
const { setCharacterSetting, getCharacterSetting } = require('../../utility/characterSettingUtility');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('describe')
		.setDescription('Set or view your character description.')
		.addStringOption(option =>
			option.setName('text')
				.setDescription('The description text for your character')
				.setRequired(false)),

	async execute(interaction) {
		const characterId = interaction.user.id;
		const text = interaction.options.getString('text');
		if (!text) {
			const desc = await getCharacterSetting(characterId, 'description');
			if (desc) {
				await interaction.reply({ content: `Your current character description:\n${desc}`, flags: MessageFlags.Ephemeral });
			}
			else {
				await interaction.reply({ content: 'You have not set a character description yet. Use `/describe text:<your description>` to set one.', flags: MessageFlags.Ephemeral });
			}
			return;
		}
		await setCharacterSetting(characterId, 'description', text);
		await interaction.reply({ content: 'Your character description has been updated!', flags: MessageFlags.Ephemeral });
	},
};
