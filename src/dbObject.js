const { Sequelize } = require('sequelize');

// Use environment variable for database path (Railway volume mount) or default to local path
const databasePath = process.env.DATABASE_PATH || 'database.sqlite';

const sequelize = new Sequelize({
	dialect: 'sqlite',
	logging: false,
	storage: databasePath,
});

const characterModels = require('./models/character/characterModel.js');
const CharacterBase = characterModels.characterBase(sequelize);
const CharacterPerk = characterModels.characterPerk(sequelize);
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

// LibModel definitions (needed for relationships)
const LibModel = require('./models/lib/LibModel.js');
const PerkLib = LibModel.perkLib(sequelize);
const SkillLib = LibModel.skillLib(sequelize);
const ItemLib = LibModel.itemLib(sequelize);
const WeaponLib = LibModel.weaponLib(sequelize);
const ArmorLib = LibModel.armorLib(sequelize);
const QuestLib = LibModel.questLib(sequelize);
const ResourceNodeLib = LibModel.resourceNodeLib(sequelize);
const ProjectLib = LibModel.projectLib(sequelize);
const HouseUpgradeLib = LibModel.houseUpgradeLib(sequelize);
const SpecialLib = LibModel.specialLib(sequelize);

// Other model definitions
const CronLog = require('./models/utility/cronLog.js')(sequelize);
const CronSchedule = require('./models/utility/cronSchedule.js')(sequelize);
const GlobalFlag = require('./models/global/globalFlag.js')(sequelize);

const raidModels = require('./models/raid/raidModel.js');
const Raid = raidModels.raid(sequelize);
const RaidStage = raidModels.raidStage(sequelize);
const RaidMonster = raidModels.raidMonster(sequelize);
const RaidMonsterLib = raidModels.raidMonsterLib(sequelize);
const RaidBoss = raidModels.raidBoss(sequelize);
const RaidBossPhase = raidModels.raidBossPhase(sequelize);

// NPC models
const npcModels = require('./models/npc/npcModel.js');
const NpcBase = npcModels.npcBase(sequelize);
const NpcStock = npcModels.npcStock(sequelize);
const NpcPerk = npcModels.npcPerk(sequelize);

// Enemy models
const enemyModels = require('./models/enemy/enemyModel.js');
const EnemyBase = enemyModels.enemyBase(sequelize);
const EnemyBaseStat = enemyModels.enemyBaseStat(sequelize);
const EnemyAttackLib = enemyModels.enemyAttackLib(sequelize);
const EnemyAttack = enemyModels.enemyAttack(sequelize);
const EnemyAbilityLib = enemyModels.enemyAbilityLib(sequelize);
const EnemyAbility = enemyModels.enemyAbility(sequelize);
const EnemyInstance = enemyModels.enemyInstance(sequelize);

// System and other models
const SystemSetting = require('./models/system/systemModel.js')(sequelize);
const ObjectBase = require('./models/npc/objectBase.js')(sequelize);

// Town models
const townModels = require('./models/town/townModel.js');
const TownProject = townModels.townProject(sequelize);
const TownResource = townModels.townResource(sequelize);
const TownBuilding = townModels.townBuilding(sequelize);
const TownDefense = townModels.townDefense(sequelize);

// House models
const houseModels = require('./models/house/houseModel.js');
const PlayerHouse = houseModels.playerHouse(sequelize);

// Trade models
const tradeModels = require('./models/trade/tradeModel.js');
const Trade = tradeModels.trade(sequelize);
const TradeItem = tradeModels.tradeItem(sequelize);

// Location models
const locationModels = require('./models/location/locationModel.js');
const LocationBase = locationModels.locationBase(sequelize);
const LocationCluster = locationModels.locationCluster(sequelize);
const LocationLink = locationModels.locationLink(sequelize);
const LocationContain = locationModels.locationContain(sequelize);
const LocationInstance = locationModels.locationInstance(sequelize);

// Event models


// Character relationships
CharacterBase.hasMany(CharacterItem, { foreignKey: 'character_id', as: 'items' });
CharacterItem.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

// CharacterItem references ItemLib
CharacterItem.belongsTo(ItemLib, { foreignKey: 'item_id', as: 'item' });
ItemLib.hasMany(CharacterItem, { foreignKey: 'item_id', as: 'characterItems' });

CharacterBase.hasMany(CharacterQuest, { foreignKey: 'character_id', as: 'quests' });
CharacterQuest.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });
CharacterQuest.belongsTo(QuestLib, { foreignKey: 'quest_id', as: 'quest' });
QuestLib.hasMany(CharacterQuest, { foreignKey: 'quest_id', as: 'characterQuests' });

CharacterBase.hasMany(CharacterRelation, { foreignKey: 'character_id', as: 'relations' });
CharacterRelation.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterSkill, { foreignKey: 'character_id', as: 'skills' });
CharacterSkill.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterStatus, { foreignKey: 'character_id', as: 'statuses' });
CharacterStatus.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

CharacterBase.hasMany(CharacterPerk, { foreignKey: 'character_id', as: 'perks' });
CharacterPerk.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });
CharacterPerk.belongsTo(PerkLib, { foreignKey: 'perk_id', as: 'perk' });
PerkLib.hasMany(CharacterPerk, { foreignKey: 'perk_id', as: 'characterPerks' });

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

// CronLog relationships
CronLog.hasOne(CronSchedule, { foreignKey: 'cron_log_id', as: 'scheduleConfig' });
CronSchedule.belongsTo(CronLog, { foreignKey: 'cron_log_id', as: 'cronLog' });

// Raid relationships
Raid.hasMany(RaidBoss, { foreignKey: 'raid_id', as: 'bosses' });
RaidBoss.belongsTo(Raid, { foreignKey: 'raid_id', as: 'raid' });

RaidBoss.hasMany(RaidBossPhase, { foreignKey: 'raid_boss_id', as: 'phases' });
RaidBossPhase.belongsTo(RaidBoss, { foreignKey: 'raid_boss_id', as: 'boss' });

// Raid stage relationships (acts and agendas)
Raid.hasMany(RaidStage, { foreignKey: 'raid_id', as: 'stages' });
RaidStage.belongsTo(Raid, { foreignKey: 'raid_id', as: 'raid' });

// Raid monster relationships
Raid.hasMany(RaidMonster, { foreignKey: 'raid_id', as: 'monsters' });
RaidMonster.belongsTo(Raid, { foreignKey: 'raid_id', as: 'raid' });
RaidMonster.belongsTo(EnemyBase, { foreignKey: 'enemy_id', as: 'enemy' });
EnemyBase.hasMany(RaidMonster, { foreignKey: 'enemy_id', as: 'raidMonsters' });
RaidMonster.belongsTo(CharacterBase, { foreignKey: 'fighting_character_id', as: 'fightingCharacter' });

// Raid monster lib relationships (spawn pool config)
Raid.hasMany(RaidMonsterLib, { foreignKey: 'raid_id', as: 'monsterLib' });
RaidMonsterLib.belongsTo(Raid, { foreignKey: 'raid_id', as: 'raid' });
RaidMonsterLib.belongsTo(EnemyBase, { foreignKey: 'enemy_id', as: 'enemy' });
EnemyBase.hasMany(RaidMonsterLib, { foreignKey: 'enemy_id', as: 'raidMonsterLibs' });
RaidMonster.belongsTo(RaidMonsterLib, { foreignKey: 'lib_id', as: 'lib' });
RaidMonsterLib.hasMany(RaidMonster, { foreignKey: 'lib_id', as: 'spawnedMonsters' });

const eventModels = require('./models/event/eventModel.js');
const EventBase = eventModels.eventBase(sequelize);
const EventMessage = eventModels.eventMessage(sequelize);
const EventCheck = eventModels.eventCheck(sequelize);
const EventCombat = eventModels.eventCombat(sequelize);
const EventEnemy = eventModels.eventEnemy(sequelize);
const EventOption = eventModels.eventOption(sequelize);
// Action tables (separated by type)
const EventActionFlag = eventModels.eventActionFlag(sequelize);
const EventActionItem = eventModels.eventActionItem(sequelize);
const EventActionStat = eventModels.eventActionStat(sequelize);
const EventActionMove = eventModels.eventActionMove(sequelize);
const EventActionEvent = eventModels.eventActionEvent(sequelize);
const EventActionStatus = eventModels.eventActionStatus(sequelize);
const EventActionShop = eventModels.eventActionShop(sequelize);
const EventActionVariable = eventModels.eventActionVariable(sequelize);

// Event relationships - New modular system
EventBase.hasOne(EventMessage, { foreignKey: 'event_id', as: 'message' });
EventMessage.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

EventBase.hasMany(EventCheck, { foreignKey: 'event_id', as: 'checks' });
EventCheck.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

EventBase.hasOne(EventCombat, { foreignKey: 'event_id', as: 'combat' });
EventCombat.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

EventBase.hasMany(EventEnemy, { foreignKey: 'event_id', as: 'enemies' });
EventEnemy.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

EventBase.hasMany(EventOption, { foreignKey: 'event_id', as: 'options' });
EventOption.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

// Action table relationships
EventBase.hasMany(EventActionFlag, { foreignKey: 'event_id', as: 'flagActions' });
EventActionFlag.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

EventBase.hasMany(EventActionItem, { foreignKey: 'event_id', as: 'itemActions' });
EventActionItem.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });
EventActionItem.belongsTo(ItemLib, { foreignKey: 'item_id', as: 'item' });

EventBase.hasMany(EventActionStat, { foreignKey: 'event_id', as: 'statActions' });
EventActionStat.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

EventBase.hasMany(EventActionMove, { foreignKey: 'event_id', as: 'moveActions' });
EventActionMove.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });
EventActionMove.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });

EventBase.hasMany(EventActionEvent, { foreignKey: 'event_id', as: 'eventActions' });
EventActionEvent.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });
EventActionEvent.belongsTo(EventBase, { foreignKey: 'next_event_id', as: 'nextEvent' });

EventBase.hasMany(EventActionStatus, { foreignKey: 'event_id', as: 'statusActions' });
EventActionStatus.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

EventBase.hasMany(EventActionShop, { foreignKey: 'event_id', as: 'shopActions' });
EventActionShop.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });
EventActionShop.belongsTo(NpcBase, { foreignKey: 'npc_id', as: 'npc' });
NpcBase.hasMany(EventActionShop, { foreignKey: 'npc_id', as: 'shopEvents' });

EventBase.hasMany(EventActionVariable, { foreignKey: 'event_id', as: 'variableActions' });
EventActionVariable.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });

// Event chaining relationships (self-referencing)
EventBase.belongsTo(EventBase, { foreignKey: 'next_event_id', as: 'nextEvent' });
EventOption.belongsTo(EventBase, { foreignKey: 'next_event_id', as: 'nextEvent' });
EventCombat.belongsTo(EventBase, { foreignKey: 'victory_event_id', as: 'victoryEvent' });
EventCombat.belongsTo(EventBase, { foreignKey: 'defeat_event_id', as: 'defeatEvent' });
EventCombat.belongsTo(EventBase, { foreignKey: 'draw_event_id', as: 'drawEvent' });

// EventCombat to EnemyBase relationship
EventCombat.belongsTo(EnemyBase, { foreignKey: 'enemy_base_id', as: 'enemy' });
EnemyBase.hasMany(EventCombat, { foreignKey: 'enemy_base_id', as: 'eventCombats' });

// Lib relationships
// ArmorLib and WeaponLib belong to ItemLib
ArmorLib.belongsTo(ItemLib, { foreignKey: 'item_id', as: 'item' });
WeaponLib.belongsTo(ItemLib, { foreignKey: 'item_id', as: 'item' });
// ItemLib has one ArmorLib and one WeaponLib (reverse relationships)
ItemLib.hasOne(ArmorLib, { foreignKey: 'item_id', as: 'armor' });
ItemLib.hasOne(WeaponLib, { foreignKey: 'item_id', as: 'weapon' });



// PerkLib references SkillLib (perk requires specific skill and level)
PerkLib.belongsTo(SkillLib, { foreignKey: 'skill_id', as: 'skill' });
SkillLib.hasMany(PerkLib, { foreignKey: 'skill_id', as: 'perks' });

// SkillLib self-referential relationship (parent-child skills)
SkillLib.belongsTo(SkillLib, { foreignKey: 'parent_skill_id', as: 'parentSkill' });
SkillLib.hasMany(SkillLib, { foreignKey: 'parent_skill_id', as: 'childSkills' });

// ResourceNodeLib references ItemLib (what item it drops)
ResourceNodeLib.belongsTo(ItemLib, { foreignKey: 'resource_item_id', as: 'resourceItem' });
ItemLib.hasMany(ResourceNodeLib, { foreignKey: 'resource_item_id', as: 'resourceNodes' });


const LocationInstanceResourceNode = locationModels.locationInstanceResourceNode(sequelize);
const LocationInstanceEnemy = locationModels.locationInstanceEnemy(sequelize);
const LocationResourceNodeSpawn = locationModels.locationResourceNodeSpawn(sequelize);
const LocationEnemySpawn = locationModels.locationEnemySpawn(sequelize);
const LocationEvent = locationModels.locationEvent(sequelize);
const LocationEnemy = locationModels.locationEnemy(sequelize);

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

LocationInstance.hasMany(LocationInstanceEnemy, { foreignKey: 'instance_id', as: 'enemies' });
LocationInstanceEnemy.belongsTo(LocationInstance, { foreignKey: 'instance_id', as: 'instance' });
LocationInstanceEnemy.belongsTo(EnemyInstance, { foreignKey: 'enemy_instance_id', as: 'enemyInstance' });
EnemyInstance.hasOne(LocationInstanceEnemy, { foreignKey: 'enemy_instance_id', as: 'locationPlacement' });

// Location spawn template relationships
LocationBase.hasMany(LocationResourceNodeSpawn, { foreignKey: 'location_id', as: 'resourceNodeSpawns' });
LocationResourceNodeSpawn.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });
LocationResourceNodeSpawn.belongsTo(ResourceNodeLib, { foreignKey: 'resource_node_lib_id', as: 'resourceNodeTemplate' });
ResourceNodeLib.hasMany(LocationResourceNodeSpawn, { foreignKey: 'resource_node_lib_id', as: 'locationSpawns' });

LocationBase.hasMany(LocationEnemySpawn, { foreignKey: 'location_id', as: 'enemySpawns' });
LocationEnemySpawn.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });
LocationEnemySpawn.belongsTo(EnemyBase, { foreignKey: 'enemy_base_id', as: 'enemyTemplate' });
EnemyBase.hasMany(LocationEnemySpawn, { foreignKey: 'enemy_base_id', as: 'locationSpawns' });

// Location event relationships
LocationBase.hasMany(LocationEvent, { foreignKey: 'location_id', as: 'events' });
LocationEvent.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });
LocationEvent.belongsTo(EventBase, { foreignKey: 'event_id', as: 'event' });
EventBase.hasMany(LocationEvent, { foreignKey: 'event_id', as: 'locationTriggers' });

// Location enemy relationships
LocationBase.hasMany(LocationEnemy, { foreignKey: 'location_id', as: 'feasibleEnemies' });
LocationEnemy.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });
LocationEnemy.belongsTo(EnemyBase, { foreignKey: 'enemy_base_id', as: 'enemy' });
EnemyBase.hasMany(LocationEnemy, { foreignKey: 'enemy_base_id', as: 'locationAssignments' });

// NPC relationships (keeping minimal NPC functionality)
NpcBase.hasMany(NpcStock, { foreignKey: 'npc_id', as: 'stock' });
NpcStock.belongsTo(NpcBase, { foreignKey: 'npc_id', as: 'npc' });
NpcStock.belongsTo(ItemLib, { foreignKey: 'item_id', as: 'item' });
ItemLib.hasMany(NpcStock, { foreignKey: 'item_id', as: 'npcStock' });

// NPC Perk relationships
NpcBase.hasMany(NpcPerk, { foreignKey: 'npc_id', as: 'teachablePerks' });
NpcPerk.belongsTo(NpcBase, { foreignKey: 'npc_id', as: 'npc' });
NpcPerk.belongsTo(PerkLib, { foreignKey: 'perk_id', as: 'perk' });
PerkLib.hasMany(NpcPerk, { foreignKey: 'perk_id', as: 'npcPerks' });

// Enemy relationships
// One-to-one relationship between EnemyBase and EnemyBaseStat
EnemyBase.hasOne(EnemyBaseStat, { foreignKey: 'enemy_id', as: 'baseStat' });
EnemyBaseStat.belongsTo(EnemyBase, { foreignKey: 'enemy_id', as: 'enemy' });

// Many-to-many relationship between EnemyBase and EnemyAttackLib through EnemyAttack
EnemyBase.belongsToMany(EnemyAttackLib, { through: EnemyAttack, foreignKey: 'enemy_id', otherKey: 'attack_id', as: 'attackLibs' });
EnemyAttackLib.belongsToMany(EnemyBase, { through: EnemyAttack, foreignKey: 'attack_id', otherKey: 'enemy_id', as: 'enemies' });

// Direct access to junction table for additional properties
EnemyBase.hasMany(EnemyAttack, { foreignKey: 'enemy_id', as: 'attacks' });
EnemyAttack.belongsTo(EnemyBase, { foreignKey: 'enemy_id', as: 'enemy' });
EnemyAttackLib.hasMany(EnemyAttack, { foreignKey: 'attack_id', as: 'enemyAttacks' });
EnemyAttack.belongsTo(EnemyAttackLib, { foreignKey: 'attack_id', as: 'attackLib' });

// Many-to-many relationship between EnemyBase and EnemyAbilityLib through EnemyAbility
EnemyBase.belongsToMany(EnemyAbilityLib, { through: EnemyAbility, foreignKey: 'enemy_id', otherKey: 'ability_id', as: 'abilityLibs' });
EnemyAbilityLib.belongsToMany(EnemyBase, { through: EnemyAbility, foreignKey: 'ability_id', otherKey: 'enemy_id', as: 'enemies' });

// Direct access to ability junction table for additional properties
EnemyBase.hasMany(EnemyAbility, { foreignKey: 'enemy_id', as: 'abilities' });
EnemyAbility.belongsTo(EnemyBase, { foreignKey: 'enemy_id', as: 'enemy' });
EnemyAbilityLib.hasMany(EnemyAbility, { foreignKey: 'ability_id', as: 'enemyAbilities' });
EnemyAbility.belongsTo(EnemyAbilityLib, { foreignKey: 'ability_id', as: 'abilityLib' });

// EnemyInstance relationships
EnemyInstance.belongsTo(EnemyBase, { foreignKey: 'enemy_id', as: 'enemy' });
EnemyBase.hasMany(EnemyInstance, { foreignKey: 'enemy_id', as: 'instances' });

// Town relationships
TownProject.belongsTo(ProjectLib, { foreignKey: 'project_id', as: 'project' });
ProjectLib.hasMany(TownProject, { foreignKey: 'project_id', as: 'townProjects' });

TownBuilding.belongsTo(ProjectLib, { foreignKey: 'project_id', as: 'project' });
ProjectLib.hasMany(TownBuilding, { foreignKey: 'project_id', as: 'townBuildings' });

// House relationships
PlayerHouse.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });
CharacterBase.hasOne(PlayerHouse, { foreignKey: 'character_id', as: 'house' });

// Trade relationships
Trade.belongsTo(CharacterBase, { foreignKey: 'initiator_id', as: 'initiator' });
Trade.belongsTo(CharacterBase, { foreignKey: 'recipient_id', as: 'recipient' });
CharacterBase.hasMany(Trade, { foreignKey: 'initiator_id', as: 'initiatedTrades' });
CharacterBase.hasMany(Trade, { foreignKey: 'recipient_id', as: 'receivedTrades' });

Trade.hasMany(TradeItem, { foreignKey: 'trade_id', as: 'items' });
TradeItem.belongsTo(Trade, { foreignKey: 'trade_id', as: 'trade' });
TradeItem.belongsTo(CharacterItem, { foreignKey: 'character_item_id', as: 'characterItem' });
CharacterItem.hasMany(TradeItem, { foreignKey: 'character_item_id', as: 'tradeItems' });

module.exports = {
	PerkLib,
	ArmorLib,
	CharacterPerk,
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
	CronSchedule,
	SystemSetting,
	Raid,
	RaidStage,
	RaidMonster,
	RaidMonsterLib,
	RaidBoss,
	RaidBossPhase,
	// New modular event system
	EventBase,
	EventMessage,
	EventCheck,
	EventCombat,
	EventEnemy,
	EventOption,
	// Action tables
	EventActionFlag,
	EventActionItem,
	EventActionStat,
	EventActionMove,
	EventActionEvent,
	EventActionStatus,
	EventActionShop,
	EventActionVariable,
	GlobalFlag,
	HouseUpgradeLib,
	ItemLib,
	LocationBase,
	LocationCluster,
	LocationContain,
	LocationLink,
	LocationInstance,
	LocationInstanceResourceNode,
	LocationInstanceEnemy,
	LocationResourceNodeSpawn,
	LocationEnemySpawn,
	LocationEvent,
	LocationEnemy,
	EnemyBase,
	EnemyBaseStat,
	EnemyAttackLib,
	EnemyAttack,
	EnemyAbilityLib,
	EnemyAbility,
	EnemyInstance,
	NpcBase,
	NpcPerk,
	NpcStock,
	ObjectBase,
	PlayerHouse,
	ProjectLib,
	QuestLib,
	ResourceNodeLib,
	SkillLib,
	SpecialLib,
	TownBuilding,
	TownDefense,
	TownProject,
	TownResource,
	Trade,
	TradeItem,
	WeaponLib,
};
// For SQLite alter with foreign keys, we need to handle it carefully
async function syncDatabase(options = {}) {
	const force = options.force || process.argv.includes('--force') || process.argv.includes('-f');
	const alter = options.alter || process.argv.includes('--alter') || process.argv.includes('-a');
	
	try {
		// Disable foreign key checks for the entire sync operation
		await sequelize.query('PRAGMA foreign_keys = OFF;', { raw: true });
		
		// Sync the database
		await sequelize.sync({ force, alter });
		
		// Re-enable foreign keys
		await sequelize.query('PRAGMA foreign_keys = ON;', { raw: true });
		
		console.log('Database & tables created/updated!');
	}
	catch (err) {
		console.error('Database sync error:', err);
		// Try to re-enable foreign keys even on error
		await sequelize.query('PRAGMA foreign_keys = ON;', { raw: true }).catch(() => {});
	}
}

// Only run syncDatabase when this file is executed directly (e.g., node dbObject.js)
// Not when it's imported as a module
if (require.main === module) {
	syncDatabase();
} 
