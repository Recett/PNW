const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, ComponentType, ButtonBuilder } = require('discord.js');
const { ItemLib } = require('@root/dbObject.js');
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
		const itemName = interaction.options.getString('name');
		const item = await ItemLib.findOne({ where: { name: itemName } });
		if (!item) {
			// Search for items with names containing the input
			// Only allow selection from user's inventory
			const { CharacterItem } = require('@root/dbObject.js');
			const matches = await CharacterItem.findAll({
				where: { character_id: userId },
				include: [{ model: ItemLib, as: 'item', where: { name: { [Op.substring]: itemName } } }],
				limit: 25,
			});
			if (!matches || matches.length === 0) {
				await interaction.reply({ content: `No item found with the name '${itemName}'.`, ephemeral: true });
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
			await interaction.reply({
				content: 'No exact item found. Please select from similar items below:',
				components: [row],
				ephemeral: true,
			});

			const collector = interaction.channel.createMessageComponentCollector({
				componentType: ComponentType.StringSelect,
				time: 60_000,
				filter: i => i.user.id === interaction.user.id,
			});

			collector.on('collect', async i => {
				const selectedId = i.values[0];
				const selectedItem = await ItemLib.findByPk(selectedId);
				if (!selectedItem) {
					await i.reply({ content: 'Item not found.', ephemeral: true });
					return;
				}
				const embed = {
					title: selectedItem.name,
					description: selectedItem.description || 'No description available.',
					fields: [
						{ name: 'Type', value: selectedItem.type || 'Unknown', inline: true },
					],
				};
				const components = [];
				if (selectedItem.type === 'Weapon' || selectedItem.type === 'Armor') {
					const equipButton = new ActionRowBuilder().addComponents(
						new ButtonBuilder()
							.setCustomId(`equip_item_${selectedItem.id}`)
							.setLabel('Equip')
							.setStyle('Primary'),
					);
					components.push(equipButton);
				}
				await i.reply({ embeds: [embed], ephemeral: true, components });
				if (components.length) {
					const buttonCollector = i.channel.createMessageComponentCollector({
						componentType: ComponentType.Button,
						time: 60_000,
						filter: btnI => btnI.user.id === i.user.id,
					});
					buttonCollector.on('collect', async btnI => {
						if (btnI.customId === `equip_item_${selectedItem.id}`) {
							const userId = btnI.user.id;
							const character = await characterUtility.getCharacterBase(userId);
							if (!character) {
								await btnI.reply({ content: 'No character found for your account.', ephemeral: true });
								buttonCollector.stop();
								return;
							}
							await characterUtility.equipCharacterItem(character.character_id, selectedItem.id, selectedItem.type);
							await btnI.reply({ content: `You have equipped ${selectedItem.name}.`, ephemeral: true });
							buttonCollector.stop();
						}
					});
				}
				collector.stop();
			});
			return;
		}
		const embed = {
			title: item.name,
			description: item.description || 'No description available.',
			fields: [
				{ name: 'Type', value: item.type || 'Unknown', inline: true },
			],
		};
		const components = [];
		if (item.type === 'Weapon' || item.type === 'Armor') {
			const equipButton = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`equip_item_${item.id}`)
					.setLabel('Equip')
					.setStyle('Primary'),
			);
			components.push(equipButton);
		}
		await interaction.reply({ embeds: [embed], ephemeral: true, components });

		if (components.length) {
			const collector = interaction.channel.createMessageComponentCollector({
				componentType: ComponentType.Button,
				time: 60_000,
				filter: i => i.user.id === interaction.user.id,
			});
			collector.on('collect', async i => {
				if (i.customId === `equip_item_${item.id}`) {
					const userId = i.user.id;
					const character = await characterUtility.getCharacterBase(userId);
					if (!character) {
						await i.reply({ content: 'No character found for your account.', ephemeral: true });
						collector.stop();
						return;
					}
					await characterUtility.equipCharacterItem(character.character_id, item.id, item.type);
					await i.reply({ content: `You have equipped ${item.name}.`, ephemeral: true });
					collector.stop();
				}
			});
		}

	},
};
