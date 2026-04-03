const { Sequelize } = require('sequelize');
const path = require('path');

// Use environment variable for database path (Railway volume mount) or default to local path.
// Relative DATABASE_PATH values are resolved relative to the project root (one level up from src/).
const rawDatabasePath = process.env.DATABASE_PATH;
const projectRoot = path.join(__dirname, '..');
const databasePath = rawDatabasePath
	? (path.isAbsolute(rawDatabasePath) ? rawDatabasePath : path.join(projectRoot, rawDatabasePath))
	: path.join(__dirname, 'database.sqlite');

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

// Other model definitions
const CronLog = require('./models/utility/cronLog.js')(sequelize);
const CronSchedule = require('./models/utility/cronSchedule.js')(sequelize);
const CronExecutionLog = require('./models/utility/cronExecutionLog.js')(sequelize);
const CronHealthCheck = require('./models/utility/cronHealthCheck.js')(sequelize);
const GlobalFlag = require('./models/global/globalFlag.js')(sequelize);

const raidModels = require('./models/raid/raidModel.js');
const Raid = raidModels.raid(sequelize);
const RaidStage = raidModels.raidStage(sequelize);
const RaidMonster = raidModels.raidMonster(sequelize);
const RaidMonsterLib = raidModels.raidMonsterLib(sequelize);
const RaidBoss = raidModels.raidBoss(sequelize);
const RaidBossPhase = raidModels.raidBossPhase(sequelize);

// NPC models — only npcPurchase (runtime purchase tracking); all content migrated to YAML
const npcModels = require('./models/npc/npcModel.js');
const NpcPurchase = npcModels.npcPurchase(sequelize);

// Enemy models — only enemyInstance (runtime); all content migrated to YAML
const enemyModels = require('./models/enemy/enemyModel.js');
const EnemyInstance = enemyModels.enemyInstance(sequelize);

// System and other models
const SystemSetting = require('./models/system/systemModel.js')(sequelize);

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

CharacterBase.hasMany(CharacterPerk, { foreignKey: 'character_id', as: 'perks' });
CharacterPerk.belongsTo(CharacterBase, { foreignKey: 'character_id', as: 'character' });

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

CronLog.hasMany(CronExecutionLog, { foreignKey: 'job_name', sourceKey: 'job_name', as: 'executionLogs' });
CronExecutionLog.belongsTo(CronLog, { foreignKey: 'job_name', targetKey: 'job_name', as: 'jobConfig' });

CronLog.hasMany(CronHealthCheck, { foreignKey: 'job_name', sourceKey: 'job_name', as: 'healthChecks' });
CronHealthCheck.belongsTo(CronLog, { foreignKey: 'job_name', targetKey: 'job_name', as: 'jobConfig' });

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
RaidMonster.belongsTo(CharacterBase, { foreignKey: 'fighting_character_id', as: 'fightingCharacter' });

// Raid monster lib relationships (spawn pool config)
Raid.hasMany(RaidMonsterLib, { foreignKey: 'raid_id', as: 'monsterLib' });
RaidMonsterLib.belongsTo(Raid, { foreignKey: 'raid_id', as: 'raid' });
RaidMonster.belongsTo(RaidMonsterLib, { foreignKey: 'lib_id', as: 'lib' });
RaidMonsterLib.hasMany(RaidMonster, { foreignKey: 'lib_id', as: 'spawnedMonsters' });


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
LocationInstance.hasMany(LocationInstanceEnemy, { foreignKey: 'instance_id', as: 'enemies' });
LocationInstanceEnemy.belongsTo(LocationInstance, { foreignKey: 'instance_id', as: 'instance' });
LocationInstanceEnemy.belongsTo(EnemyInstance, { foreignKey: 'enemy_instance_id', as: 'enemyInstance' });
EnemyInstance.hasOne(LocationInstanceEnemy, { foreignKey: 'enemy_instance_id', as: 'locationPlacement' });

// Location spawn template relationships
LocationBase.hasMany(LocationResourceNodeSpawn, { foreignKey: 'location_id', as: 'resourceNodeSpawns' });
LocationResourceNodeSpawn.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });

LocationBase.hasMany(LocationEnemySpawn, { foreignKey: 'location_id', as: 'enemySpawns' });
LocationEnemySpawn.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });

// Location event relationships (event_id references YAML event IDs, no ORM association)
LocationBase.hasMany(LocationEvent, { foreignKey: 'location_id', as: 'events' });
LocationEvent.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });

// Location enemy relationships
LocationBase.hasMany(LocationEnemy, { foreignKey: 'location_id', as: 'feasibleEnemies' });
LocationEnemy.belongsTo(LocationBase, { foreignKey: 'location_id', as: 'location' });

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
	// Sequelize instance (needed for smart sync)
	sequelize,
	
	// Active character models
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

	// Active system models
	CronLog,
	CronSchedule,
	CronExecutionLog,
	CronHealthCheck,
	SystemSetting,
	GlobalFlag,

	// Active raid models
	Raid,
	RaidStage,
	RaidMonster,
	RaidMonsterLib,
	RaidBoss,
	RaidBossPhase,

	// Active location models
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

	EnemyInstance,

	// Active NPC model (runtime purchase tracking)
	NpcPurchase,

	// Active town/house/trade models
	PlayerHouse,
	TownBuilding,
	TownDefense,
	TownProject,
	TownResource,
	Trade,
	TradeItem,
};
// Tables with composite PKs that Sequelize's SQLite alter cannot handle safely.
// Sequelize recreates the backup table with a UNIQUE on only the first PK column,
// causing INSERT failures when multiple characters share the same flag/relation/equipment names.
// These tables are synced without alter (ensure-exists only); use migrate-schema-v2.js for changes.
const COMPOSITE_PK_TABLES = new Set(['character_flags', 'character_relations', 'character_equipments']);

// For SQLite alter with foreign keys, we need to handle it carefully
async function syncDatabase(options = {}) {
	const force = options.force || process.argv.includes('--force') || process.argv.includes('-f');
	const alter = options.alter || process.argv.includes('--alter') || process.argv.includes('-a');
	
	try {
		// Disable foreign key checks for the entire sync operation
		await sequelize.query('PRAGMA foreign_keys = OFF;', { raw: true });
		
		if (alter && !force) {
			// Sync each model individually so we can skip composite-PK tables that
			// Sequelize's SQLite alter implementation cannot safely recreate.
			for (const model of Object.values(sequelize.models)) {
				const tableName = model.getTableName();
				if (COMPOSITE_PK_TABLES.has(tableName)) {
					// Ensure the table exists without altering it
					await model.sync();
				}
				else {
					await model.sync({ alter: true });
				}
			}
		}
		else {
			await sequelize.sync({ force, alter });
		}
		
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
