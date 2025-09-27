const { ObjectBase, CharacterBase, MonsterBase, LocationBase, LocationContain, LocationLink, LocationCluster } = require('@root/dbObject.js');
const { Op } = require('sequelize');
const gamecon = require('@root/Data/gamecon.json');
/**
 * Get all objects, PCs, NPCs, and enemies for a location, returning resolved model instances.
 * @param {number|string} locationId
 * @returns {Promise<{objects: Array, pcs: Array, npcs: Array, enemies: Array}>}
 */
async function getLocationContents(locationId) {
	let objectsList = (await getObjects(locationId)) || [];
	let pcsList = (await getPCs(locationId)) || [];
	let npcsList = (await getNPCs(locationId)) || [];
	let enemiesList = (await getEnemies(locationId)) || [];

	const objectsId = objectsList.map(obj => obj.object_id).filter(object_id => object_id != null);
	const pcsId = pcsList.map(pc => pc.object_id).filter(object_id => object_id != null);
	const npcsId = npcsList.map(npc => npc.object_id).filter(object_id => object_id != null);
	const enemiesId = enemiesList.map(enemy => enemy.object_id).filter(object_id => object_id != null);

	let objects = objectsId.length > 0 ? await ObjectBase.findAll({ where: { id: { [Op.in]: objectsId } } }) : [];
	let pcs = pcsId.length > 0 ? await CharacterBase.findAll({ where: { id: { [Op.in]: pcsId } } }) : [];
	let npcs = npcsId.length > 0 ? await MonsterBase.findAll({ where: { id: { [Op.in]: npcsId } } }) : [];
	let enemies = enemiesId.length > 0 ? await MonsterBase.findAll({ where: { id: { [Op.in]: enemiesId } } }) : [];

	return { objects, pcs, npcs, enemies };
}
// ...imports moved to top...

let getLocationBase = async (locationId) => {
	return await LocationBase.findOne({
		where: {
			id: locationId,
		},
	});
};

let getLocationByName = async (name) => {
	return await LocationBase.findOne({
		where: {
			name: name,
		},
	});
};

let getLocationByChannel = async (channelId) => {
	return await LocationBase.findOne({
		where: {
			channel: channelId,
		},
	});
};

let getObjects = async (locationId) => {
	return await LocationContain.findAll({
		attributes: ['object_id'],
		where: {
			location_id: locationId,
			type: gamecon.OBJECT,
		},
	});
};

let getPCs = async (locationId) => {
	return await LocationContain.findAll({
		attributes: ['object_id'],
		where: {
			location_id: locationId,
			type: gamecon.PC,
		},
	});
};

let getNPCs = async (locationId) => {
	return await LocationContain.findAll({
		attributes: ['object_id'],
		where: {
			location_id: locationId,
			type: gamecon.NPC,
		},
	});
};

let getEnemies = async (locationId) => {
	return await LocationContain.findAll({
		attributes: ['object_id'],
		where: {
			location_id: locationId,
			type: gamecon.ENEMY,
		},
	});
};

let getLinkedLocations = async (locationId) => {
	return await LocationLink.findAll({
		where: {
			location_id: locationId,
		},
	});
};

let getLocationinCluster = async (locationId) => {
	const cluster = await LocationCluster.findOne({
		where: {
			location_id: locationId,
		},
	});

	if (cluster && cluster.cluster_id) {
		return await LocationCluster.findAll({
			where: {
				cluster_id: cluster.cluster_id,
			},
		});
	}

	return [];
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

	// Get old location from CharacterBase (since that's what move command updates)
	const character = await CharacterBase.findOne({ where: { id: memberId } });
	const prevLocationId = character ? character.location_id : null;

	// Remove old location role
	if (prevLocationId) {
		const oldLoc = await LocationBase.findOne({ where: { id: prevLocationId } });
		if (oldLoc && oldLoc.role) {
			try {
				await member.roles.remove(oldLoc.role);
			}
			catch {
				// Ignore if role not present or error
			}
		}
	}
	// Add new location role
	if (newLocationId) {
		const newLoc = await LocationBase.findOne({ where: { id: newLocationId } });
		if (newLoc && newLoc.role) {
			try {
				await member.roles.add(newLoc.role);
			}
			catch {
				// Ignore if role not present or error
			}
		}
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

module.exports = {
	getLocationBase,
	getLocationByName,
	getLocationByChannel,
	getObjects,
	getPCs,
	getNPCs,
	getEnemies,
	getLinkedLocations,
	getLocationinCluster,
	addLocationToCluster,
	getLocationContents,
	updateLocationRoles,
};
