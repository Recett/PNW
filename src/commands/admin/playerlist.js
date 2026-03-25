const {
	SlashCommandBuilder,
	InteractionContextType,
	MessageFlags,
	EmbedBuilder,
	PermissionFlagsBits,
} = require('discord.js');
const { CharacterBase } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('playerlist')
		.setDescription('List all registered players with their character name and level.')
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const characters = await CharacterBase.findAll({
				attributes: ['id', 'fullname', 'name', 'level'],
				order: [['level', 'DESC']],
			});

			if (!characters.length) {
				return await interaction.editReply({ content: 'No registered characters found.' });
			}

			// Build lines: "Discord ID | Character Name | Lv. X"
			const lines = characters.map((c, i) => {
				const charName = c.fullname || c.name || 'Unknown';
				const lv = c.level ?? 1;
				return `\`${String(i + 1).padStart(3, ' ')}.\` <@${c.id}> — **${charName}** (Lv. ${lv})`;
			});

			// Split into pages of ≤4000 chars to stay within embed description limit
			const pages = [];
			let current = '';
			for (const line of lines) {
				if (current.length + line.length + 1 > 4000) {
					pages.push(current.trimEnd());
					current = '';
				}
				current += line + '\n';
			}
			if (current.trimEnd()) pages.push(current.trimEnd());

			const embeds = pages.map((pageContent, idx) =>
				new EmbedBuilder()
					.setTitle(idx === 0 ? `Player List (${characters.length} characters)` : null)
					.setDescription(pageContent)
					.setColor(0x5865f2),
			);

			return await interaction.editReply({ embeds });
		}
		catch (error) {
			console.error('[playerlist] Error:', error);
			return await interaction.editReply({ content: 'An error occurred while fetching the player list.' });
		}
	},
};
