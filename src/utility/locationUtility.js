const { ObjectBase, CharacterBase, NPCBase } = require('@root/dbObject.js');
const { Op } = require('sequelize');
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
	let npcs = npcsId.length > 0 ? await NPCBase.findAll({ where: { id: { [Op.in]: npcsId } } }) : [];
	let enemies = enemiesId.length > 0 ? await NPCBase.findAll({ where: { id: { [Op.in]: enemiesId } } }) : [];

	return { objects, pcs, npcs, enemies };
}
const { LocationBase, LocationContain } = require('@root/dbObject.js');
const gamecon = require('@root/Data/gamecon.json');

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
			location_from: locationId,
		},
	});
};

let getLinkedLocationsByChannel = async (channelId) => {
	return await LocationLink.findAll({
		where: {
			channel: channelId,
		},
	});
};

let getLocationinCluster = async (locationId) => {
	let clusterId = await LocationCluster.findOne({
		where: {
			location_id: locationId,
		},
	}).id;

	if (clusterId) {
		return await LocationCluster.findAll({
			where: {
				id: clusterId,
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

module.exports = {
	getLocationBase,
	getLocationByName,
	getLocationByChannel,
	getObjects,
	getPCs,
	getNPCs,
	getEnemies,
	getLinkedLocations,
	getLinkedLocationsByChannel,
	getLocationinCluster,
	addLocationToCluster,
	getLocationContents,
};
