const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { getCharacterBase } = require('../../utility/characterUtility');
const tradeUtility = require('../../utility/tradeUtility');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('trade')
		.setDescription('Trade items with another player')
		.addSubcommand(subcommand =>
			subcommand
				.setName('start')
				.setDescription('Start a trade with another player')
				.addUserOption(option =>
					option.setName('player')
						.setDescription('The player to trade with')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Add an item to your trade offer')
				.addIntegerOption(option =>
					option.setName('quantity')
						.setDescription('Quantity to add (default: 1)')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('remove')
				.setDescription('Remove an item from your trade offer'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('confirm')
				.setDescription('Confirm your side of the trade'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('cancel')
				.setDescription('Cancel the current trade'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('view')
				.setDescription('View the current trade')),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const character = await getCharacterBase(interaction.user.id);

		if (!character) {
			return interaction.reply({ content: 'You need a character to trade. Use `/newchar` to create one.', ephemeral: true });
		}

		switch (subcommand) {
		case 'start':
			return handleStart(interaction, character);
		case 'add':
			return handleAdd(interaction, character);
		case 'remove':
			return handleRemove(interaction, character);
		case 'confirm':
			return handleConfirm(interaction, character);
		case 'cancel':
			return handleCancel(interaction, character);
		case 'view':
			return handleView(interaction, character);
		default:
			return interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
		}
	},
};

async function handleStart(interaction, character) {
	const targetUser = interaction.options.getUser('player');

	if (targetUser.id === interaction.user.id) {
		return interaction.reply({ content: 'You cannot trade with yourself.', ephemeral: true });
	}

	if (targetUser.bot) {
		return interaction.reply({ content: 'You cannot trade with bots.', ephemeral: true });
	}

	const targetCharacter = await getCharacterBase(targetUser.id);
	if (!targetCharacter) {
		return interaction.reply({ content: 'That player does not have a character.', ephemeral: true });
	}

	const channel = interaction.channel;
	const channelId = channel.isThread() ? channel.parentId : interaction.channelId;
	const result = await tradeUtility.createTrade(character.id, targetCharacter.id, channelId);

	if (!result.success) {
		return interaction.reply({ content: result.error, ephemeral: true });
	}

	const embed = await tradeUtility.buildTradeEmbed(result.trade);
	const buttons = tradeUtility.buildTradeButtons(result.trade, true);

	await interaction.reply({
		content: `<@${targetUser.id}>, ${character.name} wants to trade with you!`,
		embeds: [embed],
		components: buttons,
	});

	// Store message ID for later updates
	const message = await interaction.fetchReply();
	result.trade.message_id = message.id;
	await result.trade.save();
}

async function handleAdd(interaction, character) {
	const trade = await tradeUtility.getActiveTrade(character.id);

	if (!trade) {
		return interaction.reply({ content: 'You do not have an active trade.', ephemeral: true });
	}

	if (trade.status !== 'active') {
		return interaction.reply({ content: 'The trade must be accepted before you can add items.', ephemeral: true });
	}

	const quantity = interaction.options.getInteger('quantity') || 1;

	// Get character's inventory
	const { CharacterItem, ItemLib } = require('../../dbObject');
	const inventory = await CharacterItem.findAll({
		where: { character_id: character.id },
	});

	if (inventory.length === 0) {
		return interaction.reply({ content: 'Your inventory is empty.', ephemeral: true });
	}

	// Build select menu for items
	const options = [];
	for (const charItem of inventory.slice(0, 25)) {
		const item = await ItemLib.findByPk(charItem.item_id);
		if (item) {
			options.push({
				label: `${item.name} (x${charItem.quantity})`,
				description: item.description?.substring(0, 100) || 'No description',
				value: `${charItem.id}_${quantity}`,
			});
		}
	}

	if (options.length === 0) {
		return interaction.reply({ content: 'No tradeable items found.', ephemeral: true });
	}

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(`trade_add_item_${trade.id}`)
		.setPlaceholder('Select an item to add')
		.addOptions(options);

	const row = new ActionRowBuilder().addComponents(selectMenu);

	await interaction.reply({
		content: `Select an item to add to the trade (quantity: ${quantity}):`,
		components: [row],
		ephemeral: true,
	});
}

async function handleRemove(interaction, character) {
	const trade = await tradeUtility.getActiveTrade(character.id);

	if (!trade) {
		return interaction.reply({ content: 'You do not have an active trade.', ephemeral: true });
	}

	if (trade.status !== 'active') {
		return interaction.reply({ content: 'The trade is not active.', ephemeral: true });
	}

	// Get items this player has in the trade
	const tradeItems = await tradeUtility.getPlayerTradeItems(trade.id, character.id);

	if (tradeItems.length === 0) {
		return interaction.reply({ content: 'You have no items in this trade.', ephemeral: true });
	}

	// Build select menu
	const { CharacterItem, ItemLib } = require('../../dbObject');
	const options = [];
	for (const ti of tradeItems) {
		const charItem = await CharacterItem.findByPk(ti.character_item_id);
		if (charItem) {
			const item = await ItemLib.findByPk(charItem.item_id);
			if (item) {
				options.push({
					label: `${item.name} (x${ti.quantity} in trade)`,
					value: `${ti.character_item_id}`,
				});
			}
		}
	}

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(`trade_remove_item_${trade.id}`)
		.setPlaceholder('Select an item to remove')
		.addOptions(options);

	const row = new ActionRowBuilder().addComponents(selectMenu);

	await interaction.reply({
		content: 'Select an item to remove from the trade:',
		components: [row],
		ephemeral: true,
	});
}

async function handleConfirm(interaction, character) {
	const trade = await tradeUtility.getActiveTrade(character.id);

	if (!trade) {
		return interaction.reply({ content: 'You do not have an active trade.', ephemeral: true });
	}

	const result = await tradeUtility.confirmTrade(trade.id, character.id);

	if (!result.success) {
		return interaction.reply({ content: result.error, ephemeral: true });
	}

	if (result.bothConfirmed) {
		// Trade completed!
		const embed = await tradeUtility.buildTradeEmbed(trade);
		embed.setColor(0x00FF00);
		embed.setDescription('✅ Trade completed successfully!');

		await interaction.reply({ embeds: [embed] });

		// Update original message if possible
		await updateTradeMessage(interaction, trade);
	}
	else {
		await interaction.reply({ content: 'You have confirmed the trade. Waiting for the other player...', ephemeral: true });

		// Update the trade message
		await updateTradeMessage(interaction, trade);
	}
}

async function handleCancel(interaction, character) {
	const trade = await tradeUtility.getActiveTrade(character.id);

	if (!trade) {
		return interaction.reply({ content: 'You do not have an active trade.', ephemeral: true });
	}

	const result = await tradeUtility.cancelTrade(trade.id, character.id);

	if (!result.success) {
		return interaction.reply({ content: result.error, ephemeral: true });
	}

	await interaction.reply({ content: '❌ Trade cancelled.' });

	// Update original message
	await updateTradeMessage(interaction, trade, true);
}

async function handleView(interaction, character) {
	const trade = await tradeUtility.getActiveTrade(character.id);

	if (!trade) {
		return interaction.reply({ content: 'You do not have an active trade.', ephemeral: true });
	}

	const embed = await tradeUtility.buildTradeEmbed(trade);
	const isInitiator = trade.initiator_id === character.id;
	const buttons = tradeUtility.buildTradeButtons(trade, isInitiator);

	await interaction.reply({ embeds: [embed], components: buttons, ephemeral: true });
}

async function updateTradeMessage(interaction, trade, cancelled = false) {
	try {
		if (trade.message_id && trade.channel_id) {
			const channel = await interaction.client.channels.fetch(trade.channel_id);
			const message = await channel.messages.fetch(trade.message_id);

			// Reload trade to get updated state
			await trade.reload();

			const embed = await tradeUtility.buildTradeEmbed(trade);
			if (cancelled) {
				embed.setColor(0xFF0000);
				embed.setDescription('❌ Trade was cancelled.');
			}
			else if (trade.status === 'completed') {
				embed.setColor(0x00FF00);
				embed.setDescription('✅ Trade completed successfully!');
			}

			await message.edit({ embeds: [embed], components: [] });
		}
	}
	catch (error) {
		console.error('Failed to update trade message:', error);
	}
}
