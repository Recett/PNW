const fsp = require('fs').promises;
const path = require('path');

function getDatabasePath() {
	const dbPath = process.env.DATABASE_PATH || 'database.sqlite';
	return path.resolve(dbPath);
}

const BACKUP_DIR = path.join(__dirname, '..', 'Backup DB');

async function backupDatabase() {
	await fsp.mkdir(BACKUP_DIR, { recursive: true });
	const ts = new Date().toISOString().replace(/T/, '_').replace(/:/g, '').replace(/\..+/, '');
	const backupPath = path.join(BACKUP_DIR, `backup_${ts}.sqlite`);
	await fsp.copyFile(getDatabasePath(), backupPath);
	return backupPath;
}

async function restoreBackup(backupPath) {
	await fsp.copyFile(backupPath, getDatabasePath());
}

/**
 * Extract the table name from a failing ALTER TABLE error.
 * Sequelize attaches the SQL string to the error object.
 */
function extractTableFromError(error) {
	const sql = error.sql || (error.parent && error.parent.sql) || '';
	const match = sql.match(/ALTER TABLE `([^`]+)`/i);
	return match ? match[1] : null;
}

/**
 * SQLite cannot ALTER TABLE for certain changes (e.g. adding a PRIMARY KEY column).
 * The standard workaround is: create a new table with the correct schema,
 * copy data across, drop the old table, rename the new one.
 */
async function rebuildTable(sequelize, tableName) {
	const queryInterface = sequelize.getQueryInterface();

	const model = Object.values(sequelize.models).find(m => m.tableName === tableName);
	if (!model) {
		throw new Error(`Cannot auto-fix table "${tableName}": no matching Sequelize model found.`);
	}

	console.log(`  Rebuilding "${tableName}"...`);

	const currentSchema = await queryInterface.describeTable(tableName);
	const currentCols = Object.keys(currentSchema);
	const newCols = Object.keys(model.rawAttributes);
	const colsToCopy = currentCols.filter(c => newCols.includes(c));
	const tempName = `${tableName}_mig_temp`;

	await queryInterface.dropTable(tempName).catch(() => { return null; });
	await queryInterface.createTable(tempName, model.rawAttributes);

	if (colsToCopy.length > 0) {
		const colList = colsToCopy.map(c => `"${c}"`).join(', ');
		await sequelize.query(
			`INSERT INTO "${tempName}" (${colList}) SELECT ${colList} FROM "${tableName}";`,
			{ raw: true },
		);
	}

	await queryInterface.dropTable(tableName);
	await sequelize.query(`ALTER TABLE "${tempName}" RENAME TO "${tableName}";`, { raw: true });

	for (const index of (model.options.indexes || [])) {
		await queryInterface.addIndex(tableName, index).catch(err => {
			console.warn(`  Index warning on "${tableName}": ${err.message}`);
		});
	}

	console.log(`  "${tableName}" rebuilt.`);
}

/**
 * Try sequelize.sync({ alter: true }).
 * When --alter fails because SQLite cannot apply a change directly,
 * auto-detect the problem table, rebuild it, then retry.
 * Repeats until all tables are handled or an unfixable error is hit.
 */
async function attemptSync(sequelize) {
	const rebuilt = new Set();
	const MAX = 20;

	for (let i = 0; i <= MAX; i++) {
		try {
			await sequelize.sync({ alter: true });
			return rebuilt;
		}
		catch (error) {
			const tableName = extractTableFromError(error);

			if (!tableName || rebuilt.has(tableName) || i === MAX) {
				throw error;
			}

			console.log(`  --alter failed on "${tableName}": ${(error.parent || error).message}`);
			rebuilt.add(tableName);
			await rebuildTable(sequelize, tableName);
		}
	}
}

/**
 * Main entry point.
 * 1. Backup
 * 2. Try --alter (with auto-rebuild fallback for SQLite limitations)
 * 3. On any failure: restore backup and rethrow
 */
async function syncWithBackup() {
	console.log('Backing up database...');
	const backupPath = await backupDatabase();
	console.log(`Backup: ${path.basename(backupPath)}`);

	const { sequelize } = require('@root/dbObject.js');
	await sequelize.query('PRAGMA foreign_keys = OFF;', { raw: true });

	try {
		console.log('Running schema sync...');
		const rebuilt = await attemptSync(sequelize);
		const rebuiltList = [...rebuilt];

		if (rebuiltList.length > 0) {
			console.log(`Schema sync complete. Rebuilt: ${rebuiltList.join(', ')}`);
		}
		else {
			console.log('Schema sync complete.');
		}

		return { backupPath, rebuilt: rebuiltList };
	}
	catch (error) {
		console.error('Schema sync failed. Restoring from backup...');
		await restoreBackup(backupPath);
		console.log('Database restored.');
		throw error;
	}
	finally {
		await sequelize.query('PRAGMA foreign_keys = ON;', { raw: true })
			.catch(err => console.error('FK re-enable failed:', err));
	}
}

module.exports = { syncWithBackup, backupDatabase, getDatabasePath };

