const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder } = require('discord.js');
const { LocationBase } = require('@root/dbObject.js');

// Helper to create a role
async function createLocationRole(guild, name) {
	return guild.roles.create({
		name,
		mentionable: true,
	});
}

// Helper to create a channel
async function createLocationChannel(guild, channelName, parentId, permissionOverwrites) {
	return guild.channels.create({
		name: channelName,
		parent: parentId,
		permissionOverwrites,
	});
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('newlocation')
		.setDescription('Create new location!')
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setContexts(InteractionContextType.Guild)
		.addStringOption(option =>
			option
				.setName('name')
				.setDescription('Location Name')
				.setRequired(true)),

	async execute(interaction) {
		let tlg = require('@/data/tlg.json');
		const guild = interaction.client.guilds.resolve(tlg.id);
		const name = interaction.options.getString('name', true);
		const channelName = name.split(/ +/).join('-').toLowerCase();
		let role, channel;
		try {
			// Create role
			role = await createLocationRole(guild, name);

			// Create channel
			const parentChannel = guild.channels.resolve(tlg.alCat);
			if (!parentChannel) throw new Error('Parent category not found.');
			channel = await createLocationChannel(
				guild,
				channelName,
				tlg.alCat,
				parentChannel.permissionOverwrites.cache,
			);

			// Set permissions for the new role
			await channel.permissionOverwrites.create(role, tlg.permissions.textRole);

			// Initial reply to avoid editReply before reply
			await interaction.reply({ content: 'Creating location...', ephemeral: true });
		}
		catch (error) {
			// Cleanup if role was created but something failed
			if (role && interaction.client.util.role(interaction.guild, role.id)) {
				await role.delete().catch(() => undefined);
			}
			interaction.client.error(error);
			if (interaction.replied) {
				await interaction.editReply('...oops, seems like there is an error. Creation incomplete.');
				return interaction.followUp(`\u0060\u0060\u0060\n${error}\n\u0060\u0060\u0060`);
			}
			else {
				return interaction.reply({ content: '...oops, seems like there is an error. Creation incomplete.' });
			}
		}

		const newLocation = {
			name: name,
			channel: channel.id,
			role: role.id,
			lock: false,
		};

		await LocationBase.create(newLocation);

		const embed = new EmbedBuilder()
			.setTitle(name)
			.setDescription('Location creation completed. Here are the initial details of the camp:');

		await interaction.editReply({ embeds: [embed] });
	},
};
