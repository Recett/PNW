const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong!'),
	async execute(interaction) {
		try {
			await interaction.deferReply();
			await interaction.editReply('Pong!');
		}
		catch (error) {
			console.error('Error in ping command:', error);
			try {
				if (interaction.deferred) {
					await interaction.editReply('An error occurred while processing the ping command.');
				}
				else {
					await interaction.reply({ content: 'An error occurred while processing the ping command.', flags: MessageFlags.Ephemeral });
				}
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},
};
