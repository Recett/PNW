const Sequelize = require('sequelize');

const monsterBase = (sequelize) => {
	return sequelize.define('monster_base', {
		id: { type: Sequelize.INTEGER, primaryKey: true },
		fullname: { type: Sequelize.STRING, allowNull: true },
		name: { type: Sequelize.STRING, allowNull: true },
		unknown_name: Sequelize.STRING,
		avatar: { type: Sequelize.STRING, allowNull: true },
		monster_type: { type: Sequelize.STRING, allowNull: true },
		start_event: { type: Sequelize.STRING, allowNull: true },
		status: Sequelize.STRING,
	}, { timestamps: false });
};

const monsterBaseStat = (sequelize) => {
	return sequelize.define('monster_base_stat', {
		monster_id: { type: Sequelize.STRING, primaryKey: true },
		health: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 100 },
		defense: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		defense_percent: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		crit_resistance: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		evade: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		speed: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 12 },
	}, { timestamps: false });
};

const monsterAttackLib = (sequelize) => {
	return sequelize.define('monster_attack_lib', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		name: { type: Sequelize.STRING, allowNull: false },
		base_damage: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		accuracy: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		critical_chance: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		cooldown: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 90 },
		description: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

const monsterAttack = (sequelize) => {
	return sequelize.define('monster_attack', {
		monster_id: { type: Sequelize.INTEGER, allowNull: false },
		attack_id: { type: Sequelize.INTEGER, allowNull: false },
	}, { timestamps: false });
};

const monsterAbilityLib = (sequelize) => {
	return sequelize.define('monster_ability_lib', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		name: { type: Sequelize.STRING, allowNull: false },
		description: { type: Sequelize.STRING, allowNull: true },
		effect: { type: Sequelize.STRING, allowNull: false },
		value: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		target: { type: Sequelize.STRING, allowNull: false, defaultValue: 'self' },
		cooldown: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
	}, { timestamps: false });
};

const monsterAbility = (sequelize) => {
	return sequelize.define('monster_ability', {
		monster_id: { type: Sequelize.STRING, allowNull: false },
		ability_id: { type: Sequelize.INTEGER, allowNull: false },
	}, { timestamps: false });
};

const monsterInstance = (sequelize) => {
	return sequelize.define('monster_instance', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		monster_id: { type: Sequelize.INTEGER, allowNull: false },
		location_id: { type: Sequelize.STRING, allowNull: true },
		current_hp: { type: Sequelize.INTEGER, allowNull: false },
		max_hp: { type: Sequelize.INTEGER, allowNull: false },
		status_effects: { type: Sequelize.TEXT, allowNull: true },
		combat_id: { type: Sequelize.STRING, allowNull: true },
		spawn_time: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
		last_action: { type: Sequelize.DATE, allowNull: true },
		is_alive: { type: Sequelize.BOOLEAN, defaultValue: true },
	}, { timestamps: false });
};

module.exports = {
	monsterBase,
	monsterBaseStat,
	monsterAttackLib,
	monsterAttack,
	monsterAbilityLib,
	monsterAbility,
	monsterInstance,
};
