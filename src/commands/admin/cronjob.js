const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { getCronMonitor } = require('@utility/cronMonitor.js');
const CronJobManager = require('@utility/cronJobManager.js');
const { CronLog, CronExecutionLog, CronHealthCheck } = require('@root/dbObject.js');
const { EMOJI } = require('../../enums');

const JOB_CHOICES = [
	{ name: 'Character Regen (HP/Stamina)', value: 'character_regen' },
	{ name: 'Galeby Cycle', value: 'galeby_cycle' },
	{ name: 'Pending Delete Cleanup', value: 'pending_delete_cleanup' },
	{ name: 'Hourly Tasks', value: 'hourly_tasks' },
	{ name: 'Midnight Job', value: 'midnight_job' },
	{ name: 'Daily Task Processor', value: 'daily_task_processor' },
	{ name: 'Weekly Stock Reset', value: 'weekly_stock_reset' },
];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('cronjob')
		.setDescription('[Admin] Manage and monitor cron jobs.')
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('Overview of all cron jobs and their health status'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('job')
				.setDescription('Show detailed statistics for a specific job')
				.addStringOption(option =>
					option.setName('name')
						.setDescription('Name of the cron job')
						.setRequired(true)
						.addChoices(...JOB_CHOICES))
				.addIntegerOption(option =>
					option.setName('days')
						.setDescription('Number of days to analyze')
						.setMinValue(1)
						.setMaxValue(30)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('logs')
				.setDescription('Show recent execution logs')
				.addStringOption(option =>
					option.setName('job')
						.setDescription('Filter by job name')
						.addChoices(
							...JOB_CHOICES,
							{ name: 'Health Monitor', value: 'health_monitor' },
						))
				.addStringOption(option =>
					option.setName('status')
						.setDescription('Filter by execution status')
						.addChoices(
							{ name: 'Success', value: 'success' },
							{ name: 'Error', value: 'error' },
							{ name: 'All', value: 'all' },
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('health')
				.setDescription('Show health checks and alerts')
				.addStringOption(option =>
					option.setName('level')
						.setDescription('Filter by alert level')
						.addChoices(
							{ name: 'Critical', value: 'critical' },
							{ name: 'Warning', value: 'warning' },
							{ name: 'Info', value: 'info' },
							{ name: 'All', value: 'all' },
						)))
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
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('cleanup')
				.setDescription('Clean up old monitoring data')
				.addIntegerOption(option =>
					option.setName('days')
						.setDescription('Remove data older than N days')
						.setMinValue(7)
						.setMaxValue(180)
						.setRequired(true))),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		try {
			switch (subcommand) {
			case 'list':
				await handleList(interaction);
				break;
			case 'job':
				await handleJobStats(interaction);
				break;
			case 'logs':
				await handleExecutionLogs(interaction);
				break;
			case 'health':
				await handleHealthChecks(interaction);
				break;
			case 'cleanup':
				await handleCleanup(interaction);
				break;
			case 'stop': {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const jobName = interaction.options.getString('name');
				const job = await CronJobManager.stopJob(jobName);
				await interaction.editReply({
					content: `${EMOJI.SUCCESS} Cron job **${jobName}** has been stopped.`,
					embeds: [{ description: `Status: ${job.status}`, color: 0x99AAB5 }],
				});
				break;
			}
			case 'pause': {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const jobName = interaction.options.getString('name');
				const job = await CronJobManager.pauseJob(jobName);
				await interaction.editReply({
					content: `${EMOJI.WARNING} Cron job **${jobName}** has been paused.`,
					embeds: [{ description: `Status: ${job.status}`, color: 0xFEE75C }],
				});
				break;
			}
			case 'resume': {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const jobName = interaction.options.getString('name');
				const job = await CronJobManager.resumeJob(jobName);
				await interaction.editReply({
					content: `${EMOJI.SUCCESS} Cron job **${jobName}** has been resumed.`,
					embeds: [{ description: `Status: ${job.status}`, color: 0x57F287 }],
				});
				break;
			}
			case 'enable': {
				const jobName = interaction.options.getString('name');
				const job = await CronJobManager.setJobEnabled(jobName, true);
				await interaction.editReply({
					content: `${EMOJI.SUCCESS} Cron job **${jobName}** has been enabled.`,
					embeds: [{ description: `Status: ${job.status} | Enabled: ${job.is_enabled}`, color: 0x57F287 }],
				});
				break;
			}

			case 'disable': {
				await interaction.deferReply({ flags: MessageFlags.Ephemeral });
				const jobName = interaction.options.getString('name');
				const job = await CronJobManager.setJobEnabled(jobName, false);
				await interaction.editReply({
					content: `${EMOJI.FAILURE} Cron job **${jobName}** has been disabled.`,
					embeds: [{ description: `Status: ${job.status} | Enabled: ${job.is_enabled}`, color: 0x99AAB5 }],
				});
				break;
			}

			default:
				await interaction.reply({ content: 'Unknown subcommand.', flags: MessageFlags.Ephemeral });
			}
		}
		catch (error) {
			console.error('Error in cronjob command:', error);
			const errorEmbed = new EmbedBuilder()
				.setColor('#FF0000')
				.setTitle(`${EMOJI.FAILURE} Error`)
				.setDescription('Failed to execute command: ' + error.message)
				.setTimestamp();

			if (interaction.replied || interaction.deferred) {
				await interaction.editReply({ embeds: [errorEmbed] });
			}
			else {
				await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
			}
		}
	},
};

async function handleList(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const [activeJobs, recentHealth] = await Promise.all([
		CronLog.findAll({ order: [['last_run', 'DESC']] }),
		CronHealthCheck.findAll({ order: [['check_time', 'DESC']], limit: 20 }),
	]);

	const healthByJob = {};
	recentHealth.forEach(health => {
		if (!healthByJob[health.job_name] || healthByJob[health.job_name].check_time < health.check_time) {
			healthByJob[health.job_name] = health;
		}
	});

	const embed = new EmbedBuilder()
		.setColor('#0066CC')
		.setTitle(`${EMOJI.INFO} Cron Job Overview`)
		.setDescription('All scheduled jobs and their health status')
		.setTimestamp();

	for (const job of activeJobs) {
		const health = healthByJob[job.job_name];
		const lastRun = job.last_run ? `<t:${Math.floor(job.last_run.getTime() / 1000)}:R>` : 'Never';
		const successRate = health ? `${health.success_rate_24h || 0}%` : 'N/A';
		const avgTime = health && health.avg_execution_time_ms ? `${Math.round(health.avg_execution_time_ms)}ms` : 'N/A';

		embed.addFields({
			name: `${getJobStatusEmoji(job.status)} ${health ? getHealthStatusEmoji(health.health_status) : '?'} ${job.job_name}`,
			value: [
				`**Last Run:** ${lastRun}`,
				`**Success Rate (24h):** ${successRate}`,
				`**Avg Time:** ${avgTime}`,
				`**Executions:** ${job.execution_count || 0} total`,
			].join('\n'),
			inline: true,
		});
	}

	const criticalAlerts = recentHealth.filter(h => h.alert_level === 'critical').length;
	const warningAlerts = recentHealth.filter(h => h.alert_level === 'warning').length;
	embed.addFields({
		name: `${EMOJI.WARNING} Alert Summary`,
		value: [
			`${EMOJI.FAILURE} Critical: ${criticalAlerts}`,
			`${EMOJI.WARNING} Warnings: ${warningAlerts}`,
			`${EMOJI.SUCCESS} Healthy: ${activeJobs.length - criticalAlerts - warningAlerts}`,
		].join('\n'),
		inline: false,
	});

	await interaction.editReply({ embeds: [embed] });
}

async function handleJobStats(interaction) {
	const jobName = interaction.options.getString('name');
	const days = interaction.options.getInteger('days') || 7;

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const monitor = getCronMonitor();
	const stats = await monitor.getJobStats(jobName, days);

	const embed = new EmbedBuilder()
		.setColor('#0066CC')
		.setTitle(`${EMOJI.INFO} Job Statistics: ${jobName}`)
		.setDescription(`Performance statistics for the last ${days} days`)
		.setTimestamp();

	embed.addFields(
		{
			name: `${EMOJI.CHART} Execution Summary`,
			value: [
				`**Total Executions:** ${stats.totalExecutions}`,
				`**Successful:** ${stats.successfulExecutions}`,
				`**Failed:** ${stats.failedExecutions}`,
				`**Success Rate:** ${stats.successRate}%`,
			].join('\n'),
			inline: true,
		},
		{
			name: '\u26A1 Performance',
			value: [
				`**Avg Execution Time:** ${stats.avgExecutionTime ? stats.avgExecutionTime + 'ms' : 'N/A'}`,
				`**Total Records:** ${stats.totalRecordsProcessed}`,
				`**DB Operations:** ${stats.totalDbOperations}`,
			].join('\n'),
			inline: true,
		},
	);

	if (stats.latestHealth) {
		const health = stats.latestHealth;
		embed.addFields({
			name: `${getHealthStatusEmoji(health.health_status)} Latest Health Check`,
			value: [
				`**Status:** ${health.health_status}`,
				`**Performance Score:** ${Math.round(health.performance_score || 0)}/100`,
				`**Consecutive Failures:** ${health.consecutive_failures}`,
				`**Last Check:** <t:${Math.floor(health.check_time.getTime() / 1000)}:R>`,
			].join('\n'),
			inline: false,
		});

		if (health.health_details && health.health_details.recommendations) {
			const recs = health.health_details.recommendations.slice(0, 3);
			if (recs.length > 0) {
				embed.addFields({
					name: '\uD83D\uDCA1 Recommendations',
					value: recs.map((rec, i) => `${i + 1}. ${rec}`).join('\n'),
					inline: false,
				});
			}
		}
	}

	if (stats.recentErrors.length > 0) {
		embed.addFields({
			name: `${EMOJI.FAILURE} Recent Errors`,
			value: stats.recentErrors.slice(0, 3).map(error =>
				`\u2022 <t:${Math.floor(error.started_at.getTime() / 1000)}:f> - ${error.error_message.substring(0, 50)}...`
			).join('\n'),
			inline: false,
		});
	}

	await interaction.editReply({ embeds: [embed] });
}

async function handleExecutionLogs(interaction) {
	const jobFilter = interaction.options.getString('job');
	const statusFilter = interaction.options.getString('status') || 'all';

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const whereConditions = {};
	if (jobFilter) whereConditions.job_name = jobFilter;
	if (statusFilter !== 'all') whereConditions.status = statusFilter;

	const logs = await CronExecutionLog.findAll({
		where: whereConditions,
		order: [['started_at', 'DESC']],
		limit: 15,
	});

	const embed = new EmbedBuilder()
		.setColor('#0066CC')
		.setTitle(`${EMOJI.INFO} Execution Logs`)
		.setDescription(`Recent execution logs${jobFilter ? ` for ${jobFilter}` : ''}${statusFilter !== 'all' ? ` (status: ${statusFilter})` : ''}`)
		.setTimestamp();

	if (logs.length === 0) {
		embed.setDescription('No execution logs found matching the criteria.');
		await interaction.editReply({ embeds: [embed] });
		return;
	}

	logs.forEach((log, index) => {
		if (index >= 10) return;
		const statusEmoji = log.status === 'success' ? EMOJI.SUCCESS : log.status === 'error' ? EMOJI.FAILURE : '\u23F3';
		const value = [
			`**Duration:** ${log.duration_ms ? log.duration_ms + 'ms' : 'N/A'}`,
			`**Memory:** ${log.memory_end_mb ? log.memory_end_mb + 'MB' : 'N/A'}`,
		];
		if (log.records_processed) value.push(`**Records:** ${log.records_processed}`);
		if (log.status === 'error' && log.error_message) value.push(`**Error:** ${log.error_message.substring(0, 50)}...`);

		embed.addFields({
			name: `${statusEmoji} ${log.job_name} - <t:${Math.floor(log.started_at.getTime() / 1000)}:f>`,
			value: value.join('\n'),
			inline: true,
		});
	});

	await interaction.editReply({ embeds: [embed] });
}

async function handleHealthChecks(interaction) {
	const levelFilter = interaction.options.getString('level') || 'all';

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const whereConditions = {};
	if (levelFilter !== 'all') whereConditions.alert_level = levelFilter;

	const healthChecks = await CronHealthCheck.findAll({
		where: whereConditions,
		order: [['check_time', 'DESC']],
		limit: 10,
	});

	const embed = new EmbedBuilder()
		.setColor('#0066CC')
		.setTitle(`${EMOJI.WARNING} Health Checks`)
		.setDescription(`Recent health check results${levelFilter !== 'all' ? ` (level: ${levelFilter})` : ''}`)
		.setTimestamp();

	if (healthChecks.length === 0) {
		embed.setDescription('No health checks found matching the criteria.');
		await interaction.editReply({ embeds: [embed] });
		return;
	}

	healthChecks.forEach(health => {
		const value = [
			`**Status:** ${health.health_status}`,
			`**Success Rate (24h):** ${health.success_rate_24h || 0}%`,
			`**Performance Score:** ${Math.round(health.performance_score || 0)}/100`,
		];
		if (health.consecutive_failures > 0) value.push(`**Consecutive Failures:** ${health.consecutive_failures}`);
		if (health.last_error_summary) value.push(`**Last Error:** ${health.last_error_summary.substring(0, 50)}...`);

		embed.addFields({
			name: `${getHealthStatusEmoji(health.health_status)}${getAlertLevelEmoji(health.alert_level)} ${health.job_name} - <t:${Math.floor(health.check_time.getTime() / 1000)}:R>`,
			value: value.join('\n'),
			inline: true,
		});
	});

	await interaction.editReply({ embeds: [embed] });
}

async function handleCleanup(interaction) {
	const days = interaction.options.getInteger('days');

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const { Op } = require('sequelize');
	const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

	const [executionCount, healthCount] = await Promise.all([
		CronExecutionLog.count({ where: { created_at: { [Op.lt]: cutoffDate } } }),
		CronHealthCheck.count({ where: { created_at: { [Op.lt]: cutoffDate } } }),
	]);

	if (executionCount === 0 && healthCount === 0) {
		await interaction.editReply({
			embeds: [new EmbedBuilder()
				.setColor('#00AA00')
				.setTitle(`${EMOJI.SUCCESS} No Cleanup Needed`)
				.setDescription(`No monitoring records older than ${days} days found.`)
				.setTimestamp()],
		});
		return;
	}

	const [executionDeleted, healthDeleted] = await Promise.all([
		CronExecutionLog.destroy({ where: { created_at: { [Op.lt]: cutoffDate } } }),
		CronHealthCheck.destroy({ where: { created_at: { [Op.lt]: cutoffDate } } }),
	]);

	await interaction.editReply({
		embeds: [new EmbedBuilder()
			.setColor('#00AA00')
			.setTitle(`${EMOJI.SUCCESS} Cleanup Complete`)
			.setDescription('Successfully cleaned up old monitoring data.')
			.addFields({
				name: 'Records Removed',
				value: [
					`**Execution Logs:** ${executionDeleted}`,
					`**Health Checks:** ${healthDeleted}`,
					`**Total:** ${executionDeleted + healthDeleted}`,
				].join('\n'),
			})
			.setTimestamp()],
	});
}

function getJobStatusEmoji(status) {
	const map = {
		running: '\uD83D\uDD04',  // 🔄
		stopped: '\u2705',         // ✅
		paused: '\u23F8\uFE0F',  // ⏸️
		error: '\u274C',           // ❌
	};
	return map[status] || '?';
}

function getHealthStatusEmoji(status) {
	const map = {
		healthy: '\uD83D\uDC9A',  // 💚
		warning: '\uD83D\uDC9B',  // 💛
		critical: '\u2764\uFE0F', // ❤️
	};
	return map[status] || '?';
}

function getAlertLevelEmoji(level) {
	const map = {
		critical: '\uD83D\uDEA8', // 🚨
		warning: '\u26A0\uFE0F',  // ⚠️
		info: '\u2139\uFE0F',     // ℹ️
	};
	return map[level] || '';
}
