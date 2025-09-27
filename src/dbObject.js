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
const EventOption = eventModels.eventOption(sequelize);
const EventOptionCheck = eventModels.eventOptionCheck(sequelize);
const EventCheck = eventModels.eventCheck(sequelize);
const SpecialEventBase = eventModels.specialEventBase(sequelize);
const SpecialEventFlag = eventModels.specialEventFlag(sequelize);
const SpecialEventTag = eventModels.specialEventTag(sequelize);
const SpecialEventOption = eventModels.specialEventOption(sequelize);
const SpecialEventOptionCheck = eventModels.specialEventOptionCheck(sequelize);
const LocationSpecialEvent = eventModels.locationSpecialEvent(sequelize);
const LocationSpecialEventTrigger = eventModels.locationSpecialEventTrigger(sequelize);

// Event relationships
EventBase.hasMany(EventFlag, { foreignKey: 'event_id', as: 'flags' });
EventFlag.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

EventBase.hasMany(EventTag, { foreignKey: 'event_id', as: 'tags' });
EventTag.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

EventBase.hasMany(EventOption, { foreignKey: 'event_id', as: 'options' });
EventOption.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

EventOption.hasMany(EventOptionCheck, { foreignKey: 'option_id', as: 'checks' });
EventOptionCheck.belongsTo(EventOption, { foreignKey: 'option_id', as: 'option' });

EventBase.hasMany(EventCheck, { foreignKey: 'event_id', as: 'checks' });
EventCheck.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

// Special Event relationships
SpecialEventBase.hasMany(LocationSpecialEvent, { foreignKey: 'special_event_id', as: 'locations' });
LocationSpecialEvent.belongsTo(SpecialEventBase, { foreignKey: 'special_event_id', as: 'specialEvent' });

SpecialEventBase.hasMany(SpecialEventFlag, { foreignKey: 'special_event_id', as: 'flags' });
SpecialEventFlag.belongsTo(SpecialEventBase, { foreignKey: 'special_event_id', as: 'specialEvent' });

SpecialEventBase.hasMany(SpecialEventTag, { foreignKey: 'special_event_id', as: 'tags' });
SpecialEventTag.belongsTo(SpecialEventBase, { foreignKey: 'special_event_id', as: 'specialEvent' });

SpecialEventBase.hasMany(SpecialEventOption, { foreignKey: 'special_event_id', as: 'options' });
SpecialEventOption.belongsTo(SpecialEventBase, { foreignKey: 'special_event_id', as: 'specialEvent' });

SpecialEventOption.hasMany(SpecialEventOptionCheck, { foreignKey: 'option_id', as: 'checks' });
SpecialEventOptionCheck.belongsTo(SpecialEventOption, { foreignKey: 'option_id', as: 'option' });

SpecialEventBase.hasMany(EventCheck, { foreignKey: 'event_id', as: 'checks' });
EventCheck.belongsTo(SpecialEventBase, { foreignKey: 'event_id', as: 'specialEvent' });

const LibModel = require('./models/lib/LibModel.js');
const ArtLib = LibModel.artLib(sequelize);
const SkillLib = LibModel.skillLib(sequelize);
const ItemLib = LibModel.itemLib(sequelize);
const WeaponLib = LibModel.weaponLib(sequelize);
const ArmorLib = LibModel.armorLib(sequelize);
const QuestLib = LibModel.questLib(sequelize);
const ResourceNodeLib = LibModel.resourceNodeLib(sequelize);

// Lib relationships
// ArmorLib and WeaponLib belong to ItemLib
ArmorLib.belongsTo(ItemLib, { foreignKey: 'item_id', as: 'item' });
WeaponLib.belongsTo(ItemLib, { foreignKey: 'item_id', as: 'item' });
// ItemLib has one ArmorLib and one WeaponLib (reverse relationships)
ItemLib.hasOne(ArmorLib, { foreignKey: 'item_id', as: 'armor' });
ItemLib.hasOne(WeaponLib, { foreignKey: 'item_id', as: 'weapon' });

// CharacterItem references ItemLib
CharacterItem.belongsTo(ItemLib, { foreignKey: 'item_id', as: 'item' });
ItemLib.hasMany(CharacterItem, { foreignKey: 'item_id', as: 'characterItems' });

// ArtLib references SkillLib (art requires specific skill and level)
ArtLib.belongsTo(SkillLib, { foreignKey: 'skill_id', as: 'skill' });
SkillLib.hasMany(ArtLib, { foreignKey: 'skill_id', as: 'arts' });

// SkillLib self-referential relationship (parent-child skills)
SkillLib.belongsTo(SkillLib, { foreignKey: 'parent_skill_id', as: 'parentSkill' });
SkillLib.hasMany(SkillLib, { foreignKey: 'parent_skill_id', as: 'childSkills' });

// ResourceNodeLib references ItemLib (what item it drops)
ResourceNodeLib.belongsTo(ItemLib, { foreignKey: 'resource_item_id', as: 'resourceItem' });
ItemLib.hasMany(ResourceNodeLib, { foreignKey: 'resource_item_id', as: 'resourceNodes' });

const locationModels = require('./models/location/locationModel.js');
const ObjectBase = require('./models/npc/objectBase.js')(sequelize);
const LocationBase = locationModels.locationBase(sequelize);
const LocationCluster = locationModels.locationCluster(sequelize);
const LocationLink = locationModels.locationLink(sequelize);
const LocationContain = locationModels.locationContain(sequelize);
const LocationInstance = locationModels.locationInstance(sequelize);
const LocationInstanceResourceNode = locationModels.locationInstanceResourceNode(sequelize);
const LocationInstanceMonster = locationModels.locationInstanceMonster(sequelize);
const LocationResourceNodeSpawn = locationModels.locationResourceNodeSpawn(sequelize);
const LocationMonsterSpawn = locationModels.locationMonsterSpawn(sequelize);

// Location relationships
LocationBase.hasOne(LocationCluster, { foreignKey: 'location_id', as: 'clusters' });
LocationCluster.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });

LocationBase.hasMany(LocationLink, { foreignKey: 'location_id', as: 'links' });
LocationLink.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });

LocationBase.hasMany(LocationContain, { foreignKey: 'location_id', as: 'contains' });
LocationContain.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });

// LocationInstance relationships
LocationInstance.belongsTo(LocationBase, { foreignKey: 'base_location_id', as: 'baseLocation' });
LocationBase.hasMany(LocationInstance, { foreignKey: 'base_location_id', as: 'instances' });
LocationInstance.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });
CharacterBase.hasOne(LocationInstance, { foreignKey: 'character_id', as: 'locationInstance' });

// LocationInstance content relationships
LocationInstance.hasMany(LocationInstanceResourceNode, { foreignKey: 'instance_id', as: 'resourceNodes' });
LocationInstanceResourceNode.belongsTo(LocationInstance, { foreignKey: 'instance_id', as: 'instance' });
LocationInstanceResourceNode.belongsTo(ResourceNodeLib, { foreignKey: 'resource_node_lib_id', as: 'nodeTemplate' });
ResourceNodeLib.hasMany(LocationInstanceResourceNode, { foreignKey: 'resource_node_lib_id', as: 'instanceNodes' });

LocationInstance.hasMany(LocationInstanceMonster, { foreignKey: 'instance_id', as: 'monsters' });
LocationInstanceMonster.belongsTo(LocationInstance, { foreignKey: 'instance_id', as: 'instance' });
LocationInstanceMonster.belongsTo(MonsterInstance, { foreignKey: 'monster_instance_id', as: 'monsterInstance' });
MonsterInstance.hasOne(LocationInstanceMonster, { foreignKey: 'monster_instance_id', as: 'locationPlacement' });

// Location spawn template relationships
LocationBase.hasMany(LocationResourceNodeSpawn, { foreignKey: 'location_id', as: 'resourceNodeSpawns' });
LocationResourceNodeSpawn.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });
LocationResourceNodeSpawn.belongsTo(ResourceNodeLib, { foreignKey: 'resource_node_lib_id', as: 'resourceNodeTemplate' });
ResourceNodeLib.hasMany(LocationResourceNodeSpawn, { foreignKey: 'resource_node_lib_id', as: 'locationSpawns' });

LocationBase.hasMany(LocationMonsterSpawn, { foreignKey: 'location_id', as: 'monsterSpawns' });
LocationMonsterSpawn.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });
LocationMonsterSpawn.belongsTo(MonsterBase, { foreignKey: 'monster_base_id', as: 'monsterTemplate' });
MonsterBase.hasMany(LocationMonsterSpawn, { foreignKey: 'monster_base_id', as: 'locationSpawns' });

// Location special event relationships
LocationBase.hasMany(LocationSpecialEvent, { foreignKey: 'location_id', as: 'specialEvents' });
LocationSpecialEvent.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });
LocationSpecialEvent.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });
EventBase.hasMany(LocationSpecialEvent, { foreignKey: 'event_id', as: 'locationSpecialEvents' });

// Character-specific special event trigger tracking
CharacterBase.hasMany(LocationSpecialEventTrigger, { foreignKey: 'character_id', as: 'specialEventTriggers' });
LocationSpecialEventTrigger.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });
LocationSpecialEvent.hasMany(LocationSpecialEventTrigger, { foreignKey: 'location_special_event_id', as: 'triggers' });
LocationSpecialEventTrigger.belongsTo(LocationSpecialEvent, { foreignKey: 'location_special_event_id', as: 'specialEvent' });

const npcModels = require('./models/npc/npcModel.js');
const NpcBase = npcModels.npcBase(sequelize);
const NpcStock = npcModels.npcStock(sequelize);

// Monster models
const monsterModels = require('./models/monster/MonsterModel.js');
const MonsterBase = monsterModels.monsterBase(sequelize);
const MonsterBaseStat = monsterModels.monsterBaseStat(sequelize);
const MonsterAttackLib = monsterModels.monsterAttackLib(sequelize);
const MonsterAttack = monsterModels.monsterAttack(sequelize);
const MonsterAbilityLib = monsterModels.monsterAbilityLib(sequelize);
const MonsterAbility = monsterModels.monsterAbility(sequelize);
const MonsterInstance = monsterModels.monsterInstance(sequelize);

const CronLog = require('./models/utility/cronLog.js')(sequelize);
const GlobalFlag = require('./models/global/globalFlag.js')(sequelize);

// NPC relationships (keeping minimal NPC functionality)
NpcBase.hasMany(NpcStock, { foreignKey: 'npc_id', as: 'stock' });
NpcStock.belongsTo(NpcBase, { foreignKey: 'npc_id', as: 'npc' });

// Monster relationships
// One-to-one relationship between MonsterBase and MonsterBaseStat
MonsterBase.hasOne(MonsterBaseStat, { foreignKey: 'monster_id', as: 'baseStat' });
MonsterBaseStat.belongsTo(MonsterBase, { foreignKey: 'monster_id', as: 'monster' });

// Many-to-many relationship between MonsterBase and MonsterAttackLib through MonsterAttack
MonsterBase.belongsToMany(MonsterAttackLib, { through: MonsterAttack, foreignKey: 'monster_id', otherKey: 'attack_id', as: 'attackLibs' });
MonsterAttackLib.belongsToMany(MonsterBase, { through: MonsterAttack, foreignKey: 'attack_id', otherKey: 'monster_id', as: 'monsters' });

// Direct access to junction table for additional properties
MonsterBase.hasMany(MonsterAttack, { foreignKey: 'monster_id', as: 'attacks' });
MonsterAttack.belongsTo(MonsterBase, { foreignKey: 'monster_id', as: 'monster' });
MonsterAttackLib.hasMany(MonsterAttack, { foreignKey: 'attack_id', as: 'monsterAttacks' });
MonsterAttack.belongsTo(MonsterAttackLib, { foreignKey: 'attack_id', as: 'attackLib' });

// Many-to-many relationship between MonsterBase and MonsterAbilityLib through MonsterAbility
MonsterBase.belongsToMany(MonsterAbilityLib, { through: MonsterAbility, foreignKey: 'monster_id', otherKey: 'ability_id', as: 'abilityLibs' });
MonsterAbilityLib.belongsToMany(MonsterBase, { through: MonsterAbility, foreignKey: 'ability_id', otherKey: 'monster_id', as: 'monsters' });

// Direct access to ability junction table for additional properties
MonsterBase.hasMany(MonsterAbility, { foreignKey: 'monster_id', as: 'abilities' });
MonsterAbility.belongsTo(MonsterBase, { foreignKey: 'monster_id', as: 'monster' });
MonsterAbilityLib.hasMany(MonsterAbility, { foreignKey: 'ability_id', as: 'monsterAbilities' });
MonsterAbility.belongsTo(MonsterAbilityLib, { foreignKey: 'ability_id', as: 'abilityLib' });

// MonsterInstance relationships
MonsterInstance.belongsTo(MonsterBase, { foreignKey: 'monster_id', as: 'monster' });
MonsterBase.hasMany(MonsterInstance, { foreignKey: 'monster_id', as: 'instances' });

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
	EventOption,
	EventOptionCheck,
	EventTag,
	GlobalFlag,
	ItemLib,
	LocationBase,
	LocationCluster,
	LocationContain,
	LocationLink,
	LocationInstance,
	LocationInstanceResourceNode,
	LocationInstanceMonster,
	LocationResourceNodeSpawn,
	LocationMonsterSpawn,
	LocationSpecialEvent,
	LocationSpecialEventTrigger,
	MonsterBase,
	MonsterBaseStat,
	MonsterAttackLib,
	MonsterAttack,
	MonsterAbilityLib,
	MonsterAbility,
	MonsterInstance,
	NpcBase,
	NpcStock,
	ObjectBase,
	QuestLib,
	ResourceNodeLib,
	SkillLib,
	SpecialEventBase,
	SpecialEventFlag,
	SpecialEventTag,
	SpecialEventOption,
	SpecialEventOptionCheck,
	WeaponLib,
};
/* const force = process.argv.includes('--force') || process.argv.includes('-f');

sequelize.sync({ force }).then(() => {
	console.log('Database & tables created!');
}); */
