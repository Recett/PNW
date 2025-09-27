const Sequelize = require('sequelize');

const sequelize = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

require('./models/character/characterArte.js')(sequelize);
require('./models/character/characterAttackStat.js')(sequelize);
require('./models/character/characterBase.js')(sequelize);
require('./models/character/characterCombatStat.js')(sequelize);
require('./models/character/characterEquipment.js')(sequelize);
require('./models/character/characterFlag.js')(sequelize);
require('./models/character/characterItem.js')(sequelize);
require('./models/character/characterQuest.js')(sequelize);
require('./models/character/characterSkill.js')(sequelize);
require('./models/character/characterRelation.js')(sequelize);
require('./models/character/characterSetting.js')(sequelize);
require('./models/character/characterStatus.js')(sequelize);
require('./models/character/characterThread.js')(sequelize);
require('./models/global/globalFlag.js')(sequelize);
require('./models/global/questLib.js')(sequelize);
require('./models/event/eventBase.js')(sequelize);
require('./models/event/eventCheck.js')(sequelize);
require('./models/event/eventFlag.js')(sequelize);
require('./models/event/eventTag.js')(sequelize);
require('./models/event/eventResolution.js')(sequelize);
require('./models/event/eventResolutionCheck.js')(sequelize);
require('./models/item/armorLib.js')(sequelize);
require('./models/item/itemLib.js')(sequelize);
require('./models/item/weaponLib.js')(sequelize);
require('./models/skill/skillLib.js')(sequelize);
require('./models/skill/artLib.js')(sequelize);
require('./models/monster/MonsterModel.js')(sequelize);
require('./models/npc/npcStock.js')(sequelize);
require('./models/location/locationBase.js')(sequelize);
require('./models/location/locationContain.js')(sequelize);
require('./models/location/locationCluster.js')(sequelize);
require('./models/location/locationLink.js')(sequelize);
require('./models/location/monsterAttackStat.js')(sequelize);
require('./models/location/monsterBaseStat.js')(sequelize);
require('./models/location/monsterAbility.js')(sequelize);
require('./models/location/objectBase.js')(sequelize);
require('./models/utility/cronLog.js')(sequelize);


const force = process.argv.includes('--force') || process.argv.includes('-f');

sequelize.sync({ force, alter:true }).then(async () => {
	console.log('Database synced');

	sequelize.close();
}).catch(console.error);
