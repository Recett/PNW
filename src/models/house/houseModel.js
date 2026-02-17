const Sequelize = require('sequelize');

/**
 * Player House Model
 *
 * upgrades field structure:
 * [
 *   {
 *     upgrade_id: INTEGER,     // Reference to houseUpgradeLib id
 *     upgrade_level: INTEGER   // Current level of this upgrade (default: 1)
 *   },
 *   ...
 * ]
 *
 * Example usage:
 * // Adding an upgrade
 * const house = await PlayerHouse.findOne({ where: { character_id: 'char123' } });
 * const currentUpgrades = house.upgrades || [];
 * currentUpgrades.push({ upgrade_id: 5, upgrade_level: 1 });
 * await house.update({ upgrades: currentUpgrades, used_upgrade_slots: currentUpgrades.length });
 *
 * // Finding a specific upgrade
 * const kitchenUpgrade = house.upgrades.find(u => u.upgrade_id === 5);
 *
 * // Upgrading an existing upgrade
 * const upgradeIndex = house.upgrades.findIndex(u => u.upgrade_id === 5);
 * if (upgradeIndex !== -1) {
 *   house.upgrades[upgradeIndex].upgrade_level += 1;
 *   await house.update({ upgrades: house.upgrades });
 * }
 */
const playerHouse = (sequelize) => {
	return sequelize.define('player_house', {
		character_id: { type: Sequelize.STRING, allowNull: false, unique: true },
		thread_id: { type: Sequelize.STRING, allowNull: true, unique: true },
		house_level: { type: Sequelize.INTEGER, defaultValue: 1 },
		total_upgrade_slots: { type: Sequelize.INTEGER, defaultValue: 2 },
		used_upgrade_slots: { type: Sequelize.INTEGER, defaultValue: 0 },
		upgrades: { type: Sequelize.JSON, defaultValue: [] },
	}, { timestamps: false });
};

module.exports = {
	playerHouse,
};