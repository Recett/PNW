const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const { LocationBase } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('narrate')
		.setDescription('Narrate event!')
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setContexts(InteractionContextType.Guild)
		.addStringOption(option =>
			option
				.setName('event_id')
				.setDescription('Event ID')
				.setRequired(true)),

	async execute(interaction) {
		const eventId = interaction.options.getString('event_id');
		const collectorFilter = i => i.user.id === interaction.user.id;
		let eventBase = await interaction.client.eventUtil.getEventBase(eventId);
		if (!eventId) {
			return interaction.reply({ content: 'Please provide a valid event ID.', ephemeral: true });
		};
		// Add resolution to description
		do {
			let title = `${eventBase.title}`;
			let description = `${eventBase.text}`;

			const embed = { title: title, description: description };
			let response = await interaction.reply({ embeds: [embed] });

			if (eventBase.default_child_event_id != 'end') {
				let childEvent = await interaction.client.eventUtil.getEventBase(eventBase.default_child_event_id);
				if (childEvent) {
					eventBase = childEvent;
				}
				else {
					return interaction.followUp({ content: 'No further child event found.', ephemeral: true });
				}
			}
		}
		while (eventBase.default_child_event_id != 'end');
	},
};
