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
		currentHp: Sequelize.INTEGER,
		maxHp: Sequelize.INTEGER,
		currentStamina: Sequelize.INTEGER,
		maxStamina: Sequelize.INTEGER,
		free_point: Sequelize.INTEGER,
		xp: Sequelize.INTEGER,
	}, { timestamps: false });
};

const characterArte = (sequelize) => {
	return sequelize.define('character_art', {
		character_id: Sequelize.STRING,
		art_id: Sequelize.INTEGER,
	}, { timestamps: false });
};

const characterCombatStat = (sequelize) => {
	return sequelize.define('character_combat_stat', {
		character_id: { type: Sequelize.STRING, primaryKey: true },
		defense: { type: Sequelize.INTEGER, defaultValue: 0 },
		defense_percent: { type: Sequelize.INTEGER, defaultValue: 0 },
		crit_resistance: { type: Sequelize.INTEGER, defaultValue: 0 },
		evade: { type: Sequelize.INTEGER, defaultValue: 0 },
		speed: { type: Sequelize.INTEGER, defaultValue: 0 },
		currentWeight: Sequelize.INTEGER,
		maxWeight: Sequelize.INTEGER,
	}, { timestamps: false });
};

const characterAttackStat = (sequelize) => {
	return sequelize.define('character_attack_stat', {
		character_id: Sequelize.STRING,
		item_id: Sequelize.INTEGER,
		attack: { type: Sequelize.INTEGER, defaultValue: 0 },
		accuracy: { type: Sequelize.INTEGER, defaultValue: 0 },
		critical: { type: Sequelize.INTEGER, defaultValue: 0 },
		critical_damage: { type: Sequelize.INTEGER, defaultValue: 150 },
		cooldown: { type: Sequelize.INTEGER, defaultValue: 0 },
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
		character_id: Sequelize.STRING,
		flag: Sequelize.STRING,
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
		character_id: Sequelize.STRING,
		quest_id: Sequelize.INTEGER,
		status: { type: Sequelize.STRING, defaultValue: 'in_progress' },
		progress: { type: Sequelize.INTEGER, defaultValue: 0 },
	}, { timestamps: false });
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
	characterArte,
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