// exportAllCsv.js
// Usage: node exportAllCsv.js <outputFolder>
// Exports all Sequelize tables to CSV files in the specified folder.

const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const Sequelize = require('sequelize');

const sequelize = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

const modelDefs = [
	'./models/character/characterPerk.js',
	'./models/character/characterAttackStat.js',
	'./models/character/characterBase.js',
	'./models/character/characterCombatStat.js',
	'./models/character/characterEquipment.js',
	'./models/character/characterFlag.js',
	'./models/character/characterItem.js',
	'./models/character/characterQuest.js',
	'./models/character/characterRelation.js',
	'./models/character/characterSetting.js',
	'./models/character/characterSkill.js',
	'./models/character/characterStatus.js',
	'./models/event/eventBase.js',
	'./models/event/eventCheck.js',
	'./models/event/eventFlag.js',
	'./models/event/eventResolution.js',
	'./models/event/eventResolutionCheck.js',
	'./models/event/eventTag.js',
	'./models/global/globalFlag.js',
	'./models/global/questLib.js',
	'./models/item/armorLib.js',
	'./models/item/itemLib.js',
	'./models/item/weaponLib.js',
	'./models/location/locationBase.js',
	'./models/location/locationCluster.js',
	'./models/location/locationContain.js',
	'./models/location/locationLink.js',
	'./models/location/objectBase.js',
	'./models/enemy/enemyModel.js',
	'./models/npc/npcStock.js',
	'./models/skill/skillLib.js',
];

function getModelExportName(modelDefPath) {
	return path.basename(modelDefPath, '.js');
}

async function exportTableToCsv(modelDefPath, outputFolder) {
	const model = require(path.join(__dirname, modelDefPath))(sequelize);
	const tableName = getModelExportName(modelDefPath);
	const records = await model.findAll({ raw: true });
	const headers = Object.keys(model.rawAttributes);
	const parser = new Parser({ fields: headers });
	const csv = parser.parse(records);
	const outPath = path.join(outputFolder, `${tableName}.csv`);
	fs.writeFileSync(outPath, csv, 'utf8');
	console.log(`Exported ${records.length} rows (with header) to ${outPath}`);
}

async function main() {
	const [,, outputFolder] = process.argv;
	if (!outputFolder) {
		console.error('Usage: node exportAllCsv.js <outputFolder>');
		process.exit(1);
	}
	if (!fs.existsSync(outputFolder)) {
		fs.mkdirSync(outputFolder, { recursive: true });
	}
	await sequelize.sync();
	for (const modelDefPath of modelDefs) {
		try {
			await exportTableToCsv(modelDefPath, outputFolder);
		}
		catch (err) {
			console.error(`Error exporting ${modelDefPath}:`, err.message);
		}
	}
	await sequelize.close();
}

if (require.main === module) {
	main();
}
