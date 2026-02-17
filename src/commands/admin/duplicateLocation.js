const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags } = require('discord.js');
const { LocationBase } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('duplicatelocation')
		.setDescription('Duplicate a location with a different time of day')
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setContexts(InteractionContextType.Guild)
		.addStringOption(option =>
			option
				.setName('location')
				.setDescription('Location ID or name to duplicate')
				.setRequired(true))
		.addStringOption(option =>
			option
				.setName('time')
				.setDescription('Time of day for the new version')
				.setRequired(true)
				.addChoices(
					{ name: 'Morning (6am-2pm)', value: 'morning' },
					{ name: 'Afternoon (2pm-10pm)', value: 'afternoon' },
					{ name: 'Night (10pm-6am)', value: 'night' },
				))
		.addStringOption(option =>
			option
				.setName('description')
				.setDescription('Optional: Override description for this time version')
				.setRequired(false)),

	async execute(interaction) {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const locationInput = interaction.options.getString('location', true);
			const timeOfDay = interaction.options.getString('time', true);
			const customDescription = interaction.options.getString('description', false);

			// Find the source location by ID or name
			let sourceLocation;
			if (!isNaN(locationInput)) {
				// Input is a number, treat as ID
				sourceLocation = await LocationBase.findOne({ where: { id: parseInt(locationInput) } });
			}
			else {
				// Input is a string, treat as name
				sourceLocation = await LocationBase.findOne({ where: { name: locationInput } });
			}

			if (!sourceLocation) {
				return await interaction.editReply({ content: `Location not found: ${locationInput}` });
			}

			// Check if a version with this time already exists for this channel
			const existingTimeVersion = await LocationBase.findOne({
				where: {
					channel: sourceLocation.channel,
					time: timeOfDay,
				},
			});

			if (existingTimeVersion) {
				return await interaction.editReply({
					content: `A ${timeOfDay} version already exists for this location (ID: ${existingTimeVersion.id}).\nUse /editlocation to modify it instead.`,
				});
			}

			// Create the duplicate with the specified time
			const newLocation = await LocationBase.create({
				name: sourceLocation.name,
				channel: sourceLocation.channel,
				description: customDescription || sourceLocation.description,
				type: sourceLocation.type,
				role: sourceLocation.role,
				lock: sourceLocation.lock,
				tag: sourceLocation.tag,
				time: timeOfDay,
			});

			// Create success embed
			const embed = new EmbedBuilder()
				.setTitle('✅ Location Duplicated')
				.setColor(0x00FF00)
				.addFields(
					{ name: 'New Location ID', value: `${newLocation.id}`, inline: true },
					{ name: 'Time of Day', value: timeOfDay, inline: true },
					{ name: 'Name', value: newLocation.name, inline: false },
					{ name: 'Channel', value: `<#${newLocation.channel}>`, inline: true },
					{ name: 'Source ID', value: `${sourceLocation.id}`, inline: true },
				)
				.setDescription('The location has been duplicated. Note: LocationContain (NPCs/enemies), LocationLink, and other junction tables were NOT copied. You can add them manually using other commands.');

			await interaction.editReply({ embeds: [embed] });
		}
		catch (error) {
			interaction.client.error(error);
			const errorMessage = `Error duplicating location: ${error.message}`;
			if (interaction.deferred) {
				return await interaction.editReply({ content: errorMessage });
			}
			else {
				return await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
			}
		}
	},
};
