const { SlashCommandBuilder, InteractionContextType, MessageFlags, EmbedBuilder } = require('discord.js');
const { CharacterBase } = require('@root/dbObject.js');
const { setCharacterSetting, getCharacterSetting } = require('@utility/characterSettingUtility.js');

const SETTINGS = [
	{
		key: 'combat_log',
		label: 'Combat Log',
		description: 'How much detail to show in combat reports.',
		choices: [
			{ name: 'Short — truncate middle of long fights (default)', value: 'short' },
			{ name: 'Long — show full log, paginated', value: 'long' },
		],
		default: 'short',
	},
];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('settings')
		.setDescription('View or change your personal preferences.')
		.setContexts(InteractionContextType.Guild)
		.addStringOption(option =>
			option
				.setName('combat_log')
				.setDescription('How much detail to show in combat reports.')
				.addChoices(
					{ name: 'Short — truncate middle of long fights (default)', value: 'short' },
					{ name: 'Long — show full log, paginated', value: 'long' },
				),
		),

	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		const userId = interaction.user.id;
		const character = await CharacterBase.findOne({ where: { id: userId } });
		if (!character) {
			await interaction.editReply({ content: 'You do not have a character.' });
			return;
		}

		const combatLogValue = interaction.options.getString('combat_log');

		// If any option was provided, apply changes
		if (combatLogValue !== null) {
			await setCharacterSetting(userId, 'combat_log', combatLogValue);
		}

		// Read current values and display
		const lines = [];
		for (const setting of SETTINGS) {
			const current = await getCharacterSetting(userId, setting.key) || setting.default;
			const choiceLabel = setting.choices.find(c => c.value === current)?.name ?? current;
			lines.push(`**${setting.label}:** ${choiceLabel}`);
		}

		const changed = combatLogValue !== null;
		const embed = new EmbedBuilder()
			.setTitle(changed ? 'Settings Updated' : 'Your Settings')
			.setDescription(lines.join('\n'))
			.setColor(changed ? 0x57F287 : 0x5865F2);

		await interaction.editReply({ embeds: [embed] });
	},
};
