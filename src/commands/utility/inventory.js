const { SlashCommandBuilder, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const characterUtility = require('../../utility/characterUtility');
const itemUtility = require('../../utility/itemUtility');
const { CharacterItem } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('inventory')
		.setDescription('View your character inventory.'),
	async execute(interaction) {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const userId = interaction.user.id;

			// Find the character for this user
			const character = await characterUtility.getCharacterBase(userId);
			if (!character) {
				return await interaction.editReply({ content: 'No character found for your account.' });
			}

			// Check if registration is incomplete
			const unregistered = await characterUtility.getCharacterFlag(userId, 'unregistered');
			if (unregistered === 1) {
				return await interaction.editReply({ content: 'You must complete the registration process before using this command.' });
			}

			// Get inventory items using utility
			const inventory = await characterUtility.getCharacterInventory(character.id);
			if (!inventory || inventory.length === 0) {
				return await interaction.editReply({ content: 'Your inventory is empty.' });
			}

			// Build inventory list for display
			const inventoryList = inventory.map(inv => {
				const item = inv.item;
				const equipped = inv.equipped ? ' (Equipped)' : '';
				return `**${item.name}** x${inv.amount}${equipped}`;
			}).join('\n');

			// Create select menu for item viewing (Discord limit of 25 options)
			const selectOptions = inventory.slice(0, 25).map(inv => ({
				label: `${inv.item.name} (x${inv.amount})`,
				value: String(inv.item.id),
				description: inv.item.description ? inv.item.description.substring(0, 100) : 'No description',
			}));

			const select = new StringSelectMenuBuilder()
				.setCustomId('inventory_item_select')
				.setPlaceholder('Select an item to view details')
				.addOptions(selectOptions);

			const row = new ActionRowBuilder().addComponents(select);

			await interaction.editReply({
				embeds: [{
					title: `${character.name}'s Inventory`,
					description: inventoryList,
					footer: { text: 'Select an item below to view detailed information and perform actions.' },
				}],
				components: [row],
			});

			// Set up collector for item selection
			const message = await interaction.fetchReply();
			const collector = message.createMessageComponentCollector({
				componentType: ComponentType.StringSelect,
				time: 60_000,
				filter: i => i.user.id === userId,
			});

			collector.on('collect', async i => {
				try {
					const selectedItem = await itemUtility.getItemWithDetails(i.values[0]);
					if (!selectedItem) {
						await i.reply({ content: 'Item not found.', flags: MessageFlags.Ephemeral });
						return;
					}

					// Get the character's inventory entry for this item
					const inventoryEntry = await CharacterItem.findOne({
						where: { character_id: character.id, item_id: selectedItem.id },
					});

					if (!inventoryEntry) {
						await i.reply({ content: 'You do not have this item in your inventory.', flags: MessageFlags.Ephemeral });
						return;
					}

					// Build embed and buttons using shared utility
					const embed = itemUtility.buildItemEmbed(selectedItem, inventoryEntry);
					const isEquipped = inventoryEntry.equipped;
					const components = itemUtility.buildItemActionButtons(selectedItem, isEquipped, itemUtility.isItemEquippable(selectedItem));

					await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, components });

					// Set up button collector for actions
					if (components.length) {
						const buttonCollector = i.channel.createMessageComponentCollector({
							componentType: ComponentType.Button,
							time: 60_000,
							filter: btnI => btnI.user.id === userId,
						});

						buttonCollector.on('collect', async btnI => {
							await itemUtility.handleItemButtonAction(btnI, selectedItem, character, () => buttonCollector.stop());
						});
					}
				}
				catch (itemError) {
					console.error('Error in inventory item selection:', itemError);
					try {
						await i.reply({ content: 'An error occurred while viewing this item.', flags: MessageFlags.Ephemeral });
					}
					catch (itemReplyError) {
						console.error('Error sending item error message:', itemReplyError);
					}
				}
			});
		}
		catch (error) {
			console.error('Error in inventory command:', error);
			try {
				if (interaction.deferred) {
					await interaction.editReply({ content: 'An error occurred while retrieving your inventory.' });
				}
				else {
					await interaction.reply({ content: 'An error occurred while retrieving your inventory.', flags: MessageFlags.Ephemeral });
				}
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},
};
