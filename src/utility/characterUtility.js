const { CharacterBase, CharacterFlag, CharacterItem, ItemLib, WeaponLib, ArmorLib } = require('@root/dbObject.js');

let getCharacterBase = async (userId) => {
	return await CharacterBase.findOne({
		where: {
			id: userId,
		},
	});
};

let getCharacterCurrentLocationId = async (userId) => {
	const character = await CharacterBase.findOne({ where: { id: userId } });
	return character ? character.location_id : null;
};

let calculateCombatStat = async (characterId) => {
	const { CharacterCombatStat } = require('@root/dbObject.js');
	const character = await getCharacterBase(characterId);
	if (!character) return 0;

	// Base HP + CON bonus
	let hp = 100 + (character.con || 0) * 20;
	// Base Stamina + CON bonus
	let stamina = 20 + (character.con || 0) * 4;

	// Update maxHp in CharacterBase
	await CharacterBase.update({ maxHp: hp }, { where: { id: characterId } });
	await CharacterBase.update({ maxStamina: stamina }, { where: { id: characterId } });

	// Calculate defense as the sum of all equipped armor items' defense stat
	let defense = 0;
	const equippedItems = await CharacterItem.findAll({
		where: { character_id: characterId, equipped: true },
		include: [{
			model: ItemLib,
			as: 'item',
			where: { item_type: 'Armor' },
			include: [{
				model: ArmorLib,
				as: 'armor',
				required: true,
			}],
		}],
	});
	for (const eq of equippedItems) {
		if (eq.item && eq.item.armor && typeof eq.item.armor.defense === 'number') {
			defense += eq.item.armor.defense;
		}
	}

	// Overweight penalty: lower agi by twice the overweight amount
	let agi = character.agi || 0;
	let str = character.str || 0;
	let currentWeight = 0;
	const combatStat = await CharacterCombatStat.findOne({ where: { character_id: characterId } });
	if (combatStat && combatStat.currentWeight != null) {
		currentWeight = combatStat.currentWeight;
	}
	else {
		// Optionally, calculate currentWeight using updateCharacterWeight if needed
		// currentWeight = await updateCharacterWeight(characterId);
	}
	let maxWeight = str;
	if (currentWeight > maxWeight && maxWeight > 0) {
		const overweight = currentWeight - maxWeight;
		agi = Math.max(0, agi - 2 * overweight);
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
	const { CharacterAttackStat } = require('@root/dbObject.js');
	// Get character base
	const character = await CharacterBase.findOne({ where: { id: characterId } });
	if (!character) return 0;
	const str = character.str || 0;
	const dex = character.dex || 0;
	
	// Find ALL equipped weapons in inventory
	const equippedWeapons = await CharacterItem.findAll({
		where: { character_id: characterId, equipped: true },
		include: [{
			model: ItemLib,
			as: 'item',
			where: { item_type: 'Weapon' },
			include: [{
				model: WeaponLib,
				as: 'weapon',
				required: true,
			}],
		}],
	});
	
	// Delete existing attack stats for this character to prevent duplicates
	await CharacterAttackStat.destroy({
		where: { character_id: characterId },
	});
	
	// Determine dual wield penalty based on equipped weapons
	let isDualWielding = false;
	let hasDualWieldingException = false;
	
	if (equippedWeapons.length > 1) {
		const mainhandWeapons = equippedWeapons.filter(w => w.item.weapon.slot === 'mainhand');
		const offhandWeapons = equippedWeapons.filter(w => w.item.weapon.slot === 'offhand');
		
		// Check if any weapon has "No Dualwielding Penalty" tag
		for (const equippedWeapon of equippedWeapons) {
			if (equippedWeapon.item) {
				const tags = equippedWeapon.item.tags;
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
		else if (equippedWeapons.length > 1) {
			// Multiple weapons of same type or unusual combination
			isDualWielding = true;
		}
	}
	
	// Apply penalty only if dual wielding and no exception weapon is equipped
	const applyDualWieldPenalty = isDualWielding && !hasDualWieldingException;
	
	// Create attack stats for each equipped weapon
	if (equippedWeapons && equippedWeapons.length > 0) {
		for (const equippedWeapon of equippedWeapons) {
			if (equippedWeapon.item && equippedWeapon.item.weapon) {
				const weapon = equippedWeapon.item.weapon;
				const attack = (weapon.base_damage || 0) + Math.floor((weapon.scaling / 100 || 0) * str);
				const baseAccuracy = Math.floor(dex * (weapon.hit_mod / 100 || 0));
				// Apply dual wield penalty: halve accuracy if dual wielding and no exception
				const accuracy = applyDualWieldPenalty ? Math.floor(baseAccuracy / 2) : baseAccuracy;
				const critical = Math.floor(dex * 0.5);
				
				await CharacterAttackStat.create({
					character_id: characterId,
					item_id: weapon.id,
					attack,
					accuracy,
					critical,
					cooldown: weapon.cooldown || 80,
				});
			}
		}
		// Return the attack value of the first weapon (for backward compatibility)
		const firstWeapon = equippedWeapons[0];
		if (firstWeapon?.item?.weapon) {
			return (firstWeapon.item.weapon.base_damage || 0) + Math.floor((firstWeapon.item.weapon.scaling / 100 || 0) * str);
		}
	}
	else {
		// No weapons equipped - create unarmed attack
		const critical = Math.floor(dex * 0.5);
		await CharacterAttackStat.create({
			character_id: characterId,
			item_id: null,
			attack: str,
			accuracy: 0,
			critical,
			cooldown: 60,
		});
		return str;
	}
	
	return 0;
};

let updateCharacterFlag = async (characterId, flag, value) => {
	await CharacterFlag.upsert({
		character_id: characterId,
		flag: flag,
		value: value,
	});
};

let updateMultipleCharacterFlags = async (characterId, flags) => {
	for (const [flag, value] of Object.entries(flags)) {
		await updateCharacterFlag(characterId, flag, value);
	}
};

let getCharacterInventory = async (characterId) => {
	return await CharacterItem.findAll({
		where: { character_id: characterId },
		include: [{ model: ItemLib, as: 'item' }],
	});
};

let equipCharacterItem = async (characterId, itemId, type) => {
	// Determine the slot of the item to equip
	let slot = null;
	let isTwoHand = false;
	if (type === 'Weapon') {
		const weapon = await WeaponLib.findOne({ where: { item_id: itemId } });
		slot = weapon ? weapon.slot : null;
		isTwoHand = weapon && weapon.slot === 'twohand';
	}
	else if (type === 'Armor') {
		const armor = await ArmorLib.findOne({ where: { item_id: itemId } });
		slot = armor ? armor.slot : null;
	}
	if (!slot) throw new Error('Item slot not found.');

	if (type === 'Weapon') {
		// Get all currently equipped weapons
		const equippedWeapons = await CharacterItem.findAll({
			where: { character_id: characterId, equipped: true },
			include: [
				{ model: ItemLib, as: 'item', where: { item_type: 'Weapon' } },
			],
		});
		if (isTwoHand) {
			// Unequip all mainhand/offhand weapons
			for (const charItem of equippedWeapons) {
				const weapon = await WeaponLib.findOne({ where: { item_id: charItem.item_id } });
				if (weapon && (weapon.slot === 'mainhand' || weapon.slot === 'offhand' || weapon.slot === 'twohand')) {
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
				const weapon = await WeaponLib.findOne({ where: { item_id: charItem.item_id } });
				if (!weapon) continue;
				if (weapon.slot === 'mainhand') {
					handsUsed++;
					mainhandEquipped = charItem;
				}
				if (weapon.slot === 'offhand') {
					handsUsed++;
					offhandEquipped = charItem;
				}
				if (weapon.slot === 'twohand') {
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
	else if (type === 'Armor') {
		// Unequip any currently equipped item in the same armor slot
		const equippedInSlot = await CharacterItem.findAll({
			where: { character_id: characterId, equipped: true },
			include: [
				{ model: ItemLib, as: 'item', where: { item_type: 'Armor' } },
			],
		});
		for (const charItem of equippedInSlot) {
			const armor = await ArmorLib.findOne({ where: { item_id: charItem.item_id } });
			const charSlot = armor ? armor.slot : null;
			if (charSlot === slot && charItem.item_id !== itemId) {
				charItem.equipped = false;
				await charItem.save();
			}
		}
	}
	// Equip the selected item
	const [item] = await CharacterItem.findOrCreate({
		where: { character_id: characterId, item_id: itemId },
		defaults: { equipped: true },
	});
	item.equipped = true;
	await item.save();
	await updateCharacterWeight(characterId);
	// Dualwielding status logic
	if (type === 'Weapon') {
		const equippedWeapons = await CharacterItem.findAll({
			where: { character_id: characterId, equipped: true },
			include: [
				{ model: ItemLib, as: 'item', where: { item_type: 'Weapon' } },
			],
		});
		let mainhandCount = 0;
		for (const charItem of equippedWeapons) {
			const weapon = await WeaponLib.findOne({ where: { item_id: charItem.item_id } });
			if (weapon && weapon.slot === 'mainhand') mainhandCount++;
		}
		const { CharacterStatus } = require('@root/dbObject.js');
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
	// Sum weights of all items in inventory
	const items = await CharacterItem.findAll({
		where: { character_id: characterId },
		include: [{
			model: ItemLib,
			as: 'item',
			include: [
				{ model: WeaponLib, as: 'weapon', required: false },
				{ model: ArmorLib, as: 'armor', required: false },
			],
		}],
	});
	let total = 0;
	for (const inv of items) {
		let weight = 0;
		if (inv.item) {
			weight = inv.item.weight || 0;
		}
		// Try to get weapon/armor weight if not present on ItemLib
		if (!weight && inv.item) {
			if (inv.item.item_type === 'Weapon' && inv.item.weapon) {
				weight = inv.item.weapon.weight || 0;
			}
			else if (inv.item.item_type === 'Armor' && inv.item.armor) {
				weight = inv.item.armor.weight || 0;
			}
		}
		total += (inv.amount || 1) * weight;
	}
	await CharacterBase.update({ currentWeight: total }, { where: { id: characterId } });
	return total;
};

let recalculateCharacterStats = async (character) => {
	// Recalculate all character stats after equip/unequip operations
	try {
		await calculateCombatStat(character.id);
		await calculateAttackStat(character.id);
		await updateCharacterWeight(character.id);
	}
	catch (error) {
		console.error('Error recalculating character stats:', error);
		throw error;
	}
};

module.exports = {
	getCharacterBase,
	getCharacterCurrentLocationId,
	calculateCombatStat,
	updateCharacterFlag,
	updateMultipleCharacterFlags,
	getCharacterInventory,
	equipCharacterItem,
	calculateAttackStat,
	updateCharacterWeight,
	recalculateCharacterStats,
};

