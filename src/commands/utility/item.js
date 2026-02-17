const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, MessageFlags } = require('discord.js');
const { ItemLib, CharacterItem } = require('@root/dbObject.js');
const { Op } = require('sequelize');
const characterUtility = require('../../utility/characterUtility');
const itemUtility = require('../../utility/itemUtility');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('item')
		.setDescription('View details about a specific item.')
		.addStringOption(option =>
			option.setName('name')
				.setDescription('The name of the item to view')
				.setRequired(true),
		),
	async execute(interaction) {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const userId = interaction.user.id;

			// Check if character exists and registration is complete
			const character = await characterUtility.getCharacterBase(userId);
			if (!character) {
				return await interaction.editReply({ content: 'No character found for your account.' });
			}

			const unregistered = await characterUtility.getCharacterFlag(userId, 'unregistered');
			if (unregistered === 1) {
				return await interaction.editReply({ content: 'You must complete the registration process before using this command.' });
			}

			const itemName = interaction.options.getString('name');

			// Try to find exact match first
			const exactMatch = await ItemLib.findOne({ where: { name: itemName } });
			const item = exactMatch ? await itemUtility.getItemWithDetails(exactMatch.id) : null;

			if (!item) {
				// Search for items with names containing the input (only from user's inventory)
				const matches = await CharacterItem.findAll({
					where: { character_id: userId },
					include: [{ model: ItemLib, as: 'item', where: { name: { [Op.substring]: itemName } } }],
					limit: 25,
				});

				if (!matches || matches.length === 0) {
					await interaction.editReply({ content: `No item found with the name '${itemName}'.` });
					return;
				}

				// If only one match, display it directly
				if (matches.length === 1) {
					const singleItem = await itemUtility.getItemWithDetails(matches[0].item.id);
					const character = await characterUtility.getCharacterBase(userId);
					const inventoryEntry = matches[0];

					const embed = itemUtility.buildItemEmbed(singleItem);
					const isEquipped = inventoryEntry?.equipped || false;
					const components = inventoryEntry
						? itemUtility.buildItemActionButtons(singleItem, isEquipped, itemUtility.isItemEquippable(singleItem))
						: [];

					await interaction.editReply({ embeds: [embed], components });

					if (components.length && character) {
						const message = await interaction.fetchReply();
						const collector = message.createMessageComponentCollector({
							componentType: ComponentType.Button,
							time: 60_000,
							filter: i => i.user.id === userId,
						});

						collector.on('collect', async i => {
							await itemUtility.handleItemButtonAction(i, singleItem, character, () => collector.stop());
						});
					}
					return;
				}

				// Show selection menu for multiple matches
				const select = new StringSelectMenuBuilder()
					.setCustomId('item_select')
					.setPlaceholder('Select an item')
					.addOptions(matches.map(i => ({
						label: i.item.name,
						value: String(i.item.id),
					})));
				const row = new ActionRowBuilder().addComponents(select);
				await interaction.editReply({
					content: 'Multiple items found. Please select one:',
					components: [row],
				});

				const collector = interaction.channel.createMessageComponentCollector({
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

						// Get character and inventory entry
						const character = await characterUtility.getCharacterBase(userId);
						const inventoryEntry = character ? await CharacterItem.findOne({
							where: { character_id: character.id, item_id: selectedItem.id },
						}) : null;

						// Build embed and buttons using shared utility
						const embed = itemUtility.buildItemEmbed(selectedItem);
						const isEquipped = inventoryEntry?.equipped || false;
						const components = inventoryEntry
							? itemUtility.buildItemActionButtons(selectedItem, isEquipped, itemUtility.isItemEquippable(selectedItem))
							: [];

						await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, components });

						// Set up button collector if there are components
						if (components.length && character) {
							const replyMessage = await i.fetchReply();
							const buttonCollector = replyMessage.createMessageComponentCollector({
								componentType: ComponentType.Button,
								time: 60_000,
								filter: btnI => btnI.user.id === userId,
							});

							buttonCollector.on('collect', async btnI => {
								await itemUtility.handleItemButtonAction(btnI, selectedItem, character, () => buttonCollector.stop());
							});
						}
					}
					catch (collectError) {
						console.error('Error in item selection:', collectError);
						try {
							await i.reply({ content: 'An error occurred while viewing this item.', flags: MessageFlags.Ephemeral });
						}
						catch (replyError) {
							console.error('Error sending error message:', replyError);
						}
					}
				});

				return;
			}

			// Exact item found - display it directly (character already fetched above)
			const inventoryEntry = character ? await CharacterItem.findOne({
				where: { character_id: character.id, item_id: item.id },
			}) : null;

			// Build embed and buttons using shared utility
			const embed = itemUtility.buildItemEmbed(item);
			const isEquipped = inventoryEntry?.equipped || false;
			const components = inventoryEntry
				? itemUtility.buildItemActionButtons(item, isEquipped, itemUtility.isItemEquippable(item))
				: [];

			await interaction.editReply({ embeds: [embed], components });

			// Set up button collector if there are components
			if (components.length && character) {
				const message = await interaction.fetchReply();
				const collector = message.createMessageComponentCollector({
					componentType: ComponentType.Button,
					time: 60_000,
					filter: i => i.user.id === userId,
				});

				collector.on('collect', async i => {
					await itemUtility.handleItemButtonAction(i, item, character, () => collector.stop());
				});
			}
		}
		catch (error) {
			console.error('Error in item command:', error);
			try {
				if (interaction.deferred) {
					await interaction.editReply({ content: 'An error occurred while retrieving item information.' });
				}
				else {
					await interaction.reply({ content: 'An error occurred while retrieving item information.', flags: MessageFlags.Ephemeral });
				}
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},
};
