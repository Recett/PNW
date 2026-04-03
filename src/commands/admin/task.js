const { SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const taskUtility = require('@utility/taskUtility.js');
const contentStore = require('@root/contentStore.js');
const { EMOJI } = require('../../enums');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('task')
		.setDescription('[Admin] Manage scheduled tasks.')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('View all scheduled tasks')
				.addStringOption(option =>
					option.setName('schedule')
						.setDescription('Filter by schedule type')
						.setRequired(false)
						.addChoices(
							{ name: 'All', value: 'all' },
							{ name: 'Daily', value: 'daily' },
							{ name: 'Weekly', value: 'weekly' },
							{ name: 'Hourly', value: 'hourly' },
						))
				.addBooleanOption(option =>
					option.setName('active_only')
						.setDescription('Show only active tasks')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('info')
				.setDescription('View detailed information about a specific task')
				.addStringOption(option =>
					option.setName('task_id')
						.setDescription('ID of the task')
						.setRequired(true)
						.setAutocomplete(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('run')
				.setDescription('Manually run tasks (for testing)')
				.addStringOption(option =>
					option.setName('schedule')
						.setDescription('Run all tasks of a specific schedule')
						.setRequired(false)
						.addChoices(
							{ name: 'Daily', value: 'daily' },
							{ name: 'Weekly', value: 'weekly' },
							{ name: 'Hourly', value: 'hourly' },
						))
				.addStringOption(option =>
					option.setName('task_id')
						.setDescription('Run a specific task by ID')
						.setRequired(false)
						.setAutocomplete(true))
				.addBooleanOption(option =>
					option.setName('dry_run')
						.setDescription('Simulate execution without making changes')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('validate')
				.setDescription('Validate all task definitions'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('stats')
				.setDescription('Show task processing statistics')),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			switch (subcommand) {
			case 'list': {
				const schedule = interaction.options.getString('schedule') || 'all';
				const activeOnly = interaction.options.getBoolean('active_only') || false;

				let tasks = contentStore.tasks.findAll();

				// Apply filters
				if (schedule !== 'all') {
					tasks = tasks.filter(task => task.schedule === schedule);
				}
				if (activeOnly) {
					tasks = tasks.filter(task => task.active !== false);
				}

				if (tasks.length === 0) {
					return await interaction.editReply({ 
						content: `${EMOJI.FAILURE} No tasks found with the specified filters.` 
					});
				}

				// Format task list
				const taskList = tasks.map(task => {
					const statusEmoji = task.active !== false ? '🟢' : '⚫';
					const scheduleEmoji = {
						daily: '📅',
						weekly: '📆', 
						hourly: '⏰'
					}[task.schedule] || '📋';

					const checksCount = task.checks ? task.checks.length : 0;
					const actionsCount = task.actions ? task.actions.length : 0;

					return `${statusEmoji} ${scheduleEmoji} **${task.id}**\n` +
						`  ${task.name || 'No name'}\n` +
						`  Schedule: ${task.schedule} | Checks: ${checksCount} | Actions: ${actionsCount}`;
				}).join('\n\n');

				const embed = {
					title: `📋 Scheduled Tasks${schedule !== 'all' ? ` (${schedule})` : ''}${activeOnly ? ' - Active Only' : ''}`,
					description: taskList,
					color: 0x5865F2,
					footer: { text: `Total: ${tasks.length} task(s)` },
				};

				return await interaction.editReply({ embeds: [embed] });
			}

			case 'info': {
				const taskId = interaction.options.getString('task_id');
				const task = contentStore.tasks.findByPk(taskId);

				if (!task) {
					return await interaction.editReply({ 
						content: `${EMOJI.FAILURE} Task '${taskId}' not found.` 
					});
				}

				const statusEmoji = task.active !== false ? '🟢' : '⚫';
				const checksCount = task.checks ? task.checks.length : 0;
				const actionsCount = task.actions ? task.actions.length : 0;

				// Format checks and actions
				let checksText = 'None';
				if (task.checks && task.checks.length > 0) {
					checksText = task.checks.map((check, i) => 
						`${i + 1}. **${check.name}** (${check.type})`
					).join('\n');
				}

				let actionsText = 'None';
				if (task.actions && task.actions.length > 0) {
					actionsText = task.actions.map((action, i) => 
						`${i + 1}. **${action.type}** action`
					).join('\n');
				}

				const embed = {
					title: `${statusEmoji} Task: ${task.id}`,
					description: task.description || 'No description',
					fields: [
						{ name: 'Name', value: task.name || 'Unnamed', inline: true },
						{ name: 'Schedule', value: task.schedule, inline: true },
						{ name: 'Active', value: task.active !== false ? 'Yes' : 'No', inline: true },
						{ name: `Checks (${checksCount})`, value: checksText, inline: false },
						{ name: `Actions (${actionsCount})`, value: actionsText, inline: false },
					],
					color: task.active !== false ? 0x57F287 : 0x99AAB5,
				};

				if (task.tags && task.tags.length > 0) {
					embed.fields.push({
						name: 'Tags',
						value: task.tags.join(', '),
						inline: false
					});
				}

				return await interaction.editReply({ embeds: [embed] });
			}

			case 'run': {
				const schedule = interaction.options.getString('schedule');
				const taskId = interaction.options.getString('task_id');
				const dryRun = interaction.options.getBoolean('dry_run') || false;

				if (!schedule && !taskId) {
					return await interaction.editReply({ 
						content: `${EMOJI.FAILURE} You must specify either a schedule or a task ID.` 
					});
				}

				if (schedule && taskId) {
					return await interaction.editReply({ 
						content: `${EMOJI.FAILURE} You cannot specify both schedule and task ID.` 
					});
				}

				let results;
				if (schedule) {
					// Run all tasks of a specific schedule
					await interaction.editReply({ 
						content: `${EMOJI.LOADING} Running ${schedule} tasks${dryRun ? ' (DRY RUN)' : ''}...` 
					});
					results = await taskUtility.processScheduledTasks(schedule, { dryRun, verbose: true });
				} else {
					// Run a specific task
					const task = contentStore.tasks.findByPk(taskId);
					if (!task) {
						return await interaction.editReply({ 
							content: `${EMOJI.FAILURE} Task '${taskId}' not found.` 
						});
					}

					await interaction.editReply({ 
						content: `${EMOJI.LOADING} Running task ${taskId}${dryRun ? ' (DRY RUN)' : ''}...` 
					});

					// Process single task
					taskUtility.processedCount = 0;
					taskUtility.errorCount = 0;
					taskUtility.taskResults.clear();
					
					await taskUtility.processTask(task, { dryRun, verbose: true });
					
					const taskResult = taskUtility.taskResults.get(taskId) || { processed: 0, succeeded: 0, failed: 0 };
					results = {
						tasksProcessed: 1,
						charactersProcessed: taskResult.processed,
						succeeded: taskResult.succeeded,
						failed: taskResult.failed,
						errors: taskUtility.errorCount
					};
				}

				const embed = {
					title: `${EMOJI.SUCCESS} Task Execution Complete${dryRun ? ' (DRY RUN)' : ''}`,
					fields: [
						{ name: 'Tasks Processed', value: String(results.tasksProcessed), inline: true },
						{ name: 'Characters Processed', value: String(results.charactersProcessed), inline: true },
						{ name: 'Succeeded', value: String(results.succeeded), inline: true },
						{ name: 'Failed', value: String(results.failed), inline: true },
						{ name: 'Errors', value: String(results.errors), inline: true },
					],
					color: results.errors > 0 ? 0xED4245 : 0x57F287,
				};

				return await interaction.editReply({ embeds: [embed] });
			}

			case 'validate': {
				const errors = taskUtility.validateTasks();

				if (errors.length === 0) {
					return await interaction.editReply({ 
						content: `${EMOJI.SUCCESS} All tasks are valid!` 
					});
				}

				const errorList = errors.slice(0, 10).map((error, i) => `${i + 1}. ${error}`).join('\n');
				const moreErrors = errors.length > 10 ? `\n... and ${errors.length - 10} more errors` : '';

				const embed = {
					title: `${EMOJI.FAILURE} Task Validation Results`,
					description: `Found ${errors.length} error(s):\n\n${errorList}${moreErrors}`,
					color: 0xED4245,
				};

				return await interaction.editReply({ embeds: [embed] });
			}

			case 'stats': {
				const stats = taskUtility.getStats();

				const embed = {
					title: '📊 Task Statistics',
					fields: [
						{ name: 'Total Tasks', value: String(stats.totalTasks), inline: true },
						{ name: 'Active Tasks', value: String(stats.activeTasks), inline: true },
						{ name: 'Daily Tasks', value: String(stats.dailyTasks), inline: true },
						{ name: 'Weekly Tasks', value: String(stats.weeklyTasks), inline: true },
						{ name: 'Hourly Tasks', value: String(stats.hourlyTasks), inline: true },
						{ name: 'Last Run Errors', value: String(stats.lastProcessed.errors), inline: true },
					],
					color: 0x5865F2,
				};

				if (stats.lastProcessed.count > 0) {
					embed.fields.push({
						name: 'Last Processing Run',
						value: `Processed ${stats.lastProcessed.count} tasks with ${stats.lastProcessed.errors} errors`,
						inline: false
					});
				}

				return await interaction.editReply({ embeds: [embed] });
			}

			default:
				return await interaction.editReply({ 
					content: `${EMOJI.FAILURE} Unknown subcommand.` 
				});
			}

		} catch (error) {
			console.error('[Task Command] Error:', error);
			const errorMessage = error.message || 'An unknown error occurred';
			
			if (interaction.deferred) {
				return await interaction.editReply({ 
					content: `${EMOJI.FAILURE} Error: ${errorMessage}` 
				});
			} else {
				return await interaction.reply({ 
					content: `${EMOJI.FAILURE} Error: ${errorMessage}`, 
					flags: MessageFlags.Ephemeral 
				});
			}
		}
	},

	async autocomplete(interaction) {
		const focusedOption = interaction.options.getFocused(true);

		if (focusedOption.name === 'task_id') {
			const tasks = contentStore.tasks.findAll();
			const filtered = tasks
				.filter(task => task.id.toLowerCase().includes(focusedOption.value.toLowerCase()))
				.slice(0, 25); // Discord limit

			await interaction.respond(
				filtered.map(task => ({
					name: `${task.id} - ${task.name || 'No name'}`,
					value: task.id
				}))
			);
		}
	}
};