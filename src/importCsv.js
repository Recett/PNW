// importCsv.js
// Usage:
//   node importCsv.js <csvFilePath|folderPath>
// If a folder is provided, all CSV files in the folder will be imported using their filenames as table names.
// If a CSV file is provided, it will be imported using its filename as the table name.

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Sequelize = require('sequelize');

const sequelize = new Sequelize('database', 'username', 'password', {
	host: 'localhost',
	dialect: 'sqlite',
	logging: false,
	storage: 'database.sqlite',
});

// Dynamically require the model based on tableName
function getModel(tableName) {
	const modelPaths = [
		'./models/character/',
		'./models/global/',
		'./models/event/',
		'./models/item/',
		'./models/skill/',
		'./models/npc/',
		'./models/location/'
	];
	for (const dir of modelPaths) {
		try {
			const model = require(path.join(__dirname, dir, tableName + '.js'))(sequelize);
			return model;
		} catch (e) {
			// continue
		}
	}
	throw new Error(`Model for table '${tableName}' not found.`);
}

async function importCsv(tableName, csvFilePath) {
	const Model = getModel(tableName);
	await sequelize.sync();
	const records = [];
	return new Promise((resolve, reject) => {
		fs.createReadStream(csvFilePath)
			.pipe(csv())
			.on('data', (row) => records.push(row))
			.on('end', async () => {
				try {
					await Model.bulkCreate(records, { ignoreDuplicates: true });
					console.log(`Imported ${records.length} records into ${tableName}`);
					resolve();
				} catch (err) {
					reject(err);
				} finally {
					await sequelize.close();
				}
			})
			.on('error', reject);
	});
}

if (require.main === module) {
	const [,, arg1] = process.argv;
	if (!arg1) {
		console.error('Usage: node importCsv.js <csvFilePath|folderPath>');
		process.exit(1);
	}
	const isDirectory = fs.existsSync(arg1) && fs.lstatSync(arg1).isDirectory();
	if (isDirectory) {
		const files = fs.readdirSync(arg1).filter(f => f.endsWith('.csv'));
		(async () => {
			for (const file of files) {
				const csvFilePath = path.join(arg1, file);
				const tableName = path.basename(file, path.extname(file));
				try {
					await importCsv(tableName, csvFilePath);
				} catch (err) {
					console.error(`Error importing ${file}:`, err);
				}
			}
		})();
	} else {
		const csvFilePath = arg1;
		const tableName = path.basename(arg1, path.extname(arg1));
		importCsv(tableName, csvFilePath)
			.catch(err => {
				console.error('Error importing CSV:', err);
				process.exit(1);
			});
	}
}
