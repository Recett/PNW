const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, MessageFlags, ComponentType } = require('discord.js');
const { CharacterBase, LocationBase, LocationLink, LocationCluster } = require('@root/dbObject.js');
const characterUtility = require('../../utility/characterUtility');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('move')
		.setDescription('Move your character to a new location.'),

	async execute(interaction) {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const userId = interaction.user.id;
			const character = await CharacterBase.findOne({ where: { id: userId } });
			if (!character) {
				return await interaction.editReply({ content: 'Character not found.' });
			}

			// Check if registration is incomplete
			const unregistered = await characterUtility.getCharacterFlag(userId, 'unregistered');
			if (unregistered === 1) {
				return await interaction.editReply({ content: 'You must complete the registration process before using this command.' });
			}

			// Clean up: remove all location roles except the character's DB location role
			try {
				const member = await interaction.guild.members.fetch(userId);
				const allLocations = await LocationBase.findAll();
				const dbLocation = character.location_id 
					? await LocationBase.findOne({ where: { id: character.location_id } }) 
					: null;
				const currentRoleId = dbLocation?.role;
				const locationRoleIds = allLocations
					.map(loc => loc.role)
					.filter(role => role && role !== currentRoleId);
				
				console.log(`[Move Cleanup] User ${userId} - DB location: ${dbLocation?.name || 'NONE'}, keeping role: ${currentRoleId || 'NONE'}`);
				for (const roleId of locationRoleIds) {
					if (member.roles.cache.has(roleId)) {
						console.log(`[Move Cleanup] Removing excess role: ${roleId}`);
						await member.roles.remove(roleId).catch(() => {});
					}
				}
			}
			catch (cleanupErr) {
				console.error('Error cleaning up location roles:', cleanupErr);
			}

			// Get current location by channelId (use parent channel if in thread)
			const channel = interaction.channel;
			const channelId = channel.isThread() ? channel.parentId : interaction.channelId;
			const locationUtil = interaction.client.locationUtil;
			const currentLocation = await locationUtil.getLocationByChannel(channelId);
			if (!currentLocation) {
				return await interaction.editReply({ content: 'This channel is not mapped to any location.' });
			}

			// Get all directly linked locations
			const links = await LocationLink.findAll({ where: { location_id: currentLocation.id } });
			const linkedIds = links.map(l => l.linked_location_id);

			// Get cluster locations
			const currentLoc = await LocationCluster.findOne({ where: { location_id: currentLocation.id } });
			let clusterIds = [];
			if (currentLoc && currentLoc.cluster_id) {
				const clusterLocs = await LocationCluster.findAll({ where: { cluster_id: currentLoc.cluster_id } });
				clusterIds = clusterLocs
					.map(l => l.location_id)
					.filter(location_id => location_id != currentLocation.id);
			}

			// Combine and deduplicate
			const allLinkedIds = Array.from(new Set([...linkedIds, ...clusterIds]));
			if (allLinkedIds.length === 0) {
				return await interaction.editReply({ content: 'There are no available locations to move to from here.' });
			}

			// Get location names
			const locations = await LocationBase.findAll({ where: { id: allLinkedIds } });
			const select = new StringSelectMenuBuilder()
				.setCustomId('move_location')
				.setPlaceholder('Choose a location to move to')
				.addOptions(locations.map(loc => ({
					label: loc.name,
					value: String(loc.id),
				})));
			const row = new ActionRowBuilder().addComponents(select);
			await interaction.editReply({ content: 'Where do you want to go?', components: [row] });

			const message = (await interaction.fetchReply()) || interaction.message;
			const collector = message.createMessageComponentCollector({
				componentType: ComponentType.StringSelect,
				time: 60000,
				filter: i => i.user.id === userId,
			});
			collector.on('collect', async i => {
				const selectedId = i.values[0];
				// Transition roles: add new role first, then remove old after delay
				const { newLocation } = await interaction.client.locationUtil.transitionLocationRoles({
					guild: interaction.guild,
					memberId: userId,
					newLocationId: selectedId,
					delayMs: 5000,
				});
				// CharacterBase.location_id is now updated inside transitionLocationRoles
				
				// Build response with clickable channel link
				let replyContent = `You traveled to **${newLocation?.name || 'the new location'}**!`;
				if (newLocation?.channel) {
					replyContent += ` Head over to <#${newLocation.channel}>`;
				}
				
				await i.reply({ content: replyContent, flags: MessageFlags.Ephemeral });
			});
		}
		catch (error) {
			console.error('Error in move command:', error);
			try {
				if (interaction.deferred) {
					await interaction.editReply({ content: 'An error occurred while trying to move.' });
				}
				else {
					await interaction.reply({ content: 'An error occurred while trying to move.', flags: MessageFlags.Ephemeral });
				}
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},
};
