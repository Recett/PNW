const { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ComponentType, MessageFlags } = require('discord.js');
const { CharacterItem, CharacterBase, CharacterStatus } = require('@root/dbObject.js');
const contentStore = require('@root/contentStore.js');
const getCharacterUtility = () => require('./characterUtility');
const { EMOJI } = require('../enums');

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
			{ name: 'Weapon Type', value: capitalizeFirst(item.weapon.subtype), inline: true },
		);
		// Numeric fields on next line
		embed.fields.push(
			{ name: 'Base Damage', value: String(item.weapon.base_damage || 0), inline: true },
			{ name: 'Scaling', value: String(item.weapon.scaling || 0), inline: true },
			{ name: 'Hit Modifier', value: `${(item.weapon.hit_mod || 0) * 100}%`, inline: true },
			{ name: 'Cooldown', value: String(item.weapon.cooldown || 0), inline: true },
			{ name: 'Weight', value: String(item.weight || 0), inline: true },
		);
		if (item.weapon.special) {
			embed.fields.push(
				{ name: 'Special', value: `${item.weapon.special} (${item.weapon.special_value || 0})`, inline: false },
			);
		}
		if (item.weapon.parry_rating) {
			embed.fields.push(
				{ name: 'Parry Rating', value: String(item.weapon.parry_rating), inline: true },
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
			{ name: 'Crit Resistance', value: String(item.armor.crit_resistance || 0), inline: true },
			{ name: 'Evade', value: String(item.armor.evade || 0), inline: true },
			{ name: 'Weight', value: String(item.weight || 0), inline: true },
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
		const rowButtons = [
			new ButtonBuilder()
				.setCustomId(`discard_item_${item.id}`)
				.setLabel('Discard')
				.setStyle('Danger'),
			new ButtonBuilder()
				.setCustomId(`close_item_${item.id}`)
				.setLabel('Close')
				.setStyle('Secondary'),
		];
		if (item.tag && Array.isArray(item.tag) && item.tag.includes('usable')) {
			rowButtons.unshift(
				new ButtonBuilder()
					.setCustomId(`use_item_${item.id}`)
					.setLabel('Use')
					.setStyle('Primary'),
			);
		}
		components.push(new ActionRowBuilder().addComponents(...rowButtons));
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

			await getCharacterUtility().setCharacterItemEquipped(character.id, item.id, 'equip');

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

			const result = await getCharacterUtility().setCharacterItemEquipped(character.id, item.id, 'unequip');
			if (result) {
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

			const confirmRow = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId(`confirm_discard_${item.id}`)
					.setLabel('Confirm')
					.setStyle('Danger'),
				new ButtonBuilder()
					.setCustomId(`cancel_discard_${item.id}`)
					.setLabel('Cancel')
					.setStyle('Secondary'),
			);

			await btnInteraction.reply({
				content: `Are you sure you want to discard **${item.name}**? This cannot be undone.`,
				flags: MessageFlags.Ephemeral,
				components: [confirmRow],
			});

			const confirmMessage = await btnInteraction.fetchReply();
			const confirmCollector = confirmMessage.createMessageComponentCollector({
				componentType: ComponentType.Button,
				filter: i => i.user.id === btnInteraction.user.id,
				time: 30_000,
				max: 1,
			});

			confirmCollector.on('collect', async confirmI => {
				if (confirmI.customId === `confirm_discard_${item.id}`) {
					const result = await getCharacterUtility().removeCharacterItem(character.id, item.id, 1);
					if (result.success) {
						const remaining = await CharacterItem.findOne({
							where: { character_id: character.id, item_id: item.id },
						});
						if (remaining) {
							await confirmI.update({ content: `You discarded 1 ${item.name}. You have ${remaining.amount} left.`, components: [] });
						}
						else {
							await confirmI.update({ content: `You discarded ${item.name}.`, components: [] });
						}
					}
					else {
						await confirmI.update({ content: 'You do not have this item in your inventory.', components: [] });
					}
					if (onComplete) onComplete();
				}
				else if (confirmI.customId === `cancel_discard_${item.id}`) {
					await confirmI.update({ content: 'Discard cancelled.', components: [] });
				}
			});

			confirmCollector.on('end', async (collected) => {
				if (collected.size === 0) {
					try {
						await btnInteraction.editReply({ content: 'Discard cancelled (timed out).', components: [] });
					}
					catch { /* interaction may have expired */ }
				}
			});

			return true;
		}
		else if (customId === `close_item_${item.id}`) {
			await btnInteraction.deferUpdate();
			if (onComplete) onComplete();
			return true;
		}
		else if (customId === `use_item_${item.id}`) {
			if (item.id !== 'med_kit') return false;

			if (!character) {
				await btnInteraction.reply({ content: 'No character found for your account.', flags: MessageFlags.Ephemeral });
				if (onComplete) onComplete();
				return true;
			}

			if ((character.currentStamina || 0) < 5) {
				await btnInteraction.reply({
					content: `${EMOJI.FAILURE} You need at least 5 stamina to use the Med Kit. (Current: ${character.currentStamina || 0})`,
					flags: MessageFlags.Ephemeral,
				});
				if (onComplete) onComplete();
				return true;
			}

			const nearbyCharacters = await CharacterBase.findAll({
				where: { location_id: character.location_id },
				attributes: ['id', 'name', 'currentHp', 'maxHp'],
			});

			if (!nearbyCharacters || nearbyCharacters.length === 0) {
				await btnInteraction.reply({
					content: `${EMOJI.FAILURE} There is no one at your location to heal.`,
					flags: MessageFlags.Ephemeral,
				});
				if (onComplete) onComplete();
				return true;
			}

			const selectOptions = nearbyCharacters.slice(0, 25).map(c => ({
				label: (c.name || c.id).substring(0, 100),
				value: c.id,
				description: `HP: ${c.currentHp || 0} / ${c.maxHp || 0}`,
			}));

			const selectRow = new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder()
					.setCustomId(`med_kit_target_${item.id}`)
					.setPlaceholder('Select a target to heal...')
					.addOptions(selectOptions),
			);

			await btnInteraction.reply({
				content: `${EMOJI.INFO} Who do you want to heal? (Costs 5 stamina)`,
				flags: MessageFlags.Ephemeral,
				components: [selectRow],
			});

			const selectMessage = await btnInteraction.fetchReply();
			const selectCollector = selectMessage.createMessageComponentCollector({
				componentType: ComponentType.StringSelect,
				filter: i => i.user.id === btnInteraction.user.id,
				time: 30_000,
				max: 1,
			});

			selectCollector.on('collect', async selectI => {
				const targetId = selectI.values[0];
				const target = await CharacterBase.findByPk(targetId);
				if (!target) {
					await selectI.update({ content: `${EMOJI.FAILURE} Target not found.`, components: [] });
					if (onComplete) onComplete();
					return;
				}

				const now = new Date();
				const cooldownRow = await CharacterStatus.findOne({ where: { character_id: target.id, status_id: 'medkit_cooldown' } });
				if (cooldownRow && cooldownRow.expires_at && new Date(cooldownRow.expires_at) > now) {
					const expiresTs = Math.floor(new Date(cooldownRow.expires_at).getTime() / 1000);
					const isSelfCd = target.id === character.id;
					const cdLabel = isSelfCd ? 'You have' : `**${target.name}** has`;
					await selectI.update({
						content: `${EMOJI.FAILURE} ${cdLabel} already received Med Kit treatment recently. Can be used again <t:${expiresTs}:R>.`,
						components: [],
					});
					if (onComplete) onComplete();
					return;
				}

				const healAmount = Math.floor((target.maxHp || 0) * 0.2);
				const newHp = Math.min(target.maxHp || 0, (target.currentHp || 0) + healAmount);

				await CharacterBase.update({ currentHp: newHp }, { where: { id: target.id } });
				await CharacterBase.update(
					{ currentStamina: Math.max(0, (character.currentStamina || 0) - 5) },
					{ where: { id: character.id } },
				);
				await getCharacterUtility().removeCharacterItem(character.id, item.id, 1);

				const cooldownExpires = new Date(Date.now() + 3 * 60 * 60 * 1000);
				const [cdRow, cdCreated] = await CharacterStatus.findOrCreate({
					where: { character_id: target.id, status_id: 'medkit_cooldown' },
					defaults: {
						category: 'neutral',
						scope: 'persistent',
						duration_unit: 'seconds',
						expires_at: cooldownExpires,
						source: 'medkit',
					},
				});
				if (!cdCreated) {
					await cdRow.update({ expires_at: cooldownExpires });
				}

				const isSelf = target.id === character.id;
				const targetLabel = isSelf ? 'yourself' : `**${target.name}**`;
				await selectI.update({
					content: `${EMOJI.SUCCESS} Healed ${targetLabel} for **${healAmount} HP**. (${target.currentHp || 0} \u2192 ${newHp}/${target.maxHp || 0})`,
					components: [],
				});
				if (onComplete) onComplete();
			});

			selectCollector.on('end', async (collected) => {
				if (collected.size === 0) {
					try {
						await btnInteraction.editReply({ content: 'Med Kit use cancelled (timed out).', components: [] });
					}
					catch { /* interaction may have expired */ }
				}
			});

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
	return contentStore.items.findByPk(itemId);
}

/**
 * Get item name by ID
 * @param {number|string} itemId - The item ID
 * @returns {Promise<string>} The item name or fallback
 */
async function getItemName(itemId) {
	const item = contentStore.items.findByPk(itemId);
	return item ? item.name : `Item #${itemId}`;
}

/**
 * Find item by tag
 * @param {string} tag - Tag to search for
 * @returns {Promise<Object|null>} Item or null
 */
async function findItemByTag(tag) {
	const allItems = contentStore.items.findAll();
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
	const equipped = await CharacterItem.findAll({
		where: { character_id: characterId, equipped: true },
	});
	return equipped
		.map(ci => {
			ci.item = contentStore.items.findByPk(ci.item_id);
			return ci;
		})
		.filter(ci => ci.item && ci.item.item_type === itemType);
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
	const items = await CharacterItem.findAll({
		where: { character_id: characterId },
	});
	return items
		.map(ci => {
			ci.item = contentStore.items.findByPk(ci.item_id);
			return ci;
		})
		.filter(ci => ci.item && ci.item.item_type === itemType);
}

/**
 * Get all character items (full inventory)
 * @param {string} characterId - Character ID
 * @returns {Promise<Array>} CharacterItem array with item associations
 */
async function getCharacterInventory(characterId) {
	const items = await CharacterItem.findAll({
		where: { character_id: characterId },
	});
	return items.map(ci => {
		const raw = ci.get ? ci.get({ plain: true }) : ci;
		raw.item = contentStore.items.findByPk(raw.item_id);
		return raw;
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
