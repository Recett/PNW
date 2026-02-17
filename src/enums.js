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
};
