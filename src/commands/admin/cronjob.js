const { SlashCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const CronJobManager = require('@utility/cronJobManager.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('cronjob')
		.setDescription('[Admin] Manage cron jobs (scheduled tasks).')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('View all cron jobs and their status')
				.addStringOption(option =>
					option.setName('filter')
						.setDescription('Filter by status')
						.setRequired(false)
						.addChoices(
							{ name: 'All', value: 'all' },
							{ name: 'Running', value: 'running' },
							{ name: 'Stopped', value: 'stopped' },
							{ name: 'Paused', value: 'paused' },
							{ name: 'Error', value: 'error' },
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('status')
				.setDescription('View detailed status of a specific cron job')
				.addStringOption(option =>
					option.setName('name')
						.setDescription('Name of the cron job')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('stop')
				.setDescription('Stop a running cron job')
				.addStringOption(option =>
					option.setName('name')
						.setDescription('Name of the cron job')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('pause')
				.setDescription('Pause a running cron job')
				.addStringOption(option =>
					option.setName('name')
						.setDescription('Name of the cron job')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('resume')
				.setDescription('Resume a paused cron job')
				.addStringOption(option =>
					option.setName('name')
						.setDescription('Name of the cron job')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('enable')
				.setDescription('Enable a cron job')
				.addStringOption(option =>
					option.setName('name')
						.setDescription('Name of the cron job')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('disable')
				.setDescription('Disable a cron job')
				.addStringOption(option =>
					option.setName('name')
						.setDescription('Name of the cron job')
						.setRequired(true))),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			switch (subcommand) {
			case 'list': {
				const filter = interaction.options.getString('filter') || 'all';
				const jobs = filter === 'all' 
					? await CronJobManager.getAllJobs()
					: await CronJobManager.getAllJobs(filter);

				if (jobs.length === 0) {
					return await interaction.editReply({ content: `No cron jobs found${filter !== 'all' ? ` with status '${filter}'` : ''}.` });
				}

				// Format job list
				const jobList = jobs.map(job => {
					const statusEmoji = {
						running: '🟢',
						stopped: '⚫',
						paused: '🟡',
						error: '🔴',
					}[job.status] || '❓';

					const lastRun = job.last_run ? new Date(job.last_run).toLocaleString() : 'Never';
					const execCount = `${job.execution_count || 0} runs`;
					const successRate = job.execution_count > 0 
						? `(${((job.success_count / job.execution_count) * 100).toFixed(1)}% success)`
						: '';

					return `${statusEmoji} **${job.job_name}**\n` +
						`  Status: ${job.status} | Enabled: ${job.is_enabled ? 'Yes' : 'No'}\n` +
						`  Last run: ${lastRun}\n` +
						`  Stats: ${execCount} ${successRate}`;
				}).join('\n\n');

				const embed = {
					title: `📋 Cron Jobs${filter !== 'all' ? ` (${filter})` : ''}`,
					description: jobList,
					color: 0x5865F2,
					footer: { text: `Total: ${jobs.length} job(s)` },
				};

				return await interaction.editReply({ embeds: [embed] });
			}

			case 'status': {
				const jobName = interaction.options.getString('name');
				const stats = await CronJobManager.getJobStats(jobName);

				const statusEmoji = {
					running: '🟢',
					stopped: '⚫',
					paused: '🟡',
					error: '🔴',
				}[stats.status] || '❓';

				const embed = {
					title: `${statusEmoji} Cron Job: ${stats.jobName}`,
					fields: [
						{ name: 'Status', value: stats.status, inline: true },
						{ name: 'Total Executions', value: String(stats.totalExecutions), inline: true },
						{ name: 'Success Rate', value: stats.successRate, inline: true },
						{ name: 'Successful', value: String(stats.successfulExecutions), inline: true },
						{ name: 'Failed', value: String(stats.failedExecutions), inline: true },
						{ name: 'Uptime', value: stats.uptime || 'N/A', inline: true },
						{ name: 'Last Run', value: stats.lastRun ? new Date(stats.lastRun).toLocaleString() : 'Never', inline: false },
						{ name: 'Next Run', value: stats.nextRun ? new Date(stats.nextRun).toLocaleString() : 'Not scheduled', inline: false },
					],
					color: stats.status === 'running' ? 0x57F287 : stats.status === 'error' ? 0xED4245 : 0x99AAB5,
				};

				if (stats.lastError) {
					embed.fields.push({
						name: '❌ Last Error',
						value: `\`\`\`${stats.lastError.substring(0, 1000)}\`\`\``,
						inline: false,
					});
					embed.fields.push({
						name: 'Error Time',
						value: new Date(stats.lastErrorAt).toLocaleString(),
						inline: false,
					});
				}

				return await interaction.editReply({ embeds: [embed] });
			}

			case 'stop': {
				const jobName = interaction.options.getString('name');
				const job = await CronJobManager.stopJob(jobName);
				return await interaction.editReply({ 
					content: `✅ Cron job **${jobName}** has been stopped.`,
					embeds: [{
						description: `Status: ${job.status}\nStopped at: ${new Date(job.stopped_at).toLocaleString()}`,
						color: 0x99AAB5,
					}],
				});
			}

			case 'pause': {
				const jobName = interaction.options.getString('name');
				const job = await CronJobManager.pauseJob(jobName);
				return await interaction.editReply({ 
					content: `⏸️ Cron job **${jobName}** has been paused.`,
					embeds: [{
						description: `Status: ${job.status}\nPaused at: ${new Date(job.paused_at).toLocaleString()}`,
						color: 0xFEE75C,
					}],
				});
			}

			case 'resume': {
				const jobName = interaction.options.getString('name');
				const job = await CronJobManager.resumeJob(jobName);
				return await interaction.editReply({ 
					content: `▶️ Cron job **${jobName}** has been resumed.`,
					embeds: [{
						description: `Status: ${job.status}`,
						color: 0x57F287,
					}],
				});
			}

			case 'enable': {
				const jobName = interaction.options.getString('name');
				const job = await CronJobManager.setJobEnabled(jobName, true);
				return await interaction.editReply({ 
					content: `✅ Cron job **${jobName}** has been enabled.`,
					embeds: [{
						description: `Status: ${job.status}\nEnabled: ${job.is_enabled}`,
						color: 0x57F287,
					}],
				});
			}

			case 'disable': {
				const jobName = interaction.options.getString('name');
				const job = await CronJobManager.setJobEnabled(jobName, false);
				return await interaction.editReply({ 
					content: `🚫 Cron job **${jobName}** has been disabled.`,
					embeds: [{
						description: `Status: ${job.status}\nEnabled: ${job.is_enabled}`,
						color: 0x99AAB5,
					}],
				});
			}

			default:
				return await interaction.editReply({ content: 'Unknown subcommand.' });
			}
		}
		catch (error) {
			console.error('Error in cronjob command:', error);
			const errorMessage = error.message || 'An error occurred while managing the cron job.';
			
			try {
				if (interaction.deferred) {
					await interaction.editReply({ content: `❌ Error: ${errorMessage}` });
				}
				else {
					await interaction.reply({ content: `❌ Error: ${errorMessage}`, flags: MessageFlags.Ephemeral });
				}
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},
};
