const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const characterUtil = require('@utility/characterUtility.js');
const { CharacterCombatStat, CharacterAttackStat } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stat')
		.setDescription('Show your character\'s stats and equipped items.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			await interaction.deferReply({ ephemeral: true });

			const userId = interaction.user.id;
			const character = await characterUtil.getCharacterBase(userId);
			if (!character) {
				return await interaction.editReply({ content: 'Character not found.' });
			}

			// Gather base stats
			const stats = [
				`HP: ${character.currentHp ?? '-'} / ${character.maxHp ?? '-'}`,
				`Stamina: ${character.currentStamina ?? '-'} / ${character.maxStamina ?? '-'}`,
				`STR: ${character.str ?? '-'}`,
				`DEX: ${character.dex ?? '-'}`,
				`AGI: ${character.agi ?? '-'}`,
				`CON: ${character.con ?? '-'}`,
			];

			// Get summarized combat stats
			const combat = await CharacterCombatStat.findOne({ where: { character_id: userId } });
			const combatFields = combat
				? [
					`Defense: ${combat.defense ?? '-'}`,
					`Speed: ${combat.speed ?? '-'}`,
					`Evade: ${combat.evade ?? '-'}`,
					`Current Weight: ${combat.currentWeight ?? '-'}`,
					`Max Weight: ${combat.maxWeight ?? '-'}`,
				]
				: ['None'];

			// Get summarized attack stats
			const attack = await CharacterAttackStat.findOne({ where: { character_id: userId } });
			const attackFields = attack
				? [
					`Attack: ${attack.attack ?? '-'}`,
					`Accuracy: ${attack.accuracy ?? '-'}`,
					`Critical: ${attack.critical ?? '-'}`,
				]
				: ['None'];

			// Get equipped items with names
			const { CharacterItem, ItemLib } = require('@root/dbObject.js');
			const equippedItems = await CharacterItem.findAll({
				where: { character_id: userId, equipped: true },
				include: [{ model: ItemLib, as: 'item' }],
			});
			const equipList = equippedItems.length > 0
				? equippedItems.map(eq => `- ${eq.item ? eq.item.name : eq.item_id}`).join('\n')
				: 'None';

			// Load avatar from CharacterSetting DB if available
			let avatarUrl;
			const { CharacterSetting } = require('@root/dbObject.js');
			const charSetting = await CharacterSetting.findOne({ where: { character_id: userId, setting: 'avatar' } });
			if (charSetting && charSetting.value) {
				avatarUrl = charSetting.value;
			}
			else {
				avatarUrl = interaction.user.displayAvatarURL({ dynamic: true });
			}
			const embed = {
				title: `${character.name}'s Stats`,
				description: stats.join('\n'),
				thumbnail: { url: avatarUrl },
				fields: [
					{ name: 'Combat Stats', value: combatFields.join('\n') },
					{ name: 'Attack Stats', value: attackFields.join('\n') },
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
