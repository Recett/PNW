const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { CharacterBase } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('testnewchar')
		.setDescription('Create a new test character with 10 STR, AGI, INT, CON.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		const userId = interaction.user.id;
		const existing = await CharacterBase.findOne({ where: { id: userId } });
		if (existing) {
			return interaction.reply({ content: 'You already have a character.', flags: MessageFlags.Ephemeral });
		}

		await CharacterBase.create({
			id: userId,
			name: interaction.user.globalName,
			str: 10,
			dex: 10,
			agi: 10,
			con: 10,
		});

		// Move character to location id 1
		const { LocationContain } = require('@root/dbObject.js');
		const gamecon = require('@root/Data/gamecon.json');
		await LocationContain.create({
			location_id: 1,
			object_id: userId,
			type: gamecon.PC,
		});

		// Give the character three items: Sword_1, Armor_1, Leg_1, and equip them
		const { CharacterItem } = require('@root/dbObject.js');
		const items = ['Sword_1', 'Armor_1', 'Leg_1'];
		for (const itemId of items) {
			await CharacterItem.create({
				character_id: userId,
				item_id: itemId,
				amount: 1,
				equipped: true,
			});
		}

		// Calculate and update player's Combat and Attack stats
		const characterUtil = require('../../utility/characterUtility');
		await characterUtil.calculateCombatStat(userId);
		await characterUtil.calculateAttackStat(userId);

		// Set currentHp to maxHp after calculation
		const updatedChar = await CharacterBase.findOne({ where: { id: userId } });
		if (updatedChar && updatedChar.maxHp != null) {
			await CharacterBase.update({ currentHp: updatedChar.maxHp }, { where: { id: userId } });
		}

		await interaction.reply({ content: 'Test character created, given and equipped Sword_1, Armor_1, Leg_1. Stats calculated.', flags: MessageFlags.Ephemeral });
	},
};
