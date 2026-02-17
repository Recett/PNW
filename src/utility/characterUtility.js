// Lazy load to avoid circular dependency
const getDbModels = () => require('@root/dbObject.js');
const itemUtility = require('./itemUtility');

let getCharacterBase = async (userId) => {
	const { CharacterBase } = getDbModels();
	return await CharacterBase.findOne({
		where: {
			id: userId,
		},
	});
};

let getCharacterCurrentLocationId = async (userId) => {
	const { CharacterBase } = getDbModels();
	const character = await CharacterBase.findOne({ where: { id: userId } });
	return character ? character.location_id : null;
};

let calculateCombatStat = async (characterId) => {
	const { CharacterBase, CharacterCombatStat } = getDbModels();
	const character = await getCharacterBase(characterId);
	if (!character) return 0;

	// Base HP + CON bonus
	let hp = 40 + (character.con || 0) * 6;
	// Base Stamina + CON bonus
	let stamina = 60 + (character.con || 0);

	// Update maxHp in CharacterBase
	await CharacterBase.update({ maxHp: hp }, { where: { id: characterId } });
	await CharacterBase.update({ maxStamina: stamina }, { where: { id: characterId } });

	// Calculate defense as the sum of all equipped armor items' defense stat
	let defense = 0;
	const equippedItems = await itemUtility.getCharacterEquippedArmor(characterId);
	for (const eq of equippedItems) {
		if (eq.item) {
			const itemDetails = await itemUtility.getItemWithDetails(eq.item_id);
			if (itemDetails?.armor?.defense != null) {
				defense += itemDetails.armor.defense;
			}
		}
	}

	// Overweight penalty: lower agi by twice the overweight amount
	let agi = character.agi || 0;
	let str = character.str || 0;

	// Calculate currentWeight by summing weights of all items in inventory
	const { CharacterItem } = getDbModels();
	const allItems = await CharacterItem.findAll({
		where: { character_id: characterId },
	});
	let currentWeight = 0;
	for (const inv of allItems) {
		let weight = 0;
		const itemDetails = await itemUtility.getItemWithDetails(inv.item_id);
		if (itemDetails) {
			weight = itemDetails.weight || 0;
			// Try to get weapon/armor weight if not present on ItemLib
			if (!weight) {
				if (itemDetails.weapon?.weight) {
					weight = itemDetails.weapon.weight;
				}
				else if (itemDetails.armor?.weight) {
					weight = itemDetails.armor.weight;
				}
			}
		}
		currentWeight += (inv.amount || 1) * weight;
	}

	let maxWeight = str;
	if (currentWeight > maxWeight && maxWeight > 0) {
		// P = (W - C)² / (W / 1.5) where W = currentWeight, C = maxWeight
		const penalty = Math.pow(currentWeight - maxWeight, 2) * 1.5 / currentWeight;
		agi = Math.max(0, agi - penalty);
	}

	await CharacterCombatStat.upsert({
		character_id: characterId,
		defense,
		speed: agi,
		evade: agi,
		currentWeight,
		maxWeight,
	});
	return defense;
};

let calculateAttackStat = async (characterId) => {
	const { CharacterBase, CharacterAttackStat, CharacterCombatStat } = getDbModels();
	// Get character base
	const character = await CharacterBase.findOne({ where: { id: characterId } });
	if (!character) return 0;
	const str = character.str || 0;
	const dex = character.dex || 0;
	const agi = character.agi || 0;
	const cooldownReduction = Math.floor(Math.sqrt(agi));

	// Get combat stat for weight penalty calculation
	const combatStat = await CharacterCombatStat.findOne({ where: { character_id: characterId } });
	const currentWeight = combatStat?.currentWeight || 0;
	const maxWeight = combatStat?.maxWeight || 1;
	// P = (W - C)² / (W / 1.5) where W = currentWeight, C = maxWeight
	// Ensure penalty is never negative (always >= 0)
	const overweightPenalty = (currentWeight > maxWeight && currentWeight > 0)
		? Math.max(0, Math.pow(currentWeight - maxWeight, 2) * 1.5 / currentWeight)
		: 0;

	// Find ALL equipped weapons in inventory
	const equippedWeapons = await itemUtility.getCharacterEquippedWeapons(characterId);

	// Delete existing attack stats for this character to prevent duplicates
	await CharacterAttackStat.destroy({
		where: { character_id: characterId },
	});

	// Get weapon details for all equipped weapons
	const weaponDetails = [];
	for (const equippedWeapon of equippedWeapons) {
		const itemDetails = await itemUtility.getItemWithDetails(equippedWeapon.item_id);
		if (itemDetails?.weapon) {
			weaponDetails.push({
				charItem: equippedWeapon,
				weapon: itemDetails.weapon,
				item: itemDetails,
			});
		}
	}

	// Determine dual wield penalty based on equipped weapons
	let isDualWielding = false;
	let hasDualWieldingException = false;

	if (weaponDetails.length > 1) {
		const mainhandWeapons = weaponDetails.filter(w => w.weapon.slot === 'mainhand');
		const offhandWeapons = weaponDetails.filter(w => w.weapon.slot === 'offhand');

		// Check if any weapon has "No Dualwielding Penalty" tag
		for (const weaponDetail of weaponDetails) {
			if (weaponDetail.item) {
				const tags = weaponDetail.item.tags;
				if (tags && tags.toLowerCase().includes('no dualwielding penalty')) {
					hasDualWieldingException = true;
					break;
				}
			}
		}

		if (mainhandWeapons.length > 0 && offhandWeapons.length > 0) {
			// Standard dual wielding (mainhand + offhand)
			isDualWielding = true;
		}
		else if (weaponDetails.length > 1) {
			// Multiple weapons of same type or unusual combination
			isDualWielding = true;
		}
	}

	// Apply penalty only if dual wielding and no exception weapon is equipped
	const applyDualWieldPenalty = isDualWielding && !hasDualWieldingException;

	// Create attack stats for each equipped weapon
	if (weaponDetails && weaponDetails.length > 0) {
		for (const weaponDetail of weaponDetails) {
			const weapon = weaponDetail.weapon;
			const attack = (weapon.base_damage || 0) + Math.floor((weapon.scaling || 0) * str);
			let baseAccuracy = Math.floor(dex * (weapon.hit_mod || 0));
			// Apply dual wield penalty: halve accuracy if dual wielding and no exception
			if (applyDualWieldPenalty) baseAccuracy = Math.floor(baseAccuracy / 2);
			// Apply overweight penalty: P = (W - C)² / (W / 1.5)
			const accuracy = Math.max(0, Math.floor(baseAccuracy - overweightPenalty));
			const critical = Math.floor(dex * 0.4);
			const cooldown = Math.max(0, (weapon.cooldown || 80) - cooldownReduction);

			await CharacterAttackStat.create({
				character_id: characterId,
				item_id: weaponDetail.charItem.item_id,
				attack,
				accuracy,
				critical,
				cooldown,
			});
		}
		// Return the attack value of the first weapon (for backward compatibility)
		const firstWeaponDetail = weaponDetails[0];
		if (firstWeaponDetail?.weapon) {
			return (firstWeaponDetail.weapon.base_damage || 0) + Math.floor((firstWeaponDetail.weapon.scaling / 100 || 0) * str);
		}
	}
	else {
		// No weapons equipped - create unarmed attack
		const critical = Math.floor(dex * 0.4);
		const cooldown = Math.max(0, 60 - cooldownReduction);
		await CharacterAttackStat.create({
			character_id: characterId,
			item_id: null,
			attack: str,
			accuracy: 0,
			critical,
			cooldown,
		});
		return str;
	}

	return 0;
};

let updateCharacterFlag = async (characterId, flag, value) => {
	const { CharacterFlag } = getDbModels();
	// Delete flag if value is 0, null, or undefined (flag removal)
	if (value === 0 || value === null || value === undefined) {
		await CharacterFlag.destroy({
			where: { character_id: characterId, flag: flag },
		});
	}
	else {
		// Use destroy + create instead of upsert to avoid primary key requirement
		await CharacterFlag.destroy({
			where: { character_id: characterId, flag: flag },
		});
		await CharacterFlag.create({
			character_id: characterId,
			flag: flag,
			value: value,
		});
	}
};

let getCharacterFlag = async (characterId, flag) => {
	const { CharacterFlag } = getDbModels();
	const flagRow = await CharacterFlag.findOne({
		where: { character_id: characterId, flag: flag },
	});
	return flagRow ? flagRow.value : null;
};

let updateMultipleCharacterFlags = async (characterId, flags) => {
	for (const [flag, value] of Object.entries(flags)) {
		await updateCharacterFlag(characterId, flag, value);
	}
};

let getCharacterInventory = async (characterId) => {
	return await itemUtility.getCharacterInventory(characterId);
};

/**
 * Get all equipped items for a character with their slot information.
 * @param {string} characterId - The character ID
 * @returns {Promise<Array<{slot: string, itemName: string, itemId: number}>>} Array of equipped items with slot info
 */
let getCharacterEquippedItems = async (characterId) => {
	const { CharacterItem } = getDbModels();
	
	const equippedItems = await CharacterItem.findAll({
		where: { character_id: characterId, equipped: true },
	});

	const equipment = [];
	for (const charItem of equippedItems) {
		if (!charItem.item_id) continue;
		
		const itemDetails = await itemUtility.getItemWithDetails(charItem.item_id);
		if (!itemDetails) continue;
		
		let slot = null;
		const itemType = itemDetails.item_type?.toLowerCase();
		
		if (itemType === 'weapon' && itemDetails.weapon) {
			slot = itemDetails.weapon.slot;
		}
		else if (itemType === 'armor' && itemDetails.armor) {
			slot = itemDetails.armor.slot;
		}
		
		if (slot) {
			equipment.push({
				slot: slot,
				itemName: itemDetails.name,
				itemId: charItem.item_id,
			});
		}
	}
	
	return equipment;
};

let equipCharacterItem = async (characterId, itemId, type) => {
	const { CharacterItem } = getDbModels();
	// Normalize type to lowercase
	const normalizedType = type?.toLowerCase();
	
	// Get item with weapon/armor details using itemUtility
	const item = await itemUtility.getItemWithDetails(itemId);
	if (!item) throw new Error('Item not found.');
	
	// Determine the slot of the item to equip
	let slot = null;
	let isTwoHand = false;
	if (normalizedType === 'weapon' && item.weapon) {
		slot = item.weapon.slot;
		isTwoHand = item.weapon.slot === 'twohand';
	}
	else if (normalizedType === 'armor' && item.armor) {
		slot = item.armor.slot;
	}
	if (!slot) throw new Error('Item slot not found.');

	if (normalizedType === 'weapon') {
		// Get all currently equipped weapons
		const equippedWeapons = await itemUtility.getCharacterEquippedWeapons(characterId);
		if (isTwoHand) {
			// Unequip all mainhand/offhand weapons
			for (const charItem of equippedWeapons) {
				const weaponItem = await itemUtility.getItemWithDetails(charItem.item_id);
				if (weaponItem?.weapon && (weaponItem.weapon.slot === 'mainhand' || weaponItem.weapon.slot === 'offhand' || weaponItem.weapon.slot === 'twohand')) {
					charItem.equipped = false;
					await charItem.save();
				}
			}
		}
		else if (slot === 'mainhand' || slot === 'offhand') {
			// Count hands used
			let handsUsed = 0;
			let offhandEquipped = null;
			let mainhandEquipped = null;
			for (const charItem of equippedWeapons) {
				const weaponItem = await itemUtility.getItemWithDetails(charItem.item_id);
				if (!weaponItem?.weapon) continue;
				if (weaponItem.weapon.slot === 'mainhand') {
					handsUsed++;
					mainhandEquipped = charItem;
				}
				if (weaponItem.weapon.slot === 'offhand') {
					handsUsed++;
					offhandEquipped = charItem;
				}
				if (weaponItem.weapon.slot === 'twohand') {
					handsUsed = 2;
					mainhandEquipped = charItem;
					offhandEquipped = charItem;
				}
			}
			if (handsUsed >= 2) {
				// Prioritize unequipping offhand, then mainhand
				if (offhandEquipped && offhandEquipped.item_id !== itemId) {
					offhandEquipped.equipped = false;
					await offhandEquipped.save();
				}
				else if (mainhandEquipped && mainhandEquipped.item_id !== itemId) {
					mainhandEquipped.equipped = false;
					await mainhandEquipped.save();
				}
			}
		}
	}
	else if (normalizedType === 'armor') {
		// Unequip any currently equipped item in the same armor slot
		const equippedInSlot = await itemUtility.getCharacterEquippedArmor(characterId);
		for (const charItem of equippedInSlot) {
			const armorItem = await itemUtility.getItemWithDetails(charItem.item_id);
			const charSlot = armorItem?.armor?.slot;
			if (charSlot === slot && charItem.item_id !== itemId) {
				charItem.equipped = false;
				await charItem.save();
			}
		}
	}
	// Equip the selected item
	const [equippedItem] = await CharacterItem.findOrCreate({
		where: { character_id: characterId, item_id: itemId },
		defaults: { equipped: true },
	});
	equippedItem.equipped = true;
	await equippedItem.save();
	await updateCharacterWeight(characterId);
	// Dualwielding status logic
	if (normalizedType === 'weapon') {
		const equippedWeapons = await itemUtility.getCharacterEquippedWeapons(characterId);
		let mainhandCount = 0;
		for (const charItem of equippedWeapons) {
			const weaponItem = await itemUtility.getItemWithDetails(charItem.item_id);
			if (weaponItem?.weapon?.slot === 'mainhand') mainhandCount++;
		}
		const { CharacterStatus } = getDbModels();
		if (mainhandCount >= 2) {
			// Upsert dualwielding status
			await CharacterStatus.upsert({
				character_id: characterId,
				status: 'Dualwielding',
				type: 'persistent',
				value: '',
			});
		}
		else {
			// Remove dualwielding status if it exists
			await CharacterStatus.destroy({
				where: {
					character_id: characterId,
					status: 'Dualwielding',
				},
			});
		}
	}
	return item;
};

let updateCharacterWeight = async (characterId) => {
	const { CharacterItem, CharacterCombatStat } = getDbModels();
	// Sum weights of all items in inventory
	const items = await CharacterItem.findAll({
		where: { character_id: characterId },
	});
	let total = 0;
	for (const inv of items) {
		let weight = 0;
		const itemDetails = await itemUtility.getItemWithDetails(inv.item_id);
		if (itemDetails) {
			weight = itemDetails.weight || 0;
			// Try to get weapon/armor weight if not present on ItemLib
			if (!weight) {
				if (itemDetails.weapon?.weight) {
					weight = itemDetails.weapon.weight;
				}
				else if (itemDetails.armor?.weight) {
					weight = itemDetails.armor.weight;
				}
			}
		}
		total += (inv.amount || 1) * weight;
	}
	// Update currentWeight in CharacterCombatStat (use upsert in case record doesn't exist)
	const existing = await CharacterCombatStat.findOne({ where: { character_id: characterId } });
	if (existing) {
		await CharacterCombatStat.update({ currentWeight: total }, { where: { character_id: characterId } });
	}
	else {
		await CharacterCombatStat.create({ character_id: characterId, currentWeight: total });
	}
	return total;
};

let recalculateCharacterStats = async (character) => {
	// Recalculate all character stats after equip/unequip operations
	try {
		// calculateCombatStat handles weight calculation internally
		await calculateCombatStat(character.id);
		await calculateAttackStat(character.id);
	}
	catch (error) {
		console.error('Error recalculating character stats:', error);
		throw error;
	}
};

let getCharacterStat = async (character, statName) => {
	// Handle both character object and character ID
	const characterData = typeof character === 'object' ? character : await getCharacterBase(character);
	if (!characterData) return 0;

	// Return the requested stat, defaulting to 0 if not found
	return characterData[statName] || 0;
};

/**
 * Get character's combat stats (defense, evade, speed, weight, etc.)
 * @param {string} characterId - The character ID
 * @returns {Promise<Object|null>} Combat stat record or null
 */
let getCharacterCombatStat = async (characterId) => {
	const { CharacterCombatStat } = getDbModels();
	return await CharacterCombatStat.findOne({ where: { character_id: characterId } });
};

/**
 * Get character's attack stats (attack, accuracy, critical per weapon)
 * @param {string} characterId - The character ID
 * @returns {Promise<Object|null>} Attack stat record or null (first weapon)
 */
let getCharacterAttackStat = async (characterId) => {
	const { CharacterAttackStat } = getDbModels();
	return await CharacterAttackStat.findOne({ where: { character_id: characterId } });
};

/**
 * Get a character setting value
 * @param {string} characterId - The character ID
 * @param {string} settingName - The setting name (e.g., 'avatar')
 * @returns {Promise<string|null>} Setting value or null
 */
let getCharacterSetting = async (characterId, settingName) => {
	const { CharacterSetting } = getDbModels();
	const setting = await CharacterSetting.findOne({
		where: { character_id: characterId, setting: settingName },
	});
	return setting?.value ?? null;
};

let checkCharacterInventory = async (characterId, itemId, quantity = 1) => {
	const { CharacterItem } = getDbModels();
	const inventoryItem = await CharacterItem.findOne({
		where: {
			character_id: characterId,
			item_id: itemId,
		},
	});

	if (!inventoryItem) return false;
	return inventoryItem.amount >= quantity;
};

let checkCharacterSkill = async (characterId, skillId, requiredLevel = 1) => {
	const { CharacterSkill } = getDbModels();
	const characterSkill = await CharacterSkill.findOne({
		where: {
			character_id: characterId,
			skill_id: skillId,
		},
	});

	if (!characterSkill) return false;
	return characterSkill.lv >= requiredLevel;
};

let checkCharacterLevel = async (characterId, requiredLevel = 1) => {
	const character = await getCharacterBase(characterId);
	if (!character) return false;

	return (character.level || 1) >= requiredLevel;
};

let addCharacterItem = async (characterId, itemId, quantity = 1) => {
	const { CharacterItem } = getDbModels();
	const [item, created] = await CharacterItem.findOrCreate({
		where: { character_id: characterId, item_id: itemId },
		defaults: { amount: quantity, equipped: false },
	});

	if (!created) {
		item.amount += quantity;
		await item.save();
	}

	await updateCharacterWeight(characterId);
	return { success: true, quantityAdded: quantity, newTotal: item.amount };
};

let removeCharacterItem = async (characterId, itemId, quantity = 1) => {
	const { CharacterItem } = getDbModels();
	const item = await CharacterItem.findOne({
		where: { character_id: characterId, item_id: itemId },
	});

	if (!item) return { success: false, quantityRemoved: 0 };

	const quantityRemoved = Math.min(item.amount, quantity);
	const wasEquipped = item.equipped;
	
	if (item.amount <= quantity) {
		// Removing last instance - unequip if equipped to prevent ghost item
		if (wasEquipped) {
			item.equipped = false;
			await item.save();
		}
		await item.destroy();
		// Recalculate stats if item was equipped
		if (wasEquipped) {
			await recalculateCharacterStats(characterId);
		}
	}
	else {
		item.amount -= quantity;
		await item.save();
	}

	await updateCharacterWeight(characterId);
	return { success: true, quantityRemoved, wasEquipped: item.amount <= quantity ? wasEquipped : false };
};

let setCharacterItemQuantity = async (characterId, itemId, quantity) => {
	const { CharacterItem } = getDbModels();
	if (quantity <= 0) {
		// If setting to 0 or negative, remove the item completely
		return await removeAllCharacterItem(characterId, itemId);
	}

	const existingItem = await CharacterItem.findOne({
		where: { character_id: characterId, item_id: itemId },
	});
	const previousQuantity = existingItem ? existingItem.amount : 0;
	const wasEquipped = existingItem?.equipped || false;

	const [item, created] = await CharacterItem.findOrCreate({
		where: { character_id: characterId, item_id: itemId },
		defaults: { amount: quantity, equipped: false },
	});

	if (!created) {
		// If reducing to 0 from equipped state, unequip first to prevent ghost item
		if (quantity === 0 && wasEquipped) {
			item.equipped = false;
			await item.save();
			await recalculateCharacterStats(characterId);
		}
		item.amount = quantity;
		await item.save();
	}

	await updateCharacterWeight(characterId);
	return { success: true, previousQuantity, newQuantity: quantity };
};

let removeAllCharacterItem = async (characterId, itemId) => {
	const { CharacterItem } = getDbModels();
	const item = await CharacterItem.findOne({
		where: { character_id: characterId, item_id: itemId },
	});

	if (!item) return { success: false, quantityRemoved: 0 };

	const quantityRemoved = item.amount;
	const wasEquipped = item.equipped;
	
	// Unequip before destroying to prevent ghost item
	if (wasEquipped) {
		item.equipped = false;
		await item.save();
	}
	
	await item.destroy();
	
	// Recalculate stats if item was equipped
	if (wasEquipped) {
		await recalculateCharacterStats(characterId);
	}
	
	await updateCharacterWeight(characterId);
	return { success: true, quantityRemoved, wasEquipped };
};

/**
 * Get the quantity of a specific item in character's inventory
 * @param {string} characterId - Character ID
 * @param {number} itemId - Item ID
 * @returns {Promise<number>} - Quantity of item (0 if not found)
 */
let getCharacterItemQuantity = async (characterId, itemId) => {
	const { CharacterItem } = getDbModels();
	const item = await CharacterItem.findOne({
		where: { character_id: characterId, item_id: itemId },
	});
	return item ? item.amount : 0;
};

let setCharacterStat = async (characterId, statName, value) => {
	const { CharacterBase } = getDbModels();
	const character = await getCharacterBase(characterId);
	if (!character) return { success: false };

	await CharacterBase.update(
		{ [statName]: value },
		{ where: { id: characterId } },
	);

	// If setting XP, check for level up
	if (statName === 'xp') {
		const levelUpResult = await checkAndApplyLevelUp(characterId);
		return { success: true, ...levelUpResult };
	}

	// If setting base stats (con, str, dex, agi), recalculate derived stats (HP, stamina, combat, attack)
	const baseStats = ['con', 'str', 'dex', 'agi'];
	if (baseStats.includes(statName)) {
		await recalculateCharacterStats({ id: characterId });
	}

	return { success: true };
};

let modifyCharacterStat = async (characterId, statName, value) => {
	const { CharacterBase } = getDbModels();
	const character = await getCharacterBase(characterId);
	if (!character) return { success: false };

	// Update the stat
	const currentValue = character[statName] || 0;
	const newValue = currentValue + value;

	await CharacterBase.update(
		{ [statName]: newValue },
		{ where: { id: characterId } },
	);

	// If modifying XP, check for level up
	if (statName === 'xp') {
		const levelUpResult = await checkAndApplyLevelUp(characterId);
		return { success: true, ...levelUpResult };
	}

	// If modifying base stats (con, str, dex, agi), recalculate derived stats (HP, stamina, combat, attack)
	const baseStats = ['con', 'str', 'dex', 'agi'];
	if (baseStats.includes(statName)) {
		await recalculateCharacterStats({ id: characterId });
	}

	return { success: true };
};

let addCharacterStatus = async (characterId, statusName, statusType = 'temporary', value = '') => {
	const { CharacterStatus } = getDbModels();

	await CharacterStatus.upsert({
		character_id: characterId,
		status: statusName,
		type: statusType,
		value: value,
	});

	return true;
};

let removeCharacterStatus = async (characterId, statusName) => {
	const { CharacterStatus } = getDbModels();

	await CharacterStatus.destroy({
		where: {
			character_id: characterId,
			status: statusName,
		},
	});

	return true;
};

let clearAllCharacterStatuses = async (characterId) => {
	const { CharacterStatus } = getDbModels();

	await CharacterStatus.destroy({
		where: {
			character_id: characterId,
		},
	});

	return true;
};

/**
 * XP required to level up (flat 1000 XP per level)
 */
const XP_PER_LEVEL = 1000;

/**
 * Check if character should level up and apply level up bonuses.
 * Deducts 1000 XP per level gained and grants 2 free stat points per level.
 * @param {string} characterId - The character ID
 * @returns {Object} { leveledUp: boolean, oldLevel: number, newLevel: number, freeStatPointsGained: number }
 */
let checkAndApplyLevelUp = async (characterId) => {
	const { CharacterBase } = getDbModels();
	const character = await getCharacterBase(characterId);
	if (!character) return { leveledUp: false };

	const currentLevel = character.level || 1;
	let currentXp = character.xp || 0;
	let levelsGained = 0;

	// Level up as many times as possible
	while (currentXp >= XP_PER_LEVEL) {
		currentXp -= XP_PER_LEVEL;
		levelsGained++;
	}

	if (levelsGained === 0) {
		return { leveledUp: false, oldLevel: currentLevel, newLevel: currentLevel };
	}

	const newLevel = currentLevel + levelsGained;
	const freeStatPointsGained = levelsGained * 2;
	const currentFreePoints = character.freeStatPoints || 0;

	// Update level, deduct XP, and add free stat points
	await CharacterBase.update(
		{
			level: newLevel,
			xp: currentXp,
			freeStatPoints: currentFreePoints + freeStatPointsGained,
		},
		{ where: { id: characterId } },
	);

	return {
		leveledUp: true,
		oldLevel: currentLevel,
		newLevel: newLevel,
		levelsGained: levelsGained,
		freeStatPointsGained: freeStatPointsGained,
		totalFreeStatPoints: currentFreePoints + freeStatPointsGained,
		remainingXp: currentXp,
		xpForNextLevel: XP_PER_LEVEL,
	};
};

let addCharacterExperience = async (characterId, xpAmount) => {
	const { CharacterBase } = getDbModels();
	const character = await getCharacterBase(characterId);
	if (!character) return { success: false };

	const currentXp = character.xp || 0;
	const newXp = currentXp + xpAmount;

	await CharacterBase.update(
		{ xp: newXp },
		{ where: { id: characterId } },
	);

	// Check for level up after adding XP
	const levelUpResult = await checkAndApplyLevelUp(characterId);

	return {
		success: true,
		xpGained: xpAmount,
		totalXp: newXp,
		...levelUpResult,
	};
};

let addCharacterSkillExperience = async (characterId, skillExpMap) => {
	const { CharacterSkill } = getDbModels();

	for (const [skillId, expAmount] of Object.entries(skillExpMap)) {
		const [skill] = await CharacterSkill.findOrCreate({
			where: { character_id: characterId, skill_id: skillId },
			defaults: { lv: 0, xp: 0, type: 'normal', aptitude: 0 },
		});

		skill.xp += expAmount;
		await skill.save();
	}

	return true;
};

/**
 * Calculate stats from virtue values and add them to character
 * @param {number} characterId - Character ID
 * @param {number} fortitude - Fortitude value (F)
 * @param {number} justice - Justice value (J)
 * @param {number} prudence - Prudence value (P)
 * @param {number} temperance - Temperance value (T)
 * @returns {Object} - Calculated stat bonuses and application result
 */
let applyVirtueStats = async (characterId, fortitude, justice, prudence, temperance) => {
	// Validate JPTF total (should not exceed 24)
	const jptfTotal = justice + prudence + temperance + fortitude;
	if (jptfTotal > 24) {
		console.error(`[applyVirtueStats] Invalid JPTF total: ${jptfTotal} (max: 24). Using defaults.`);
		fortitude = 8;
		justice = 8;
		prudence = 8;
		temperance = 8;
	}

	// Calculate base stats using virtue formulas
	// Con = (3F - 24) / 8
	let con = Math.round((3 * fortitude - 24) / 8);
	
	// Str = (2J + 2P - T) / 8
	let str = Math.round((2 * justice + 2 * prudence - temperance) / 8);
	
	// Dex = (2P + 2T - J) / 8
	let dex = Math.round((2 * prudence + 2 * temperance - justice) / 8);
	
	// Agi = (2J + 2T - P) / 8
	let agi = Math.round((2 * justice + 2 * temperance - prudence) / 8);

	// Calculate total and apply correction if needed
	const total = con + str + dex + agi;
	const correction = 12 - total;

	if (correction !== 0) {
		// Find the highest stat to apply correction
		const stats = [
			{ name: 'con', value: con },
			{ name: 'str', value: str },
			{ name: 'dex', value: dex },
			{ name: 'agi', value: agi },
		];

		// Sort by value descending, then by name for consistency
		stats.sort((a, b) => {
			if (b.value !== a.value) return b.value - a.value;
			return a.name.localeCompare(b.name);
		});

		// Apply correction to the highest stat
		const highestStat = stats[0].name;
		if (highestStat === 'con') con += correction;
		else if (highestStat === 'str') str += correction;
		else if (highestStat === 'dex') dex += correction;
		else if (highestStat === 'agi') agi += correction;
	}

	// Apply the calculated stats to the character
	await modifyCharacterStat(characterId, 'con', con);
	await modifyCharacterStat(characterId, 'str', str);
	await modifyCharacterStat(characterId, 'dex', dex);
	await modifyCharacterStat(characterId, 'agi', agi);

	return {
		success: true,
		virtues: { fortitude, justice, prudence, temperance },
		stats: { con, str, dex, agi },
		total: con + str + dex + agi,
		correctionApplied: correction,
	};
};

module.exports = {
	getCharacterBase,
	getCharacterCurrentLocationId,
	calculateCombatStat,
	updateCharacterFlag,
	getCharacterFlag,
	updateMultipleCharacterFlags,
	getCharacterInventory,
	getCharacterEquippedItems,
	equipCharacterItem,
	calculateAttackStat,
	updateCharacterWeight,
	recalculateCharacterStats,
	getCharacterStat,
	getCharacterCombatStat,
	getCharacterAttackStat,
	getCharacterSetting,
	checkCharacterInventory,
	checkCharacterSkill,
	checkCharacterLevel,
	addCharacterItem,
	removeCharacterItem,
	setCharacterItemQuantity,
	removeAllCharacterItem,
	getCharacterItemQuantity,
	setCharacterStat,
	modifyCharacterStat,
	addCharacterStatus,
	removeCharacterStatus,
	clearAllCharacterStatuses,
	checkAndApplyLevelUp,
	addCharacterExperience,
	addCharacterSkillExperience,
	applyVirtueStats,
	XP_PER_LEVEL,
};

