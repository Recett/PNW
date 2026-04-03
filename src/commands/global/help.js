const {
	SlashCommandBuilder,
	InteractionContextType,
	MessageFlags,
	EmbedBuilder,
	PermissionFlagsBits,
	ApplicationCommandOptionType,
} = require('discord.js');

// Layout config — add a command name here when a new command is created.
// Descriptions are pulled automatically from the SlashCommandBuilder definitions.
const COMMAND_LAYOUT = [
	// ── Player sections ─────────────────────────────────────────────────────
	{ category: '👤 Character', admin: false, commands: ['character'] },
	{ category: '🌍 World', admin: false, commands: ['interact'] },
	{ category: '⚔️ Activities', admin: false, commands: ['hunt', 'raid'] },
	{ category: '🔧 General', admin: false, commands: ['register', 'item', 'trade', 'project', 'ping'] },
	// ── Admin sections ───────────────────────────────────────────────────────
	{ category: '⚙️ Server Management', admin: true, commands: ['location', 'narrate', 'setting', 'cronjob', 'task', 'monitor', 'dbsync'] },
	{ category: '⚔️ Game Management', admin: true, commands: ['raidmanage', 'playerlist', 'history'] },
	{ category: '🧪 Testing', admin: true, commands: ['testnewchar', 'testcombat', 'testraid', 'diagnose-permissions'] },
];

/**
 * Builds the display lines for a command by reading its SlashCommandBuilder JSON.
 * Subcommands and subcommand groups are enumerated; plain commands produce one line.
 */
function buildCommandLines(name, data) {
	const json = data.toJSON();
	const subs = (json.options ?? []).filter(o =>
		o.type === ApplicationCommandOptionType.Subcommand ||
		o.type === ApplicationCommandOptionType.SubcommandGroup,
	);

	if (subs.length === 0) {
		return [`\`/${name}\` — ${json.description}`];
	}

	const lines = [];
	for (const sub of subs) {
		if (sub.type === ApplicationCommandOptionType.SubcommandGroup) {
			for (const inner of sub.options ?? []) {
				lines.push(`\`/${name} ${sub.name} ${inner.name}\` — ${inner.description}`);
			}
		}
		else {
			lines.push(`\`/${name} ${sub.name}\` — ${sub.description}`);
		}
	}
	return lines;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('View available commands.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

			const embed = new EmbedBuilder()
				.setTitle(isAdmin ? '📖 Help — All Commands' : '📖 Help')
				.setColor(0x5865f2)
				.setDescription(
					isAdmin
						? 'Showing all commands including admin functions.'
						: 'Use `/help` to see this list any time.',
				)
				.setFooter({ text: isAdmin ? 'Admin commands are shown below.' : 'Admin commands are hidden.' });

			let adminSeparatorAdded = false;

			for (const section of COMMAND_LAYOUT) {
				if (section.admin && !isAdmin) continue;

				const lines = [];
				for (const name of section.commands) {
					const command = interaction.client.commands.get(name);
					if (!command) continue;
					lines.push(...buildCommandLines(name, command.data));
				}

				if (lines.length === 0) continue;

				if (section.admin && !adminSeparatorAdded) {
					embed.addFields({ name: '\u200B', value: '— Admin Commands —' });
					adminSeparatorAdded = true;
				}

				embed.addFields({ name: section.category, value: lines.join('\n') });
			}

			await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
		}
		catch (error) {
			console.error('Error in help command:', error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
			}
		}
	},
};
