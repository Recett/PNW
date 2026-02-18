const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { setCharacterSetting, getCharacterSetting } = require('../../utility/characterSettingUtility');

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
			console.log('[Avatar] Retrieved current avatar for', characterId, ':', currentAvatar);
			if (currentAvatar) {
				await interaction.reply({
					embeds: [{
						title: 'Your Current Character Avatar',
						image: { url: currentAvatar },
						color: 0x00bfff,
					}],
					flags: MessageFlags.Ephemeral,
				});
			}
			else {
				await interaction.reply({ content: 'You have not set a character avatar yet. Use `/avatar url:<your_image_url>` to set one.', flags: MessageFlags.Ephemeral });
			}
			return;
		}
		// Validate URL is a valid image URL (allows query parameters like ?size=256)
		if (!/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(url)) {
			await interaction.reply({ content: 'Please provide a valid image URL (jpg, jpeg, png, gif, webp).', flags: MessageFlags.Ephemeral });
			return;
		}
		await setCharacterSetting(characterId, 'avatar', url);
		console.log('[Avatar] Set avatar for', characterId, 'to:', url);
		await interaction.reply({ content: 'Your character avatar has been set!', flags: MessageFlags.Ephemeral });
	},
};
