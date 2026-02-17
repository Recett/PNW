const {
	SlashCommandBuilder,
	InteractionContextType,
	MessageFlags,
	EmbedBuilder,
} = require('discord.js');
const characterSettingUtil = require('../../utility/characterSettingUtility');
const { CharacterBase } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('history')
		.setDescription('View your character\'s registration history and original choices.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const userId = interaction.user.id;

			// Check if character exists
			const character = await CharacterBase.findOne({ where: { id: userId } });
			if (!character) {
				return await interaction.editReply({
					content: 'You do not have a registered character. Use `/register` to create one.',
				});
			}

			// Get registration record
			const recordJson = await characterSettingUtil.getCharacterSetting(userId, 'registration_record');

			if (!recordJson) {
				return await interaction.editReply({
					content: 'No registration history found. Your character may have been created before registration tracking was implemented.',
				});
			}

			const record = JSON.parse(recordJson);

			// Build embed with registration history
			const registrationDate = new Date(record.completionTime || record.startTime).toLocaleDateString();
			const embed = new EmbedBuilder()
				.setTitle('📜 Registration History')
				.setDescription(`Original choices made during **${character.name}**'s registration interview.`)
				.setColor(0x9b59b6)
				.setThumbnail(character.avatar || interaction.user.displayAvatarURL())
				.setFooter({ text: `Registered on ${registrationDate}` });

			// Add event path summary
			const pathSummary = `Visited ${record.eventPath.length} events\nMade ${record.choices.length} choices`;
			embed.addFields({ name: '🗺️ Interview Path', value: pathSummary, inline: false });

			// Add virtue values
			const virtueText = [
				`**Fortitude:** ${record.virtueStats.F}`,
				`**Justice:** ${record.virtueStats.J}`,
				`**Prudence:** ${record.virtueStats.P}`,
				`**Temperance:** ${record.virtueStats.T}`,
				`**Total:** ${record.virtueStats.F + record.virtueStats.J + record.virtueStats.P + record.virtueStats.T}/24`,
			].join('\n');

			embed.addFields({ name: '🛡️ Cardinal Virtues', value: virtueText, inline: false });

			// Add starter weapon from final flags
			const starterKey = Object.keys(record.allFlags).find(key => key.toLowerCase().startsWith('starter_'));
			if (starterKey) {
				const weaponName = starterKey
					.replace('starter_', '')
					.replace(/_/g, ' ')
					.replace(/\b\w/g, l => l.toUpperCase()); // Capitalize each word
				embed.addFields({ name: '⚔️ Starter Weapon', value: weaponName, inline: true });
			}

			// Show choice summary
			const virtueChoices = record.choices.filter(c => 
				['Fortitude', 'Justice', 'Prudence', 'Temperance'].includes(c.flagName)
			);
			if (virtueChoices.length > 0) {
				const choicesSummary = `Made ${virtueChoices.length} virtue-affecting choices throughout the interview.`;
				embed.addFields({ name: '📝 Choices Made', value: choicesSummary, inline: false });
			}

			await interaction.editReply({ embeds: [embed] });
		}
		catch (error) {
			console.error('Error in history command:', error);
			try {
				await interaction.editReply({
					content: 'An error occurred while retrieving your registration history.',
				});
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},
};
