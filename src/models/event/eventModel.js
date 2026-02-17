const Sequelize = require('sequelize');
const {
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
} = require('./eventConstants');

/**
 * NEW EVENT SYSTEM
 *
 * Event Base: Core event template/placeholder
 * Event Message: Optional message display for Discord
 * Event Check: Validation system (flags, stats, items, etc.)
 * Event Combat: Combat resolution
 * Event Enemy: Enemy preview system for player decision-making
 * Event Option: Player choice system with event chaining
 *
 * Action Tables (separated by type for clean data handling):
 * - eventActionFlag: Set/modify flags
 * - eventActionItem: Give/take items
 * - eventActionStat: Modify character stats
 * - eventActionMove: Move player to location
 * - eventActionEvent: Chain to another event
 */

// Core event template - contains minimal info and links to components
const eventBase = (sequelize) => {
	return sequelize.define('event_base', {
		id: { type: Sequelize.STRING, primaryKey: true },
		name: { type: Sequelize.STRING, allowNull: false },
		description: { type: Sequelize.STRING, allowNull: true },
		// Event types: see EVENT_TYPE enum in eventConstants.js for reference
		event_type: { type: Sequelize.STRING, allowNull: true },
		// Default event to chain to if no other action/option specifies one
		next_event_id: { type: Sequelize.STRING, allowNull: true },
		is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
		// If true, event processes without displaying message/options and auto-proceeds to next event
		silent: { type: Sequelize.BOOLEAN, defaultValue: false },
		// For categorization and filtering
		tags: { type: Sequelize.JSON, defaultValue: [] },
		// Flexible data storage
		metadata: { type: Sequelize.JSON, defaultValue: {} },
	}, { timestamps: false });
};

// Optional message component for Discord display
const eventMessage = (sequelize) => {
	return sequelize.define('event_message', {
		id: { type: Sequelize.STRING, primaryKey: true },
		event_id: { type: Sequelize.STRING, allowNull: false, unique: true },
		title: { type: Sequelize.STRING, allowNull: true },
		text: { type: Sequelize.TEXT, allowNull: true },
		avatar: { type: Sequelize.STRING, allowNull: true },
		illustration: { type: Sequelize.STRING, allowNull: true },
		npc_speaker: { type: Sequelize.STRING, allowNull: true },
		// Message types: see MESSAGE_TYPE enum in eventConstants.js for reference
		message_type: { type: Sequelize.STRING, allowNull: true },
		// When to show this message
		display_conditions: { type: Sequelize.JSON, defaultValue: {} },
	}, { timestamps: false });
};

// Check system - can validate multiple conditions
const eventCheck = (sequelize) => {
	return sequelize.define('event_check', {
		id: { type: Sequelize.STRING, primaryKey: true },
		event_id: { type: Sequelize.STRING, allowNull: false },
		// Identifier for this check
		check_name: { type: Sequelize.STRING, allowNull: false },
		// Check types: see CHECK_TYPE enum in eventConstants.js
		check_type: {
			type: Sequelize.STRING,
			allowNull: false,
			validate: {
				isIn: [Object.values(CHECK_TYPE)],
			},
		},

		// Type-specific JSON data columns
		// Flag check data: { flag_name: string, flag_value: string, is_global_flag: boolean }
		flag_data: { type: Sequelize.JSON, allowNull: true },

		// Stat check data: { stat_name: string, stat_comparison: string, stat_value: number, use_dice_roll: boolean }
		stat_data: { type: Sequelize.JSON, allowNull: true },

		// Item check data: [{ item_id: number, required_quantity: number }, ...] (array for multiple items)
		item_data: { type: Sequelize.JSON, allowNull: true },

		// Skill check data: { skill_id: number, required_level: number }
		skill_data: { type: Sequelize.JSON, allowNull: true },

		// Level check data: { required_level: number }
		level_data: { type: Sequelize.JSON, allowNull: true },

		// Random check data: { success_chance: number }
		random_data: { type: Sequelize.JSON, allowNull: true },

		// General settings
		difficulty_modifier: { type: Sequelize.INTEGER, defaultValue: 0 },
		success_message: { type: Sequelize.STRING, allowNull: true },
		failure_message: { type: Sequelize.STRING, allowNull: true },
		// If false, failure doesn't block progression
		is_required: { type: Sequelize.BOOLEAN, defaultValue: true },
		// If true, check result will not be displayed to player
		silent: { type: Sequelize.BOOLEAN, defaultValue: true },
		// Order to execute checks
		execution_order: { type: Sequelize.INTEGER, defaultValue: 0 },

		// Event branching - automatically route to different events based on check outcome
		// If blank, continues to next check or falls through to default event flow
		success_event_id: { type: Sequelize.STRING, allowNull: true },
		failure_event_id: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

// Combat system
const eventCombat = (sequelize) => {
	return sequelize.define('event_combat', {
		id: { type: Sequelize.STRING, primaryKey: true },
		event_id: { type: Sequelize.STRING, allowNull: false, unique: true },
		// Combat types: see COMBAT_TYPE enum in eventConstants.js for reference
		combat_type: { type: Sequelize.STRING, allowNull: true },

		// Enemy reference - foreign key to enemy_base
		enemy_base_id: { type: Sequelize.INTEGER, allowNull: false },

		// Combat settings
		environment_effects: { type: Sequelize.JSON, defaultValue: {} },

		// Victory/defeat/draw outcomes
		victory_message: { type: Sequelize.STRING, allowNull: true },
		defeat_message: { type: Sequelize.STRING, allowNull: true },
		draw_message: { type: Sequelize.STRING, allowNull: true },

		// Event chaining based on combat outcome
		victory_event_id: { type: Sequelize.STRING, allowNull: true },
		defeat_event_id: { type: Sequelize.STRING, allowNull: true },
		draw_event_id: { type: Sequelize.STRING, allowNull: true },

		// Special rules
		special_rules: { type: Sequelize.JSON, defaultValue: {} },
	}, { timestamps: false });
};

// Enemy preview system - displays enemy information to players before combat/choices
const eventEnemy = (sequelize) => {
	return sequelize.define('event_enemy', {
		id: { type: Sequelize.STRING, primaryKey: true },
		event_id: { type: Sequelize.STRING, allowNull: false },
		// Enemy reference - can be enemy or NPC
		enemy_type: { type: Sequelize.STRING, allowNull: true },
		enemy_id: { type: Sequelize.INTEGER, allowNull: false },

		// Display information override (optional - if not provided, uses enemy's default info)
		display_name: { type: Sequelize.STRING, allowNull: true },
		display_description: { type: Sequelize.STRING, allowNull: true },
		display_avatar: { type: Sequelize.STRING, allowNull: true },
		display_illustration: { type: Sequelize.STRING, allowNull: true },

		// Preview stats to show player (allows selective information reveal)
		show_health: { type: Sequelize.BOOLEAN, defaultValue: true },
		show_level: { type: Sequelize.BOOLEAN, defaultValue: true },
		show_stats: { type: Sequelize.JSON, defaultValue: [] },
		show_abilities: { type: Sequelize.JSON, defaultValue: [] },
		show_weaknesses: { type: Sequelize.JSON, defaultValue: [] },
		show_resistances: { type: Sequelize.JSON, defaultValue: [] },

		// Custom preview information
		threat_level: { type: Sequelize.STRING, allowNull: true },
		preview_notes: { type: Sequelize.STRING, allowNull: true },
		warning_message: { type: Sequelize.STRING, allowNull: true },

		// Display settings
		display_order: { type: Sequelize.INTEGER, defaultValue: 0 },
		is_hidden: { type: Sequelize.BOOLEAN, defaultValue: false },
		reveal_conditions: { type: Sequelize.JSON, defaultValue: {} },
	}, { timestamps: false });
};

// ============================================================================
// ACTION TABLES - Each action type has its own table for clear structure
// ============================================================================

// Flag actions - set/modify character or global flags
const eventActionFlag = (sequelize) => {
	return sequelize.define('event_action_flag', {
		id: { type: Sequelize.STRING, primaryKey: true },
		event_id: { type: Sequelize.STRING, allowNull: false },
		flag_name: { type: Sequelize.STRING, allowNull: false },
		flag_value: { type: Sequelize.STRING, allowNull: false },
		flag_operation: {
			type: Sequelize.STRING,
			defaultValue: FLAG_OPERATION.SET,
			validate: { isIn: [Object.values(FLAG_OPERATION)] },
		},
		flag_type: {
			type: Sequelize.STRING,
			defaultValue: FLAG_TYPE.CHARACTER,
			validate: { isIn: [Object.values(FLAG_TYPE)] },
		},
		// If true, action result will not be displayed to player
		silent: { type: Sequelize.BOOLEAN, defaultValue: true },
		// Custom message to display when action is not silent
		custom_message: { type: Sequelize.STRING, allowNull: true },
		execution_order: { type: Sequelize.INTEGER, defaultValue: 0 },
		// Store result in session variable for use by subsequent actions
		output_variable: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

// Item actions - give/take items
const eventActionItem = (sequelize) => {
	return sequelize.define('event_action_item', {
		id: { type: Sequelize.STRING, primaryKey: true },
		event_id: { type: Sequelize.STRING, allowNull: false },
		item_id: { type: Sequelize.INTEGER, allowNull: false },
		// Quantity can be a number or expression like \"${items_taken}\"
		quantity: { type: Sequelize.STRING, defaultValue: '1' },
		operation: {
			type: Sequelize.STRING,
			defaultValue: ITEM_OPERATION.GIVE,
			validate: { isIn: [Object.values(ITEM_OPERATION)] },
		},
		// If true, action result will not be displayed to player
		silent: { type: Sequelize.BOOLEAN, defaultValue: true },
		// Custom message to display when action is not silent
		custom_message: { type: Sequelize.STRING, allowNull: true },
		execution_order: { type: Sequelize.INTEGER, defaultValue: 0 },
		// Store result (quantity affected) in session variable
		output_variable: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

// Stat actions - modify character stats
const eventActionStat = (sequelize) => {
	return sequelize.define('event_action_stat', {
		id: { type: Sequelize.STRING, primaryKey: true },
		event_id: { type: Sequelize.STRING, allowNull: false },
		stat_name: { type: Sequelize.STRING, allowNull: false },
		// Value can be a number or expression like "${items_taken * 10}"
		value: { type: Sequelize.STRING, allowNull: false },
		operation: {
			type: Sequelize.STRING,
			defaultValue: STAT_OPERATION.ADD,
			validate: { isIn: [Object.values(STAT_OPERATION)] },
		},
		// If true, action result will not be displayed to player
		silent: { type: Sequelize.BOOLEAN, defaultValue: true },
		// Custom message to display when action is not silent
		custom_message: { type: Sequelize.STRING, allowNull: true },
		execution_order: { type: Sequelize.INTEGER, defaultValue: 0 },
		// Store result (new value or change amount) in session variable
		output_variable: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

// Movement actions - move player to location
const eventActionMove = (sequelize) => {
	return sequelize.define('event_action_move', {
		id: { type: Sequelize.STRING, primaryKey: true },
		event_id: { type: Sequelize.STRING, allowNull: false },
		location_id: { type: Sequelize.STRING, allowNull: false },
		movement_type: { type: Sequelize.STRING, allowNull: true },
		// If true, action result will not be displayed to player
		silent: { type: Sequelize.BOOLEAN, defaultValue: true },
		// Custom message to display when action is not silent
		custom_message: { type: Sequelize.STRING, allowNull: true },
		execution_order: { type: Sequelize.INTEGER, defaultValue: 0 },
	}, { timestamps: false });
};

// Event chaining - trigger another event
const eventActionEvent = (sequelize) => {
	return sequelize.define('event_action_event', {
		id: { type: Sequelize.STRING, primaryKey: true },
		event_id: { type: Sequelize.STRING, allowNull: false },
		next_event_id: { type: Sequelize.STRING, allowNull: false },
		delay_seconds: { type: Sequelize.INTEGER, defaultValue: 0 },
		// If true, action result will not be displayed to player
		silent: { type: Sequelize.BOOLEAN, defaultValue: true },
		// Custom message to display when action is not silent
		custom_message: { type: Sequelize.STRING, allowNull: true },
		execution_order: { type: Sequelize.INTEGER, defaultValue: 0 },
	}, { timestamps: false });
};

// Status actions - inflict/remove status conditions
const eventActionStatus = (sequelize) => {
	return sequelize.define('event_action_status', {
		id: { type: Sequelize.STRING, primaryKey: true },
		event_id: { type: Sequelize.STRING, allowNull: false },
		// Status condition name (e.g., 'poisoned', 'stunned', 'blessed')
		status_name: { type: Sequelize.STRING, allowNull: false },
		// Status type (e.g., 'buff', 'debuff', 'temporary', 'permanent')
		status_type: { type: Sequelize.STRING, defaultValue: 'temporary' },
		// Optional value for the status (e.g., damage per turn, duration)
		status_value: { type: Sequelize.STRING, allowNull: true },
		operation: {
			type: Sequelize.STRING,
			defaultValue: 'add',
			validate: { isIn: [['add', 'remove', 'clear_all']] },
		},
		// If true, action result will not be displayed to player
		silent: { type: Sequelize.BOOLEAN, defaultValue: true },
		// Custom message to display when action is not silent
		custom_message: { type: Sequelize.STRING, allowNull: true },
		execution_order: { type: Sequelize.INTEGER, defaultValue: 0 },
	}, { timestamps: false });
};

// Variable actions - read/compute values and store in session variables
const eventActionVariable = (sequelize) => {
	return sequelize.define('event_action_variable', {
		id: { type: Sequelize.STRING, primaryKey: true },
		event_id: { type: Sequelize.STRING, allowNull: false },
		// Name to store the variable as (e.g., "original_hp", "items_taken")
		variable_name: { type: Sequelize.STRING, allowNull: false },
		// Source type: 'stat', 'flag', 'item_count', 'literal', 'expression', 'input', 'chat_input'
		source_type: {
			type: Sequelize.STRING,
			defaultValue: VARIABLE_SOURCE.STAT,
			validate: { isIn: [Object.values(VARIABLE_SOURCE)] },
		},
		// Which stat/flag/item to read (e.g., "hp", "gold", item_id)
		source_name: { type: Sequelize.STRING, allowNull: true },
		// For literal values or expressions (e.g., "100" or "${var_a + var_b}")
		expression: { type: Sequelize.STRING, allowNull: true },
		// For flag source: is it a global flag?
		is_global_flag: { type: Sequelize.BOOLEAN, defaultValue: false },
		// If true, action result will not be displayed to player
		silent: { type: Sequelize.BOOLEAN, defaultValue: true },
		// Custom message to display when action is not silent
		custom_message: { type: Sequelize.STRING, allowNull: true },
		execution_order: { type: Sequelize.INTEGER, defaultValue: 0 },
		// === Input fields (for source_type: 'input' or 'chat_input') ===
		// Label text for modal field or chat prompt
		input_label: { type: Sequelize.STRING, allowNull: true },
		// Placeholder/hint text in input field
		input_placeholder: { type: Sequelize.STRING, allowNull: true },
		// Default value if player doesn't respond or cancels
		input_default: { type: Sequelize.STRING, allowNull: true },
		// If true, parse input as number; otherwise keep as string
		is_numeric: { type: Sequelize.BOOLEAN, defaultValue: false },
	}, { timestamps: false });
};

// Shop actions - open NPC item/perk shop
const eventActionShop = (sequelize) => {
	return sequelize.define('event_action_shop', {
		id: { type: Sequelize.STRING, primaryKey: true },
		event_id: { type: Sequelize.STRING, allowNull: false },
		// Which NPC's shop to open
		npc_id: { type: Sequelize.STRING, allowNull: false },
		// Shop types: 'item', 'perk', 'both'
		shop_type: {
			type: Sequelize.STRING,
			defaultValue: SHOP_TYPE.ITEM,
			validate: { isIn: [Object.values(SHOP_TYPE)] },
		},
		// When to trigger this action
		trigger_condition: {
			type: Sequelize.STRING,
			defaultValue: TRIGGER_CONDITION.IMMEDIATE,
			validate: { isIn: [Object.values(TRIGGER_CONDITION)] },
		},
		// If true, action result will not be displayed to player
		silent: { type: Sequelize.BOOLEAN, defaultValue: false },
		// Custom message to display when action is not silent
		custom_message: { type: Sequelize.STRING, allowNull: true },
		execution_order: { type: Sequelize.INTEGER, defaultValue: 0 },
	}, { timestamps: false });
};

// Player choice system (formerly event resolution)
const eventOption = (sequelize) => {
	return sequelize.define('event_option', {
		id: { type: Sequelize.STRING, primaryKey: true },
		event_id: { type: Sequelize.STRING, allowNull: false },
		// Unique within event
		option_id: { type: Sequelize.STRING, allowNull: false },
		text: { type: Sequelize.STRING, allowNull: false },
		description: { type: Sequelize.STRING, allowNull: true },

		// Event chaining - which event to trigger when this option is selected
		next_event_id: { type: Sequelize.STRING, allowNull: true },

		// Visibility conditions - arrays of check names that must pass
		required_checks: { type: Sequelize.JSON, defaultValue: [] },
		// Arrays of check names that must fail
		hidden_checks: { type: Sequelize.JSON, defaultValue: [] },

		// Option properties
		// Default choice if no input
		is_default: { type: Sequelize.BOOLEAN, defaultValue: false },
		// Warning flag for dangerous choices
		is_destructive: { type: Sequelize.BOOLEAN, defaultValue: false },
		// Prevent spam clicking
		cooldown_seconds: { type: Sequelize.INTEGER, defaultValue: 0 },

		// Ordering
		display_order: { type: Sequelize.INTEGER, defaultValue: 0 },
	}, { timestamps: false });
};

module.exports = {
	// Core event components
	eventBase,
	eventMessage,
	eventCheck,
	eventCombat,
	eventEnemy,
	eventOption,

	// Action tables (separated by type)
	eventActionFlag,
	eventActionItem,
	eventActionStat,
	eventActionMove,
	eventActionEvent,
	eventActionStatus,
	eventActionShop,
	eventActionVariable,

	// Export constants for easy access
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