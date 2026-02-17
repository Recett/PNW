/**
 * Event System Constants and Enums
 *
 * This file contains all the enums and constants used throughout the event system.
 * Import these to ensure consistency and avoid magic numbers/strings.
 */

/**
 * Flag types for event actions
 *
 * LOCAL: Session variables (temporary, only exist during the current event session)
 * CHARACTER: Per-character flags (persistent, stored in character_flag table)
 * GLOBAL: Server-wide flags (persistent, stored in global_flag table)
 */
const FLAG_TYPE = {
	LOCAL: 'local',        // Session variable
	CHARACTER: 'character',
	GLOBAL: 'global',
};

// Check types for event checks
const CHECK_TYPE = {
	FLAG: 'flag',
	STAT: 'stat',
	ITEM: 'item',
	SKILL: 'skill',
	LEVEL: 'level',
	RANDOM: 'random',
};

/**
 * JSON Data Structure Examples for eventCheck type-specific columns:
 *
 * flag_data (for CHECK_TYPE.FLAG):
 * { flag_name: "quest_started", flag_value: "true", is_global_flag: false }
 *
 * stat_data (for CHECK_TYPE.STAT):
 * { stat_name: "hp", stat_comparison: "greater_than", stat_value: 50, use_dice_roll: false }
 * { stat_name: "strength", stat_comparison: "dice_roll", stat_value: 80, use_dice_roll: true }
 *
 * item_data (for CHECK_TYPE.ITEM - supports multiple items in one check):
 * [
 *   { item_id: 101, required_quantity: 2 },
 *   { item_id: 205, required_quantity: 1 }
 * ]
 *
 * skill_data (for CHECK_TYPE.SKILL):
 * { skill_id: 5, required_level: 3 }
 *
 * level_data (for CHECK_TYPE.LEVEL):
 * { required_level: 10 }
 *
 * random_data (for CHECK_TYPE.RANDOM):
 * { success_chance: 75 }  // 75% chance of success
 */

// Flag operations
const FLAG_OPERATION = {
	SET: 'set',
	ADD: 'add',
	SUBTRACT: 'subtract',
	TOGGLE: 'toggle',
};

// Item operations
const ITEM_OPERATION = {
	// Add specified quantity
	GIVE: 'give',
	// Remove specified quantity
	TAKE: 'take',
	// Set to exact quantity
	SET: 'set',
	// Remove all of this item regardless of quantity
	REMOVE_ALL: 'remove_all',
};

/**
 * Item Action Examples:
 *
 * Give items:
 * { action_type: 'item', item_operation: 'give', item_id: 101, quantity: 3 }
 *
 * Take items:
 * { action_type: 'item', item_operation: 'take', item_id: 205, quantity: 1 }
 *
 * Set exact quantity:
 * { action_type: 'item', item_operation: 'set', item_id: 309, quantity: 5 }
 *
 * Remove all of an item (ignores quantity):
 * { action_type: 'item', item_operation: 'remove_all', item_id: 404 }
 */

// Stat operations
const STAT_OPERATION = {
	SET: 'set',
	ADD: 'add',
	SUBTRACT: 'subtract',
};

// Stat comparison types for stat checks
const STAT_COMPARISON = {
	GREATER_THAN: 'greater_than',
	LESS_THAN: 'less_than',
	EQUAL: 'equal',
	GREATER_EQUAL: 'greater_equal',
	LESS_EQUAL: 'less_equal',
	// Roll d100 vs stat value
	DICE_ROLL: 'dice_roll',
};

// Movement types
const MOVEMENT_TYPE = {
	TELEPORT: 'teleport',
	WALK: 'walk',
	FORCED: 'forced',
};

// Status operations
const STATUS_OPERATION = {
	// Add/inflict a status condition
	ADD: 'add',
	// Remove a status condition
	REMOVE: 'remove',
	// Remove all status conditions
	CLEAR_ALL: 'clear_all',
};

// Combat types
const COMBAT_TYPE = {
	ENEMY: 'enemy',
	NPC: 'npc',
	GROUP: 'group',
	BOSS: 'boss',
};

// Enemy types
const ENEMY_TYPE = {
	ENEMY: 'enemy',
	NPC: 'npc',
};

// Shop types
const SHOP_TYPE = {
	ITEM: 'item',
	PERK: 'perk',
	BOTH: 'both',
};

// Trigger conditions for actions
const TRIGGER_CONDITION = {
	IMMEDIATE: 'immediate',
	CHECK_SUCCESS: 'check_success',
	CHECK_FAILURE: 'check_failure',
	COMBAT_VICTORY: 'combat_victory',
	COMBAT_DEFEAT: 'combat_defeat',
	COMBAT_FLEE: 'combat_flee',
	OPTION_SELECTED: 'option_selected',
};

// Variable source types for event_action_variable
const VARIABLE_SOURCE = {
	// Read character stat (hp, gold, str, etc.)
	STAT: 'stat',
	// Read flag value
	FLAG: 'flag',
	// Count of specific item in inventory
	ITEM_COUNT: 'item_count',
	// Hardcoded numeric value
	LITERAL: 'literal',
	// Compute from other variables
	EXPRESSION: 'expression',
	// Collect player input via Discord modal
	INPUT: 'input',
	// Collect player input via chat message
	CHAT_INPUT: 'chat_input',
};

module.exports = {
	FLAG_TYPE,
	CHECK_TYPE,
	FLAG_OPERATION,
	ITEM_OPERATION,
	STAT_OPERATION,
	STAT_COMPARISON,
	MOVEMENT_TYPE,
	STATUS_OPERATION,
	COMBAT_TYPE,
	ENEMY_TYPE,
	SHOP_TYPE,
	TRIGGER_CONDITION,
	VARIABLE_SOURCE,
};