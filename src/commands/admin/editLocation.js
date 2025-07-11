// editLocation.js
// Command to edit location data for the current channel

const { SlashCommandBuilder } = require('discord.js');
const LocationBase = require('../../models/location/locationBase');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('editlocation')
		.setDescription('Edit location data for the current channel')
		.addStringOption(option =>
			option.setName('name')
				.setDescription('New name for the location')
				.setRequired(false))
		.addStringOption(option =>
			option.setName('type')
				.setDescription('Type of the location')
				.setRequired(false))

		.addBooleanOption(option =>
			option.setName('lock')
				.setDescription('Lock or unlock the location')
				.setRequired(false)),
	async execute(interaction) {
		const channelId = interaction.channel.id;
		const updates = {};
		const name = interaction.options.getString('name');
		const type = interaction.options.getString('type');
		const lock = interaction.options.getBoolean('lock');

		if (name !== null) updates.name = name;
		if (type !== null) updates.type = type;
		if (lock !== null) updates.lock = lock;

		if (Object.keys(updates).length === 0) {
			return interaction.reply({ content: 'No fields to update.', ephemeral: true });
		}

		// Find and update the location by channel id
		const [updatedRows] = await LocationBase.update(updates, {
			where: { channel: channelId }
		});

		if (updatedRows === 0) {
			return interaction.reply({ content: 'No location found for this channel.', ephemeral: true });
		}

		await interaction.reply({ content: 'Location updated successfully.', ephemeral: true });
	},
};
