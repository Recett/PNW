const Sequelize = require('sequelize');

const enemyBase = (sequelize) => {
	return sequelize.define('enemy_base', {
		id: { type: Sequelize.INTEGER, primaryKey: true },
		fullname: { type: Sequelize.STRING, allowNull: true },
		name: { type: Sequelize.STRING, allowNull: true },
		unknown_name: Sequelize.STRING,
		avatar: { type: Sequelize.STRING, allowNull: true },
		lv: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 1 },
		enemy_type: { type: Sequelize.STRING, allowNull: true },
		start_event: { type: Sequelize.STRING, allowNull: true },
		status: Sequelize.STRING,
		// Example: { "type": "boss", "difficulty": "hard", "element": "fire" }
		tag: { type: Sequelize.JSON, allowNull: true },
		// Example: { "ability": "regenerate", "rate": 5, "condition": "below_50_hp" }
		special: { type: Sequelize.JSON, allowNull: true },
		// Example: { "gold": 500, "items": [{ "id": 12, "chance": 0.3, "quantity": 1 }], "exp": 150 }
		reward: { type: Sequelize.JSON, allowNull: true },
	}, { timestamps: false });
};

const enemyBaseStat = (sequelize) => {
	return sequelize.define('enemy_base_stat', {
		enemy_id: { type: Sequelize.STRING, primaryKey: true },
		health: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 100 },
		defense: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		defense_percent: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		crit_resistance: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		evade: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		speed: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 12 },
	}, { timestamps: false });
};

const enemyAttackLib = (sequelize) => {
	return sequelize.define('enemy_attack_lib', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		name: { type: Sequelize.STRING, allowNull: false },
		base_damage: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		accuracy: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
		critical_chance: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		cooldown: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 90 },
		description: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

const enemyAttack = (sequelize) => {
	return sequelize.define('enemy_attack', {
		enemy_id: { type: Sequelize.INTEGER, allowNull: false },
		attack_id: { type: Sequelize.INTEGER, allowNull: false },
	}, { timestamps: false });
};

const enemyAbilityLib = (sequelize) => {
	return sequelize.define('enemy_ability_lib', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		name: { type: Sequelize.STRING, allowNull: false },
		description: { type: Sequelize.STRING, allowNull: true },
		effect: { type: Sequelize.STRING, allowNull: false },
		value: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		target: { type: Sequelize.STRING, allowNull: false, defaultValue: 'self' },
		cooldown: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
	}, { timestamps: false });
};

const enemyAbility = (sequelize) => {
	return sequelize.define('enemy_ability', {
		enemy_id: { type: Sequelize.STRING, allowNull: false },
		ability_id: { type: Sequelize.INTEGER, allowNull: false },
	}, { timestamps: false });
};

const enemyInstance = (sequelize) => {
	return sequelize.define('enemy_instance', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		enemy_id: { type: Sequelize.INTEGER, allowNull: false },
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
	enemyBase,
	enemyBaseStat,
	enemyAttackLib,
	enemyAttack,
	enemyAbilityLib,
	enemyAbility,
	enemyInstance,
};