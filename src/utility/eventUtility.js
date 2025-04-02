const EventBase = require('@/models/character/eventBase.js');
const EventFlag = require('@/models/character/eventFlag.js');
const EventTag = require('@/models/character/eventTag.js');
const EventResolution = require('@/models/character/eventResolution.js');

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
