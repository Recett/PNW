const { SlashCommandBuilder } = require('discord.js');
const characterUtility = require('../../utility/characterUtility');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('inventory')
		.setDescription('View your character inventory.'),
	async execute(interaction) {
		// Get the user/character ID
		const userId = interaction.user.id;
		// Find the character for this user using utility
		const character = await characterUtility.getCharacterBase(userId);
		if (!character) {
			await interaction.reply({ content: 'No character found for your account.', flags: MessageFlags.Ephemeral });
			return;
		}
		// Get inventory items using utility
		const inventory = await characterUtility.getCharacterInventory(character.character_id);
		if (!inventory || inventory.length === 0) {
			await interaction.reply({ content: 'Your inventory is empty.', flags: MessageFlags.Ephemeral });
			return;
		}
		// Build inventory list
		const inventoryList = inventory.map(inv => {
			const item = inv.item;
			return `**${item.name}** x${inv.amount}`;
		}).join('\n');
		await interaction.reply({
			embeds: [{
				title: `${character.name}'s Inventory`,
				description: inventoryList,
			}],
			flags: MessageFlags.Ephemeral,
		});
	},
};
