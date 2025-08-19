const { Sequelize } = require('sequelize');
const sequelize = new Sequelize({
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

const characterModels = require('./models/character/characterModel.js');
const CharacterBase = characterModels.characterBase(sequelize);
const CharacterArte = characterModels.characterArte(sequelize);
const CharacterCombatStat = characterModels.characterCombatStat(sequelize);
const CharacterAttackStat = characterModels.characterAttackStat(sequelize);
const CharacterEquipment = characterModels.characterEquipment(sequelize);
const CharacterFlag = characterModels.characterFlag(sequelize);
const CharacterItem = characterModels.characterItem(sequelize);
const CharacterQuest = characterModels.characterQuest(sequelize);
const CharacterRelation = characterModels.characterRelation(sequelize);
const CharacterSetting = characterModels.characterSetting(sequelize);
const CharacterSkill = characterModels.characterSkill(sequelize);
const CharacterStatus = characterModels.characterStatus(sequelize);
const CharacterThread = characterModels.characterThread(sequelize);

// Character relationships
CharacterBase.hasMany(CharacterItem, { foreignKey: 'character_id', as: 'items' });
CharacterItem.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterQuest, { foreignKey: 'character_id', as: 'quests' });
CharacterQuest.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterRelation, { foreignKey: 'character_id', as: 'relations' });
CharacterRelation.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterSkill, { foreignKey: 'character_id', as: 'skills' });
CharacterSkill.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterStatus, { foreignKey: 'character_id', as: 'statuses' });
CharacterStatus.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterArte, { foreignKey: 'character_id', as: 'artes' });
CharacterArte.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterCombatStat, { foreignKey: 'character_id', as: 'combatStats' });
CharacterCombatStat.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterAttackStat, { foreignKey: 'character_id', as: 'attackStats' });
CharacterAttackStat.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterEquipment, { foreignKey: 'character_id', as: 'equipment' });
CharacterEquipment.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterFlag, { foreignKey: 'character_id', as: 'flags' });
CharacterFlag.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterSetting, { foreignKey: 'character_id', as: 'settings' });
CharacterSetting.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterThread, { foreignKey: 'character_id', as: 'threads' });
CharacterThread.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

const eventModels = require('./models/event/eventModel.js');
const EventBase = eventModels.eventBase(sequelize);
const EventFlag = eventModels.eventFlag(sequelize);
const EventTag = eventModels.eventTag(sequelize);
const EventResolution = eventModels.eventResolution(sequelize);
const EventResolutionCheck = eventModels.eventResolutionCheck(sequelize);
const EventCheck = eventModels.eventCheck(sequelize);

// Event relationships
EventBase.hasMany(EventFlag, { foreignKey: 'event_id', as: 'flags' });
EventFlag.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

EventBase.hasMany(EventTag, { foreignKey: 'event_id', as: 'tags' });
EventTag.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

EventBase.hasMany(EventResolution, { foreignKey: 'event_id', as: 'resolutions' });
EventResolution.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

EventResolution.hasMany(EventResolutionCheck, { foreignKey: 'resolution_id', as: 'checks' });
EventResolutionCheck.belongsTo(EventResolution, { foreignKey: 'resolution_id', as: 'resolution' });

EventBase.hasMany(EventCheck, { foreignKey: 'event_id', as: 'checks' });
EventCheck.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

const LibModel = require('./models/lib/LibModel.js');
const ArtLib = LibModel.artLib(sequelize);
const SkillLib = LibModel.skillLib(sequelize);
const ItemLib = LibModel.itemLib(sequelize);
const WeaponLib = LibModel.weaponLib(sequelize);
const ArmorLib = LibModel.armorLib(sequelize);
const QuestLib = LibModel.questLib(sequelize);

// Lib relationships
// ArmorLib and WeaponLib belong to ItemLib
ArmorLib.belongsTo(ItemLib, { foreignKey: 'item_id', as: 'item' });
WeaponLib.belongsTo(ItemLib, { foreignKey: 'item_id', as: 'item' });

// ArtLib references SkillLib (art uses a skill)
ArtLib.belongsTo(SkillLib, { foreignKey: 'skill_id', as: 'skill' });

const locationModels = require('./models/location/locationModel.js');
const ObjectBase = require('./models/npc/objectBase.js')(sequelize);
const LocationBase = locationModels.locationBase(sequelize);
const LocationCluster = locationModels.locationCluster(sequelize);
const LocationLink = locationModels.locationLink(sequelize);
const LocationContain = locationModels.locationContain(sequelize);

// Location relationships
LocationBase.hasOne(LocationCluster, { foreignKey: 'location_id', as: 'clusters' });
LocationCluster.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });

LocationBase.hasMany(LocationLink, { foreignKey: 'location_id', as: 'links' });
LocationLink.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });

LocationBase.hasMany(LocationContain, { foreignKey: 'location_id', as: 'contains' });
LocationContain.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });
LocationContain.belongsTo(ObjectBase, { foreignKey: 'object_id', as: 'object' });

const npcModels = require('./models/npc/npcModel.js');
const NpcBase = npcModels.npcBase(sequelize);
const NpcStock = npcModels.npcStock(sequelize);
const NpcBaseStat = npcModels.npcBaseStat(sequelize);
const NpcAttackStat = npcModels.npcAttackStat(sequelize);
const NpcAbility = npcModels.npcAbility(sequelize);
const NpcAttackLink = npcModels.npcAttackLink(sequelize);
const NpcAbilityLink = npcModels.npcAbilityLink(sequelize);

const CronLog = require('./models/utility/cronLog.js')(sequelize);
const GlobalFlag = require('./models/global/globalFlag.js')(sequelize);
// NPC relationships
NpcBase.hasMany(NpcStock, { foreignKey: 'npc_id', as: 'stock' });
NpcStock.belongsTo(NpcBase, { foreignKey: 'npc_id', as: 'npc' });

// One-to-one relationship between NPCBase and NpcBaseStat
NpcBase.hasOne(NpcBaseStat, { foreignKey: 'npc_id', as: 'baseStat' });
NpcBaseStat.belongsTo(NpcBase, { foreignKey: 'npc_id', as: 'npc' });

// NPCBase and NpcAttackStat are linked through NpcAttackLink
NpcBase.belongsToMany(NpcAttackStat, { through: NpcAttackLink, foreignKey: 'npc_id', otherKey: 'npc_attack_id', as: 'attackStats' });
NpcAttackStat.belongsToMany(NpcBase, { through: NpcAttackLink, foreignKey: 'npc_attack_id', otherKey: 'npc_id', as: 'npcs' });

// NPCBase and NpcAbility are linked through NPCAbilityLink
NpcBase.belongsToMany(NpcAbility, { through: NpcAbilityLink, foreignKey: 'npc_id', otherKey: 'npc_ability_id', as: 'abilities' });
NpcAbility.belongsToMany(NpcBase, { through: NpcAbilityLink, foreignKey: 'npc_ability_id', otherKey: 'npc_id', as: 'npcs' });

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
	NpcBase,
	NpcStock,
	NpcAbility,
	NpcAttackLink,
	NpcAbilityLink,
	NpcAttackStat,
	ObjectBase,
	QuestLib,
	SkillLib,
	WeaponLib,
};

const force = process.argv.includes('--force') || process.argv.includes('-f');

sequelize.sync({ force }).then(() => {
	console.log('Database & tables created!');
});