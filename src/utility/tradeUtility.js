const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const contentStore = require('@root/contentStore.js');
const characterUtil = require('@utility/characterUtility.js');
const { Trade, TradeItem, CharacterItem, CharacterBase } = require('@root/dbObject');

/**
 * Check if a player has an active trade
 */
async function getActiveTrade(characterId) {
	const trade = await Trade.findOne({
		where: {
			status: ['pending', 'active'],
			[require('sequelize').Op.or]: [
				{ initiator_id: characterId },
				{ recipient_id: characterId },
			],
		},
	});
	return trade;
}

/**
 * Create a new trade between two players
 */
async function createTrade(initiatorId, recipientId, channelId) {
	// Check if either player already has an active trade
	const initiatorTrade = await getActiveTrade(initiatorId);
	if (initiatorTrade) {
		return { success: false, error: 'You already have an active trade.' };
	}

	const recipientTrade = await getActiveTrade(recipientId);
	if (recipientTrade) {
		return { success: false, error: 'That player already has an active trade.' };
	}

	// Create the trade with 10 minute expiry
	const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
	const trade = await Trade.create({
		initiator_id: initiatorId,
		recipient_id: recipientId,
		status: 'pending',
		channel_id: channelId,
		expires_at: expiresAt,
	});

	return { success: true, trade };
}

/**
 * Accept a pending trade request
 */
async function acceptTrade(tradeId, recipientId) {
	const trade = await Trade.findByPk(tradeId);
	if (!trade) {
		return { success: false, error: 'Trade not found.' };
	}
	if (trade.recipient_id !== recipientId) {
		return { success: false, error: 'You are not the recipient of this trade.' };
	}
	if (trade.status !== 'pending') {
		return { success: false, error: 'This trade is no longer pending.' };
	}

	trade.status = 'active';
	await trade.save();

	return { success: true, trade };
}

/**
 * Cancel a trade
 */
async function cancelTrade(tradeId, characterId) {
	const trade = await Trade.findByPk(tradeId);
	if (!trade) {
		return { success: false, error: 'Trade not found.' };
	}
	if (trade.initiator_id !== characterId && trade.recipient_id !== characterId) {
		return { success: false, error: 'You are not part of this trade.' };
	}
	if (trade.status === 'completed' || trade.status === 'cancelled') {
		return { success: false, error: 'This trade is already finished.' };
	}

	// Remove all trade items
	await TradeItem.destroy({ where: { trade_id: tradeId } });

	trade.status = 'cancelled';
	await trade.save();

	return { success: true };
}

/**
 * Add an item to the trade
 */
async function addItemToTrade(tradeId, characterId, characterItemId, quantity = 1) {
	const trade = await Trade.findByPk(tradeId);
	if (!trade) {
		return { success: false, error: 'Trade not found.' };
	}
	if (trade.initiator_id !== characterId && trade.recipient_id !== characterId) {
		return { success: false, error: 'You are not part of this trade.' };
	}
	if (trade.status !== 'active') {
		return { success: false, error: 'Trade is not active.' };
	}

	// Verify the character owns this item
	const charItem = await CharacterItem.findOne({
		where: { id: characterItemId, character_id: characterId },
	});
	if (!charItem) {
		return { success: false, error: 'You do not own this item.' };
	}

	// Block equipped items
	if (charItem.equipped) {
		return { success: false, error: 'You cannot trade an equipped item. Unequip it first.' };
	}

	// Check quantity
	if (charItem.amount < quantity) {
		return { success: false, error: `You only have ${charItem.amount} of this item.` };
	}

	// Check if item is already in trade
	const existingTradeItem = await TradeItem.findOne({
		where: { trade_id: tradeId, character_item_id: characterItemId },
	});
	if (existingTradeItem) {
		// Update quantity
		const newQty = existingTradeItem.quantity + quantity;
		if (newQty > charItem.amount) {
			return { success: false, error: `You only have ${charItem.amount} of this item.` };
		}
		existingTradeItem.quantity = newQty;
		await existingTradeItem.save();
	}
	else {
		// Add new trade item
		await TradeItem.create({
			trade_id: tradeId,
			owner_id: characterId,
			character_item_id: characterItemId,
			quantity: quantity,
		});
	}

	// Reset confirmations when items change
	trade.initiator_confirmed = false;
	trade.recipient_confirmed = false;
	await trade.save();

	return { success: true };
}

/**
 * Remove an item from the trade
 */
async function removeItemFromTrade(tradeId, characterId, characterItemId, quantity = null) {
	const trade = await Trade.findByPk(tradeId);
	if (!trade) {
		return { success: false, error: 'Trade not found.' };
	}
	if (trade.initiator_id !== characterId && trade.recipient_id !== characterId) {
		return { success: false, error: 'You are not part of this trade.' };
	}
	if (trade.status !== 'active') {
		return { success: false, error: 'Trade is not active.' };
	}

	const tradeItem = await TradeItem.findOne({
		where: { trade_id: tradeId, character_item_id: characterItemId, owner_id: characterId },
	});
	if (!tradeItem) {
		return { success: false, error: 'This item is not in the trade.' };
	}

	if (quantity === null || quantity >= tradeItem.quantity) {
		// Remove entirely
		await tradeItem.destroy();
	}
	else {
		// Reduce quantity
		tradeItem.quantity -= quantity;
		await tradeItem.save();
	}

	// Reset confirmations when items change
	trade.initiator_confirmed = false;
	trade.recipient_confirmed = false;
	await trade.save();

	return { success: true };
}

/**
 * Confirm the trade from one side
 */
async function confirmTrade(tradeId, characterId) {
	const trade = await Trade.findByPk(tradeId);
	if (!trade) {
		return { success: false, error: 'Trade not found.' };
	}
	if (trade.initiator_id !== characterId && trade.recipient_id !== characterId) {
		return { success: false, error: 'You are not part of this trade.' };
	}
	if (trade.status !== 'active') {
		return { success: false, error: 'Trade is not active.' };
	}

	if (characterId === trade.initiator_id) {
		trade.initiator_confirmed = true;
	}
	else {
		trade.recipient_confirmed = true;
	}
	await trade.save();
	// Reload to get the current DB state (guards against concurrent confirmations overwriting each other)
	await trade.reload();

	// If both confirmed, execute the trade
	if (trade.initiator_confirmed && trade.recipient_confirmed) {
		return await executeTrade(tradeId);
	}

	return { success: true, bothConfirmed: false };
}

/**
 * Execute the trade - swap items between players
 */
async function executeTrade(tradeId) {
	const trade = await Trade.findByPk(tradeId);
	if (!trade || trade.status !== 'active') {
		return { success: false, error: 'Trade not found or not active.' };
	}

	// Check daily trade limit (1 successful trade per player per UTC day)
	const todayDay = Math.floor(Date.now() / 86400000);
	const [initiatorLastDay, recipientLastDay] = await Promise.all([
		characterUtil.getCharacterFlag(trade.initiator_id, 'last_trade_day'),
		characterUtil.getCharacterFlag(trade.recipient_id, 'last_trade_day'),
	]);
	if (initiatorLastDay === todayDay || recipientLastDay === todayDay) {
		return { success: false, error: 'One or both players have already completed a trade today. Try again tomorrow (resets at UTC midnight).' };
	}

	// Use a transaction for atomic swap
	const sequelize = Trade.sequelize;
	const transaction = await sequelize.transaction();

	try {
		// Atomically claim the trade — prevents double execution from race conditions
		const [claimedCount] = await Trade.update(
			{ status: 'completed' },
			{ where: { id: tradeId, status: 'active' }, transaction },
		);
		if (claimedCount === 0) {
			await transaction.rollback();
			return { success: false, error: 'Trade is no longer active.' };
		}

		const tradeItems = await TradeItem.findAll({ where: { trade_id: tradeId }, transaction });

		// Snapshot the data we need from each trade item before clearing FK references
		const transfers = [];
		for (const tradeItem of tradeItems) {
			const charItem = await CharacterItem.findByPk(tradeItem.character_item_id, { transaction });
			if (!charItem) {
				throw new Error('Item no longer exists.');
			}
			if (charItem.amount < tradeItem.quantity) {
				throw new Error(`Insufficient quantity for item ${charItem.item_id}.`);
			}
			transfers.push({
				charItem,
				quantity: tradeItem.quantity,
				owner_id: tradeItem.owner_id,
			});
		}

		// Destroy TradeItem rows first so the FK reference to character_items is removed
		// before we destroy/modify those rows (SQLite FK checks are ON)
		await TradeItem.destroy({ where: { trade_id: tradeId }, transaction });

		for (const { charItem, quantity, owner_id } of transfers) {
			// Determine the other player
			const newOwnerId = owner_id === trade.initiator_id
				? trade.recipient_id
				: trade.initiator_id;

			// Check if the recipient already has this item
			const existingItem = await CharacterItem.findOne({
				where: { character_id: newOwnerId, item_id: charItem.item_id },
				transaction,
			});

			if (existingItem) {
				// Add to existing stack
				existingItem.amount += quantity;
				await existingItem.save({ transaction });
			}
			else {
				// Create new item for recipient
				await CharacterItem.create({
					character_id: newOwnerId,
					item_id: charItem.item_id,
					amount: quantity,
					equipped: false,
				}, { transaction });
			}

			// Remove from original owner
			if (charItem.amount === quantity) {
				await charItem.destroy({ transaction });
			}
			else {
				charItem.amount -= quantity;
				await charItem.save({ transaction });
			}
		}

		await transaction.commit();

		// Record today's UTC day for both players to enforce the daily limit
		await Promise.all([
			characterUtil.updateCharacterFlag(trade.initiator_id, 'last_trade_day', todayDay),
			characterUtil.updateCharacterFlag(trade.recipient_id, 'last_trade_day', todayDay),
		]);

		return { success: true, bothConfirmed: true };
	}
	catch (error) {
		await transaction.rollback();
		// Clean up TradeItem rows (the rollback restored them, so they're still in the DB)
		// and mark trade cancelled — must destroy TradeItems first due to FK constraint
		await TradeItem.destroy({ where: { trade_id: tradeId } });
		await Trade.update({ status: 'cancelled' }, { where: { id: tradeId } });
		return { success: false, error: error.message };
	}
}

/**
 * Build the trade embed showing both sides
 */
async function buildTradeEmbed(trade) {
	const initiator = await CharacterBase.findByPk(trade.initiator_id);
	const recipient = await CharacterBase.findByPk(trade.recipient_id);

	const initiatorItems = await TradeItem.findAll({
		where: { trade_id: trade.id, owner_id: trade.initiator_id },
	});
	const recipientItems = await TradeItem.findAll({
		where: { trade_id: trade.id, owner_id: trade.recipient_id },
	});

	// Build item lists
	const initiatorList = await formatItemList(initiatorItems);
	const recipientList = await formatItemList(recipientItems);

	const embed = new EmbedBuilder()
		.setTitle('📦 Trade')
		.setColor(trade.status === 'pending' ? 0xFFAA00 : 0x00AA00)
		.addFields(
			{
				name: `${initiator?.name || 'Unknown'}'s Offer ${trade.initiator_confirmed ? '✅' : ''}`,
				value: initiatorList || '*Nothing*',
				inline: true,
			},
			{
				name: `${recipient?.name || 'Unknown'}'s Offer ${trade.recipient_confirmed ? '✅' : ''}`,
				value: recipientList || '*Nothing*',
				inline: true,
			},
		)
		.setFooter({ text: `Trade ID: ${trade.id} | Status: ${trade.status}` });

	if (trade.status === 'pending') {
		embed.setDescription(`Waiting for ${recipient?.name || 'recipient'} to accept...`);
	}

	return embed;
}

/**
 * Format a list of trade items for display
 */
async function formatItemList(tradeItems) {
	if (!tradeItems || tradeItems.length === 0) return null;

	const lines = [];
	for (const ti of tradeItems) {
		const charItem = await CharacterItem.findByPk(ti.character_item_id);
		if (charItem) {
			const item = contentStore.items.findByPk(charItem.item_id);
			const name = item?.name || `Item #${charItem.item_id}`;
			lines.push(`• ${name} x${ti.quantity}`);
		}
	}
	return lines.join('\n') || null;
}

/**
 * Build action buttons for trade
 */
function buildTradeButtons(trade, isInitiator) {
	const rows = [];

	if (trade.status === 'pending' && !isInitiator) {
		// Accept/Decline buttons for recipient
		rows.push(new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`trade_accept_${trade.id}`)
				.setLabel('Accept')
				.setStyle(ButtonStyle.Success),
			new ButtonBuilder()
				.setCustomId(`trade_decline_${trade.id}`)
				.setLabel('Decline')
				.setStyle(ButtonStyle.Danger),
		));
	}
	else if (trade.status === 'active') {
		// Confirm/Cancel buttons
		const isConfirmed = isInitiator ? trade.initiator_confirmed : trade.recipient_confirmed;
		rows.push(new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`trade_confirm_${trade.id}`)
				.setLabel(isConfirmed ? 'Confirmed ✓' : 'Confirm')
				.setStyle(ButtonStyle.Success)
				.setDisabled(isConfirmed),
			new ButtonBuilder()
				.setCustomId(`trade_cancel_${trade.id}`)
				.setLabel('Cancel')
				.setStyle(ButtonStyle.Danger),
		));
	}

	return rows;
}

/**
 * Get trade items for a specific player
 */
async function getPlayerTradeItems(tradeId, characterId) {
	return await TradeItem.findAll({
		where: { trade_id: tradeId, owner_id: characterId },
	});
}

module.exports = {
	getActiveTrade,
	createTrade,
	acceptTrade,
	cancelTrade,
	addItemToTrade,
	removeItemFromTrade,
	confirmTrade,
	executeTrade,
	buildTradeEmbed,
	buildTradeButtons,
	getPlayerTradeItems,
};
