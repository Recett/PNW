const { LocationBase, LocationContain } = require('@root/dbObject.js');
const gamecon = require('@root/Data/gamecon.json');

let getLocationBase = async (locationId) => {
	return await LocationBase.findOne({
		where: {
			location_Id: locationId,
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

let getObjectsInLocation = async (locationId) => {
	return await LocationContain.findAll({
		where: {
			location_id: locationId,
			type: gamecon.OBJECT,
		},
	});
};

let getPCsInLocation = async (locationId) => {
	return await LocationContain.findAll({
		where: {
			location_id: locationId,
			type: gamecon.PC,
		},
	});
};

let getNPCsInLocation = async (locationId) => {
	return await LocationContain.findAll({
		where: {
			location_id: locationId,
			type: gamecon.NPC,
		},
	});
};

let getEnemiesInLocation = async (locationId) => {
	return await LocationContain.findAll({
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
	getObjectsInLocation,
	getPCsInLocation,
	getNPCsInLocation,
	getEnemiesInLocation,
	getLinkedLocations,
	getLinkedLocationsByChannel,
	getLocationinCluster,
	addLocationToCluster,
};
