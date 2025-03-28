const Discord = require("discord.js");
const User = require("@/models/character/user.js");
const CharacterBase = require("@/models/character/characterBase.js");
const CharacterSkill = require("@/models/character/characterSkill.js");
const CharacterEquipment = require("@/models/character/characterEquipment.js");

let characterId = async (userId) => {
  return await User.findOne({
    attributes: 'character_id',
    where: {
      user_id: userId,
    },
  });
};

let characterId = async (characterId) => {
  return await CharacterBase.findOne({
    where: {
      character_id: characterId,
    },
  });
};

let character_equipment = async (characterId) => {
  return await Character.findOne({
    where: {
      character_id: characterId,
    },
  });
};

let character_skill_list = async (characterId) => {
  return await CharacterSkill.findAll({
    where: {
      character_id: characterId,
    },
  });
};

let character_item_list = async (characterId) => {
  return await CharacterSkill.findAll({
    where: {
      character_id: characterId,
    },
  });
};

module.exports = {
  characterId,
  character,
  character_equipment,
  character_skill_list,
  character_item_list
};
