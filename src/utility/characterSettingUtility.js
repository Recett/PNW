const { CharacterSetting } = require('@root/dbObject.js');

/**
 * Set a character's setting value.
 * @param {string} characterId - The character's ID
 * @param {string} setting - The name of the setting
 * @param {string|number|boolean} value - The value to set (will be stored as string)
 * @returns {Promise<void>}
 */
async function setCharacterSetting(characterId, setting, value) {
	await CharacterSetting.upsert({
		character_id: characterId,
		setting: setting,
		value: String(value),
	});
}

/**
 * Get a character's setting value.
 * @param {string} characterId - The character's ID
 * @param {string} setting - The name of the setting
 * @returns {Promise<string|null>} The value or null if not set
 */
async function getCharacterSetting(characterId, setting) {
	const record = await CharacterSetting.findOne({
		where: {
			character_id: characterId,
			setting: setting,
		},
	});
	return record ? record.value : null;
}

module.exports = {
	setCharacterSetting,
	getCharacterSetting,
};
