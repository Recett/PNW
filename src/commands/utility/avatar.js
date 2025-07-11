const { SlashCommandBuilder } = require('discord.js');
const { setCharacterSetting } = require('../../utility/characterSettingUtility');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('avatar')
		.setDescription('Set your character avatar image URL.')
		.addStringOption(option =>
			option.setName('url')
				.setDescription('The URL of your avatar image')
				.setRequired(false)),

	async execute(interaction) {
		const characterId = interaction.user.id;
		const url = interaction.options.getString('url');
		if (!url) {
			const currentAvatar = await getCharacterSetting(characterId, 'avatar');
			if (currentAvatar) {
				await interaction.reply({
					embeds: [{
						title: 'Your Current Character Avatar',
						image: { url: currentAvatar },
						color: 0x00bfff,
					}],
					ephemeral: true,
				});
			} else {
				await interaction.reply({ content: 'You have not set a character avatar yet. Use `/avatar url:<your_image_url>` to set one.', ephemeral: true });
			}
			return;
		}
		// Optionally: Validate URL is a valid image URL (basic check)
		if (!/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(url)) {
			await interaction.reply({ content: 'Please provide a valid image URL (jpg, jpeg, png, gif, webp).', ephemeral: true });
			return;
		}
		await setCharacterSetting(characterId, 'avatar', url);
		await interaction.reply({ content: `Your character avatar has been set!`, ephemeral: true });
	},
};
