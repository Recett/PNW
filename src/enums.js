// Location Types
const LOCATION_TYPES = {
	CITY: 'city',
	DISTRICT: 'district',
	WARD: 'ward',
};

// Status Types
const STATUS_TYPES = {
	ACTIVE: 'active',
	INACTIVE: 'inactive',
	ARCHIVED: 'archived',
};

// Role Types
const ROLE_TYPES = {
	ADMIN: 'admin',
	MODERATOR: 'moderator',
	USER: 'user',
};

// Action Types
const ACTION_TYPES = {
	CREATE: 'create',
	UPDATE: 'update',
	DELETE: 'delete',
};

// Priority Levels
const PRIORITY_LEVELS = {
	LOW: 'low',
	MEDIUM: 'medium',
	HIGH: 'high',
	URGENT: 'urgent',
};

// Response Codes
const RESPONSE_CODES = {
	SUCCESS: 200,
	ERROR: 500,
	NOT_FOUND: 404,
	UNAUTHORIZED: 401,
	BAD_REQUEST: 400,
};

// Equipment Slots - Weapons
const WEAPON_SLOTS = {
	MAINHAND: 'mainhand',
	OFFHAND: 'offhand',
	TWOHAND: 'twohand',
};

// Equipment Slots - Armor
const ARMOR_SLOTS = {
	HEAD: 'head',
	BODY: 'body',
	LEG: 'leg',
};

// All Equipment Slots (for display purposes)
const EQUIPMENT_SLOT_CONFIG = [
	{ key: WEAPON_SLOTS.MAINHAND, label: 'Main Hand', icon: '⚔️' },
	{ key: WEAPON_SLOTS.OFFHAND, label: 'Off Hand', icon: '🛡️' },
	{ key: ARMOR_SLOTS.HEAD, label: 'Head', icon: '👒' },
	{ key: ARMOR_SLOTS.BODY, label: 'Armor', icon: '👕' },
	{ key: ARMOR_SLOTS.LEG, label: 'Legging', icon: '👖' },
];

// Emoji constants
// IMPORTANT: Never use emoji literals directly in JS source. Terminal/editor encoding
// can silently corrupt multi-byte emoji characters. Always reference from this object.
const EMOJI = {
	// Status indicators
	SUCCESS: '\u2705',       // ✅
	FAILURE: '\u274C',       // ❌
	WARNING: '\u26A0\uFE0F', // ⚠️
	INFO: '\u2139\uFE0F',    // ℹ️

	// Combat
	SWORD: '\u2694\uFE0F',        // ⚔️
	SKULL: '\uD83D\uDC80',        // 💀
	RUN: '\uD83C\uDFC3',          // 🏃
	SHIELD: '\uD83D\uDEE1\uFE0F', // 🛡️
	LIGHTNING: '\u26A1',          // ⚡
	BULLET: '\u2514\u2500',       // └─
	STAR: '\u2B50',               // ⭐
	WIND: '\uD83D\uDCA8',         // 💨
	ARROW: '\u2192',              // →
	RIPOSTE: '\u21A9\uFE0F',      // ↩️
	BOOM: '\uD83D\uDCA5',         // 💥
	DAGGER: '\uD83D\uDDE1\uFE0F', // 🗡️
	EM_DASH: '\u2014',            // —
	FOCUS: '\uD83C\uDFAF',        // 🎯

	// Items / Economy
	PACKAGE: '\uD83D\uDCE6', // 📦
	GOLD: '\uD83D\uDCB0',    // 💰
	MONEY_BAG: '\uD83D\uDCB0', // 💰
	COIN: '\uD83E\uFA99',    // 🪙
	GIFT: '\uD83C\uDF81',    // 🎁
	SPARKLE: '\u2728',       // ✨
	CHART: '\uD83D\uDCCA',   // 📊
	WALK: '\uD83D\uDEB6',    // 🚶
	PARTY: '\uD83C\uDF89',   // 🎉
	WAVE: '\uD83D\uDC4B',    // 👋
	SHOP: '\uD83D\uDED2',    // 🛒
	BOOK: '\uD83D\uDCD6',    // 📖
	DOOR: '\uD83D\uDEAA',    // 🚪
	NOTE: '\uD83D\uDCDD',    // 📝

	// Number emojis (1–10)
	NUMBERS: [
		'1\uFE0F\u20E3', // 1️⃣
		'2\uFE0F\u20E3', // 2️⃣
		'3\uFE0F\u20E3', // 3️⃣
		'4\uFE0F\u20E3', // 4️⃣
		'5\uFE0F\u20E3', // 5️⃣
		'6\uFE0F\u20E3', // 6️⃣
		'7\uFE0F\u20E3', // 7️⃣
		'8\uFE0F\u20E3', // 8️⃣
		'9\uFE0F\u20E3', // 9️⃣
		'\uD83D\uDD1F',  // 🔟
	],
};

module.exports = {
	LOCATION_TYPES,
	STATUS_TYPES,
	ROLE_TYPES,
	ACTION_TYPES,
	PRIORITY_LEVELS,
	RESPONSE_CODES,
	WEAPON_SLOTS,
	ARMOR_SLOTS,
	EQUIPMENT_SLOT_CONFIG,
	EMOJI,
};
