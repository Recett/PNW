const {
	SlashCommandBuilder,
	InteractionContextType,
	EmbedBuilder,
	PermissionsBitField,
} = require('discord.js');
const { LocationBase } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('diagnose-permissions')
		.setDescription('Diagnose thread permission issues')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('User to check permissions for (optional)')
				.setRequired(false))
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		await interaction.deferReply({ ephemeral: true });

		try {
			const targetUser = interaction.options.getUser('user') || interaction.user;
			const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
			const targetMember = await interaction.guild.members.fetch(targetUser.id);

			// Find interview location
			const allLocations = await LocationBase.findAll();
			const interviewLocation = allLocations.find(loc =>
				loc.tag && Array.isArray(loc.tag) && loc.tag.includes('interview')
			);

			if (!interviewLocation || !interviewLocation.channel) {
				return await interaction.editReply('❌ No interview location found or no channel set.');
			}

			const interviewChannel = await interaction.guild.channels.fetch(interviewLocation.channel);
			if (!interviewChannel) {
				return await interaction.editReply('❌ Interview channel not found.');
			}

			// Get permissions
			const userChannelPerms = interviewChannel.permissionsFor(targetMember);
			const botChannelPerms = interviewChannel.permissionsFor(botMember);
			
			// Check @everyone role permissions (critical for new users)
			const everyoneRole = interaction.guild.roles.everyone;
			const everyoneChannelPerms = interviewChannel.permissionsFor(everyoneRole);

			// Role hierarchy check
			const roleHierarchyOK = botMember.roles.highest.position > targetMember.roles.highest.position;

			// Build diagnostic embed
			const embed = new EmbedBuilder()
				.setTitle('🔍 Thread Permission Diagnosis')
				.setColor(roleHierarchyOK ? 0x00ff00 : 0xff0000)
				.addFields(
					{
						name: '👤 Target User',
						value: `${targetUser.username} (${targetUser.id})\nHighest Role: ${targetMember.roles.highest.name} (Position: ${targetMember.roles.highest.position})`,
						inline: true
					},
					{
						name: '🤖 Bot Info',
						value: `${botMember.user.username}\nHighest Role: ${botMember.roles.highest.name} (Position: ${botMember.roles.highest.position})`,
						inline: true
					},
					{
						name: '🏛️ Interview Channel',
						value: `${interviewChannel.name} (${interviewChannel.id})\nType: ${interviewChannel.type}`,
						inline: false
					},
					{
						name: '🌍 @everyone Permissions (NEW USERS)',
						value: [
							`View Channel: ${everyoneChannelPerms?.has(PermissionsBitField.Flags.ViewChannel) ? '✅' : '❌'}`,
							`Send Messages: ${everyoneChannelPerms?.has(PermissionsBitField.Flags.SendMessages) ? '✅' : '❌'}`,
							`Create Private Threads: ${everyoneRole.permissions.has(PermissionsBitField.Flags.CreatePrivateThreads) ? '✅' : '❌'}`,
						].join('\n'),
						inline: true
					},
					{
						name: '👤 User Channel Permissions',
						value: [
							`View Channel: ${userChannelPerms?.has(PermissionsBitField.Flags.ViewChannel) ? '✅' : '❌'}`,
							`Send Messages: ${userChannelPerms?.has(PermissionsBitField.Flags.SendMessages) ? '✅' : '❌'}`,
							`Send Messages in Threads: ${userChannelPerms?.has(PermissionsBitField.Flags.SendMessagesInThreads) ? '✅' : '❌'}`,
						].join('\n'),
						inline: true
					},
					{
						name: '🤖 Bot Channel Permissions',
						value: [
							`View Channel: ${botChannelPerms?.has(PermissionsBitField.Flags.ViewChannel) ? '✅' : '❌'}`,
							`Manage Threads: ${botChannelPerms?.has(PermissionsBitField.Flags.ManageThreads) ? '✅' : '❌'}`,
							`Use Private Threads: ${botChannelPerms?.has(PermissionsBitField.Flags.UsePrivateThreads) ? '✅' : '❌'}`,
						].join('\n'),
						inline: true
					}
				);

			// Root cause analysis for new user registration
			const rootIssues = [];
			const recommendations = [];
			
			// Critical: Users need channel access to be added to threads
			const hasChannelAccess = everyoneChannelPerms?.has(PermissionsBitField.Flags.ViewChannel);
			
			if (!hasChannelAccess) {
				rootIssues.push('🚨 CRITICAL: New users cannot see interview channel');
				recommendations.push('**Required**: Grant @everyone "View Channel" permission in interview channel');
				recommendations.push('**Alternative**: Grant location role BEFORE creating thread (current solution)');
			} else {
				recommendations.push('✅ New users can access interview channel - thread creation should work');
			}
			
			if (!roleHierarchyOK) {
				rootIssues.push('❌ Bot role too low in hierarchy');
				recommendations.push('**Fix**: Move bot role above user roles in Server Settings → Roles');
			}

			if (rootIssues.length > 0) {
				embed.addFields(
					{
						name: '🚨 Root Cause Issues',
						value: rootIssues.join('\n'),
						inline: false
					},
					{
						name: '💡 Solutions',
						value: recommendations.join('\n'),
						inline: false
					}
				);
				
				embed.setColor(0xff0000); // Red for critical issues
			} else {
				embed.addFields({
					name: '✅ Status',
					value: 'All permissions configured correctly for new user registration.',
					inline: false
				});
			}

			await interaction.editReply({ embeds: [embed] });

		} catch (error) {
			console.error('Diagnose permissions error:', error);
			await interaction.editReply('❌ Error occurred during diagnosis: ' + error.message);
		}
	},
};