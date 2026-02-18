const { SlashCommandBuilder, InteractionContextType, MessageFlags, AttachmentBuilder } = require('discord.js');
const characterUtil = require('@utility/characterUtility.js');
const { generateStatCard } = require('@utility/imageGenerator.js');

/**
 * Creates a colored progress bar using emoji squares
 * @param {number} current - Current value
 * @param {number} max - Maximum value
 * @param {string} type - 'hp' for gradient colors, 'stamina' for blue
 * @param {number} length - Bar length in segments (default: 8)
 * @returns {string} Formatted bar string with value
 */
function createColorBar(current, max, type = 'hp', length = 8) {
	if (max == null || max <= 0) return '- / -';
	const curr = current ?? 0;
	const percent = Math.max(0, Math.min(100, (curr / max) * 100));
	const filled = Math.min(length, Math.floor((percent / 100) * length));
	const empty = length - filled;

	let filledEmoji;
	if (type === 'stamina') {
		filledEmoji = '🟦';
	}
	else if (percent > 50) {
		filledEmoji = '🟩';
	}
	else if (percent > 25) {
		filledEmoji = '🟨';
	}
	else {
		filledEmoji = '🟥';
	}

	return `${filledEmoji.repeat(filled)}${'⬛'.repeat(empty)} ${curr}/${max}`;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stat')
		.setDescription('Show your character\'s stats and equipped items.')
		.setContexts(InteractionContextType.Guild)
		.addBooleanOption(option =>
			option.setName('plain')
				.setDescription('Show text-based stats instead of image card (default: false)')
				.setRequired(false))
		.addBooleanOption(option =>
			option.setName('public')
				.setDescription('Show the stats publicly (default: hidden)')
				.setRequired(false)),

	async execute(interaction) {
		try {
			const isPublic = interaction.options.getBoolean('public') ?? false;
			const isPlain = interaction.options.getBoolean('plain') ?? false;
			await interaction.deferReply({ ephemeral: !isPublic });

			const userId = interaction.user.id;
			const character = await characterUtil.getCharacterBase(userId);
			if (!character) {
				return await interaction.editReply({ content: 'Character not found.' });
			}

			// Check if registration is incomplete
			const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
			if (unregistered === 1) {
				return await interaction.editReply({ content: 'You must complete the registration process before using this command.' });
			}

			// Get stats via utility methods (separation of concerns)
			const combat = await characterUtil.getCharacterCombatStat(userId);
			const attack = await characterUtil.getCharacterAttackStat(userId);
			const equipment = await characterUtil.getCharacterEquippedItems(userId);

			// Load avatar from CharacterSetting DB if available
			const savedAvatar = await characterUtil.getCharacterSetting(userId, 'avatar');
			const avatarUrl = savedAvatar || interaction.user.displayAvatarURL({ extension: 'png', size: 256 });

			// IMAGE CARD MODE (default) - fallback to plain text if canvas fails
			if (!isPlain) {
				try {
					const imageBuffer = await generateStatCard(
						character,
						combat,
						attack,
						equipment,
						avatarUrl,
					);

					const attachment = new AttachmentBuilder(imageBuffer, { name: 'stat-card.png' });
					return await interaction.editReply({ files: [attachment] });
				}
				catch (canvasError) {
					console.error('Canvas generation failed, falling back to plain text:');
					console.error('Error name:', canvasError.name);
					console.error('Error message:', canvasError.message);
					console.error('Error stack:', canvasError.stack);
					// Fall through to plain text mode
				}
			}

			// PLAIN TEXT MODE
			const statFields = [
				`STR: ${character.str ?? '-'}`,
				`DEX: ${character.dex ?? '-'}`,
				`AGI: ${character.agi ?? '-'}`,
				`CON: ${character.con ?? '-'}`,
			];

			const combatFields = combat
				? [
					`Defense: ${combat.defense ?? '-'}`,
					`Speed: ${combat.speed ?? '-'}`,
					`Evade: ${combat.evade ?? '-'}`,
					`Current Weight: ${combat.currentWeight ?? '-'}`,
					`Max Weight: ${combat.maxWeight ?? '-'}`,
				]
				: ['None'];

			const attackFields = attack
				? [
					`Attack: ${attack.attack ?? '-'}`,
					`Accuracy: ${attack.accuracy ?? '-'}`,
					`Critical: ${attack.critical ?? '-'}`,
				]
				: ['None'];

			// Format equipped items list for plain text
			const equipList = equipment.length > 0
				? equipment.map(eq => `- ${eq.itemName}`).join('\n')
				: 'None';

			// Create HP and Stamina bars
			const hpBar = createColorBar(character.currentHp, character.maxHp, 'hp');
			const staminaBar = createColorBar(character.currentStamina, character.maxStamina, 'stamina');

			const embed = {
				title: `${character.name}'s Stats`,
				description: statFields.join('\n'),
				thumbnail: { url: avatarUrl },
				fields: [
					{ name: 'HP', value: hpBar, inline: true },
					{ name: 'Stamina', value: staminaBar, inline: true },
					{ name: '\u200B', value: '\u200B', inline: true },
					{ name: 'Combat Stats', value: combatFields.join('\n'), inline: true },
					{ name: 'Attack Stats', value: attackFields.join('\n'), inline: true },
					{ name: 'Equipped Items', value: equipList },
				],
			};
			await interaction.editReply({ embeds: [embed] });
		}
		catch (error) {
			console.error('Error in stat command:', error);
			try {
				if (interaction.deferred) {
					await interaction.editReply({ content: 'An error occurred while retrieving your character stats.' });
				}
				else {
					await interaction.reply({ content: 'An error occurred while retrieving your character stats.', flags: MessageFlags.Ephemeral });
				}
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},
};
