const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage: path.join(__dirname, '..', 'database.sqlite'),
	logging: console.log,
});

async function migrate() {
	try {
		await sequelize.query('PRAGMA foreign_keys = OFF;');

		// Create new table with correct schema
		await sequelize.query(`CREATE TABLE IF NOT EXISTS event_combats_new (
			id VARCHAR(255) PRIMARY KEY,
			event_id VARCHAR(255) NOT NULL UNIQUE,
			combat_type VARCHAR(255) NOT NULL,
			enemy_base_id INTEGER NOT NULL,
			environment_effects TEXT DEFAULT '{}',
			victory_message VARCHAR(255),
			defeat_message VARCHAR(255),
			draw_message VARCHAR(255),
			victory_event_id VARCHAR(255),
			defeat_event_id VARCHAR(255),
			draw_event_id VARCHAR(255),
			special_rules TEXT DEFAULT '{}'
		)`);

		// Copy data - convert enemy_ids to enemy_base_id
		await sequelize.query(`INSERT INTO event_combats_new 
			SELECT id, event_id, combat_type, CAST(enemy_ids AS INTEGER), environment_effects, 
				   victory_message, defeat_message, draw_message, victory_event_id, defeat_event_id, 
				   draw_event_id, special_rules 
			FROM event_combats`);

		// Drop old table
		await sequelize.query('DROP TABLE event_combats');

		// Rename new table
		await sequelize.query('ALTER TABLE event_combats_new RENAME TO event_combats');

		await sequelize.query('PRAGMA foreign_keys = ON;');
		console.log('Migration complete!');
		process.exit(0);
	}
	catch (e) {
		console.error('Migration failed:', e);
		process.exit(1);
	}
}

migrate();
