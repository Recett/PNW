'use strict';

const Sequelize = require('sequelize');

const pendingEncounterModel = (sequelize) => {
	return sequelize.define('pending_encounter', {
		id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
		target_player_id: { type: Sequelize.STRING, allowNull: false },
		fighter_id: { type: Sequelize.STRING, allowNull: true },
		enemy_id: { type: Sequelize.STRING, allowNull: false },
		location_id: { type: Sequelize.INTEGER, allowNull: false },
		channel_id: { type: Sequelize.STRING, allowNull: false },
		message_id: { type: Sequelize.STRING, allowNull: true },
		expires_at: { type: Sequelize.DATE, allowNull: false },
		status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pending' },
		enemy_current_hp: { type: Sequelize.INTEGER, allowNull: true },
		wave_id: { type: Sequelize.INTEGER, allowNull: true },
		outcome: { type: Sequelize.STRING, allowNull: true },
	}, { timestamps: false });
};

module.exports = pendingEncounterModel;
