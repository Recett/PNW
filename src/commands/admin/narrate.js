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
const contentStore = require('@root/contentStore.js');
const configuredChannels = require('@root/config/channels.js');

const DEFAULT_NARRATION_COLOR = 0x2f3136;

function buildNarrationEmbed({ title, text, color }) {
	const embed = new EmbedBuilder()
		.setDescription(text)
		.setColor(color ?? DEFAULT_NARRATION_COLOR);

	if (title) {
		embed.setTitle(title);
	}

	return embed;
}

async function resolveNarrationChannel(interaction, channelKey) {
	if (!channelKey) {
		return { channel: interaction.channel, source: 'current' };
	}

	const matchingEntry = Object.entries(configuredChannels)
		.find(([key]) => key.toLowerCase() === channelKey.toLowerCase());

	if (!matchingEntry) {
		return { error: `Unknown narration channel key \`${channelKey}\`.` };
	}

	const [, channelId] = matchingEntry;
	const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
	if (!channel) {
		return { error: `Unable to fetch configured channel for key \`${channelKey}\`.` };
	}

	return { channel, source: matchingEntry[0] };
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('narrate')
		.setDescription('Send a narration message from a modal or prepared YAML preset.')
		.addStringOption(option =>
			option.setName('preset')
				.setDescription('Prepared narration preset ID from YAML content.')
				.setAutocomplete(true)
				.setRequired(false))
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		const presetId = interaction.options.getString('preset')?.trim();
		if (presetId) {
			await this.executePreset(interaction, presetId);
			return;
		}

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

	async executePreset(interaction, presetId) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		contentStore.reload();
		const preset = contentStore.narrations?.findByPk(String(presetId));
		if (!preset) {
			const availablePresets = contentStore.narrations?.findAll()
				.slice(0, 10)
				.map(entry => entry.id)
				.join(', ');
			const suffix = availablePresets ? ` Available presets: ${availablePresets}` : '';
			await interaction.editReply({ content: `Narration preset \`${presetId}\` was not found.${suffix}` });
			return;
		}

		if (!preset.text) {
			await interaction.editReply({ content: `Narration preset \`${presetId}\` is missing required \`text\` content.` });
			return;
		}

		const { channel, source, error } = await resolveNarrationChannel(interaction, preset.channel);
		if (error || !channel) {
			await interaction.editReply({ content: error || 'Unable to post narration: channel not available.' });
			return;
		}

		const embed = buildNarrationEmbed(preset);
		await channel.send({ embeds: [embed] });

		const locationLabel = source === 'current' ? 'the current channel' : `configured channel \`${source}\``;
		await interaction.editReply({ content: `Posted narration preset \`${preset.id}\` to ${locationLabel}.` });
	},

	/**
	 * Handle the modal submission - send the narration as an embed
	 */
	async autocomplete(interaction) {
		const focusedOption = interaction.options.getFocused(true);
		if (focusedOption.name === 'preset') {
			const query = focusedOption.value.toLowerCase();
			const presets = contentStore.narrations?.findAll() ?? [];
			const filtered = presets
				.filter(p =>
					p.id.toLowerCase().includes(query) ||
					(p.title ?? '').toLowerCase().includes(query),
				)
				.slice(0, 25);
			await interaction.respond(
				filtered.map(p => ({
					name: p.title ? `${p.id} \u2014 ${p.title}` : p.id,
					value: p.id,
				}))
			);
		}
	},

	async handleModal(interaction) {
		const title = interaction.fields.getTextInputValue('narrate_title')?.trim() || 'Narration';
		const text = interaction.fields.getTextInputValue('narrate_text').trim();

		const embed = buildNarrationEmbed({ title, text });

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
