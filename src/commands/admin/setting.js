const { SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { SystemSetting } = require('@root/dbObject.js');

// Define available server-wide settings with their metadata
const SETTINGS_CONFIG = {
	stat_public: {
		name: 'stat_public',
		description: 'Show /stat command publicly by default for all users',
		type: 'boolean',
		default: false,
	},
	inventory_public: {
		name: 'inventory_public',
		description: 'Show /inventory command publicly by default for all users',
		type: 'boolean',
		default: false,
	},
	combat_notifications: {
		name: 'combat_notifications',
		description: 'Enable combat result notifications server-wide',
		type: 'boolean',
		default: true,
	},
	event_logging: {
		name: 'event_logging',
		description: 'Enable detailed event logging',
		type: 'boolean',
		default: false,
	},
};

/**
 * Get a system setting value.
 * @param {string} key - The setting key
 * @returns {Promise<any>} The value or default if not set
 */
async function getSystemSetting(key) {
	const config = SETTINGS_CONFIG[key];
	const record = await SystemSetting.findOne({ where: { key } });
	if (record && record.value !== null) {
		return record.value;
	}
	return config ? config.default : null;
}

/**
 * Set a system setting value.
 * @param {string} key - The setting key
 * @param {any} value - The value to set
 * @param {string} description - Optional description
 */
async function setSystemSetting(key, value, description = null) {
	const config = SETTINGS_CONFIG[key];
	await SystemSetting.upsert({
		key,
		value,
		description: description || (config ? config.description : null),
		updated_at: new Date(),
	});
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setting')
		.setDescription('[Admin] View or modify server-wide settings.')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('View all current server settings'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('set')
				.setDescription('Change a server setting value')
				.addStringOption(option =>
					option.setName('name')
						.setDescription('The setting to change')
						.setRequired(true)
						.addChoices(
							...Object.values(SETTINGS_CONFIG).map(s => ({
								name: `${s.name}`,
								value: s.name,
							})),
						))
				.addStringOption(option =>
					option.setName('value')
						.setDescription('The new value for the setting')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('get')
				.setDescription('View a specific server setting')
				.addStringOption(option =>
					option.setName('name')
						.setDescription('The setting to view')
						.setRequired(true)
						.addChoices(
							...Object.values(SETTINGS_CONFIG).map(s => ({
								name: `${s.name}`,
								value: s.name,
							})),
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('reset')
				.setDescription('Reset a server setting to its default value')
				.addStringOption(option =>
					option.setName('name')
						.setDescription('The setting to reset')
						.setRequired(true)
						.addChoices(
							...Object.values(SETTINGS_CONFIG).map(s => ({
								name: `${s.name}`,
								value: s.name,
							})),
						))),

	// Export for use in other commands
	SETTINGS_CONFIG,
	getSystemSetting,
	setSystemSetting,

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		try {
			switch (subcommand) {
			case 'list': {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });

				const settingsList = [];
				for (const [key, config] of Object.entries(SETTINGS_CONFIG)) {
					const currentValue = await getSystemSetting(key);
					settingsList.push(`**${config.name}**: \`${currentValue}\`\n└ ${config.description}`);
				}

				const embed = {
					title: '⚙️ Server Settings',
					description: settingsList.join('\n\n'),
					color: 0x5865F2,
					footer: { text: 'Use /setting set <name> <value> to change a setting' },
				};

				await interaction.editReply({ embeds: [embed] });
				break;
			}

			case 'set': {
				const settingName = interaction.options.getString('name');
				const rawValue = interaction.options.getString('value').toLowerCase();
				const config = SETTINGS_CONFIG[settingName];

				if (!config) {
					await interaction.reply({
						content: `Unknown setting: \`${settingName}\``,
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				let parsedValue;
				// Validate and parse value based on type
				if (config.type === 'boolean') {
					if (!['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(rawValue)) {
						await interaction.reply({
							content: `Invalid value for \`${settingName}\`. Expected: true/false, yes/no, on/off, or 1/0`,
							flags: MessageFlags.Ephemeral,
						});
						return;
					}
					parsedValue = ['true', '1', 'yes', 'on'].includes(rawValue);
				}
				else if (config.type === 'number') {
					parsedValue = Number(rawValue);
					if (isNaN(parsedValue)) {
						await interaction.reply({
							content: `Invalid value for \`${settingName}\`. Expected a number.`,
							flags: MessageFlags.Ephemeral,
						});
						return;
					}
				}
				else {
					parsedValue = rawValue;
				}

				await setSystemSetting(settingName, parsedValue);
				await interaction.reply({
					content: `✅ Server setting \`${settingName}\` has been set to \`${parsedValue}\``,
					flags: MessageFlags.Ephemeral,
				});
				break;
			}

			case 'get': {
				const settingName = interaction.options.getString('name');
				const config = SETTINGS_CONFIG[settingName];

				if (!config) {
					await interaction.reply({
						content: `Unknown setting: \`${settingName}\``,
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				const currentValue = await getSystemSetting(settingName);

				const embed = {
					title: `⚙️ Server Setting: ${config.name}`,
					description: config.description,
					fields: [
						{ name: 'Current Value', value: `\`${currentValue}\``, inline: true },
						{ name: 'Default', value: `\`${config.default}\``, inline: true },
						{ name: 'Type', value: config.type, inline: true },
					],
					color: 0x5865F2,
				};

				await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
				break;
			}

			case 'reset': {
				const settingName = interaction.options.getString('name');
				const config = SETTINGS_CONFIG[settingName];

				if (!config) {
					await interaction.reply({
						content: `Unknown setting: \`${settingName}\``,
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				await setSystemSetting(settingName, config.default);
				await interaction.reply({
					content: `✅ Server setting \`${settingName}\` has been reset to default: \`${config.default}\``,
					flags: MessageFlags.Ephemeral,
				});
				break;
			}
			}
		}
		catch (error) {
			console.error('Error in setting command:', error);
			const errorMessage = 'An error occurred while managing server settings.';
			if (interaction.deferred) {
				await interaction.editReply({ content: errorMessage });
			}
			else {
				await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
			}
		}
	},
};
