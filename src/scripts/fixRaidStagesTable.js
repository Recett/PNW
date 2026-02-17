/**
 * Fix raid tables schema
 * Recreates tables with correct unique constraints (composite, not individual)
 */

const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
	dialect: 'sqlite',
	logging: false,
	storage: path.join(__dirname, '..', 'database.sqlite'),
});

async function fixRaidTables() {
	try {
		console.log('Fixing raid tables schema...\n');

		// Fix raid_stages table
		console.log('--- Fixing raid_stages ---');
		await sequelize.query('DROP TABLE IF EXISTS raid_stages');
		console.log('✓ Dropped raid_stages table');

		await sequelize.query(`
			CREATE TABLE raid_stages (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				raid_id INTEGER NOT NULL,
				stage_type VARCHAR(255) NOT NULL,
				stage_number INTEGER NOT NULL,
				name VARCHAR(255),
				description TEXT,
				goal_points INTEGER NOT NULL DEFAULT 100,
				effects JSON,
				is_final TINYINT(1) DEFAULT 0
			)
		`);
		console.log('✓ Created raid_stages table with correct schema');

		await sequelize.query('CREATE INDEX raid_stages_raid_id ON raid_stages(raid_id)');
		await sequelize.query('CREATE INDEX raid_stages_stage_type ON raid_stages(stage_type)');
		await sequelize.query('CREATE INDEX raid_stages_raid_id_stage_type_stage_number ON raid_stages(raid_id, stage_type, stage_number)');
		console.log('✓ Created indexes (non-unique)');

		// Fix raid_monster_libs table
		console.log('\n--- Fixing raid_monster_libs ---');
		await sequelize.query('DROP TABLE IF EXISTS raid_monster_libs');
		console.log('✓ Dropped raid_monster_libs table');

		await sequelize.query(`
			CREATE TABLE raid_monster_libs (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				raid_id INTEGER NOT NULL,
				enemy_id INTEGER NOT NULL,
				spawn_weight INTEGER DEFAULT 1,
				act_score INTEGER DEFAULT 1,
				agenda_score INTEGER DEFAULT 1,
				agenda_cap INTEGER DEFAULT 10,
				agenda_action JSON DEFAULT '{"type":"agenda","value":1}'
			)
		`);
		console.log('✓ Created raid_monster_libs table with correct schema');

		await sequelize.query('CREATE INDEX raid_monster_libs_raid_id ON raid_monster_libs(raid_id)');
		await sequelize.query('CREATE INDEX raid_monster_libs_enemy_id ON raid_monster_libs(enemy_id)');
		await sequelize.query('CREATE INDEX raid_monster_libs_raid_id_enemy_id ON raid_monster_libs(raid_id, enemy_id)');
		console.log('✓ Created indexes (non-unique)');

		console.log('\n✅ Raid tables fixed successfully!');

	} catch (error) {
		console.error('❌ Error:', error.message);
		throw error;
	} finally {
		await sequelize.close();
	}
}

if (require.main === module) {
	fixRaidTables();
}

module.exports = { fixRaidTables };
