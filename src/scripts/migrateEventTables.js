/**
 * Migration Script: Drop and recreate event tables with STRING id
 * 
 * This script drops all event tables (except event_base which already has STRING id)
 * and recreates them with the correct STRING primary key type.
 * 
 * Run with: node src/scripts/migrateEventTables.js
 */

const { Sequelize } = require('sequelize');
const path = require('path');

// Connect to the database
const sequelize = new Sequelize({
	dialect: 'sqlite',
	logging: console.log,
	storage: path.join(__dirname, '..', '..', 'database.sqlite'),
});

// Tables to drop and recreate (in order due to foreign key dependencies)
const tablesToMigrate = [
	'event_messages',
	'event_checks',
	'event_combats',
	'event_enemies',
	'event_options',
	'event_action_flags',
	'event_action_items',
	'event_action_stats',
	'event_action_moves',
	'event_action_events',
	'event_action_statuses',
	'location_events',
];

async function migrateEventTables() {
	try {
		console.log('Starting event table migration...\n');

		// Disable foreign key constraints
		await sequelize.query('PRAGMA foreign_keys = OFF;', { raw: true });
		console.log('Foreign key constraints disabled.');

		// Get list of existing tables
		const [tables] = await sequelize.query(
			"SELECT name FROM sqlite_master WHERE type='table';",
			{ raw: true }
		);
		const existingTables = tables.map(t => t.name);
		console.log('Existing tables:', existingTables.join(', '));

		// Drop each event table if it exists
		for (const tableName of tablesToMigrate) {
			if (existingTables.includes(tableName)) {
				console.log(`\nDropping table: ${tableName}`);
				await sequelize.query(`DROP TABLE IF EXISTS "${tableName}";`, { raw: true });
				console.log(`  ✓ Dropped ${tableName}`);
			} else {
				console.log(`\nTable ${tableName} does not exist, skipping drop.`);
			}
		}

		// Re-enable foreign keys
		await sequelize.query('PRAGMA foreign_keys = ON;', { raw: true });
		console.log('\nForeign key constraints re-enabled.');

		console.log('\n========================================');
		console.log('Migration complete!');
		console.log('========================================');
		console.log('\nNow run the following to recreate tables with correct schema:');
		console.log('  node src/dbObject.js');
		console.log('\nOr with force flag to recreate all tables:');
		console.log('  node src/dbObject.js --force');

	} catch (error) {
		console.error('Migration error:', error);
		// Try to re-enable foreign keys even on error
		await sequelize.query('PRAGMA foreign_keys = ON;', { raw: true }).catch(() => {});
		process.exit(1);
	} finally {
		await sequelize.close();
	}
}

migrateEventTables();
