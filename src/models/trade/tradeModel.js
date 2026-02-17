const Sequelize = require('sequelize');

/**
 * TRADE SYSTEM
 * 
 * Allows players to trade items with each other.
 * Each player can only have one active trade at a time.
 * Both players must confirm before the trade executes.
 */

// Main trade session table
const trade = (sequelize) => {
	return sequelize.define('trade', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		// Player who initiated the trade
		initiator_id: { type: Sequelize.STRING, allowNull: false },
		// Player who received the trade request
		recipient_id: { type: Sequelize.STRING, allowNull: false },
		// Trade status: pending, active, confirmed, completed, cancelled
		status: { type: Sequelize.STRING, defaultValue: 'pending' },
		// Whether each player has confirmed
		initiator_confirmed: { type: Sequelize.BOOLEAN, defaultValue: false },
		recipient_confirmed: { type: Sequelize.BOOLEAN, defaultValue: false },
		// Discord message ID for updating the trade UI
		message_id: { type: Sequelize.STRING, allowNull: true },
		channel_id: { type: Sequelize.STRING, allowNull: true },
		// Timestamps
		created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
		expires_at: { type: Sequelize.DATE, allowNull: true },
	}, { timestamps: false });
};

// Items in a trade (linked to trade session)
const tradeItem = (sequelize) => {
	return sequelize.define('trade_item', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		// Reference to trade session
		trade_id: { type: Sequelize.INTEGER, allowNull: false },
		// Who is offering this item
		owner_id: { type: Sequelize.STRING, allowNull: false },
		// Reference to character_item (the specific item instance)
		character_item_id: { type: Sequelize.INTEGER, allowNull: false },
		// Quantity being traded
		quantity: { type: Sequelize.INTEGER, defaultValue: 1 },
	}, { timestamps: false });
};

module.exports = {
	trade,
	tradeItem,
};
