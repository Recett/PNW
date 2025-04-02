const Discord = require("discord.js");
const User = require("@models/user.js");
const CharacterBase = require("@models/character/characterBase.js");
const CharacterSkill = require("@models/character/characterSkill.js");
const CharacterEquipment = require("@models/character/characterEquipment.js");

let getCharacterId = async (userId) => {
	return await User.findOne({
		attributes: 'character_id',
		where: {
			user_id: userId,
		},
	});
};

let getCharacterBase = async (characterId) => {
	return await CharacterBase.findOne({
		where: {
			character_id: characterId,
		},
	});
};

let getCharacterEquipment = async (characterId) => {
	return await Character.findOne({
		where: {
			character_id: characterId,
		},
	});
};

module.exports = {
	getCharacterId,
	getCharacterBase,
	getCharacterEquipment,
};
