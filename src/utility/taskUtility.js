const { CharacterBase, CharacterFlag, GlobalFlag } = require('@root/dbObject.js');
const contentStore = require('@root/contentStore.js');
const eventUtility = require('./eventUtility');
const characterUtil = require('./characterUtility');
const { EMOJI } = require('../enums');

/**
 * TASK PROCESSING SYSTEM
 * 
 * Executes scheduled tasks defined in YAML that can check flags and perform actions
 * on characters automatically. Reuses the existing event action system for consistency.
 * 
 * Flow:
 * 1. Load active tasks from contentStore
 * 2. For each task, find eligible characters (based on task checks)
 * 3. Execute task actions on eligible characters
 * 4. Log results and handle errors
 */

class TaskUtility {
	constructor() {
		this.eventUtil = new eventUtility.EventProcessor();
		this.processedCount = 0;
		this.errorCount = 0;
		this.taskResults = new Map(); // taskId -> { processed, succeeded, failed }
	}

	/**
	 * Process all active tasks of a specific schedule type
	 * @param {string} schedule - Schedule type: 'daily', 'weekly', 'hourly'
	 * @param {Object} options - Processing options
	 * @param {boolean} options.dryRun - Log what would happen without executing actions
	 * @param {boolean} options.verbose - Enable verbose logging
	 * @returns {Object} Processing results
	 */
	async processScheduledTasks(schedule, options = {}) {
		const { dryRun = false, verbose = false } = options;
		
		console.log(`[TaskUtility] Processing ${schedule} tasks${dryRun ? ' (DRY RUN)' : ''}...`);
		
		// Reset counters
		this.processedCount = 0;
		this.errorCount = 0;
		this.taskResults.clear();

		// Get active tasks for this schedule
		const tasks = this.getActiveTasksBySchedule(schedule);
		
		if (tasks.length === 0) {
			console.log(`[TaskUtility] No active ${schedule} tasks found`);
			return { tasksProcessed: 0, charactersProcessed: 0, errors: 0 };
		}

		console.log(`[TaskUtility] Found ${tasks.length} active ${schedule} task(s): ${tasks.map(t => t.id).join(', ')}`);

		// Process each task
		for (const task of tasks) {
			try {
				await this.processTask(task, { dryRun, verbose });
			} catch (error) {
				console.error(`[TaskUtility] Error processing task ${task.id}:`, error);
				this.errorCount++;
				
				// Initialize task result if not exists
				if (!this.taskResults.has(task.id)) {
					this.taskResults.set(task.id, { processed: 0, succeeded: 0, failed: 0 });
				}
				this.taskResults.get(task.id).failed++;
			}
		}

		// Summary
		const totalCharacters = Array.from(this.taskResults.values()).reduce((sum, result) => sum + result.processed, 0);
		const totalSucceeded = Array.from(this.taskResults.values()).reduce((sum, result) => sum + result.succeeded, 0);
		const totalFailed = Array.from(this.taskResults.values()).reduce((sum, result) => sum + result.failed, 0);

		console.log(`[TaskUtility] ${schedule} tasks complete: ${tasks.length} tasks, ${totalCharacters} characters processed, ${totalSucceeded} succeeded, ${totalFailed} failed`);
		
		if (verbose || this.errorCount > 0) {
			for (const [taskId, result] of this.taskResults.entries()) {
				console.log(`  ${taskId}: ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed`);
			}
		}

		return {
			tasksProcessed: tasks.length,
			charactersProcessed: totalCharacters,
			succeeded: totalSucceeded,
			failed: totalFailed,
			errors: this.errorCount,
			taskResults: Object.fromEntries(this.taskResults)
		};
	}

	/**
	 * Get active tasks for a specific schedule
	 * @param {string} schedule - Schedule type
	 * @returns {Array} Active tasks
	 */
	getActiveTasksBySchedule(schedule) {
		const allTasks = contentStore.tasks.findAll();
		return allTasks.filter(task => 
			task.active !== false && 
			task.schedule === schedule
		);
	}

	/**
	 * Process a single task against all eligible characters
	 * @param {Object} task - Task definition from YAML
	 * @param {Object} options - Processing options
	 */
	async processTask(task, options = {}) {
		const { dryRun = false, verbose = false } = options;
		
		if (verbose) {
			console.log(`[TaskUtility] Processing task: ${task.id} - ${task.name || 'Unnamed'}`);
		}

		// Initialize task result tracking
		const taskResult = { processed: 0, succeeded: 0, failed: 0 };
		this.taskResults.set(task.id, taskResult);

		// Get eligible characters for this task
		const eligibleCharacters = await this.getEligibleCharacters(task);
		
		if (eligibleCharacters.length === 0) {
			if (verbose) {
				console.log(`[TaskUtility] No eligible characters for task ${task.id}`);
			}
			return;
		}

		if (verbose) {
			console.log(`[TaskUtility] Found ${eligibleCharacters.length} eligible character(s) for task ${task.id}`);
		}

		// Process each eligible character
		for (const character of eligibleCharacters) {
			try {
				taskResult.processed++;
				
				if (dryRun) {
					console.log(`[TaskUtility] [DRY RUN] Would execute task ${task.id} for character ${character.id}`);
					taskResult.succeeded++;
				} else {
					await this.executeTaskForCharacter(task, character);
					taskResult.succeeded++;
					
					if (verbose) {
						console.log(`[TaskUtility] ${EMOJI.SUCCESS} Task ${task.id} completed for character ${character.id}`);
					}
				}
			} catch (error) {
				console.error(`[TaskUtility] ${EMOJI.FAILURE} Error executing task ${task.id} for character ${character.id}:`, error);
				taskResult.failed++;
			}
		}
	}

	/**
	 * Find characters eligible for a task based on task checks
	 * @param {Object} task - Task definition
	 * @returns {Array} Eligible characters
	 */
	async getEligibleCharacters(task) {
		// Get all characters from database
		const allCharacters = await CharacterBase.findAll();
		
		if (!task.check || task.check.length === 0) {
			// If no checks defined, task applies to all characters
			return allCharacters;
		}

		const eligibleCharacters = [];

		// Check each character against task conditions
		for (const character of allCharacters) {
			try {
				const isEligible = await this.checkCharacterEligibility(character, task);
				if (isEligible) {
					eligibleCharacters.push(character);
				}
			} catch (error) {
				console.error(`[TaskUtility] Error checking eligibility for character ${character.id}:`, error);
			}
		}

		return eligibleCharacters;
	}

	/**
	 * Check if a character is eligible for a task
	 * @param {Object} character - Character record
	 * @param {Object} task - Task definition
	 * @returns {boolean} Whether character is eligible
	 */
	async checkCharacterEligibility(character, task) {
		// Create a minimal session for the character (no Discord interaction needed)
		const session = {
			characterId: character.id,
			sessionId: `task_${task.id}_${character.id}_${Date.now()}`,
			flags: {
				local: {},
				character: {},
				global: {}
			},
			pendingCharacterFlags: new Map(),
			pendingGlobalFlags: new Map(),
			variables: {},
			messages: [],
			interaction: null, // No Discord interaction for tasks
			npc: null,
			logSessionId: null,
			eventDepth: 0
		};

		// Check all task conditions
		for (const check of task.check || []) {
			try {
				let checkResult = { success: false };

				// Use the existing eventUtility functions for consistency
				switch (check.type) {
					case 'flag':
						checkResult = await this.eventUtil.checkFlag(check, session);
						break;
					case 'stat':
						checkResult = await this.eventUtil.checkStat(check, session);
						break;
					case 'item':
						checkResult = await this.eventUtil.checkItem(check, session);
						break;
					default:
						console.warn(`[TaskUtility] Unknown check type: ${check.type} in task ${task.id}`);
						continue;
				}

				// If this check is required and failed, character is not eligible
				if (check.is_required !== false && !checkResult.success) {
					return false;
				}

				// If this check succeeded but is marked as should fail, character is not eligible  
				if (check.should_fail && checkResult.success) {
					return false;
				}

			} catch (error) {
				console.error(`[TaskUtility] Error checking condition '${check.name}' for character ${character.id}:`, error);
				// If required check fails with error, character is not eligible
				if (check.is_required !== false) {
					return false;
				}
			}
		}

		// All checks passed
		return true;
	}

	/**
	 * Execute task actions for a specific character
	 * @param {Object} task - Task definition
	 * @param {Object} character - Character record
	 */
	async executeTaskForCharacter(task, character) {
		// Create session for action execution
		const session = {
			characterId: character.id,
			sessionId: `task_${task.id}_${character.id}_${Date.now()}`,
			flags: {
				local: {},
				character: {},
				global: {}
			},
			pendingCharacterFlags: new Map(),
			pendingGlobalFlags: new Map(),
			variables: {},
			messages: [],
			interaction: null, // No Discord interaction for tasks
			npc: null,
			logSessionId: null,
			eventDepth: 0
		};

		// Execute all task actions
		for (const action of task.action || []) {
			try {
				await this.executeTaskAction(action, session, task.id);
			} catch (error) {
				console.error(`[TaskUtility] Error executing action in task ${task.id} for character ${character.id}:`, error);
				throw error; // Re-throw to fail the entire task for this character
			}
		}

		// Flush pending flags to database
		await this.eventUtil.flushPendingFlags(session);
	}

	/**
	 * Execute a single task action
	 * @param {Object} action - Action definition
	 * @param {Object} session - Session object
	 * @param {string} taskId - Task ID for logging
	 */
	async executeTaskAction(action, session, taskId) {
		// Use existing eventUtility functions for consistency
		switch (action.type) {
			case 'flag':
				await this.eventUtil.executeFlagAction(action, session, `task_${taskId}`);
				break;
			case 'item':
				await this.eventUtil.executeItemAction(action, session);
				break;
			case 'stat':
				await this.eventUtil.executeStatAction(action, session);
				break;
			default:
				console.warn(`[TaskUtility] Unknown action type: ${action.type} in task ${taskId}`);
		}
	}

	/**
	 * Get task processing statistics
	 * @returns {Object} Statistics
	 */
	getStats() {
		return {
			totalTasks: contentStore.tasks.size,
			activeTasks: contentStore.tasks.findAll({ where: { active: true } }).length,
			dailyTasks: this.getActiveTasksBySchedule('daily').length,
			weeklyTasks: this.getActiveTasksBySchedule('weekly').length,
			hourlyTasks: this.getActiveTasksBySchedule('hourly').length,
			lastProcessed: {
				count: this.processedCount,
				errors: this.errorCount,
				results: Object.fromEntries(this.taskResults)
			}
		};
	}

	/**
	 * Validate task definitions
	 * @returns {Array} Array of validation errors
	 */
	validateTasks() {
		const errors = [];
		const tasks = contentStore.tasks.findAll();

		for (const task of tasks) {
			// Check required fields
			if (!task.id) {
				errors.push('Task missing id field');
				continue;
			}

			if (!task.schedule) {
				errors.push(`Task ${task.id}: missing schedule field`);
			} else if (!['daily', 'weekly', 'hourly'].includes(task.schedule)) {
				errors.push(`Task ${task.id}: invalid schedule '${task.schedule}', must be daily/weekly/hourly`);
			}

			// Validate checks
			if (task.check) {
				for (const [index, check] of (task.check || []).entries()) {
					if (!check.type) {
						errors.push(`Task ${task.id}: check[${index}] missing type field`);
					}
					if (!check.name) {
						errors.push(`Task ${task.id}: check[${index}] missing name field`);
					}
				}
			}

			// Validate actions
			if (task.action) {
				for (const [index, action] of (task.action || []).entries()) {
					if (!action.type) {
						errors.push(`Task ${task.id}: action[${index}] missing type field`);
					}
				}
			}
		}

		return errors;
	}
}

// Export singleton instance
module.exports = new TaskUtility();