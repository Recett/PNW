const { SlashCommandBuilder, StringSelectMenuBuilder, ActionRowBuilder, MessageFlags } = require('discord.js');
const { CharacterBase, LocationBase, LocationLink, LocationCluster } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('move')
		.setDescription('Move your character to a new location.'),

	async execute(interaction) {
		const userId = interaction.user.id;
		const character = await CharacterBase.findOne({ where: { id: userId } });
		if (!character) {
			return interaction.reply({ content: 'Character not found.', flags: MessageFlags.Ephemeral });
		}

		// Get current location by channelId (like lookaround/talk)
		const channelId = interaction.channelId;
		const locationUtil = interaction.client.locationUtil;
		let currentLocation = await locationUtil.getLocationByChannel(channelId);
		console.log('Current location for channel', channelId, currentLocation);
		if (!currentLocation) {
			return interaction.reply({ content: 'This channel is not mapped to any location.', flags: MessageFlags.Ephemeral });
		}

		// Get all directly linked locations
		const links = await LocationLink.findAll({ where: { id_from: currentLocation.id } });
		const linkedIds = links.map(l => l.linked_location_id);

		// Get cluster locations
		const currentLoc = await LocationCluster.findOne({ where: { id: currentLocation.id } });
		let clusterIds = [];
		if (currentLoc && currentLoc.cluster_id) {
			const clusterLocs = await LocationCluster.findAll({ where: { cluster_id: currentLoc.cluster_id } });
			clusterIds = clusterLocs.map(l => l.id).filter(id => id !== currentLocation.id);
		}

		// Combine and deduplicate
		const allLinkedIds = Array.from(new Set([...linkedIds, ...clusterIds]));
		if (allLinkedIds.length === 0) {
			return interaction.reply({ content: 'There are no available locations to move to from here.', flags: MessageFlags.Ephemeral });
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
		await interaction.reply({ content: 'Where do you want to go?', components: [row], flags: MessageFlags.Ephemeral });

		const message = (await interaction.fetchReply()) || interaction.message;
		const collector = message.createMessageComponentCollector({
			componentType: 3, // StringSelect
			time: 60000,
			filter: i => i.user.id === userId,
		});
		collector.on('collect', async i => {
			const selectedId = i.values[0];
			await CharacterBase.update({ location_id: selectedId }, { where: { id: userId } });
			await i.reply({ content: `You have moved to the new location.`, flags: MessageFlags.Ephemeral });
		});
	},
};
