const { Sequelize } = require('sequelize');
const gamecon = require('@root/Data/gamecon.json');
const sequelize = new Sequelize({
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

const CharacterFlag = require('@models/character/characterFlag.js')(sequelize);
const CharacterQuest = require('@models/character/characterQuest.js')(sequelize);
const EventBase = require('@/models/event/eventBase.js')(sequelize);
const EventFlag = require('@/models/event/eventFlag.js')(sequelize);
const EventTag = require('@/models/event/eventTag.js')(sequelize);
const EventResolution = require('@/models/event/eventResolution.js')(sequelize);
const EventResolutionCheck = require('@/models/event/eventResolutionCheck.js')(sequelize);
const CharacterBase = require('@models/character/characterBase.js')(sequelize);
const CharacterSkill = require('@models/character/characterSkill.js')(sequelize);
const CharacterItem = require('@models/character/characterItem.js')(sequelize);
const CharacterEquipment = require('@models/character/characterEquipment.js')(sequelize);
const ArtLib = require('@models/skill/artLib.js')(sequelize);
const SkillLib = require('@models/skill/skillLib.js')(sequelize);
const ItemLib = require('@models/item/itemLib.js')(sequelize);
const WeaponLib = require('@models/item/weaponLib.js')(sequelize);
const ArmorLib = require('@models/item/armorLib.js')(sequelize);
const LocationBase = require('@models/location/locationBase.js')(sequelize);
const LocationCluster = require('@models/location/locationCluster.js')(sequelize);
const LocationLink = require('@models/location/locationLink.js')(sequelize);
const LocationContain = require('@models/location/locationContain.js')(sequelize);
const MonsterAttackStat = require('@models/location/monsterAttackStat.js')(sequelize);
const MonsterBaseStat = require('@models/location/monsterBaseStat.js')(sequelize);
const ObjectBase = require('@models/location/objectBase.js')(sequelize);
const NPCBase = require('@models/npc/npcBase.js')(sequelize);
const CharacterThread = require('@models/character/characterThread.js')(sequelize);
const CronLog = require('@models/utility/cronLog.js')(sequelize);
const CharacterArte = require('@models/character/characterArte.js')(sequelize);
const CharacterAttackStat = require('@models/character/characterAttackStat.js')(sequelize);
const CharacterCombatStat = require('@models/character/characterCombatStat.js')(sequelize);
const CharacterRelation = require('@models/character/characterRelation.js')(sequelize);
const CharacterSetting = require('@models/character/characterSetting.js')(sequelize);
const CharacterStatus = require('@models/character/characterStatus.js')(sequelize);
const GlobalFlag = require('@models/global/globalFlag.js')(sequelize);
const QuestLib = require('@models/global/questLib.js')(sequelize);
const EventCheck = require('@models/event/eventCheck.js')(sequelize);
const NpcStock = require('@models/npc/npcStock.js')(sequelize);
const MonsterAbility = require('@models/location/monsterAbility.js')(sequelize);


// **CharacterItem
CharacterItem.belongsTo(ItemLib, { foreignKey: 'item_id', as: 'item' });

Reflect.defineProperty(CharacterBase.prototype, 'addItem', {
	value: async item => {
		const characterItem = await CharacterInventory.findOne({
			where: { character_id: this.character_id, item_id: item.id },
		});

		if (characterItem) {
			characterItem.amount += 1;
			return characterItem.save();
		}

		return CharacterInventory.create({ character_id: this.character_id, item_id: item.id, amount: 1 });
	},
});

Reflect.defineProperty(CharacterBase.prototype, 'getInventory', {
	value: () => {
		return CharacterInventory.findAll({
			where: { user_id: this.user_id },
			include: ['item'],
		});
	},
});

Reflect.defineProperty(CharacterEquipment.prototype, 'equipItem', {
	value: async item => {
		/*
		const characterItem = await CharacterInventory.findOne({
			where: { character_id: this.character_id, item_id: item.id },
		});
		*/
		const itemLib = await ItemLib.findByPk(item.id);
		let slot = null;
		if (itemLib.type === 'armor') {
			const armorLib = await ArmorLib.findByPk(item.id);
			slot = armorLib.slot;
		}
		else if (itemLib.type === 'weapon') {
			slot = 'hand';
		}

		return CharacterEquipment.upsert({ character_id: this.character_id, item_id: item.id, slot: slot });
	},
});

Reflect.defineProperty(CharacterBase.prototype, 'getItems', {
	value: () => {
		return UserItems.findAll({
			where: { user_id: this.user_id },
			include: ['item'],
		});
	},
});

// **Event
EventBase.hasMany(EventFlag, { foreignKey: 'event_id', as: 'flag' });
EventBase.hasMany(EventTag, { foreignKey: 'event_id', as: 'tag' });
EventBase.hasMany(EventResolution, { foreignKey: 'event_id', as: 'resolution' });

Reflect.defineProperty(EventBase.prototype, 'getEventFlags', {
	value: () => {
		return EventBase.findAll({
			where: { event_id: this.event_id },
			include: ['flag'],
		});
	},
});

Reflect.defineProperty(EventBase.prototype, 'getEventTags', {
	value: () => {
		return EventBase.findAll({
			where: { event_id: this.event_id },
			include: ['tag'],
		});
	},
});

Reflect.defineProperty(EventBase.prototype, 'getResolutions', {
	value: () => {
		return EventBase.findAll({
			where: { event_id: this.event_id },
			include: ['resolution'],
		});
	},
});

// **LocationContain
LocationContain.belongsTo(ObjectBase, { foreignKey: 'object_id', as: 'object' });

Reflect.defineProperty(LocationBase.prototype, 'getObjects', {
	value: () => {
		return LocationContain.findAll({
			where: { location_id: this.location_id },
			include: ['object'],
			type: gamecon.OBJECT,
		});
	},
});

Reflect.defineProperty(LocationBase.prototype, 'getNPC', {
	value: () => {
		return LocationContain.findAll({
			where: { location_id: this.location_id },
			include: ['object'],
			type: gamecon.NPC,
		});
	},
});

Reflect.defineProperty(LocationBase.prototype, 'getEnemies', {
	value: () => {
		return LocationContain.findAll({
			where: { location_id: this.location_id },
			include: ['object'],
			type: gamecon.NPC,
		});
	},
});

module.exports = {
	ArtLib,
	ArmorLib,
	CharacterArte,
	CharacterAttackStat,
	CharacterBase,
	CharacterCombatStat,
	CharacterEquipment,
	CharacterFlag,
	CharacterItem,
	CharacterQuest,
	CharacterRelation,
	CharacterSetting,
	CharacterSkill,
	CharacterStatus,
	CharacterThread,
	CronLog,
	EventBase,
	EventCheck,
	EventFlag,
	EventResolution,
	EventResolutionCheck,
	EventTag,
	GlobalFlag,
	ItemLib,
	LocationBase,
	LocationCluster,
	LocationContain,
	LocationLink,
	MonsterAbility,
	MonsterAttackStat,
	MonsterBaseStat,
	NPCBase,
	NpcStock,
	ObjectBase,
	QuestLib,
	SkillLib,
	WeaponLib,
};
