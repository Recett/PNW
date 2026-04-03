const { CharacterBase, LocationBase, LocationContain, LocationCluster, LocationLink } = require('@root/dbObject.js');
const contentStore = require('@root/contentStore.js');
const { Op } = require('sequelize');
const gamecon = require('@root/Data/gamecon.json');

/**
 * Get current time of day based on server hour
 * Morning: 6-14 (6am to 2pm) = 8 hours
 * Afternoon: 14-22 (2pm to 10pm) = 8 hours
 * Night: 22-6 (10pm to 6am) = 8 hours
 * @returns {string} 'morning', 'afternoon', or 'night'
 */
function getCurrentTimeOfDay() {
	const hour = new Date().getHours();
	if (hour >= 6 && hour < 14) {
		return 'morning';
	}
	else if (hour >= 14 && hour < 22) {
		return 'afternoon';
	}
	else {
		return 'night';
	}
}

/**
 * Get location by channel with time-aware fallback logic
 * Fallback chain: exact time match > night→afternoon→morning > default (time=null)
 * @param {string} channelId - Discord channel ID
 * @param {string} timeOfDay - 'morning', 'afternoon', 'night', or null for current time
 * @returns {Promise<Object|null>} Location object or null
 */
async function getLocationByChannelWithTime(channelId, timeOfDay = null) {
	if (!timeOfDay) {
		timeOfDay = getCurrentTimeOfDay();
	}

	// Get all locations with this channel from DB
	const locations = await LocationBase.findAll({ where: { channel: channelId } });

	if (locations.length === 0) return null;
	if (locations.length === 1) return locations[0];

	// Check flag overrides first (superimposition model)
	const flagOverride = locations.find(loc => loc.flag_override);
	if (flagOverride) return flagOverride;

	// Try exact time match
	const exactMatch = locations.find(loc => loc.time === timeOfDay);
	if (exactMatch) return exactMatch;

	// Fallback chain based on current time
	if (timeOfDay === 'night') {
		const afternoon = locations.find(loc => loc.time === 'afternoon');
		if (afternoon) return afternoon;
		const morning = locations.find(loc => loc.time === 'morning');
		if (morning) return morning;
	}
	else if (timeOfDay === 'afternoon') {
		const morning = locations.find(loc => loc.time === 'morning');
		if (morning) return morning;
	}

	const defaultVersion = locations.find(loc => !loc.time || loc.time === '');
	return defaultVersion || locations[0];
}

/**
 * Get all objects, PCs, NPCs, and enemies for a location, returning resolved model instances.
 * @param {number|string} locationId
 * @param {string} timeOfDay - Optional time filter ('morning', 'afternoon', 'night', or null for current time)
 * @returns {Promise<{objects: Array, pcs: Array, npcs: Array, enemies: Array}>}
 */
async function getLocationContents(locationId, timeOfDay = null) {
	if (!timeOfDay) {
		timeOfDay = getCurrentTimeOfDay();
	}

	let objectsList = (await getObjects(locationId, timeOfDay)) || [];
	let pcs = (await getPCs(locationId, timeOfDay)) || []; // Now returns CharacterBase objects directly
	let npcsList = (await getNPCs(locationId, timeOfDay)) || [];
	let enemiesList = (await getEnemies(locationId, timeOfDay)) || [];

	const objectsId = objectsList.map(obj => obj.object_id).filter(object_id => object_id != null);
	const npcsId = npcsList.map(npc => npc.object_id).filter(object_id => object_id != null);
	const enemiesId = enemiesList.map(enemy => enemy.object_id).filter(object_id => object_id != null);

	let objects = objectsId.map(id => contentStore.objects.findByPk(String(id))).filter(o => o != null);
	// PCs are already CharacterBase objects, no need for additional lookup
	let npcs = npcsId.map(id => contentStore.npcs.findByPk(String(id))).filter(n => n != null);
	let enemies = enemiesId.map(id => contentStore.enemies.findByPk(String(id))).filter(e => e != null);

	return { objects, pcs, npcs, enemies };
}

let getLocationBase = async (locationId) => {
	return await LocationBase.findByPk(locationId);
};

/**
 * Get location name by ID
 * @param {number|string} locationId - Location ID
 * @returns {Promise<string>} Location name or fallback
 */
async function getLocationName(locationId) {
	const location = await LocationBase.findByPk(locationId);
	return location ? location.name : locationId;
}

let getLocationByName = async (name) => {
	return await LocationBase.findOne({ where: { name: name } });
};

let getLocationByChannel = async (channelId) => {
	return await getLocationByChannelWithTime(channelId, null);
};

let getObjects = async (locationId, timeOfDay = null) => {
	const whereClause = {
		location_id: locationId,
		type: gamecon.OBJECT,
	};

	if (timeOfDay) {
		whereClause[Op.or] = [
			{ time: null },
			{ time: '' },
			{ time: timeOfDay },
		];
	}

	return await LocationContain.findAll({
		attributes: ['object_id'],
		where: whereClause,
	});
};

let getPCs = async (locationId, timeOfDay = null) => {
	// Query CharacterBase directly for characters at this location
	return await CharacterBase.findAll({
		attributes: ['id'],
		where: { location_id: locationId }
	});
};

let getNPCs = async (locationId, timeOfDay = null) => {
	const whereClause = {
		location_id: locationId,
		type: gamecon.NPC,
	};

	if (timeOfDay) {
		whereClause[Op.or] = [
			{ time: null },
			{ time: '' },
			{ time: timeOfDay },
		];
	}

	return await LocationContain.findAll({
		attributes: ['object_id'],
		where: whereClause,
	});
};

let getEnemies = async (locationId, timeOfDay = null) => {
	const whereClause = {
		location_id: locationId,
		type: gamecon.ENEMY,
	};

	if (timeOfDay) {
		whereClause[Op.or] = [
			{ time: null },
			{ time: '' },
			{ time: timeOfDay },
		];
	}

	return await LocationContain.findAll({
		attributes: ['object_id'],
		where: whereClause,
	});
};

let getLinkedLocations = async (locationId) => {
	return await LocationLink.findAll({
		where: { location_id: locationId },
	});
};

let getLocationinCluster = async (locationId) => {
	const clusterEntry = await LocationCluster.findOne({
		where: { location_id: locationId },
	});
	if (!clusterEntry) return [];
	return await LocationCluster.findAll({
		where: { cluster_id: clusterEntry.cluster_id },
	});
};

let addLocationToCluster = async (locationIdA, locationIdB) => {
	let existingClusterA = await LocationCluster.findOne({
		where: {
			location_id: locationIdA,
		},
	});

	let existingClusterB = await LocationCluster.findOne({
		where: {
			location_id: locationIdB,
		},
	});

	if (!existingClusterA & !existingClusterB) {
		let clusterId = await LocationCluster.create({
			location_id: locationIdA,
		}).id;
		await LocationCluster.create({
			id: clusterId,
			location_id: locationIdB,
		});
		return true;
	}
	else if (existingClusterA && !existingClusterB) {
		await LocationCluster.create({
			id: existingClusterA.id,
			location_id: locationIdB,
		});
		return true;
	}
	else if (!existingClusterA && existingClusterB) {
		await LocationCluster.create({
			id: existingClusterB.id,
			location_id: locationIdA,
		});
		return true;
	}

	return false;
};

/**
 * Update user roles when moving between locations.
 * Removes the role of the old location and adds the role of the new location.
 * @param {Object} params - { guild, memberId, oldLocationId, newLocationId }
 */
async function updateLocationRoles({ guild, memberId, newLocationId }) {
	const member = await guild.members.fetch(memberId);

	// Add new location role FIRST
	let newRoleId = null;
	if (newLocationId) {
		const newLoc = await LocationBase.findByPk(newLocationId);
		if (newLoc && newLoc.role) {
			newRoleId = newLoc.role;
			try {
				await member.roles.add(newLoc.role);
			}
			catch {
				// Ignore if role not present or error
			}
		}
	}

	// Remove all OTHER location roles (not the new one)
	const allLocations = await LocationBase.findAll();
	for (const loc of allLocations) {
		if (loc.role && loc.role !== newRoleId && member.roles.cache.has(loc.role)) {
			try {
				await member.roles.remove(loc.role);
			}
			catch {
				// Ignore if role not present or error
			}
		}
	}

	if (newLocationId) {
		// Update CharacterBase.location_id
		await CharacterBase.update(
			{ location_id: newLocationId },
			{ where: { id: memberId } },
		);
		// Update LocationContain for the character
		await LocationContain.findOrCreate({
			where: { object_id: memberId },
			defaults: { location_id: newLocationId, type: 'PC' },
		}).then(([record, created]) => {
			if (!created) {
				record.location_id = newLocationId;
				return record.save();
			}
		});
	}
}

/**
 * Transition location roles with delayed old role removal.
 * Adds new role first, then removes old role after delay to prevent jarring channel switch.
 * @param {Object} params - { guild, memberId, newLocationId, delayMs }
 * @returns {Object} { newLocation } - The new location data for channel linking
 */
async function transitionLocationRoles({ guild, memberId, newLocationId, delayMs = 5000 }) {
	const member = await guild.members.fetch(memberId);

	// Get new location data (needed for channel link)
	const newLoc = newLocationId ? await LocationBase.findByPk(newLocationId) : null;

	// Add new location role FIRST
	let newRoleId = null;
	if (newLoc && newLoc.role) {
		newRoleId = newLoc.role;
		try {
			await member.roles.add(newLoc.role);
		}
		catch (err) {
			console.error('Error adding new location role:', err);
		}
	}

	// Remove all OTHER location roles (not the new one) after delay
	setTimeout(async () => {
		try {
			const freshMember = await guild.members.fetch(memberId);
			const allLocations = await LocationBase.findAll();
			for (const loc of allLocations) {
				if (loc.role && loc.role !== newRoleId && freshMember.roles.cache.has(loc.role)) {
					try {
						await freshMember.roles.remove(loc.role);
					}
					catch {
						// Role removal failed, may not exist
					}
				}
			}
		}
		catch (err) {
			console.error('Error removing old location roles:', err);
		}
	}, delayMs);

	// Update LocationContain for the character
	if (newLocationId) {
		await LocationContain.findOrCreate({
			where: { object_id: memberId },
			defaults: { location_id: newLocationId, type: 'PC' },
		}).then(([record, created]) => {
			if (!created) {
				record.location_id = newLocationId;
				return record.save();
			}
		});
	}

	// Update CharacterBase.location_id
	if (newLocationId) {
		await CharacterBase.update(
			{ location_id: newLocationId },
			{ where: { id: memberId } },
		);
	}

	return { newLocation: newLoc };
}

/**
 * Move character to a new location
 * @param {string} characterId - Character ID
 * @param {number} newLocationId - New location ID
 * @param {Object} guild - Discord guild object (optional for role updates)
 */
async function moveCharacterToLocation(characterId, newLocationId, guild = null) {
	// Reset bilge depth if moving to a non-bilge location
	const destLoc = newLocationId ? await LocationBase.findByPk(newLocationId) : null;
	const isBilge = destLoc && Array.isArray(destLoc.tag) && destLoc.tag.includes('bilge');
	if (!isBilge) {
		await CharacterBase.update({ depth: 0 }, { where: { id: characterId } });
	}

	// Update character's location in CharacterBase
	await CharacterBase.update(
		{ location_id: newLocationId },
		{ where: { id: characterId } },
	);

	// Update LocationContain
	await LocationContain.findOrCreate({
		where: { object_id: characterId },
		defaults: { location_id: newLocationId, type: gamecon.PC },
	}).then(([record, created]) => {
		if (!created) {
			record.location_id = newLocationId;
			return record.save();
		}
	});

	// Update Discord roles if guild is provided
	if (guild) {
		const member = await guild.members.fetch(characterId);

		// Add new location role FIRST
		let newRoleId = null;
		if (destLoc && destLoc.role) {
			newRoleId = destLoc.role;
			try {
				await member.roles.add(destLoc.role);
			}
			catch {
				// Ignore if role not present or error
			}
		}
		
		// Remove all OTHER location roles (not the new one)
		const allLocations = await LocationBase.findAll();
		for (const loc of allLocations) {
			if (loc.role && loc.role !== newRoleId && member.roles.cache.has(loc.role)) {
				try {
					await member.roles.remove(loc.role);
				}
				catch {
					// Ignore if role not present or error
				}
			}
		}
	}
	
	return true;
}

module.exports = {
	getCurrentTimeOfDay,
	getLocationBase,
	getLocationName,
	getLocationByName,
	getLocationByChannel,
	getLocationByChannelWithTime,
	getObjects,
	getPCs,
	getNPCs,
	getEnemies,
	getLinkedLocations,
	getLocationinCluster,
	addLocationToCluster,
	getLocationContents,
	updateLocationRoles,
	transitionLocationRoles,
	moveCharacterToLocation,
};
