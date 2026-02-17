/**
 * LocationEnemy Usage Examples and Utility Functions
 * Demonstrates how to use the locationEnemy table for managing feasible enemies per location
 */

const { LocationEnemy, EnemyBase, LocationBase } = require('@root/dbObject.js');
const { Op } = require('sequelize');

class LocationEnemyManager {
	/**
	 * Get all feasible enemies for a location
	 * @param {string} locationId - Location identifier
	 * @param {Object} filters - Optional filters (level, category, threat level)
	 * @returns {Array} Array of feasible enemies with their settings
	 */
	static async getFeasibleEnemies(locationId, filters = {}) {
		const whereConditions = {
			location_id: locationId,
			is_active: true,
		};

		// Apply level filtering
		if (filters.playerLevel) {
			whereConditions.min_level = { [Op.lte]: filters.playerLevel };
			whereConditions.max_level = { [Op.gte]: filters.playerLevel };
		}

		// Apply category filtering
		if (filters.category) {
			whereConditions.enemy_category = filters.category;
		}

		// Apply threat level filtering
		if (filters.maxThreatLevel) {
			whereConditions.threat_level = { [Op.lte]: filters.maxThreatLevel };
		}

		const feasibleEnemies = await LocationEnemy.findAll({
			where: whereConditions,
			include: [{
				model: EnemyBase,
				as: 'enemy',
				required: true,
			}],
			order: [['encounter_weight', 'DESC']],
		});

		return feasibleEnemies;
	}

	/**
	 * Select a random enemy based on encounter weights
	 * @param {Array} feasibleEnemies - Array of feasible enemies from getFeasibleEnemies
	 * @returns {Object|null} Selected enemy with location settings
	 */
	static selectRandomEnemy(feasibleEnemies) {
		if (!feasibleEnemies || feasibleEnemies.length === 0) return null;

		const totalWeight = feasibleEnemies.reduce((sum, enemyEntry) => 
			sum + (enemyEntry.encounter_weight || 100), 0);
		
		let random = Math.random() * totalWeight;

		for (const enemyEntry of feasibleEnemies) {
			random -= (enemyEntry.encounter_weight || 100);
			if (random <= 0) {
				return enemyEntry;
			}
		}

		// Fallback to first enemy
		return feasibleEnemies[0];
	}

	/**
	 * Add an enemy to a location's feasible enemy list
	 * @param {string} locationId - Location identifier
	 * @param {number} enemyBaseId - Enemy base ID
	 * @param {Object} settings - Enemy settings for this location
	 * @returns {Object} Created LocationEnemy record
	 */
	static async addEnemyToLocation(locationId, enemyBaseId, settings = {}) {
		const defaultSettings = {
			location_id: locationId,
			enemy_base_id: enemyBaseId,
			min_level: 1,
			max_level: 99,
			encounter_weight: 100,
			enemy_category: 'common',
			threat_level: 1,
			group_encounter: false,
			level_scaling: true,
			experience_modifier: 1.0,
			is_active: true,
		};

		const enemySettings = { ...defaultSettings, ...settings };
		return await LocationEnemy.create(enemySettings);
	}

	/**
	 * Update enemy settings for a specific location
	 * @param {string} locationId - Location identifier
	 * @param {number} enemyBaseId - Enemy base ID
	 * @param {Object} updates - Settings to update
	 * @returns {Array} Update result
	 */
	static async updateEnemyInLocation(locationId, enemyBaseId, updates) {
		return await LocationEnemy.update(updates, {
			where: {
				location_id: locationId,
				enemy_base_id: enemyBaseId,
			},
		});
	}

	/**
	 * Remove an enemy from a location's feasible list
	 * @param {string} locationId - Location identifier
	 * @param {number} enemyBaseId - Enemy base ID
	 * @returns {number} Number of rows deleted
	 */
	static async removeEnemyFromLocation(locationId, enemyBaseId) {
		return await LocationEnemy.destroy({
			where: {
				location_id: locationId,
				enemy_base_id: enemyBaseId,
			},
		});
	}

	/**
	 * Get enemies by category for a location
	 * @param {string} locationId - Location identifier
	 * @param {string} category - Enemy category ('common', 'elite', 'boss', 'rare')
	 * @returns {Array} Enemies in the specified category
	 */
	static async getEnemiesByCategory(locationId, category) {
		return await this.getFeasibleEnemies(locationId, { category });
	}

	/**
	 * Get boss enemies for a location
	 * @param {string} locationId - Location identifier
	 * @returns {Array} Boss enemies
	 */
	static async getBossEnemies(locationId) {
		return await this.getEnemiesByCategory(locationId, 'boss');
	}

	/**
	 * Get enemies suitable for group encounters
	 * @param {string} locationId - Location identifier
	 * @param {number} playerLevel - Player level for filtering
	 * @returns {Array} Group encounter enemies
	 */
	static async getGroupEncounterEnemies(locationId, playerLevel) {
		const feasibleEnemies = await LocationEnemy.findAll({
			where: {
				location_id: locationId,
				is_active: true,
				group_encounter: true,
				min_level: { [Op.lte]: playerLevel },
				max_level: { [Op.gte]: playerLevel },
			},
			include: [{
				model: EnemyBase,
				as: 'enemy',
				required: true,
			}],
			order: [['encounter_weight', 'DESC']],
		});

		return feasibleEnemies;
	}

	/**
	 * Create sample enemy assignments for a location
	 * @param {string} locationId - Location identifier
	 * @returns {Array} Created enemy assignments
	 */
	static async createSampleEnemyAssignments(locationId) {
		const sampleAssignments = [
			{
				location_id: locationId,
				enemy_base_id: 1, // Assuming enemy ID 1 exists
				min_level: 1,
				max_level: 5,
				encounter_weight: 200,
				enemy_category: 'common',
				threat_level: 1,
				description: 'Common forest dwelling creature',
				group_encounter: true,
			},
			{
				location_id: locationId,
				enemy_base_id: 2, // Assuming enemy ID 2 exists
				min_level: 3,
				max_level: 8,
				encounter_weight: 100,
				enemy_category: 'elite',
				threat_level: 3,
				description: 'Stronger variant that leads groups',
				experience_modifier: 1.5,
			},
			{
				location_id: locationId,
				enemy_base_id: 3, // Assuming enemy ID 3 exists
				min_level: 5,
				max_level: 10,
				encounter_weight: 25,
				enemy_category: 'boss',
				threat_level: 5,
				description: 'Rare boss encounter',
				experience_modifier: 3.0,
				loot_table_modifiers: JSON.stringify({
					rare_drop_chance: 0.5,
					bonus_gold_multiplier: 2.0,
				}),
			},
		];

		const createdAssignments = [];
		for (const assignment of sampleAssignments) {
			try {
				const created = await LocationEnemy.create(assignment);
				createdAssignments.push(created);
			} catch (error) {
				console.error(`Failed to create assignment for enemy ${assignment.enemy_base_id}:`, error.message);
			}
		}

		return createdAssignments;
	}
}

module.exports = LocationEnemyManager;

/* Usage Examples:

// Get all feasible enemies for a location
const enemies = await LocationEnemyManager.getFeasibleEnemies('forest_entrance', {
	playerLevel: 5,
	maxThreatLevel: 3
});

// Select a random enemy
const selectedEnemy = LocationEnemyManager.selectRandomEnemy(enemies);

// Add a new enemy to a location
await LocationEnemyManager.addEnemyToLocation('dark_cave', 4, {
	min_level: 8,
	max_level: 15,
	enemy_category: 'elite',
	threat_level: 4,
	encounter_weight: 75,
	description: 'Cave dwelling predator'
});

// Get boss enemies only
const bosses = await LocationEnemyManager.getBossEnemies('dragon_lair');

// Get enemies suitable for group encounters
const groupEnemies = await LocationEnemyManager.getGroupEncounterEnemies('goblin_camp', 6);

*/