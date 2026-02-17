const Sequelize = require('sequelize');

const eventBase = (sequelize) => {
	return sequelize.define('event_base', {
		id: { type: Sequelize.STRING, primaryKey: true },
		title: Sequelize.STRING,
		avatar: Sequelize.STRING,
		illustration: Sequelize.STRING,
		text: Sequelize.STRING,
		default_child_event_id: Sequelize.STRING,
		choose_placeholder: Sequelize.STRING,
		hidden: Sequelize.BOOLEAN,
		npc: { type: Sequelize.STRING, allowNull: true },
		check: Sequelize.BOOLEAN,
	}, { timestamps: false });
};

const eventFlag = (sequelize) => {
	return sequelize.define('event_flag', {
 	event_id: Sequelize.STRING,
 	option_id: Sequelize.INTEGER,
 	flag: Sequelize.STRING,
 	amount: Sequelize.INTEGER,
 	method: Sequelize.STRING,
 	external: Sequelize.BOOLEAN,
 	global: Sequelize.BOOLEAN,
	}, { timestamps: false });
};

const eventTag = (sequelize) => {
	return sequelize.define('event_tag', {
		event_id: Sequelize.STRING,
		tag: Sequelize.STRING,
	}, { timestamps: false });
};

const eventOption = (sequelize) => {
	return sequelize.define('event_option', {
 	event_id: Sequelize.STRING,
 	option_id: Sequelize.STRING,
		text: Sequelize.STRING,
		required_flags: Sequelize.STRING,
		child_event_id: Sequelize.STRING,
	}, { timestamps: false });
};

const eventOptionCheck = (sequelize) => {
	return sequelize.define('event_option_check', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		option_id: { type: Sequelize.INTEGER, allowNull: false },
		check_type: { type: Sequelize.STRING, allowNull: false },
		target_stat: { type: Sequelize.STRING, allowNull: true },
		minimum_value: { type: Sequelize.INTEGER, allowNull: true },
		required_flag: { type: Sequelize.STRING, allowNull: true },
		required_flag_value: { type: Sequelize.STRING, allowNull: true },
		forbidden_flag: { type: Sequelize.STRING, allowNull: true },
		forbidden_flag_value: { type: Sequelize.STRING, allowNull: true },
		required_item: { type: Sequelize.STRING, allowNull: true },
		required_quantity: { type: Sequelize.INTEGER, defaultValue: 1 },
		description: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

const eventCheck = (sequelize) => {
	return sequelize.define('event_check', {
		event_id: Sequelize.STRING,
		check_source: Sequelize.STRING,
		check_type: Sequelize.STRING,
		check_value: Sequelize.INTEGER,
		roll: Sequelize.BOOLEAN,
		difficulty_mod: Sequelize.INTEGER,
		target: Sequelize.INTEGER,
		event_if_true: Sequelize.STRING,
		event_if_false: Sequelize.STRING,
	}, { timestamps: false });
};

const specialEventBase = (sequelize) => {
	return sequelize.define('special_event_base', {
		id: { type: Sequelize.STRING, primaryKey: true },
		title: { type: Sequelize.STRING, allowNull: true },
		avatar: { type: Sequelize.STRING, allowNull: true },
		illustration: { type: Sequelize.STRING, allowNull: true },
		text: { type: Sequelize.STRING, allowNull: true },
		default_child_event_id: { type: Sequelize.STRING, allowNull: true },
		choose_placeholder: { type: Sequelize.STRING, allowNull: true },
		hidden: { type: Sequelize.BOOLEAN, defaultValue: false },
		npc: { type: Sequelize.STRING, allowNull: true },
		check: { type: Sequelize.BOOLEAN, defaultValue: false },
		is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
	}, { timestamps: false });
};

const specialEventFlag = (sequelize) => {
	return sequelize.define('special_event_flag', {
 	special_event_id: { type: Sequelize.STRING, allowNull: false },
 	option_id: { type: Sequelize.INTEGER, allowNull: true },
 	flag: { type: Sequelize.STRING, allowNull: false },
 	amount: { type: Sequelize.INTEGER, defaultValue: 1 },
 	method: { type: Sequelize.STRING, defaultValue: 'set' },
 	external: { type: Sequelize.BOOLEAN, defaultValue: false },
 	global: { type: Sequelize.BOOLEAN, defaultValue: false },
	}, { timestamps: false });
};

const specialEventTag = (sequelize) => {
	return sequelize.define('special_event_tag', {
		special_event_id: { type: Sequelize.STRING, allowNull: false },
		tag: { type: Sequelize.STRING, allowNull: false },
	}, { timestamps: false });
};

const specialEventOption = (sequelize) => {
	return sequelize.define('special_event_option', {
 	special_event_id: { type: Sequelize.STRING, allowNull: false },
 	option_id: { type: Sequelize.STRING, allowNull: false },
 	text: { type: Sequelize.STRING, allowNull: true },
 	child_event_id: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

const specialEventOptionCheck = (sequelize) => {
	return sequelize.define('special_event_option_check', {
		option_id: { type: Sequelize.STRING, allowNull: false },
		check_type: { type: Sequelize.STRING, allowNull: false },
		target_stat: { type: Sequelize.STRING, allowNull: true },
		minimum_value: { type: Sequelize.INTEGER, allowNull: true },
		required_flag: { type: Sequelize.STRING, allowNull: true },
		required_flag_value: { type: Sequelize.STRING, allowNull: true },
		forbidden_flag: { type: Sequelize.STRING, allowNull: true },
		forbidden_flag_value: { type: Sequelize.STRING, allowNull: true },
		required_item: { type: Sequelize.STRING, allowNull: true },
		required_quantity: { type: Sequelize.INTEGER, defaultValue: 1 },
		description: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

const locationSpecialEvent = (sequelize) => {
	return sequelize.define('location_special_event', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		location_id: { type: Sequelize.STRING, allowNull: false },
		special_event_id: { type: Sequelize.STRING, allowNull: false },
		// Rarity: 1=Common, 2=Uncommon, 3=Rare, 4=Epic, 5=Legendary
		rarity: { type: Sequelize.INTEGER, defaultValue: 1 },
		required_flags: { type: Sequelize.JSON, allowNull: true },
		forbidden_flags: { type: Sequelize.JSON, allowNull: true },
		description: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

const locationSpecialEventTrigger = (sequelize) => {
	return sequelize.define('location_special_event_trigger', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		character_id: { type: Sequelize.STRING, allowNull: false },
		location_id: { type: Sequelize.STRING, allowNull: false },
		special_event_id: { type: Sequelize.STRING, allowNull: false },
		triggered_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
		instance_id: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

module.exports = {
	eventBase,
	eventFlag,
	eventTag,
	eventOption,
	eventOptionCheck,
	eventCheck,
	specialEventBase,
	specialEventFlag,
	specialEventTag,
	specialEventOption,
	specialEventOptionCheck,
	locationSpecialEvent,
	locationSpecialEventTrigger,
};
