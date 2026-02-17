const { ActionRowBuilder, ButtonBuilder, MessageFlags } = require('discord.js');
const { ItemLib, CharacterItem, WeaponLib, ArmorLib } = require('@root/dbObject.js');
const characterUtility = require('./characterUtility');

/**
 * Builds an embed object for displaying item details
 * @param {Object} item - The item object with weapon/armor associations loaded
 * @param {Object} inventoryEntry - Optional inventory entry for amount/equipped status
 * @returns {Object} Embed object for Discord
 */
function buildItemEmbed(item, inventoryEntry = null) {
	// Capitalize first letter for display
	const capitalizeFirst = (str) => str ? str.charAt(0).toUpperCase() + str.slice(1) : 'Unknown';

	const embed = {
		title: item.name,
		description: item.description || 'No description available.',
		fields: [
			{ name: 'Type', value: capitalizeFirst(item.item_type), inline: true },
		],
	};

	// Add inventory-specific fields if provided
	if (inventoryEntry) {
		embed.fields.push(
			{ name: 'Amount', value: String(inventoryEntry.amount), inline: true },
			{ name: 'Equipped', value: inventoryEntry.equipped ? 'Yes' : 'No', inline: true },
		);
	}

	// Add weapon-specific stats
	if (item.item_type === 'weapon' && item.weapon) {
		// Text fields first
		embed.fields.push(
			{ name: 'Slot', value: capitalizeFirst(item.weapon.slot), inline: true },
			{ name: 'Weapon Type', value: capitalizeFirst(item.weapon.weapon_type), inline: true },
		);
		// Numeric fields on next line
		embed.fields.push(
			{ name: 'Base Damage', value: String(item.weapon.base_damage || 0), inline: true },
			{ name: 'Scaling', value: `${(item.weapon.scaling || 0) * 100}%`, inline: true },
			{ name: 'Hit Modifier', value: `${(item.weapon.hit_mod || 0) * 100}%`, inline: true },
			{ name: 'Cooldown', value: String(item.weapon.cooldown || 0), inline: true },
			{ name: 'Weight', value: String(item.weapon.weight || 0), inline: true },
		);
		if (item.weapon.special) {
			embed.fields.push(
				{ name: 'Special', value: `${item.weapon.special} (${item.weapon.special_value || 0})`, inline: false },
			);
		}
	}
	// Add armor-specific stats
	else if (item.item_type === 'armor' && item.armor) {
		// Text fields first
		embed.fields.push(
			{ name: 'Slot', value: capitalizeFirst(item.armor.slot), inline: true },
		);
		// Numeric fields on next line
		embed.fields.push(
			{ name: 'Defense', value: String(item.armor.defense || 0), inline: true },
			{ name: 'Defense %', value: `${item.armor.defense_percent || 0}%`, inline: true },
			{ name: 'Crit Resistance', value: String(item.armor.crit_resistance || 0), inline: true },
			{ name: 'Evade', value: String(item.armor.evade || 0), inline: true },
			{ name: 'Evade %', value: `${item.armor.evade_percent || 0}%`, inline: true },
			{ name: 'Weight', value: String(item.armor.weight || 0), inline: true },
		);
	}

	return embed;
}

/**
 * Builds action button row for item interactions
 * @param {Object} item - The item object
 * @param {boolean} isEquipped - Whether the item is currently equipped
 * @param {boolean} isEquippable - Whether the item can be equipped (Weapon/Armor)
 * @returns {ActionRowBuilder[]} Array of action rows with buttons
 */
function buildItemActionButtons(item, isEquipped = false, isEquippable = false) {
	const components = [];

	if (isEquippable) {
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
	else {
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

	return components;
}

/**
 * Handles button interactions for item actions (equip, unequip, discard, close)
 * @param {Object} btnInteraction - The button interaction from Discord
 * @param {Object} item - The item being acted upon
 * @param {Object} character - The character performing the action
 * @param {Function} onComplete - Optional callback when action completes
 * @returns {boolean} True if action was handled, false otherwise
 */
async function handleItemButtonAction(btnInteraction, item, character, onComplete = null) {
	const customId = btnInteraction.customId;

	try {
		if (customId === `equip_item_${item.id}`) {
			if (!character) {
				await btnInteraction.reply({ content: 'No character found for your account.', flags: MessageFlags.Ephemeral });
				if (onComplete) onComplete();
				return true;
			}

			const [characterItem] = await CharacterItem.findOrCreate({
				where: { character_id: character.id, item_id: item.id },
				defaults: { equipped: true, amount: 1 },
			});
			characterItem.equipped = true;
			await characterItem.save();

			// Recalculate stats
			await characterUtility.recalculateCharacterStats(character);

			await btnInteraction.reply({ content: `You have equipped ${item.name}.`, flags: MessageFlags.Ephemeral });
			if (onComplete) onComplete();
			return true;
		}
		else if (customId === `unequip_item_${item.id}`) {
			if (!character) {
				await btnInteraction.reply({ content: 'No character found for your account.', flags: MessageFlags.Ephemeral });
				if (onComplete) onComplete();
				return true;
			}

			const characterItem = await CharacterItem.findOne({
				where: { character_id: character.id, item_id: item.id, equipped: true },
			});
			if (characterItem) {
				characterItem.equipped = false;
				await characterItem.save();

				// Recalculate stats
				await characterUtility.recalculateCharacterStats(character);

				await btnInteraction.reply({ content: `You have unequipped ${item.name}.`, flags: MessageFlags.Ephemeral });
			}
			else {
				await btnInteraction.reply({ content: 'This item is not currently equipped.', flags: MessageFlags.Ephemeral });
			}
			if (onComplete) onComplete();
			return true;
		}
		else if (customId === `discard_item_${item.id}`) {
			if (!character) {
				await btnInteraction.reply({ content: 'No character found for your account.', flags: MessageFlags.Ephemeral });
				if (onComplete) onComplete();
				return true;
			}

			const characterItem = await CharacterItem.findOne({
				where: { character_id: character.id, item_id: item.id },
			});
			if (characterItem) {
				if (characterItem.amount > 1) {
					characterItem.amount -= 1;
					await characterItem.save();
					await btnInteraction.reply({ content: `You discarded 1 ${item.name}. You have ${characterItem.amount} left.`, flags: MessageFlags.Ephemeral });
				}
				else {
					await characterItem.destroy();
					await btnInteraction.reply({ content: `You discarded ${item.name}.`, flags: MessageFlags.Ephemeral });
				}
			}
			else {
				await btnInteraction.reply({ content: 'You do not have this item in your inventory.', flags: MessageFlags.Ephemeral });
			}
			if (onComplete) onComplete();
			return true;
		}
		else if (customId === `close_item_${item.id}`) {
			await btnInteraction.deferUpdate();
			if (onComplete) onComplete();
			return true;
		}

		return false;
	}
	catch (error) {
		console.error('Error in item button action:', error);
		try {
			await btnInteraction.reply({ content: 'An error occurred while performing this action.', flags: MessageFlags.Ephemeral });
		}
		catch (replyError) {
			console.error('Error sending button error message:', replyError);
		}
		if (onComplete) onComplete();
		return true;
	}
}

/**
 * Fetches an item with its weapon/armor associations
 * @param {number|string} itemId - The item ID
 * @returns {Object|null} The item with associations or null
 */
async function getItemWithDetails(itemId) {
	return await ItemLib.findByPk(itemId, {
		include: [
			{ model: WeaponLib, as: 'weapon', required: false },
			{ model: ArmorLib, as: 'armor', required: false },
		],
	});
}

/**
 * Get item name by ID
 * @param {number|string} itemId - The item ID
 * @returns {Promise<string>} The item name or fallback
 */
async function getItemName(itemId) {
	const item = await ItemLib.findByPk(itemId);
	return item ? item.name : `Item #${itemId}`;
}

/**
 * Find item by tag
 * @param {string} tag - Tag to search for
 * @returns {Promise<Object|null>} Item or null
 */
async function findItemByTag(tag) {
	const allItems = await ItemLib.findAll();
	const tagLower = tag.toLowerCase();
	return allItems.find(item =>
		item.tag && Array.isArray(item.tag) && 
		item.tag.some(t => t && t.toLowerCase() === tagLower),
	) || null;
}

/**
 * Checks if an item is equippable (Weapon or Armor)
 * @param {Object} item - The item object
 * @returns {boolean} True if equippable
 */
function isItemEquippable(item) {
	return item.item_type === 'weapon' || item.item_type === 'armor';
}

/**
 * Get character's equipped items by type (delegates CharacterItem queries involving ItemLib)
 * @param {string} characterId - Character ID
 * @param {string} itemType - 'weapon' or 'armor'
 * @returns {Promise<Array>} CharacterItem array with item association
 */
async function getCharacterEquippedItemsByType(characterId, itemType) {
	return await CharacterItem.findAll({
		where: { character_id: characterId, equipped: true },
		include: [
			{ model: ItemLib, as: 'item', where: { item_type: itemType } },
		],
	});
}

/**
 * Get character's equipped weapons
 * @param {string} characterId - Character ID
 * @returns {Promise<Array>} CharacterItem array with weapon details
 */
async function getCharacterEquippedWeapons(characterId) {
	return await getCharacterEquippedItemsByType(characterId, 'weapon');
}

/**
 * Get character's equipped armor
 * @param {string} characterId - Character ID
 * @returns {Promise<Array>} CharacterItem array with armor details
 */
async function getCharacterEquippedArmor(characterId) {
	return await getCharacterEquippedItemsByType(characterId, 'armor');
}

/**
 * Get all character items by type (equipped and unequipped)
 * @param {string} characterId - Character ID
 * @param {string} itemType - 'weapon', 'armor', etc.
 * @returns {Promise<Array>} CharacterItem array with item association
 */
async function getCharacterItemsByType(characterId, itemType) {
	return await CharacterItem.findAll({
		where: { character_id: characterId },
		include: [
			{ model: ItemLib, as: 'item', where: { item_type: itemType } },
		],
	});
}

/**
 * Get all character items (full inventory)
 * @param {string} characterId - Character ID
 * @returns {Promise<Array>} CharacterItem array with item associations
 */
async function getCharacterInventory(characterId) {
	return await CharacterItem.findAll({
		where: { character_id: characterId },
		include: [{ model: ItemLib, as: 'item' }],
	});
}

module.exports = {
	buildItemEmbed,
	buildItemActionButtons,
	handleItemButtonAction,
	getItemWithDetails,
	getItemName,
	findItemByTag,
	isItemEquippable,
	getCharacterEquippedItemsByType,
	getCharacterEquippedWeapons,
	getCharacterEquippedArmor,
	getCharacterItemsByType,
	getCharacterInventory,
};
