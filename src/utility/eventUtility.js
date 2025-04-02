const EventBase = require('@/models/event/eventBase.js');
const EventFlag = require('@/models/event/eventFlag.js');
const EventTag = require('@/models/event/eventTag.js');
const EventResolution = require('@/models/event/eventResolution.js');

let getEventBase = async (eventId) => {
	return await EventBase.findOne({
		where: {
			event_Id: eventId,
		},
	});
};

let getEventFlag = async (eventId) => {
	return await EventFlag.findAll({
		where: {
			event_Id: eventId,
		},
	});
};

let getEventResolution = async (eventId) => {
	return await EventResolution.findAll({
		where: {
			event_Id: eventId,
		},
	});
};

let getEventResolutionOne = async (eventId) => {
	return await EventResolution.findOne({
		where: {
			event_Id: eventId,
			resolution_Id: resolution_id
		},
	});
};

let getEventTag = async (eventId) => {
	return await EventTag.findAll({
		where: {
			event_Id: eventId,
		},
	});
};

module.exports = {
	getEventBase,
	getEventFlag,
	getEventResolution,
	getEventTag,
};
