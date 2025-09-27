const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { CharacterBase } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('testnewchar')
		.setDescription('Create a new test character with 10 STR, AGI, INT, CON.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			await interaction.deferReply({ ephemeral: true });

			const userId = interaction.user.id;
			const existing = await CharacterBase.findOne({ where: { id: userId } });
			if (existing) {
				return await interaction.editReply({ content: 'You already have a character.' });
			}

			await CharacterBase.create({
				id: userId,
				name: interaction.user.globalName,
				str: 10,
				dex: 10,
				agi: 10,
				con: 10,
			});

			// Move character to the first location in the database using locationUtil
			const locationUtil = interaction.client.locationUtil;
			const firstLocation = await locationUtil.getLocationBase(1);
			if (firstLocation) {
				await locationUtil.updateLocationRoles({
					guild: interaction.guild,
					memberId: userId,
					newLocationId: firstLocation.id,
				});
			}

			// Give the character three items: Sword_1, Armor_1, Leg_1, and equip them
			const { CharacterItem } = require('@root/dbObject.js');
			const items = ['1', '2', '3'];
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

			// Set currentHp and currentStamina to maxHp and maxStamina after calculation
			const updatedChar = await CharacterBase.findOne({ where: { id: userId } });
			const updateFields = {};
			if (updatedChar && updatedChar.maxHp != null) {
				updateFields.currentHp = updatedChar.maxHp;
			}
			if (updatedChar && updatedChar.maxStamina != null) {
				updateFields.currentStamina = updatedChar.maxStamina;
			}
			if (Object.keys(updateFields).length > 0) {
				await CharacterBase.update(updateFields, { where: { id: userId } });
			}

			await interaction.editReply({ content: 'Test character created, given and equipped Sword_1, Armor_1, Leg_1. Stats calculated.' });
		}
		catch (error) {
			console.error('Error in testnewchar command:', error);
			try {
				if (interaction.deferred) {
					await interaction.editReply({ content: 'An error occurred while creating the test character.' });
				}
				else {
					await interaction.reply({ content: 'An error occurred while creating the test character.', flags: MessageFlags.Ephemeral });
				}
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},
};
