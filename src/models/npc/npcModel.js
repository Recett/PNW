const Sequelize = require('sequelize');

const npcBase = (sequelize) => {
	return sequelize.define('npc_base', {
		id: { type: Sequelize.STRING, primaryKey: true },
		fullname: { type: Sequelize.STRING, allowNull: true },
		name: { type: Sequelize.STRING, allowNull: true },
		unknown_name: Sequelize.STRING,
		avatar: { type: Sequelize.STRING, allowNull: true },
		npc_type: { type: Sequelize.STRING, allowNull: true },
		start_event: { type: Sequelize.STRING, allowNull: true },
		status: Sequelize.STRING,
	}, { timestamps: false });
};

const npcStock = (sequelize) => {
	return sequelize.define('npc_stock', {
		npc_id: Sequelize.STRING,
		item_id: Sequelize.STRING,
		amount: Sequelize.INTEGER,
	}, { timestamps: false });
};

const npcStatus = (sequelize) => {
	return sequelize.define('npc_status', {
		npc_id: Sequelize.STRING,
		status: Sequelize.STRING,
		value: Sequelize.STRING,
	}, { timestamps: false });
};

const npcBaseStat = (sequelize) => {
	return sequelize.define('npc_base_stat', {
		health: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		defense: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		evade: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		accuracy: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
	}, { timestamps: false });
};

const npcAttackStat = (sequelize) => {
	return sequelize.define('npc_attack_stat', {
		name: { type: Sequelize.STRING, allowNull: false },
		attack: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		accuracy: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		critical: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		cooldown: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
		description: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

const npcAbility = (sequelize) => {
	return sequelize.define('npc_ability', {
		name: { type: Sequelize.STRING, allowNull: true },
		description: { type: Sequelize.STRING, allowNull: true },
		effect: { type: Sequelize.JSON, allowNull: true },
		cooldown: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
	}, { timestamps: false });
};

const npcAttackLink = (sequelize) => {
	return sequelize.define('npc_attack_link', {
		npc_id: { type: Sequelize.STRING, allowNull: false },
		npc_attack_stat_id: { type: Sequelize.INTEGER, allowNull: false },
	}, { timestamps: false });
};

const npcAbilityLink = (sequelize) => {
	return sequelize.define('npc_ability_link', {
		npc_id: { type: Sequelize.STRING, allowNull: false },
		npc_ability_id: { type: Sequelize.INTEGER, allowNull: false },
	}, { timestamps: false });
};

module.exports = {
	npcBase,
	npcStock,
	npcStatus,
	npcBaseStat,
	npcAttackStat,
	npcAbility,
	npcAttackLink,
	npcAbilityLink,
};
