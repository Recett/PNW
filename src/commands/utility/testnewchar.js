const { SlashCommandBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { CharacterBase, CharacterItem, ItemLib, LocationBase } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('testnewchar')
		.setDescription('Create a new test character with 10 STR, AGI, INT, CON.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

			// Move character to a location with "test" tag
			const locationUtil = interaction.client.locationUtil;
			const allLocations = await LocationBase.findAll();
			const testLocation = allLocations.find(loc =>
				loc.tag && Array.isArray(loc.tag) && loc.tag.includes('test'),
			);
			if (testLocation) {
				await locationUtil.updateLocationRoles({
					guild: interaction.guild,
					memberId: userId,
					newLocationId: testLocation.id,
				});
			}

			// Find all items with "starter" tag and give them to the character equipped
			const allItems = await ItemLib.findAll();
			const starterItems = allItems.filter(item =>
				item.tag && Array.isArray(item.tag) && item.tag.includes('starter'),
			);

			for (const item of starterItems) {
				await CharacterItem.create({
					character_id: userId,
					item_id: item.id,
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

			const itemNames = starterItems.map(item => item.name).join(', ') || 'none';
			await interaction.editReply({ content: `Test character created and equipped with starter items: ${itemNames}. Stats calculated.` });
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
