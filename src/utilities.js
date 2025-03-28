const Discord = require("discord.js");
const User = require("@models/character/user.js");
const Character = require("@models/character/character.js");

let characterId = async (userId) => {
  return await User.findOne({
    attributes: 'character_id',
    where: {
      user_id: userId,
    },
  });
};

module.exports = {
  characterId
};
