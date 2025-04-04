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

require('./models/item/armorLib.js')(sequelize);
require('./models/item/itemLib.js')(sequelize);
require('./models/item/weaponLib.js')(sequelize);

require('./models/skill/skillLib.js')(sequelize);


const force = process.argv.includes('--force') || process.argv.includes('-f');

sequelize.sync({ force }).then(async () => {
	console.log('Database synced');

	sequelize.close();
}).catch(console.error);