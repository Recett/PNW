const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { syncWithBackup } = require('@utility/migrationUtility.js');
const { EMOJI } = require('@/enums.js');
const path = require('path');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('dbsync')
		.setDescription('Sync database schema from model definitions (backs up first)')
		.setContexts([InteractionContextType.Guild]),

	async execute(interaction) {
		if (!interaction.member.permissions.has('Administrator')) {
			return interaction.reply({
				content: `${EMOJI.FAILURE} This command requires Administrator permission.`,
				flags: MessageFlags.Ephemeral,
			});
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		await interaction.editReply('Backing up database and running schema sync...');

		try {
			const { backupPath, rebuilt } = await syncWithBackup();
			const backupName = path.basename(backupPath);
			let msg = `${EMOJI.SUCCESS} **Schema sync complete.**\nBackup: \`${backupName}\``;
			if (rebuilt.length > 0) {
				msg += `\nAuto-rebuilt tables: ${rebuilt.map(t => `\`${t}\``).join(', ')}`;
			}
			await interaction.editReply(msg);
		}
		catch (error) {
			console.error('dbsync command error:', error);
			await interaction.editReply(
				`${EMOJI.FAILURE} **Sync failed — database restored from backup.**\n` +
				`\`\`\`\n${error.message}\n\`\`\`\n` +
				'If the error repeats, write a migration file and use `/migration run`.',
			);
		}
	},
};

