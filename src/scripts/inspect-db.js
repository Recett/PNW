/**
 * Database Inspector Script
 * 
 * Usage: node scripts/inspect-db.js [table_name] [--all]
 * 
 * Examples:
 *   node scripts/inspect-db.js                    # List all tables
 *   node scripts/inspect-db.js event_bases        # Show schema for specific table
 *   node scripts/inspect-db.js event --all        # Show all tables containing "event"
 */

const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
	dialect: 'sqlite',
	logging: false,
	storage: path.join(__dirname, '..', 'database.sqlite'),
});

async function getAllTables() {
	const [tables] = await sequelize.query(
		"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;",
		{ raw: true }
	);
	return tables.map(t => t.name).filter(n => n !== 'sqlite_sequence');
}

async function getTableSchema(tableName) {
	const [columns] = await sequelize.query(`PRAGMA table_info('${tableName}');`);
	return columns;
}

async function getTableRowCount(tableName) {
	const [[result]] = await sequelize.query(`SELECT COUNT(*) as count FROM "${tableName}";`);
	return result.count;
}

async function getForeignKeys(tableName) {
	const [fks] = await sequelize.query(`PRAGMA foreign_key_list('${tableName}');`);
	return fks;
}

async function getIndexes(tableName) {
	const [indexes] = await sequelize.query(`PRAGMA index_list('${tableName}');`);
	return indexes;
}

function formatColumn(col) {
	let str = `  ${col.name.padEnd(25)} ${col.type.padEnd(15)}`;
	if (col.pk) str += ' PRIMARY KEY';
	if (col.notnull) str += ' NOT NULL';
	if (col.dflt_value !== null) str += ` DEFAULT ${col.dflt_value}`;
	return str;
}

async function inspectTable(tableName) {
	console.log(`\n${'='.repeat(60)}`);
	console.log(`TABLE: ${tableName}`);
	console.log('='.repeat(60));

	const columns = await getTableSchema(tableName);
	const rowCount = await getTableRowCount(tableName);
	const fks = await getForeignKeys(tableName);
	const indexes = await getIndexes(tableName);

	console.log(`\nRows: ${rowCount}`);
	console.log(`\nColumns (${columns.length}):`);
	columns.forEach(col => console.log(formatColumn(col)));

	if (fks.length > 0) {
		console.log(`\nForeign Keys (${fks.length}):`);
		fks.forEach(fk => {
			console.log(`  ${fk.from} -> ${fk.table}(${fk.to})`);
		});
	}

	if (indexes.length > 0) {
		console.log(`\nIndexes (${indexes.length}):`);
		indexes.forEach(idx => {
			console.log(`  ${idx.name} ${idx.unique ? '(UNIQUE)' : ''}`);
		});
	}
}

async function listTables(filter = null) {
	const tables = await getAllTables();
	const filtered = filter 
		? tables.filter(t => t.toLowerCase().includes(filter.toLowerCase()))
		: tables;

	console.log(`\nTables in database (${filtered.length}${filter ? ` matching "${filter}"` : ''}):\n`);
	filtered.forEach(t => console.log(`  ${t}`));
	return filtered;
}

async function main() {
	const args = process.argv.slice(2);
	const showAll = args.includes('--all') || args.includes('-a');
	const tableArg = args.find(a => !a.startsWith('-'));

	try {
		if (!tableArg) {
			// No argument - list all tables
			await listTables();
		} else if (showAll) {
			// Show all tables matching filter
			const tables = await listTables(tableArg);
			for (const table of tables) {
				await inspectTable(table);
			}
		} else {
			// Check if exact table exists
			const allTables = await getAllTables();
			if (allTables.includes(tableArg)) {
				await inspectTable(tableArg);
			} else {
				// Try to find matching tables
				const matches = allTables.filter(t => 
					t.toLowerCase().includes(tableArg.toLowerCase())
				);
				if (matches.length === 1) {
					await inspectTable(matches[0]);
				} else if (matches.length > 1) {
					console.log(`\nMultiple tables match "${tableArg}":`);
					matches.forEach(t => console.log(`  ${t}`));
					console.log(`\nUse --all flag to inspect all matching tables.`);
				} else {
					console.log(`\nNo table found matching "${tableArg}"`);
					await listTables();
				}
			}
		}
	} catch (error) {
		console.error('Error:', error.message);
	} finally {
		await sequelize.close();
	}
}

main();
