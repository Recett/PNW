/**
 * cleanupDeadTables.js
 *
 * Post-YAML-migration cleanup script.
 * 1. Backs up the database
 * 2. Drops all dead content tables (migrated to YAML)
 * 3. Recreates active tables that had FK constraints to dead tables (without those FKs)
 *
 * Usage: node src/scripts/cleanupDeadTables.js [--dry-run]
 *
 * --dry-run: Print what would be done without making changes
 */

const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'database.sqlite');

// Dead content tables — migrated to YAML, no longer read/written at runtime
const DEAD_TABLES = [
	// Enemy content
	'enemy_bases',
	'enemy_base_stats',
	'enemy_attack_libs',
	'enemy_attacks',
	'enemy_ability_libs',
	'enemy_abilities',
	// Item/equipment content
	'item_libs',
	'weapon_libs',
	'armor_libs',
	// Character content
	'perk_libs',
	'skill_libs',
	'quest_libs',
	// World content
	'resource_node_libs',
	'project_libs',
	'house_upgrade_libs',
	'special_libs',
	// NPC content
	'npc_bases',
	'npc_perks',
	'object_bases',
	// Event content
	'event_bases',
	'event_checks',
	'event_messages',
	'event_combats',
	'event_enemies',
	'event_options',
	'event_action_flags',
	'event_action_items',
	'event_action_stats',
	'event_action_moves',
	'event_action_events',
	'event_action_statuses',
	'event_action_shops',
	'event_action_variables',
];

// Active tables that have FK constraints pointing to dead tables.
// These need to be recreated without the FK constraints.
// Format: { table, tempTable, columns (preserving data), fksToRemove[] }
const TABLES_TO_REBUILD = [
	{
		table: 'enemy_instances',
		fksToRemove: ['enemy_bases'],
	},
	{
		table: 'raid_monsters',
		fksToRemove: ['enemy_bases'],
	},
	{
		table: 'raid_monster_libs',
		fksToRemove: ['enemy_bases'],
	},
	{
		table: 'character_perks',
		fksToRemove: ['perk_libs'],
	},
	{
		table: 'character_items',
		fksToRemove: ['item_libs'],
	},
	{
		table: 'character_quests',
		fksToRemove: ['quest_libs'],
	},
	{
		table: 'npc_stocks',
		fksToRemove: ['item_libs', 'npc_bases'],
	},
	{
		table: 'town_projects',
		fksToRemove: ['project_libs'],
	},
	{
		table: 'town_buildings',
		fksToRemove: ['project_libs'],
	},
	{
		table: 'location_instance_resource_nodes',
		fksToRemove: ['resource_node_libs'],
	},
	{
		table: 'location_resource_node_spawns',
		fksToRemove: ['resource_node_libs'],
	},
	{
		table: 'location_enemy_spawns',
		fksToRemove: ['enemy_bases'],
	},
	{
		table: 'location_events',
		fksToRemove: ['event_bases'],
	},
	{
		table: 'location_enemies',
		fksToRemove: ['enemy_bases'],
	},
];

async function main() {
	console.log(`Database: ${DB_PATH}`);
	console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

	if (!fs.existsSync(DB_PATH)) {
		console.error(`Database not found at ${DB_PATH}`);
		process.exit(1);
	}

	// Step 1: Backup
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
	const backupPath = DB_PATH.replace('.sqlite', `.backup-${timestamp}.sqlite`);
	console.log(`[1/3] Backing up database to: ${path.basename(backupPath)}`);
	if (!DRY_RUN) {
		fs.copyFileSync(DB_PATH, backupPath);
		console.log(`  Backup created (${(fs.statSync(backupPath).size / 1024).toFixed(0)} KB)\n`);
	}
	else {
		console.log('  (skipped in dry-run)\n');
	}

	const sequelize = new Sequelize({
		dialect: 'sqlite',
		logging: false,
		storage: DB_PATH,
	});

	try {
		// Step 2: Rebuild active tables to remove FK constraints
		console.log('[2/3] Rebuilding active tables to remove dead FK constraints...');
		await sequelize.query('PRAGMA foreign_keys = OFF;', { raw: true });

		for (const rebuild of TABLES_TO_REBUILD) {
			const { table, fksToRemove } = rebuild;

			// Get current CREATE TABLE statement
			const [rows] = await sequelize.query(
				`SELECT sql FROM sqlite_master WHERE type='table' AND name='${table}'`,
			);
			if (!rows || rows.length === 0) {
				console.log(`  ${table}: not found, skipping`);
				continue;
			}

			const originalSql = rows[0].sql;

			// Remove REFERENCES clauses that point to dead tables
			// Also removes trailing ON DELETE/ON UPDATE clauses
			let newSql = originalSql;
			for (const deadTable of fksToRemove) {
				const pattern = new RegExp(
					`\\s*REFERENCES\\s+[\`"']?${deadTable}[\`"']?\\s*\\(\\s*[\`"']?\\w+[\`"']?\\s*\\)` +
					`(?:\\s+ON\\s+(?:DELETE|UPDATE)\\s+(?:NO\\s+ACTION|CASCADE|SET\\s+NULL|SET\\s+DEFAULT|RESTRICT))*`,
					'gi',
				);
				newSql = newSql.replace(pattern, '');
			}

			if (newSql === originalSql) {
				console.log(`  ${table}: no FK changes needed`);
				continue;
			}

			console.log(`  ${table}: removing FK refs to [${fksToRemove.join(', ')}]`);

			if (!DRY_RUN) {
				const tempTable = `_${table}_rebuild`;
				const tempSql = newSql.replace(
					new RegExp(`CREATE TABLE [\`"']?${table}[\`"']?`),
					`CREATE TABLE \`${tempTable}\``,
				);

				// Get column names
				const colResults = await sequelize.query(`PRAGMA table_info('${table}')`, { type: Sequelize.QueryTypes.SELECT });
				const columns = colResults.map(c => `\`${c.name}\``).join(', ');

				await sequelize.query(tempSql, { raw: true });
				await sequelize.query(`INSERT INTO \`${tempTable}\` (${columns}) SELECT ${columns} FROM \`${table}\``, { raw: true });
				await sequelize.query(`DROP TABLE \`${table}\``, { raw: true });
				await sequelize.query(`ALTER TABLE \`${tempTable}\` RENAME TO \`${table}\``, { raw: true });
			}
		}
		console.log();

		// Step 3: Drop dead tables
		console.log('[3/3] Dropping dead content tables...');
		let dropped = 0;
		for (const table of DEAD_TABLES) {
			// Check if table exists
			const [exists] = await sequelize.query(
				`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`,
			);
			if (!exists || exists.length === 0) {
				continue;
			}

			// Count rows for info
			const [countResult] = await sequelize.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
			const rowCount = countResult[0].cnt;

			console.log(`  DROP ${table} (${rowCount} rows)`);
			if (!DRY_RUN) {
				await sequelize.query(`DROP TABLE \`${table}\``, { raw: true });
			}
			dropped++;
		}

		await sequelize.query('PRAGMA foreign_keys = ON;', { raw: true });

		// Vacuum to reclaim space
		if (!DRY_RUN && dropped > 0) {
			console.log('\n  Running VACUUM to reclaim disk space...');
			await sequelize.query('VACUUM', { raw: true });
		}

		console.log(`\nDone! Dropped ${dropped} dead tables.`);
		if (DRY_RUN) {
			console.log('(This was a dry run — no changes were made.)');
		}
		else {
			const newSize = fs.statSync(DB_PATH).size;
			const backupSize = fs.statSync(backupPath).size;
			const saved = backupSize - newSize;
			console.log(`Database size: ${(backupSize / 1024).toFixed(0)} KB -> ${(newSize / 1024).toFixed(0)} KB (saved ${(saved / 1024).toFixed(0)} KB)`);
			console.log(`Backup at: ${backupPath}`);
		}
	}
	catch (error) {
		console.error('\nError during cleanup:', error.message);
		if (!DRY_RUN) {
			console.error(`\nRestoring from backup: ${backupPath}`);
			fs.copyFileSync(backupPath, DB_PATH);
			console.error('Database restored.');
		}
		process.exit(1);
	}
	finally {
		await sequelize.close();
	}
}

main();
