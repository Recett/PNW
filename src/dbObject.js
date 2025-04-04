const Sequelize = require('sequelize');

const sequelize = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

const EventBase = require('@/models/event/eventBase.js')(sequelize);
const EventFlag = require('@/models/event/eventFlag.js')(sequelize);
const EventTag = require('@/models/event/eventTag.js')(sequelize);
const EventResolution = require('@/models/event/eventResolution.js')(sequelize);

EventBase.hasMany(EventFlag, { foreignKey: 'event_id', as: 'flag' });
EventBase.hasMany(EventTag, { foreignKey: 'event_id', as: 'tag' });
EventBase.hasMany(EventResolution, { foreignKey: 'event_id', as: 'resolution' });

/*Reflect.defineProperty(Users.prototype, 'addItem', {
	value: async item => {
		const userItem = await UserItems.findOne({
			where: { user_id: this.user_id, item_id: item.id },
		});

		if (userItem) {
			userItem.amount += 1;
			return userItem.save();
		}

		return UserItems.create({ user_id: this.user_id, item_id: item.id, amount: 1 });
	},
});*/

Reflect.defineProperty(EventBase.prototype, 'getFlags', {
	value: () => {
		return EventBase.findAll({
			where: { event_id: this.event_id },
			include: ['flag'],
		});
	},
});

Reflect.defineProperty(EventBase.prototype, 'getTags', {
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
			include: ['tag'],
		});
	},
});

const CharacterBase = require("@models/character/characterBase.js");
const CharacterSkill = require("@models/character/characterSkill.js");
const CharacterInventory = require("@models/character/characterInventory.js");
const CharacterEquipment = require("@models/character/characterEquipment.js");
const SkillLib = require("@models/skill/skillLib.js");
const ItemLib = require("@models/item/itemLib.js");
const WeaponLib = require("@models/item/weaponLib.js");
const ArmorLib = require("@models/item/armorLib.js");

/*CharacterSkill.belongsTo(SkillLib, { foreignKey: 'skill_id', as: 'skill' });
CharacterInventory.belongsTo(ItemLib, { foreignKey: 'item_id', as: 'item' });
CharacterEquipment.belongsTo(ItemLib, { foreignKey: 'head', as: 'head' });
CharacterEquipment.belongsTo(ItemLib, { foreignKey: 'body', as: 'body' });
CharacterEquipment.belongsTo(ItemLib, { foreignKey: 'leg', as: 'leg' });
CharacterEquipment.belongsTo(ItemLib, { foreignKey: 'mainhand', as: 'mainhand' });
CharacterEquipment.belongsTo(ItemLib, { foreignKey: 'offhand', as: 'offhand' });*/

/*Reflect.defineProperty(Users.prototype, 'addItem', {
	value: async item => {
		const userItem = await UserItems.findOne({
			where: { user_id: this.user_id, item_id: item.id },
		});

		if (userItem) {
			userItem.amount += 1;
			return userItem.save();
		}

		return UserItems.create({ user_id: this.user_id, item_id: item.id, amount: 1 });
	},
});*/

/*Reflect.defineProperty(CharacterBase.prototype, 'getSkill', {
	value: () => {
		return CharacterSkill.findAll({
			where: { user_id: this.user_id },
			include: ['skill'],
		});
	},
});

Reflect.defineProperty(CharacterBase.prototype, 'getInventory', {
	value: () => {
		return CharacterInventory.findAll({
			where: { user_id: this.user_id },
			include: ['item'],
		});
	},
});*/

module.exports = { EventBase, 
	EventTag, 
	EventResolution, 
	EventFlag, 
	CharacterBase, 
	CharacterSkill, 
	CharacterInventory, 
	CharacterEquipment, 
	SkillLib, 
	ItemLib,
	ItemLib,
	WeaponLib,
	ArmorLib,
};
