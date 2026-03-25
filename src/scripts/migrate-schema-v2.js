'use strict';
/**
 * migrate-schema-v2.js
 *
 * Recreates the SQLite database schema from scratch using the updated Sequelize
 * model definitions, then migrates important data with type conversions:
 *   - INTEGER foreign keys → STRING for all YAML-content ID references
 *     (item_id, perk_id, skill_id, quest_id, enemy_base_id, resource_node_lib_id)
 *   - character_relation: deduplicates rows that shared the broken xp-primaryKey,
 *     keeping the entry with the highest xp per (character_id, npc_id) pair.
 *
 * Run from project root:
 *   node src/scripts/migrate-schema-v2.js
 *
 * Transient/empty tables that are NOT migrated (discarded):
 *   raids, raid_*, trades, trade_items, enemy_instances,
 *   location_instance_enemies, location_instance_resource_nodes
 */

const path = require('path');
const fs   = require('fs');

// ─── Working directory ────────────────────────────────────────────────────────
// Must be src/ so that dbObject.js resolves 'database.sqlite' correctly.
const SRC_DIR = path.resolve(__dirname, '..');
process.chdir(SRC_DIR);

const { Sequelize, QueryTypes } = require('sequelize');

// ─── Paths ────────────────────────────────────────────────────────────────────
const DB_PATH    = path.join(SRC_DIR, 'database.sqlite');
const BACKUP_DIR = path.join(SRC_DIR, 'Backup DB');

function makeTimestamp() {
	const d = new Date();
	const pad = n => String(n).padStart(2, '0');
	return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// ─── Migration table manifest ─────────────────────────────────────────────────
// Each entry: { table, convert?, dedup? }
//   convert(row) → transformed row  (applied to every row before insert)
//   dedup: { key(row)→string, pickBest(a,b)→row }  (applied after convert)
// Tables are listed in FK-safe insertion order.
const TABLES_TO_MIGRATE = [
	{ table: 'global_flags' },
	{ table: 'system_settings' },
	{ table: 'cron_schedules' },
	{ table: 'cron_logs' },
	{ table: 'event_bases' },

	// ── Location ──
	{ table: 'location_bases' },
	{ table: 'location_clusters' },
	{ table: 'location_links' },
	{ table: 'location_contains' },
	{ table: 'location_events' },
	{
		table: 'location_enemy_spawns',
		convert: row => ({ ...row, enemy_base_id: row.enemy_base_id == null ? null : String(row.enemy_base_id) }),
	},
	{
		table: 'location_enemies',
		convert: row => ({ ...row, enemy_base_id: row.enemy_base_id == null ? null : String(row.enemy_base_id) }),
	},
	{
		table: 'location_resource_node_spawns',
		convert: row => ({ ...row, resource_node_lib_id: row.resource_node_lib_id == null ? null : String(row.resource_node_lib_id) }),
	},
	{ table: 'location_instances' },

	// ── Character (parent first) ──
	{ table: 'character_bases' },
	{ table: 'character_flags' },
	{ table: 'character_settings' },
	{ table: 'character_combat_stats' },
	{ table: 'character_statuses' },
	{ table: 'character_threads' },
	{
		table: 'character_items',
		convert: row => ({ ...row, item_id: row.item_id == null ? null : String(row.item_id) }),
	},
	{
		table: 'character_perks',
		convert: row => ({ ...row, perk_id: row.perk_id == null ? null : String(row.perk_id) }),
	},
	{
		table: 'character_skills',
		convert: row => ({ ...row, skill_id: row.skill_id == null ? null : String(row.skill_id) }),
	},
	{
		table: 'character_quests',
		convert: row => ({ ...row, quest_id: row.quest_id == null ? null : String(row.quest_id) }),
	},
	{
		table: 'character_equipments',
		convert: row => ({ ...row, item_id: row.item_id == null ? null : String(row.item_id) }),
	},
	{
		table: 'character_attack_stats',
		convert: row => ({ ...row, item_id: row.item_id == null ? null : String(row.item_id) }),
	},
	{
		table: 'character_relations',
		// Was keyed by xp (broken PK) — dedup to one row per (character_id, npc_id)
		dedup: {
			key:      row => `${row.character_id}||${row.npc_id}`,
			pickBest: (a, b) => ((Number(a.xp) >= Number(b.xp)) ? a : b),
		},
	},

	// ── Town / House ──
	{ table: 'player_houses' },
	{ table: 'town_buildings' },
	{ table: 'town_defenses' },
	{ table: 'town_projects' },
	{ table: 'town_resources' },

	// ── NPC runtime ──
	{ table: 'npc_stocks' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Escape a JavaScript value for embedding in a SQLite raw INSERT. */
function sqlVal(v) {
	if (v === null || v === undefined) return 'NULL';
	if (typeof v === 'boolean')        return v ? '1' : '0';
	if (typeof v === 'number')         return String(v);
	if (typeof v === 'object')         return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
	return `'${String(v).replace(/'/g, "''")}'`;
}

/** Build and run a raw INSERT; returns the number of rows inserted. */
async function bulkInsertRaw(sequelize, table, rows) {
	if (!rows.length) return 0;

	const cols = Object.keys(rows[0]);
	if (!cols.length) return 0;

	const colList = cols.map(c => `"${c}"`).join(', ');
	let inserted = 0;

	for (const row of rows) {
		const vals = cols.map(c => sqlVal(row[c])).join(', ');
		await sequelize.query(
			`INSERT OR REPLACE INTO "${table}" (${colList}) VALUES (${vals})`,
			{ raw: true },
		);
		inserted++;
	}
	return inserted;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
	console.log('');
	console.log('╔══════════════════════════════════════════════╗');
	console.log('║       Database Schema Migration v2           ║');
	console.log('╚══════════════════════════════════════════════╝');
	console.log('');

	// ── 1. Backup ──────────────────────────────────────────────────────────
	console.log('[1/5] Backing up database...');
	if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
	const BACKUP_PATH = path.join(BACKUP_DIR, `database_backup_${makeTimestamp()}.sqlite`);
	fs.copyFileSync(DB_PATH, BACKUP_PATH);
	console.log(`      Backup saved → ${BACKUP_PATH}`);
	console.log('');

	// ── 2. Open OLD database (backup copy) for reading ─────────────────────
	console.log('[2/5] Reading data from backup...');
	const oldDb = new Sequelize({
		dialect: 'sqlite',
		logging:  false,
		storage:  BACKUP_PATH,
	});

	const extractedData = {};
	const countsBefore  = {};

	for (const spec of TABLES_TO_MIGRATE) {
		let rows;
		try {
			rows = await oldDb.query(`SELECT * FROM "${spec.table}"`, { type: QueryTypes.SELECT });
		}
		catch (e) {
			// Table may not exist in very old DB versions — skip gracefully
			console.log(`      [SKIP] ${spec.table} — table not found: ${e.message}`);
			extractedData[spec.table] = [];
			countsBefore[spec.table]  = 0;
			continue;
		}

		countsBefore[spec.table] = rows.length;

		// Apply per-row conversion
		let processed = rows.map(spec.convert || (r => r));

		// Dedup if required
		if (spec.dedup) {
			const map = new Map();
			for (const row of processed) {
				const k = spec.dedup.key(row);
				map.set(k, map.has(k) ? spec.dedup.pickBest(map.get(k), row) : row);
			}
			const deduped = [...map.values()];
			if (deduped.length < processed.length) {
				console.log(`      [DEDUP] ${spec.table}: ${processed.length} → ${deduped.length} rows`);
			}
			processed = deduped;
		}

		extractedData[spec.table] = processed;
		console.log(`      ${spec.table}: ${processed.length} row(s)`);
	}

	await oldDb.close();
	console.log('');

	// ── 3. Re-open dbObject (connects to live database.sqlite) ─────────────
	console.log('[3/5] Loading updated models from dbObject.js...');
	// This import triggers Sequelize model registration with the new field types
	// (the changes made in Phase 1 of the migration plan).
	const dbObject = require('../dbObject.js');
	// Retrieve the underlying sequelize instance via any model
	const sequelize = dbObject.CharacterBase.sequelize;
	console.log('      Models loaded.');
	console.log('');

	// ── 4. Force-sync: drop all tables and recreate from model definitions ──
	console.log('[4/5] Recreating schema (force sync)...');
	console.log('      WARNING: All existing tables will be dropped & rebuilt.');
	await sequelize.query('PRAGMA foreign_keys = OFF;', { raw: true });
	await sequelize.sync({ force: true });
	await sequelize.query('PRAGMA foreign_keys = OFF;', { raw: true }); // keep off during bulk insert
	console.log('      Schema recreation complete.');
	console.log('');

	// ── 5. Insert migrated data ─────────────────────────────────────────────
	console.log('[5/5] Inserting migrated data...');
	const countsAfter = {};

	for (const spec of TABLES_TO_MIGRATE) {
		const rows = extractedData[spec.table] || [];
		if (!rows.length) {
			countsAfter[spec.table] = 0;
			continue;
		}
		try {
			const inserted = await bulkInsertRaw(sequelize, spec.table, rows);
			countsAfter[spec.table] = inserted;
			console.log(`      ${spec.table}: ${inserted} row(s) inserted`);
		}
		catch (err) {
			console.error(`      [ERROR] ${spec.table}: ${err.message}`);
			countsAfter[spec.table] = -1;
		}
	}

	// Re-enable FK checks
	await sequelize.query('PRAGMA foreign_keys = ON;', { raw: true });
	await sequelize.close();
	console.log('');

	// ── Summary ────────────────────────────────────────────────────────────
	console.log('─────────────────────────────────────────────────');
	console.log('Migration summary');
	console.log('─────────────────────────────────────────────────');
	let allGood = true;
	for (const spec of TABLES_TO_MIGRATE) {
		const before  = countsBefore[spec.table] ?? 0;
		const after   = countsAfter[spec.table]  ?? 0;

		// Dedup tables may legitimately have fewer rows after
		const label = (after === -1) ? '  ERROR' :
		              (before === 0 && after === 0) ? '     ok (empty)' :
		              `${String(before).padStart(4)} → ${String(after).padStart(4)}`;
		console.log(`  ${spec.table.padEnd(40)} ${label}`);
		if (after === -1) allGood = false;
	}
	console.log('─────────────────────────────────────────────────');
	if (allGood) {
		console.log('✓ Migration complete. Original database preserved at:');
		console.log(`  ${BACKUP_PATH}`);
	}
	else {
		console.log('✗ One or more tables had errors. Review the output above.');
		console.log(`  Original database preserved at: ${BACKUP_PATH}`);
	}
	console.log('');
}

main().catch(err => {
	console.error('');
	console.error('FATAL ERROR:', err);
	process.exit(1);
});
