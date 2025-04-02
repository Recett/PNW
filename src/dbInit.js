const Sequelize = require('sequelize');

const sequelize = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

require('./models/character/characterBase.js')(sequelize);
require('./models/character/characterCombatStat.js')(sequelize);
require('./models/character/characterEquipment.js')(sequelize);
require('./models/character/characterInventory.js')(sequelize);
require('./models/character/characterSkill.js')(sequelize);

require('./models/event/eventBase.js')(sequelize);
require('./models/event/eventFlag.js')(sequelize);
require('./models/event/eventTag.js')(sequelize);
require('./models/event/eventResolution.js')(sequelize);

require('./models/itemLib/armorLib.js')(sequelize);
require('./models/event/itemLib.js')(sequelize);
require('./models/event/weaponLib.js')(sequelize);

require('./models/skillLib/skillLib.js')(sequelize);


const force = process.argv.includes('--force') || process.argv.includes('-f');