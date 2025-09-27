const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('server')
		.setDescription('Provides information about the server.'),
	async execute(interaction) {
		try {
			await interaction.deferReply();
			// interaction.guild is the object representing the Guild in which the command was run
			await interaction.editReply(`This server is ${interaction.guild.name} and has ${interaction.guild.memberCount} members.`);
		}
		catch (error) {
			console.error('Error in server command:', error);
			try {
				if (interaction.deferred) {
					await interaction.editReply('An error occurred while retrieving server information.');
				}
				else {
					await interaction.reply({ content: 'An error occurred while retrieving server information.', flags: MessageFlags.Ephemeral });
				}
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},
};
