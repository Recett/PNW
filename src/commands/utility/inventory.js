const { SlashCommandBuilder, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, ButtonBuilder } = require('discord.js');
const characterUtility = require('../../utility/characterUtility');
const { ItemLib, CharacterItem, WeaponLib, ArmorLib } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('inventory')
		.setDescription('View your character inventory.'),
	async execute(interaction) {
		try {
			await interaction.deferReply({ ephemeral: true });

			// Get the user/character ID
			const userId = interaction.user.id;
			// Find the character for this user using utility
			const character = await characterUtility.getCharacterBase(userId);
			if (!character) {
				return await interaction.editReply({ content: 'No character found for your account.' });
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

			// Create select menu for item viewing
			const selectOptions = inventory.map(inv => ({
				label: `${inv.item.name} (x${inv.amount})`,
				value: String(inv.item.id),
				description: inv.item.description ? inv.item.description.substring(0, 100) : 'No description',
			}));

			// Discord limit of 25 options
			const select = new StringSelectMenuBuilder()
				.setCustomId('inventory_item_select')
				.setPlaceholder('Select an item to view details')
				.addOptions(selectOptions.slice(0, 25));

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
					const selectedId = i.values[0];
					const selectedItem = await ItemLib.findByPk(selectedId, {
						include: [
							{ model: WeaponLib, as: 'weapon', required: false },
							{ model: ArmorLib, as: 'armor', required: false },
						],
					});

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

					// Build detailed item embed
					const embed = {
						title: selectedItem.name,
						description: selectedItem.description || 'No description available.',
						fields: [
							{ name: 'Type', value: selectedItem.item_type || 'Unknown', inline: true },
							{ name: 'Amount', value: String(inventoryEntry.amount), inline: true },
							{ name: 'Equipped', value: inventoryEntry.equipped ? 'Yes' : 'No', inline: true },
						],
					};

					// Add weapon/armor specific stats
					if (selectedItem.item_type === 'Weapon' && selectedItem.weapon) {
						embed.fields.push(
							{ name: 'Slot', value: selectedItem.weapon.slot || 'Unknown', inline: true },
							{ name: 'Base Damage', value: String(selectedItem.weapon.base_damage || 0), inline: true },
							{ name: 'Scaling', value: `${selectedItem.weapon.scaling || 0}%`, inline: true },
							{ name: 'Hit Modifier', value: `${selectedItem.weapon.hit_mod || 0}%`, inline: true },
							{ name: 'Cooldown', value: String(selectedItem.weapon.cooldown || 0), inline: true },
							{ name: 'Weight', value: String(selectedItem.weapon.weight || 0), inline: true },
							{ name: 'Weapon Type', value: selectedItem.weapon.weapon_type || 'Unknown', inline: true },
							{ name: 'Graze', value: `${selectedItem.weapon.graze || 0}%`, inline: true },
						);
						if (selectedItem.weapon.special) {
							embed.fields.push(
								{ name: 'Special', value: `${selectedItem.weapon.special} (${selectedItem.weapon.special_value || 0})`, inline: false },
							);
						}
					}
					else if (selectedItem.item_type === 'Armor' && selectedItem.armor) {
						embed.fields.push(
							{ name: 'Slot', value: selectedItem.armor.slot || 'Unknown', inline: true },
							{ name: 'Defense', value: String(selectedItem.armor.defense || 0), inline: true },
							{ name: 'Defense %', value: `${selectedItem.armor.defense_percent || 0}%`, inline: true },
							{ name: 'Crit Resistance', value: String(selectedItem.armor.crit_resistance || 0), inline: true },
							{ name: 'Evade', value: String(selectedItem.armor.evade || 0), inline: true },
							{ name: 'Evade %', value: `${selectedItem.armor.evade_percent || 0}%`, inline: true },
							{ name: 'Weight', value: String(selectedItem.armor.weight || 0), inline: true },
						);
					}

					// Create action buttons
					const components = [];
					if (selectedItem.item_type === 'Weapon' || selectedItem.item_type === 'Armor') {
						const isEquipped = inventoryEntry.equipped;
						const equipButton = new ActionRowBuilder().addComponents(
							new ButtonBuilder()
								.setCustomId(`equip_item_${selectedItem.id}`)
								.setLabel('Equip')
								.setStyle('Primary')
								.setDisabled(isEquipped),
							new ButtonBuilder()
								.setCustomId(`unequip_item_${selectedItem.id}`)
								.setLabel('Unequip')
								.setStyle('Secondary')
								.setDisabled(!isEquipped),
							new ButtonBuilder()
								.setCustomId(`discard_item_${selectedItem.id}`)
								.setLabel('Discard')
								.setStyle('Danger'),
							new ButtonBuilder()
								.setCustomId(`close_item_${selectedItem.id}`)
								.setLabel('Close')
								.setStyle('Secondary'),
						);
						components.push(equipButton);
					}
					else {
						const actionButton = new ActionRowBuilder().addComponents(
							new ButtonBuilder()
								.setCustomId(`discard_item_${selectedItem.id}`)
								.setLabel('Discard')
								.setStyle('Danger'),
							new ButtonBuilder()
								.setCustomId(`close_item_${selectedItem.id}`)
								.setLabel('Close')
								.setStyle('Secondary'),
						);
						components.push(actionButton);
					}

					await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, components });

					// Set up button collector for actions
					if (components.length) {
						const buttonCollector = i.channel.createMessageComponentCollector({
							componentType: ComponentType.Button,
							time: 60_000,
							filter: btnI => btnI.user.id === i.user.id,
						});

						buttonCollector.on('collect', async btnI => {
							try {
								if (btnI.customId === `equip_item_${selectedItem.id}`) {
									// Equip the item
									inventoryEntry.equipped = true;
									await inventoryEntry.save();

									// Recalculate stats
									await characterUtility.recalculateCharacterStats(character);

									await btnI.reply({ content: `You have equipped ${selectedItem.name}.`, flags: MessageFlags.Ephemeral });
									buttonCollector.stop();
								}
								else if (btnI.customId === `unequip_item_${selectedItem.id}`) {
									// Unequip the item
									inventoryEntry.equipped = false;
									await inventoryEntry.save();

									// Recalculate stats
									await characterUtility.recalculateCharacterStats(character);

									await btnI.reply({ content: `You have unequipped ${selectedItem.name}.`, flags: MessageFlags.Ephemeral });
									buttonCollector.stop();
								}
								else if (btnI.customId === `discard_item_${selectedItem.id}`) {
									// Discard the item
									if (inventoryEntry.amount > 1) {
										inventoryEntry.amount -= 1;
										await inventoryEntry.save();
										await btnI.reply({ content: `You discarded 1 ${selectedItem.name}. You have ${inventoryEntry.amount} left.`, flags: MessageFlags.Ephemeral });
									}
									else {
										await inventoryEntry.destroy();
										await btnI.reply({ content: `You discarded ${selectedItem.name}.`, flags: MessageFlags.Ephemeral });
									}
									buttonCollector.stop();
								}
								else if (btnI.customId === `close_item_${selectedItem.id}`) {
									await btnI.deferUpdate();
									buttonCollector.stop();
								}
							}
							catch (btnError) {
								console.error('Error in inventory button interaction:', btnError);
								try {
									await btnI.reply({ content: 'An error occurred while performing this action.', flags: MessageFlags.Ephemeral });
								}
								catch (btnReplyError) {
									console.error('Error sending button error message:', btnReplyError);
								}
							}
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

			collector.on('end', () => {
				// Could disable components here if needed
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
