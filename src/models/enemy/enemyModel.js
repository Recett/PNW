const Sequelize = require('sequelize');

// All enemy content (enemy_bases, stats, attacks, abilities) migrated to YAML (contentStore.enemies).
// Only enemyInstance remains as a runtime table for spawned enemies in active locations/raids.

const enemyInstance = (sequelize) => {
	return sequelize.define('enemy_instance', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		enemy_id: { type: Sequelize.STRING, allowNull: false },
		location_id: { type: Sequelize.STRING, allowNull: true },
		current_hp: { type: Sequelize.INTEGER, allowNull: false },
		max_hp: { type: Sequelize.INTEGER, allowNull: false },
		status_effects: { type: Sequelize.TEXT, allowNull: true },
		combat_id: { type: Sequelize.STRING, allowNull: true },
		spawn_time: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
		last_action: { type: Sequelize.DATE, allowNull: true },
		is_alive: { type: Sequelize.BOOLEAN, defaultValue: true },
	}, { timestamps: false });
};

module.exports = {
	enemyInstance,
};