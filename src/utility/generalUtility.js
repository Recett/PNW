/**
 * Vietnamese Pronoun Configuration
 * Pronouns are relational - they depend on age relationship between speaker and listener
 *
 * Age brackets:
 * - child: 0-12
 * - teen: 13-17
 * - young: 18-30
 * - adult: 31-50
 * - elder: 51+
 *
 * Gender: 'nam' (male), 'nữ' (female), default is male
 */

/**
 * Pronoun placeholder constants for use in event text
 *
 * Player pronouns:
 * - PC_SELF (${1p}): How player refers to self (tôi, em, cháu...)
 * - PC_NAME (${player_name}): Player's display name
 * - PC_FULLNAME (${player_fullname}): Player's full name
 *
 * NPC-to-player (relational):
 * - NPC_TO_PC (${2p}): How NPC addresses player (anh, chị, cháu, ông, bà...)
 * - NPC_SELF (${npc_1p}): How NPC refers to self (tôi, ta, lão, bà...)
 *
 * Player-to-NPC (relational):
 * - PC_TO_NPC (${npc_2p}): How player addresses NPC (anh, chị, bác, ông, bà...)
 * - NPC_NAME (${npc_name}): NPC's display name
 */
const PRONOUN_PLACEHOLDER = {
	PC_SELF: '${1p}',
	PC_NAME: '${player_name}',
	PC_FULLNAME: '${player_fullname}',
	NPC_TO_PC: '${2p}',
	NPC_SELF: '${npc_1p}',
	PC_TO_NPC: '${npc_2p}',
	NPC_NAME: '${npc_name}',
};

// Bracket order for comparison (higher index = older)
const AGE_BRACKET_ORDER = ['child', 'teen', 'young', 'adult', 'elder'];

/**
 * How PLAYER refers to themselves (doesn't depend on NPC)
 * Used for ${1p} placeholder
 */
const PLAYER_SELF_PRONOUN = {
	child: { male: 'cháu', female: 'cháu', default: 'cháu' },
	teen: { male: 'em', female: 'em', default: 'em' },
	young: { male: 'tôi', female: 'tôi', default: 'tôi' },
	adult: { male: 'tôi', female: 'tôi', default: 'tôi' },
	elder: { male: 'tôi', female: 'tôi', default: 'tôi' },
};

/**
 * Relational pronouns based on age difference between NPC and player
 * Key: relationship from NPC's perspective (senior = NPC older, junior = NPC younger)
 * toPlayer: how NPC addresses player (based on player gender)
 * npcSelf: how NPC refers to self (based on NPC gender)
 */
const RELATIONAL_PRONOUN = {
	// NPC is 2+ brackets older than player (e.g., elder NPC to teen player)
	much_older: {
		toPlayer: { male: 'cháu', female: 'cháu', default: 'cháu' },
		npcSelf: { male: 'ông', female: 'bà', default: 'ông' },
	},
	// NPC is 1 bracket older (e.g., adult NPC to young player)
	older: {
		toPlayer: { male: 'anh', female: 'chị', default: 'anh' },
		npcSelf: { male: 'tôi', female: 'tôi', default: 'tôi' },
	},
	// Same age bracket
	peer: {
		toPlayer: { male: 'anh', female: 'chị', default: 'anh' },
		npcSelf: { male: 'tôi', female: 'tôi', default: 'tôi' },
	},
	// NPC is 1 bracket younger
	younger: {
		toPlayer: { male: 'anh', female: 'chị', default: 'anh' },
		npcSelf: { male: 'em', female: 'em', default: 'em' },
	},
	// NPC is 2+ brackets younger (e.g., teen NPC to elder player)
	much_younger: {
		toPlayer: { male: 'bác', female: 'bác', default: 'bác' },
		npcSelf: { male: 'cháu', female: 'cháu', default: 'cháu' },
	},
};

/**
 * Get age bracket from numeric age
 */
function getAgeBracket(age) {
	if (age <= 12) return 'child';
	if (age <= 17) return 'teen';
	if (age <= 30) return 'young';
	if (age <= 50) return 'adult';
	return 'elder';
}

/**
 * Get gender key from character gender string
 */
function getGenderKey(gender) {
	if (!gender) return 'default';
	const g = gender.toLowerCase();
	if (g === 'nam' || g === 'male' || g === 'm') return 'male';
	if (g === 'nữ' || g === 'female' || g === 'f') return 'female';
	return 'default';
}

/**
 * Get age relationship from NPC's perspective
 * @param {number} npcAge - NPC's age
 * @param {number} playerAge - Player's age
 * @returns {string} - 'much_older', 'older', 'peer', 'younger', 'much_younger'
 */
function getAgeRelationship(npcAge, playerAge) {
	const npcBracket = getAgeBracket(npcAge || 25);
	const playerBracket = getAgeBracket(playerAge || 25);
	const npcIndex = AGE_BRACKET_ORDER.indexOf(npcBracket);
	const playerIndex = AGE_BRACKET_ORDER.indexOf(playerBracket);
	const diff = npcIndex - playerIndex;

	if (diff >= 2) return 'much_older';
	if (diff === 1) return 'older';
	if (diff === 0) return 'peer';
	if (diff === -1) return 'younger';
	return 'much_younger';
}

/**
 * Get player's self-referencing pronoun (doesn't depend on NPC)
 * Used for ${1p} placeholder
 */
function getPlayerSelfPronoun(playerAge, playerGender) {
	const bracket = getAgeBracket(playerAge || 25);
	const genderKey = getGenderKey(playerGender);
	const config = PLAYER_SELF_PRONOUN[bracket];
	if (!config) return 'tôi';
	return config[genderKey] || config.default;
}

/**
 * Get how NPC addresses the player (relational, based on age difference)
 * Used for ${2p} placeholder
 */
function getNpcToPlayerPronoun(npcAge, playerAge, playerGender) {
	const relationship = getAgeRelationship(npcAge, playerAge);
	const genderKey = getGenderKey(playerGender);
	const config = RELATIONAL_PRONOUN[relationship]?.toPlayer;
	if (!config) return 'anh';
	return config[genderKey] || config.default;
}

/**
 * Get peer pronoun (equal relationship, used as fail-safe when NPC is missing)
 */
function getPeerPronoun(gender) {
	const genderKey = getGenderKey(gender);
	const config = RELATIONAL_PRONOUN.peer?.toPlayer;
	if (!config) return 'anh';
	return config[genderKey] || config.default;
}

/**
 * Get how NPC refers to themselves when talking to player (relational)
 * Used for ${npc_1p} placeholder
 */
function getNpcSelfPronoun(npcAge, npcGender, playerAge) {
	const relationship = getAgeRelationship(npcAge, playerAge);
	const genderKey = getGenderKey(npcGender);
	const config = RELATIONAL_PRONOUN[relationship]?.npcSelf;
	if (!config) return 'tôi';
	return config[genderKey] || config.default;
}

/**
 * Reverse relationship perspective
 * If NPC is 'older' than player, then player is 'younger' than NPC
 */
function reverseRelationship(relationship) {
	const reverseMap = {
		much_older: 'much_younger',
		older: 'younger',
		peer: 'peer',
		younger: 'older',
		much_younger: 'much_older',
	};
	return reverseMap[relationship] || 'peer';
}

/**
 * Get how player addresses the NPC (relational, from player's perspective)
 * Used for ${npc_2p} placeholder
 */
function getPlayerToNpcPronoun(playerAge, npcAge, npcGender) {
	// Get relationship from NPC's perspective, then reverse it
	const npcRelationship = getAgeRelationship(npcAge, playerAge);
	const playerRelationship = reverseRelationship(npcRelationship);
	const genderKey = getGenderKey(npcGender);
	const config = RELATIONAL_PRONOUN[playerRelationship]?.toPlayer;
	if (!config) return 'anh';
	return config[genderKey] || config.default;
}

/**
 * Legacy function - get pronoun based on type, age, and gender
 * @deprecated Use getPlayerSelfPronoun or getNpcToPlayerPronoun instead
 */
function getPronoun(type, age, gender) {
	if (type === 'first_person') {
		return getPlayerSelfPronoun(age, gender);
	}
	// For second_person without NPC context, assume peer relationship
	const genderKey = getGenderKey(gender);
	const config = RELATIONAL_PRONOUN.peer?.toPlayer;
	if (!config) return 'anh';
	return config[genderKey] || config.default;
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Process text with pronoun and player name placeholders
 *
 * Supported placeholders:
 * - ${first_person} or ${1p} - How player refers to self (tôi, em, con...)
 * - ${second_person} or ${2p} - How NPC addresses player (relational: anh, chị, ông, bà, cháu...)
 * - ${npc_1p} - How NPC refers to self (relational: tôi, em, cháu, ta...)
 * - ${player_name} - Player's display name
 * - ${player_fullname} - Player's full name
 * - ${npc_name} - NPC's display name
 *
 * Auto-capitalization after sentence-ending punctuation (. ! ?)
 *
 * @param {string} text - Text with placeholders
 * @param {number} playerAge - Player's age
 * @param {string} playerGender - Player's gender
 * @param {Object} character - Character object with name fields
 * @param {Object} npc - NPC object with age, gender, name fields (optional)
 * @returns {string} - Processed text
 */
function processTextTemplate(text, playerAge, playerGender, character = null, npc = null) {
	if (!text) return text;

	// Player pronouns
	const firstPerson = getPlayerSelfPronoun(playerAge, playerGender);
	const playerName = character?.name || character?.fullname || 'Người lữ khách';
	const playerFullname = character?.fullname || character?.name || 'Người lữ khách';

	// NPC-related pronouns (relational based on age difference)
	// When NPC is null, use peer relationship as fail-safe
	const hasNpc = npc !== null;
	const npcAge = npc?.age || 25;
	const npcGender = npc?.gender;

	// If no NPC, use peer relationship (equal treatment)
	const secondPerson = hasNpc ? getNpcToPlayerPronoun(npcAge, playerAge, playerGender) : getPeerPronoun(playerGender);
	const npcSelf = hasNpc ? getNpcSelfPronoun(npcAge, npcGender, playerAge) : 'tôi';
	const npcSecondPerson = hasNpc ? getPlayerToNpcPronoun(playerAge, npcAge, npcGender) : 'bạn';
	const npcName = npc?.name || npc?.fullname || '';

	// Replace placeholders
	let result = text;

	// First person (player self)
	result = result.replace(/\$\{(first_person|1p)\}/gi, firstPerson);

	// Second person (NPC to player - relational)
	result = result.replace(/\$\{(second_person|2p)\}/gi, secondPerson);

	// NPC first person (NPC self - relational)
	result = result.replace(/\$\{npc_1p\}/gi, npcSelf);

	// NPC second person (player to NPC - relational)
	result = result.replace(/\$\{npc_2p\}/gi, npcSecondPerson);

	// Player name
	result = result.replace(/\$\{player_name\}/gi, playerName);
	result = result.replace(/\$\{player_fullname\}/gi, playerFullname);

	// NPC name - remove if no NPC (programming mistake)
	result = result.replace(/\$\{npc_name\}/gi, npcName);

	// Auto-capitalize after sentence-ending punctuation
	// Match: (. or ! or ?) followed by space(s) and then a Vietnamese/ASCII lowercase letter
	result = result.replace(/([.!?])\s+([a-zA-Zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ])/g,
		(match, punct, letter) => `${punct} ${letter.toUpperCase()}`);

	// Capitalize first letter at the beginning of text
	result = result.replace(/^([a-zA-Zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ])/,
		(match, letter) => letter.toUpperCase());

	// Capitalize first letter after newlines
	result = result.replace(/\n([a-zA-Zàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ])/g,
		(match, letter) => `\n${letter.toUpperCase()}`);

	return result;
}

/**
 * Legacy pronoun function for backwards compatibility
 * @deprecated Use processTextTemplate instead
 */
function pronoun(event, age, gender) {
	return processTextTemplate(event, age, gender);
}

module.exports = {
	pronoun,
	processTextTemplate,
	getPronoun,
	getPlayerSelfPronoun,
	getNpcToPlayerPronoun,
	getNpcSelfPronoun,
	getPlayerToNpcPronoun,
	getPeerPronoun,
	reverseRelationship,
	getAgeRelationship,
	getAgeBracket,
	getGenderKey,
	PRONOUN_PLACEHOLDER,
	PLAYER_SELF_PRONOUN,
	RELATIONAL_PRONOUN,
	AGE_BRACKET_ORDER,
};
