const {
	SlashCommandBuilder,
	InteractionContextType,
	MessageFlags,
	EmbedBuilder,
	PermissionFlagsBits,
} = require('discord.js');

const PLAYER_COMMANDS = [
	{
		category: '👤 Character',
		commands: [
			'`/character stat` — View your stats and equipped items',
			'`/character inventory` — Browse your inventory',
			'`/character edit` — Edit your name, avatar, and description',
			'`/character allocate` — Spend free stat points',
			'`/character perk list` — View your perks',
			'`/character perk activate` — Activate an available perk',
			'`/character perk deactivate` — Deactivate an equipped perk',
			'`/character delete` — Delete your character',
		],
	},
	{
		category: '🌍 World',
		commands: [
			'`/interact look` — Look around your current location',
			'`/interact move` — Travel to another location',
			'`/interact talk` — Talk with an NPC',
			'`/interact explore` — Explore deeper into the area',
		],
	},
	{
		category: '🔧 General',
		commands: [
			'`/register` — Create a new character',
			'`/item <name>` — Look up item details',
			'`/cook` — Cook food from ingredients',
			'`/trade` — Trade items with another player',
			'`/project` — View or contribute to town projects',
			'`/ping` — Check if the bot is online',
		],
	},
];

const ADMIN_COMMANDS = [
	{
		category: '⚙️ Server Management',
		commands: [
			'`/location` — Manage server locations',
			'`/narrate` — Post a message as the bot',
			'`/setting` — Configure server-wide settings',
			'`/importsheet` — Import game data from Google Sheets',
			'`/cronjob` — Manage scheduled tasks',
		],
	},
	{
		category: '⚔️ Game Management',
		commands: [
			'`/raidmanage` — Manage active raids',
			'`/history <user>` — View a character\'s registration history',
			'`/location duplicate` — Duplicate a location with a different time of day',
		],
	},
	{
		category: '🧪 Testing',
		commands: [
			'`/testnewchar` — Create a test character',
			'`/testcombat` — Test the combat system',
			'`/testraid` — Test a raid encounter',
			'`/diagnose-permissions` — Debug Discord permissions',
		],
	},
];

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

			for (const section of PLAYER_COMMANDS) {
				embed.addFields({ name: section.category, value: section.commands.join('\n') });
			}

			if (isAdmin) {
				embed.addFields({ name: '\u200B', value: '— Admin Commands —' });
				for (const section of ADMIN_COMMANDS) {
					embed.addFields({ name: section.category, value: section.commands.join('\n') });
				}
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
