const { CharacterBase, CharacterSkill, LocationContain, CharacterFlag, CharacterItem, ItemLib, WeaponLib, ArmorLib } = require('@root/dbObject.js');
const gamecon = require('@root/Data/gamecon.json');

let getCharacterBase = async (userId) => {
	return await CharacterBase.findOne({
		where: {
			id: userId,
		},
	});
};

let getCharacterCurrentLocationId = async (userId) => {
	return await LocationContain.findOne({
		where: {
			object_id: userId,
			type: gamecon.PC,
		},
	}).location_id;
};

let calculateCombatStat = async (characterId) => {
	const { CharacterCombatStat } = require('@root/dbObject.js');
	const character = await getCharacterBase(characterId);
	if (!character) return 0;

	let hp = 100 + (character.con || 0) * 20; // Base HP + CON bonus
	let stamina = 20 + (character.con || 0) * 4; // Base HP + CON bonus

	// Update maxHp in CharacterBase
	await CharacterBase.update({ maxHp: hp }, { where: { id: characterId } });
	await CharacterBase.update({ maxStamina: stamina }, { where: { id: characterId } });

	// Calculate defense as the sum of all equipped items' defense stat
	let defense = 0;
	const equippedItems = await CharacterItem.findAll({
		where: { character_id: characterId, equipped: true },
		include: [{ model: ItemLib, as: 'item' }],
	});
	for (const eq of equippedItems) {
		if (eq.item && typeof eq.item.defense === 'number') {
			defense += eq.item.defense;
		}
	}

	// Overweight penalty: lower agi by twice the overweight amount
	let agi = character.agi || 0;
	let str = character.str || 0;
	let currentWeight = 0;
	const combatStat = await CharacterCombatStat.findOne({ where: { character_id: characterId } });
	if (combatStat && combatStat.currentWeight != null) {
		currentWeight = combatStat.currentWeight;
	} else {
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
	// Find equipped weapon in inventory
	const equippedWeapon = await CharacterItem.findOne({
		where: { character_id: characterId, equipped: true },
		include: [{ model: ItemLib, as: 'item', where: { type: 'Weapon' } }],
	});
	let attack = str;
	let accuracy = 0;
	let critical = 0;
	let item_id = null;
	if (equippedWeapon) {
		const weapon = await WeaponLib.findByPk(equippedWeapon.item_id);
		if (weapon) {
			attack = (weapon.base_damage || 0) + Math.floor((weapon.scaling / 100 || 0) * str);
			accuracy = Math.floor(dex * (weapon.hit_mod / 100 || 0) / 100);
			item_id = weapon.id;
		}
	}
	critical = Math.floor(dex * 0.5);
	// Upsert into characterAttackStat
	await CharacterAttackStat.upsert({
		character_id: characterId,
		item_id,
		attack,
		accuracy,
		critical,
	});
	return attack;
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
		const weapon = await WeaponLib.findByPk(itemId);
		slot = weapon ? weapon.slot : null;
		isTwoHand = weapon && weapon.slot === 'twohand';
	} else if (type === 'Armor') {
		const armor = await ArmorLib.findByPk(itemId);
		slot = armor ? armor.slot : null;
	}
	if (!slot) throw new Error('Item slot not found.');

	if (type === 'Weapon') {
		// Get all currently equipped weapons
		const equippedWeapons = await CharacterItem.findAll({
			where: { character_id: characterId, equipped: true },
			include: [
				{ model: ItemLib, as: 'item', where: { type: 'Weapon' } }
			]
		});
		if (isTwoHand) {
			// Unequip all mainhand/offhand weapons
			for (const charItem of equippedWeapons) {
				const weapon = await WeaponLib.findByPk(charItem.item_id);
				if (weapon && (weapon.slot === 'mainhand' || weapon.slot === 'offhand' || weapon.slot === 'twohand')) {
					charItem.equipped = false;
					await charItem.save();
				}
			}
		} else if (slot === 'mainhand' || slot === 'offhand') {
			// Count hands used
			let handsUsed = 0;
			let offhandEquipped = null;
			let mainhandEquipped = null;
			for (const charItem of equippedWeapons) {
				const weapon = await WeaponLib.findByPk(charItem.item_id);
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
				} else if (mainhandEquipped && mainhandEquipped.item_id !== itemId) {
					mainhandEquipped.equipped = false;
					await mainhandEquipped.save();
				}
			}
		}
	} else if (type === 'Armor') {
		// Unequip any currently equipped item in the same armor slot
		const equippedInSlot = await CharacterItem.findAll({
			where: { character_id: characterId, equipped: true },
			include: [
				{ model: ItemLib, as: 'item', where: { type: 'Armor' } }
			]
		});
		for (const charItem of equippedInSlot) {
			const armor = await ArmorLib.findByPk(charItem.item_id);
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
				{ model: ItemLib, as: 'item', where: { type: 'Weapon' } }
			]
		});
		let mainhandCount = 0;
		for (const charItem of equippedWeapons) {
			const weapon = await WeaponLib.findByPk(charItem.item_id);
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
		} else {
			// Remove dualwielding status if it exists
			await CharacterStatus.destroy({
				where: {
					character_id: characterId,
					status: 'Dualwielding',
				}
			});
		}
	}
	return item;
};

let updateCharacterWeight = async (characterId) => {
	// Sum weights of all items in inventory
	const items = await CharacterItem.findAll({
		where: { character_id: characterId },
		include: [
			{ model: ItemLib, as: 'item' },
		],
	});
	let total = 0;
	for (const inv of items) {
		let weight = 0;
		if (inv.item) {
			weight = inv.item.weight || 0;
		}
		// Try to get weapon/armor weight if not present on ItemLib
		if (!weight && inv.item && inv.item.type === 'Weapon') {
			const weapon = await WeaponLib.findByPk(inv.item_id);
			if (weapon) weight = weapon.weight || 0;
		}
		if (!weight && inv.item && inv.item.type === 'Armor') {
			const armor = await ArmorLib.findByPk(inv.item_id);
			if (armor) weight = armor.weight || 0;
		}
		total += (inv.amount || 1) * weight;
	}
	await CharacterBase.update({ currentWeight: total }, { where: { character_id: characterId } });
	return total;
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
};

