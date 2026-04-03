const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { getCronMonitor } = require('@utility/cronMonitor.js');
const { CronLog, CronExecutionLog, CronHealthCheck } = require('@root/dbObject.js');
const { EMOJI } = require('../../enums');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('monitor')
		.setDescription('Monitor and manage cron jobs')
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addSubcommand(subcommand => 
			subcommand
				.setName('dashboard')
				.setDescription('Show cron job health dashboard'))
		.addSubcommand(subcommand => 
			subcommand
				.setName('job')
				.setDescription('Show detailed job statistics')
				.addStringOption(option =>
					option.setName('name')
						.setDescription('Name of the cron job')
						.setRequired(true)
						.addChoices(
							{ name: 'Hourly Job (HP/Stamina Regen)', value: 'hourly_job' },
							{ name: 'Daily Task Processor', value: 'daily_task_processor' },
							{ name: 'Weekly Stock Reset', value: 'weekly_stock_reset' },
							{ name: 'Midnight Job', value: 'midnight_job' }
						))
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
							{ name: 'Hourly Job', value: 'hourly_job' },
							{ name: 'Daily Task Processor', value: 'daily_task_processor' },
							{ name: 'Weekly Stock Reset', value: 'weekly_stock_reset' },
							{ name: 'Midnight Job', value: 'midnight_job' }
						))
				.addStringOption(option =>
					option.setName('status')
						.setDescription('Filter by execution status')
						.addChoices(
							{ name: 'Success', value: 'success' },
							{ name: 'Error', value: 'error' },
							{ name: 'All', value: 'all' }
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
							{ name: 'All', value: 'all' }
						)))
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
			case 'dashboard':
				await handleDashboard(interaction);
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
			}
		}
		catch (error) {
			console.error('Error in monitor command:', error);
			const errorEmbed = new EmbedBuilder()
				.setColor('#FF0000')
				.setTitle(EMOJI.FAILURE + ' Error')
				.setDescription('Failed to execute monitoring command: ' + error.message)
				.setTimestamp();

			if (interaction.replied) {
				await interaction.editReply({ embeds: [errorEmbed] });
			}
			else {
				await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
			}
		}
	},
};

async function handleDashboard(interaction) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	// Get all cron jobs health status
	const [activeJobs, recentHealth] = await Promise.all([
		CronLog.findAll({ order: [['last_run', 'DESC']] }),
		CronHealthCheck.findAll({
			where: {},
			order: [['check_time', 'DESC']],
			limit: 20,
		}),
	]);

	// Group health checks by job
	const healthByJob = {};
	recentHealth.forEach(health => {
		if (!healthByJob[health.job_name] || healthByJob[health.job_name].check_time < health.check_time) {
			healthByJob[health.job_name] = health;
		}
	});

	const embed = new EmbedBuilder()
		.setColor('#0066CC')
		.setTitle(`${EMOJI.INFO} Cron Job Dashboard`)
		.setDescription('Overview of all scheduled jobs and their health status')
		.setTimestamp();

	// Add job status fields
	for (const job of activeJobs) {
		const health = healthByJob[job.job_name];
		const status = getJobStatusEmoji(job.status);
		const healthStatus = health ? getHealthStatusEmoji(health.health_status) : '❓';
		
		const lastRun = job.last_run ? `<t:${Math.floor(job.last_run.getTime() / 1000)}:R>` : 'Never';
		const successRate = health ? `${health.success_rate_24h || 0}%` : 'N/A';
		const avgTime = health && health.avg_execution_time_ms ? `${Math.round(health.avg_execution_time_ms)}ms` : 'N/A';
		
		embed.addFields({
			name: `${status} ${healthStatus} ${job.job_name}`,
			value: [
				`**Last Run:** ${lastRun}`,
				`**Success Rate (24h):** ${successRate}`,
				`**Avg Time:** ${avgTime}`,
				`**Executions:** ${job.execution_count || 0} total`,
			].join('\\n'),
			inline: true,
		});
	}

	// Add alerts summary
	const criticalAlerts = recentHealth.filter(h => h.alert_level === 'critical').length;
	const warningAlerts = recentHealth.filter(h => h.alert_level === 'warning').length;

	embed.addFields({
		name: `${EMOJI.WARNING} Alert Summary`,
		value: [
			`❌ Critical: ${criticalAlerts}`,
			`⚠️ Warnings: ${warningAlerts}`,
			`✅ Healthy: ${activeJobs.length - criticalAlerts - warningAlerts}`,
		].join('\\n'),
		inline: false,
	});

	// Add action buttons
	const row = new ActionRowBuilder()
		.addComponents(
			new ButtonBuilder()
				.setCustomId('monitor_refresh_dashboard')
				.setLabel('Refresh')
				.setStyle(ButtonStyle.Primary)
				.setEmoji('🔄'),
			new ButtonBuilder()
				.setCustomId('monitor_view_alerts')
				.setLabel('View Alerts')
				.setStyle(ButtonStyle.Danger)
				.setEmoji('🚨'),
		);

	await interaction.editReply({ embeds: [embed], components: [row] });
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

	// Basic stats
	embed.addFields(
		{
			name: '📊 Execution Summary',
			value: [
				`**Total Executions:** ${stats.totalExecutions}`,
				`**Successful:** ${stats.successfulExecutions}`,
				`**Failed:** ${stats.failedExecutions}`,
				`**Success Rate:** ${stats.successRate}%`,
			].join('\\n'),
			inline: true,
		},
		{
			name: '⚡ Performance',
			value: [
				`**Avg Execution Time:** ${stats.avgExecutionTime ? stats.avgExecutionTime + 'ms' : 'N/A'}`,
				`**Total Records:** ${stats.totalRecordsProcessed}`,
				`**DB Operations:** ${stats.totalDbOperations}`,
			].join('\\n'),
			inline: true,
		}
	);

	// Health status
	if (stats.latestHealth) {
		const health = stats.latestHealth;
		const healthEmoji = getHealthStatusEmoji(health.health_status);
		
		embed.addFields({
			name: `${healthEmoji} Latest Health Check`,
			value: [
				`**Status:** ${health.health_status}`,
				`**Performance Score:** ${Math.round(health.performance_score || 0)}/100`,
				`**Consecutive Failures:** ${health.consecutive_failures}`,
				`**Last Check:** <t:${Math.floor(health.check_time.getTime() / 1000)}:R>`,
			].join('\\n'),
			inline: false,
		});

		// Add recommendations if any
		if (health.health_details && health.health_details.recommendations) {
			const recommendations = health.health_details.recommendations.slice(0, 3);
			if (recommendations.length > 0) {
				embed.addFields({
					name: '💡 Recommendations',
					value: recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\\n'),
					inline: false,
				});
			}
		}
	}

	// Recent errors
	if (stats.recentErrors.length > 0) {
		embed.addFields({
			name: `${EMOJI.FAILURE} Recent Errors`,
			value: stats.recentErrors.slice(0, 3).map(error => 
				`• <t:${Math.floor(error.started_at.getTime() / 1000)}:f> - ${error.error_message.substring(0, 50)}...`
			).join('\\n'),
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
		if (index < 10) { // Embed field limit
			const statusEmoji = log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : '⏳';
			const duration = log.duration_ms ? `${log.duration_ms}ms` : 'N/A';
			const memory = log.memory_end_mb ? `${log.memory_end_mb}MB` : 'N/A';
			
			let value = [
				`**Duration:** ${duration}`,
				`**Memory:** ${memory}`,
			];

			if (log.records_processed) {
				value.push(`**Records:** ${log.records_processed}`);
			}

			if (log.status === 'error' && log.error_message) {
				value.push(`**Error:** ${log.error_message.substring(0, 50)}...`);
			}

			embed.addFields({
				name: `${statusEmoji} ${log.job_name} - <t:${Math.floor(log.started_at.getTime() / 1000)}:f>`,
				value: value.join('\\n'),
				inline: true,
			});
		}
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
		const healthEmoji = getHealthStatusEmoji(health.health_status);
		const alertEmoji = getAlertLevelEmoji(health.alert_level);
		
		const value = [
			`**Status:** ${health.health_status}`,
			`**Success Rate (24h):** ${health.success_rate_24h || 0}%`,
			`**Performance Score:** ${Math.round(health.performance_score || 0)}/100`,
		];

		if (health.consecutive_failures > 0) {
			value.push(`**Consecutive Failures:** ${health.consecutive_failures}`);
		}

		if (health.last_error_summary) {
			value.push(`**Last Error:** ${health.last_error_summary.substring(0, 50)}...`);
		}

		embed.addFields({
			name: `${healthEmoji}${alertEmoji} ${health.job_name} - <t:${Math.floor(health.check_time.getTime() / 1000)}:R>`,
			value: value.join('\\n'),
			inline: true,
		});
	});

	await interaction.editReply({ embeds: [embed] });
}

async function handleCleanup(interaction) {
	const days = interaction.options.getInteger('days');

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

	// Count records to be deleted
	const [executionCount, healthCount] = await Promise.all([
		CronExecutionLog.count({ where: { created_at: { [require('sequelize').Op.lt]: cutoffDate } } }),
		CronHealthCheck.count({ where: { created_at: { [require('sequelize').Op.lt]: cutoffDate } } }),
	]);

	if (executionCount === 0 && healthCount === 0) {
		const embed = new EmbedBuilder()
			.setColor('#00AA00')
			.setTitle(`${EMOJI.SUCCESS} No Cleanup Needed`)
			.setDescription(`No monitoring records older than ${days} days found.`)
			.setTimestamp();

		await interaction.editReply({ embeds: [embed] });
		return;
	}

	// Perform cleanup
	const [executionDeleted, healthDeleted] = await Promise.all([
		CronExecutionLog.destroy({ where: { created_at: { [require('sequelize').Op.lt]: cutoffDate } } }),
		CronHealthCheck.destroy({ where: { created_at: { [require('sequelize').Op.lt]: cutoffDate } } }),
	]);

	const embed = new EmbedBuilder()
		.setColor('#00AA00')
		.setTitle(`${EMOJI.SUCCESS} Cleanup Complete`)
		.setDescription(`Successfully cleaned up old monitoring data.`)
		.addFields(
			{
				name: 'Records Removed',
				value: [
					`**Execution Logs:** ${executionDeleted}`,
					`**Health Checks:** ${healthDeleted}`,
					`**Total:** ${executionDeleted + healthDeleted}`,
				].join('\\n'),
			}
		)
		.setTimestamp();

	await interaction.editReply({ embeds: [embed] });
}

// Helper functions
function getJobStatusEmoji(status) {
	switch (status) {
	case 'running': return '🔄';
	case 'stopped': return '✅';
	case 'paused': return '⏸️';
	case 'error': return '❌';
	default: return '❓';
	}
}

function getHealthStatusEmoji(status) {
	switch (status) {
	case 'healthy': return '💚';
	case 'warning': return '💛';
	case 'critical': return '❤️';
	default: return '❓';
	}
}

function getAlertLevelEmoji(level) {
	switch (level) {
	case 'critical': return '🚨';
	case 'warning': return '⚠️';
	case 'info': return 'ℹ️';
	default: return '';
	}
}