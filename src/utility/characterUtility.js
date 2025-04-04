const Discord = require("discord.js");
const { CharacterBase, CharacterSkill, CharacterEquipment } = require('@root/dbObject.js');

let getCharacterBase = async (userId) => {
	return await CharacterBase.findOne({
		where: {
			character_id: userId,
		},
	});
};

let getCharacterEquipment = async (userId) => {
	return await Character.findOne({
		where: {
			character_id: userId,
		},
	});
};

module.exports = {
	getCharacterBase,
	getCharacterEquipment,
};
