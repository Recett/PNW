const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	InteractionContextType,
	MessageFlags,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	EmbedBuilder,
} = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('narrate')
		.setDescription('Send a narration message with a modal input.')
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		// Build the narration modal
		const modal = new ModalBuilder()
			.setCustomId('narrate_modal')
			.setTitle('Narration');

		// Title input (optional)
		const titleInput = new TextInputBuilder()
			.setCustomId('narrate_title')
			.setLabel('Title (optional)')
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('Enter a title for the narration...')
			.setRequired(false)
			.setMaxLength(256);

		// Text input (required, paragraph style for long text)
		const textInput = new TextInputBuilder()
			.setCustomId('narrate_text')
			.setLabel('Narration Text')
			.setStyle(TextInputStyle.Paragraph)
			.setPlaceholder('Enter your narration text here...')
			.setRequired(true)
			.setMaxLength(4000);

		modal.addComponents(
			new ActionRowBuilder().addComponents(titleInput),
			new ActionRowBuilder().addComponents(textInput),
		);

		await interaction.showModal(modal);
	},

	/**
	 * Handle the modal submission - send the narration as an embed
	 */
	async handleModal(interaction) {
		const title = interaction.fields.getTextInputValue('narrate_title')?.trim() || 'Narration';
		const text = interaction.fields.getTextInputValue('narrate_text').trim();

		const embed = new EmbedBuilder()
			.setTitle(title)
			.setDescription(text)
			.setColor(0x2f3136);

		// Acknowledge privately, then post as a regular bot message to avoid slash command attribution.
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		if (!interaction.channel) {
			await interaction.editReply({ content: 'Unable to post narration: channel not available.' });
			return;
		}

		await interaction.channel.send({ embeds: [embed] });
		await interaction.deleteReply();
	},
};
