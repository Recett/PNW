const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, ButtonBuilder, MessageFlags } = require('discord.js');
const { ItemLib, CharacterItem, WeaponLib, ArmorLib } = require('@root/dbObject.js');
const { Op } = require('sequelize');
const characterUtility = require('../../utility/characterUtility');

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
			await interaction.deferReply({ ephemeral: true });

			const itemName = interaction.options.getString('name');
			const item = await ItemLib.findOne({
				where: { name: itemName },
				include: [
					{ model: WeaponLib, as: 'weapon', required: false },
					{ model: ArmorLib, as: 'armor', required: false },
				],
			});

			if (!item) {
				// Search for items with names containing the input
				// Only allow selection from user's inventory
				const userId = interaction.user.id;
				const matches = await CharacterItem.findAll({
					where: { character_id: userId },
					include: [{ model: ItemLib, as: 'item', where: { name: { [Op.substring]: itemName } } }],
					limit: 25,
				});
				if (!matches || matches.length === 0) {
					await interaction.editReply({ content: `No item found with the name '${itemName}'.` });
					return;
				}

				const select = new StringSelectMenuBuilder()
					.setCustomId('item_select')
					.setPlaceholder('Select an item')
					.addOptions(matches.map(i => ({
						label: i.item.name,
						value: String(i.item.id),
					})));
				const row = new ActionRowBuilder().addComponents(select);
				await interaction.editReply({
					content: 'No exact item found. Please select from similar items below:',
					components: [row],
				});

				const collector = interaction.channel.createMessageComponentCollector({
					componentType: ComponentType.StringSelect,
					time: 60_000,
					filter: i => i.user.id === interaction.user.id,
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
						const embed = {
							title: selectedItem.name,
							description: selectedItem.description || 'No description available.',
							fields: [
								{ name: 'Type', value: selectedItem.item_type || 'Unknown', inline: true },
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
						const components = [];
						if (selectedItem.item_type === 'Weapon' || selectedItem.item_type === 'Armor') {
							// Check if item is equipped by the user
							const character = await characterUtility.getCharacterBase(userId);
							let isEquipped = false;
							if (character) {
								const equippedItem = await CharacterItem.findOne({
									where: { character_id: character.id, item_id: selectedItem.id, equipped: true },
								});
								isEquipped = !!equippedItem;
							}

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
						if (components.length) {
							const replyMessage = await i.fetchReply();
							const buttonCollector = replyMessage.createMessageComponentCollector({
								componentType: ComponentType.Button,
								time: 60_000,
								filter: btnI => btnI.user.id === i.user.id,
							});
							buttonCollector.on('collect', async btnI => {
								try {
									if (btnI.customId === `equip_item_${selectedItem.id}`) {
										const character = await characterUtility.getCharacterBase(userId);
										if (!character) {
											await btnI.reply({ content: 'No character found for your account.', flags: MessageFlags.Ephemeral });
											buttonCollector.stop();
											return;
										}
										// Equip the item directly using CharacterItem
										const [characterItem] = await CharacterItem.findOrCreate({
											where: { character_id: character.id, item_id: selectedItem.id },
											defaults: { equipped: true, amount: 1 },
										});
										characterItem.equipped = true;
										await characterItem.save();

										// Recalculate stats
										await characterUtility.recalculateCharacterStats(character);

										await btnI.reply({ content: `You have equipped ${selectedItem.name}.`, flags: MessageFlags.Ephemeral });
										buttonCollector.stop();
									}
									else if (btnI.customId === `unequip_item_${selectedItem.id}`) {
										const character = await characterUtility.getCharacterBase(userId);
										if (!character) {
											await btnI.reply({ content: 'No character found for your account.', flags: MessageFlags.Ephemeral });
											buttonCollector.stop();
											return;
										}
										// Unequip the item
										const characterItem = await CharacterItem.findOne({
											where: { character_id: character.id, item_id: selectedItem.id, equipped: true },
										});
										if (characterItem) {
											characterItem.equipped = false;
											await characterItem.save();

											// Recalculate stats
											await characterUtility.recalculateCharacterStats(character);

											await btnI.reply({ content: `You have unequipped ${selectedItem.name}.`, flags: MessageFlags.Ephemeral });
										}
										else {
											await btnI.reply({ content: 'This item is not currently equipped.', flags: MessageFlags.Ephemeral });
										}
										buttonCollector.stop();
									}
									else if (btnI.customId === `discard_item_${selectedItem.id}`) {
										const character = await characterUtility.getCharacterBase(userId);
										if (!character) {
											await btnI.reply({ content: 'No character found for your account.', flags: MessageFlags.Ephemeral });
											buttonCollector.stop();
											return;
										}
										// Remove the item from character's inventory
										const characterItem = await CharacterItem.findOne({
											where: { character_id: character.id, item_id: selectedItem.id },
										});
										if (characterItem) {
											if (characterItem.amount > 1) {
												characterItem.amount -= 1;
												await characterItem.save();
												await btnI.reply({ content: `You discarded 1 ${selectedItem.name}. You have ${characterItem.amount} left.`, flags: MessageFlags.Ephemeral });
											}
											else {
												await characterItem.destroy();
												await btnI.reply({ content: `You discarded ${selectedItem.name}.`, flags: MessageFlags.Ephemeral });
											}
										}
										else {
											await btnI.reply({ content: 'You do not have this item in your inventory.', flags: MessageFlags.Ephemeral });
										}
										buttonCollector.stop();
									}
									else if (btnI.customId === `close_item_${selectedItem.id}`) {
										await btnI.deferUpdate();
										buttonCollector.stop();
									}
								}
								catch (btnError) {
									console.error('Error in item button interaction:', btnError);
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

				collector.on('end', () => {
					// Collector ended
				});

				return;
			}

			// If exact item found, display it directly
			const embed = {
				title: item.name,
				description: item.description || 'No description available.',
				fields: [
					{ name: 'Type', value: item.item_type || 'Unknown', inline: true },
				],
			};

			// Add weapon/armor specific stats
			if (item.item_type === 'Weapon' && item.weapon) {
				embed.fields.push(
					{ name: 'Slot', value: item.weapon.slot || 'Unknown', inline: true },
					{ name: 'Base Damage', value: String(item.weapon.base_damage || 0), inline: true },
					{ name: 'Scaling', value: `${item.weapon.scaling || 0}%`, inline: true },
					{ name: 'Hit Modifier', value: `${item.weapon.hit_mod || 0}%`, inline: true },
					{ name: 'Cooldown', value: String(item.weapon.cooldown || 0), inline: true },
					{ name: 'Weight', value: String(item.weapon.weight || 0), inline: true },
					{ name: 'Weapon Type', value: item.weapon.weapon_type || 'Unknown', inline: true },
					{ name: 'Graze', value: `${item.weapon.graze || 0}%`, inline: true },
				);
				if (item.weapon.special) {
					embed.fields.push(
						{ name: 'Special', value: `${item.weapon.special} (${item.weapon.special_value || 0})`, inline: false },
					);
				}
			}
			else if (item.item_type === 'Armor' && item.armor) {
				embed.fields.push(
					{ name: 'Slot', value: item.armor.slot || 'Unknown', inline: true },
					{ name: 'Defense', value: String(item.armor.defense || 0), inline: true },
					{ name: 'Defense %', value: `${item.armor.defense_percent || 0}%`, inline: true },
					{ name: 'Crit Resistance', value: String(item.armor.crit_resistance || 0), inline: true },
					{ name: 'Evade', value: String(item.armor.evade || 0), inline: true },
					{ name: 'Evade %', value: `${item.armor.evade_percent || 0}%`, inline: true },
					{ name: 'Weight', value: String(item.armor.weight || 0), inline: true },
				);
			}

			// Check if user has this item and create appropriate buttons
			const userId = interaction.user.id;
			const character = await characterUtility.getCharacterBase(userId);
			const components = [];

			if (character) {
				const characterItem = await CharacterItem.findOne({
					where: { character_id: character.id, item_id: item.id },
				});

				if (characterItem && (item.item_type === 'Weapon' || item.item_type === 'Armor')) {
					const isEquipped = characterItem.equipped;
					const equipButton = new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setCustomId(`equip_item_${item.id}`)
							.setLabel('Equip')
							.setStyle('Primary')
							.setDisabled(isEquipped),
						new ButtonBuilder()
							.setCustomId(`unequip_item_${item.id}`)
							.setLabel('Unequip')
							.setStyle('Secondary')
							.setDisabled(!isEquipped),
						new ButtonBuilder()
							.setCustomId(`discard_item_${item.id}`)
							.setLabel('Discard')
							.setStyle('Danger'),
						new ButtonBuilder()
							.setCustomId(`close_item_${item.id}`)
							.setLabel('Close')
							.setStyle('Secondary'),
					);
					components.push(equipButton);
				}
				else if (characterItem) {
					const actionButton = new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setCustomId(`discard_item_${item.id}`)
							.setLabel('Discard')
							.setStyle('Danger'),
						new ButtonBuilder()
							.setCustomId(`close_item_${item.id}`)
							.setLabel('Close')
							.setStyle('Secondary'),
					);
					components.push(actionButton);
				}
			}

			await interaction.editReply({ embeds: [embed], components });

			// Set up button collector if there are components
			if (components.length) {
				const message = await interaction.fetchReply();
				const collector = message.createMessageComponentCollector({
					componentType: ComponentType.Button,
					time: 60_000,
					filter: i => i.user.id === userId,
				});

				collector.on('collect', async i => {
					try {
						if (i.customId === `equip_item_${item.id}`) {
							if (!character) {
								await i.reply({ content: 'No character found for your account.', flags: MessageFlags.Ephemeral });
								collector.stop();
								return;
							}
							const [characterItem] = await CharacterItem.findOrCreate({
								where: { character_id: character.id, item_id: item.id },
								defaults: { equipped: true, amount: 1 },
							});
							characterItem.equipped = true;
							await characterItem.save();

							// Recalculate stats
							await characterUtility.recalculateCharacterStats(character);

							await i.reply({ content: `You have equipped ${item.name}.`, flags: MessageFlags.Ephemeral });
							collector.stop();
						}
						else if (i.customId === `unequip_item_${item.id}`) {
							if (!character) {
								await i.reply({ content: 'No character found for your account.', flags: MessageFlags.Ephemeral });
								collector.stop();
								return;
							}
							const characterItem = await CharacterItem.findOne({
								where: { character_id: character.id, item_id: item.id, equipped: true },
							});
							if (characterItem) {
								characterItem.equipped = false;
								await characterItem.save();

								// Recalculate stats
								await characterUtility.recalculateCharacterStats(character);

								await i.reply({ content: `You have unequipped ${item.name}.`, flags: MessageFlags.Ephemeral });
							}
							else {
								await i.reply({ content: 'This item is not currently equipped.', flags: MessageFlags.Ephemeral });
							}
							collector.stop();
						}
						else if (i.customId === `discard_item_${item.id}`) {
							if (!character) {
								await i.reply({ content: 'No character found for your account.', flags: MessageFlags.Ephemeral });
								collector.stop();
								return;
							}
							const characterItem = await CharacterItem.findOne({
								where: { character_id: character.id, item_id: item.id },
							});
							if (characterItem) {
								if (characterItem.amount > 1) {
									characterItem.amount -= 1;
									await characterItem.save();
									await i.reply({ content: `You discarded 1 ${item.name}. You have ${characterItem.amount} left.`, flags: MessageFlags.Ephemeral });
								}
								else {
									await characterItem.destroy();
									await i.reply({ content: `You discarded ${item.name}.`, flags: MessageFlags.Ephemeral });
								}
							}
							else {
								await i.reply({ content: 'You do not have this item in your inventory.', flags: MessageFlags.Ephemeral });
							}
							collector.stop();
						}
						else if (i.customId === `close_item_${item.id}`) {
							await i.deferUpdate();
							collector.stop();
						}
					}
					catch (btnError) {
						console.error('Error in item button interaction:', btnError);
						try {
							await i.reply({ content: 'An error occurred while performing this action.', flags: MessageFlags.Ephemeral });
						}
						catch (btnReplyError) {
							console.error('Error sending button error message:', btnReplyError);
						}
					}
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
