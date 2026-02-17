const Sequelize = require('sequelize');

const characterBase = (sequelize) => {
	return sequelize.define('character_base', {
		id: { type: Sequelize.STRING, primaryKey: true },
		fullname: Sequelize.STRING,
		name: Sequelize.STRING,
		nickname: Sequelize.STRING,
		avatar: Sequelize.STRING,
		age: Sequelize.INTEGER,
		gender: Sequelize.STRING,
		gold: Sequelize.INTEGER,
		str: Sequelize.INTEGER,
		dex: Sequelize.INTEGER,
		agi: Sequelize.INTEGER,
		con: Sequelize.INTEGER,
		perk_point: Sequelize.INTEGER,
		currentHp: Sequelize.INTEGER,
		maxHp: Sequelize.INTEGER,
		currentStamina: Sequelize.INTEGER,
		maxStamina: Sequelize.INTEGER,
		free_point: Sequelize.INTEGER,
		level: { type: Sequelize.INTEGER, defaultValue: 1 },
		xp: { type: Sequelize.INTEGER, defaultValue: 0 },
		location_id: Sequelize.STRING,
		depth: { type: Sequelize.INTEGER, defaultValue: 0 },
	}, { timestamps: false });
};

const characterPerk = (sequelize) => {
	return sequelize.define('character_perk', {
		character_id: Sequelize.STRING,
		perk_id: Sequelize.INTEGER,
		stamina_spent: { type: Sequelize.INTEGER, defaultValue: 0 },
		status: { type: Sequelize.ENUM('learning', 'available', 'equipped'), defaultValue: 'learning' },
	}, { timestamps: false });
};

const characterCombatStat = (sequelize) => {
	return sequelize.define('character_combat_stat', {
		character_id: { type: Sequelize.STRING, primaryKey: true },
		defense: { type: Sequelize.INTEGER, defaultValue: 0 },
		defense_percent: { type: Sequelize.INTEGER, defaultValue: 0 },
		crit_resistance: { type: Sequelize.INTEGER, defaultValue: 0 },
		evade: { type: Sequelize.INTEGER, defaultValue: 0 },
		speed: { type: Sequelize.FLOAT, defaultValue: 0 },
		currentWeight: Sequelize.INTEGER,
		maxWeight: Sequelize.INTEGER,
	}, { timestamps: false });
};

const characterAttackStat = (sequelize) => {
	return sequelize.define('character_attack_stat', {
		character_id: Sequelize.STRING,
		item_id: Sequelize.INTEGER,
		attack: { type: Sequelize.INTEGER, defaultValue: 0 },
		accuracy: { type: Sequelize.FLOAT, defaultValue: 0 },
		critical: { type: Sequelize.INTEGER, defaultValue: 0 },
		critical_damage: { type: Sequelize.INTEGER, defaultValue: 150 },
		cooldown: { type: Sequelize.FLOAT, defaultValue: 0 },
	}, { timestamps: false });
};

const characterEquipment = (sequelize) => {
	return sequelize.define('character_equipment', {
		character_id: { type: Sequelize.STRING, primaryKey: true },
		item_id: { type: Sequelize.INTEGER, allowNull: false },
		slot: Sequelize.STRING,
	}, { timestamps: false });
};

const characterFlag = (sequelize) => {
	return sequelize.define('character_flag', {
		character_id: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		flag: {
			type: Sequelize.STRING,
			primaryKey: true,
		},
		value: Sequelize.INTEGER,
	}, { timestamps: false });
};

const characterItem = (sequelize) => {
	return sequelize.define('character_item', {
		character_id: Sequelize.STRING,
		item_id: Sequelize.INTEGER,
		amount: { type: Sequelize.INTEGER, defaultValue: 1 },
		equipped: { type: Sequelize.BOOLEAN, defaultValue: false },
	}, { timestamps: false });
};

const characterQuest = (sequelize) => {
	return sequelize.define('character_quest', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		character_id: { type: Sequelize.STRING, allowNull: false },
		quest_id: { type: Sequelize.INTEGER, allowNull: false },
		// Quest status: 'not_started', 'in_progress', 'completed', 'failed', 'abandoned'
		status: { type: Sequelize.STRING, defaultValue: 'in_progress' },
		// Current progress (for tracked objectives) - JSON for complex tracking
		// Example: { "kills": 5, "items_collected": 3 } or { "value": 10 }
		progress: { type: Sequelize.JSON, defaultValue: {} },
		// Maximum progress needed (for completion) - JSON for complex requirements
		// Example: { "kills": 10, "items_collected": 5 } or { "value": 100 }
		max_progress: { type: Sequelize.JSON, defaultValue: {} },
		// JSON field for complex quest data
		quest_data: { type: Sequelize.JSON, allowNull: true },
		// JSON field for objective tracking
		objectives: { type: Sequelize.JSON, allowNull: true },
		// Current objective index or stage
		current_stage: { type: Sequelize.INTEGER, defaultValue: 0 },
		// When quest was started
		started_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
		// When quest was completed/failed
		completed_at: { type: Sequelize.DATE, allowNull: true },
		// Last time quest was updated
		updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
		// Notes or custom data
		notes: { type: Sequelize.TEXT, allowNull: true },
	}, {
		timestamps: false,
		indexes: [
			{ fields: ['character_id'] },
			{ fields: ['quest_id'] },
			{ fields: ['status'] },
			{ fields: ['character_id', 'quest_id'], unique: true },
		],
	});
};

const characterSetting = (sequelize) => {
	return sequelize.define('character_setting', {
		character_id: Sequelize.STRING,
		setting: Sequelize.STRING,
		value: Sequelize.STRING,
	}, { timestamps: false });
};

const characterRelation = (sequelize) => {
	return sequelize.define('character_relation', {
		character_id: Sequelize.STRING,
		npc_id: Sequelize.STRING,
		xp: { type: Sequelize.STRING, primaryKey: true, unique: false },
		level: { type: Sequelize.INTEGER, defaultValue: 0 },
		value: Sequelize.STRING,
	}, { timestamps: false });
};

const characterSkill = (sequelize) => {
	return sequelize.define('character_skill', {
		character_id: Sequelize.STRING,
		skill_id: Sequelize.INTEGER,
		lv: { type: Sequelize.INTEGER, defaultValue: 0 },
		xp: { type: Sequelize.INTEGER, defaultValue: 0 },
		type: Sequelize.STRING,
		aptitude: { type: Sequelize.INTEGER, defaultValue: 0 },
	}, { timestamps: false });
};

const characterStatus = (sequelize) => {
	return sequelize.define('character_status', {
		character_id: Sequelize.STRING,
		status: Sequelize.STRING,
		type: Sequelize.STRING,
		value: Sequelize.STRING,
	}, { timestamps: false });
};

const characterThread = (sequelize) => {
	return sequelize.define('character_threads', {
		character_id: Sequelize.INTEGER,
		location_id: Sequelize.INTEGER,
		thread_id: { type: Sequelize.STRING, allowNull: false },
	}, { timestamps: false });
};

module.exports = {
	characterBase,
	characterPerk,
	characterCombatStat,
	characterAttackStat,
	characterEquipment,
	characterFlag,
	characterItem,
	characterQuest,
	characterSetting,
	characterRelation,
	characterSkill,
	characterStatus,
	characterThread,
};
