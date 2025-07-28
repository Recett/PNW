const { SlashCommandBuilder, InteractionContextType, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { CharacterBase, NPCBase, CharacterFlag } = require('@root/dbObject.js');
const eventUtil = require('@utility/eventUtility.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('talk')
		.setDescription('Talk with an NPC!')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		const userId = interaction.user.id;
		const character = await CharacterBase.findOne({ where: { id: userId } });
		if (!character) {
			return interaction.reply({ content: 'Character not found.', flags: MessageFlags.Ephemeral });
		}
		// Get location by channelId (like lookaround)
		const channelId = interaction.channelId;
		const locationUtil = interaction.client.locationUtil;
		let currentLocation = await locationUtil.getLocationByChannel(channelId);
		if (!currentLocation) {
			return interaction.reply({ content: 'This channel is not mapped to any location.', flags: MessageFlags.Ephemeral });
		}
		// Get all NPCs in this location using the same method as lookaround
		const { npcs } = await locationUtil.getLocationContents(currentLocation.id);
		if (!npcs || npcs.length === 0) {
			return interaction.reply({ content: 'There are no NPCs to talk to here.', flags: MessageFlags.Ephemeral });
		}
		// Get all known flags for this character
		const flags = await CharacterFlag.findAll({ where: { character_id: userId } });
		const flagMap = {};
		flags.forEach(f => { flagMap[f.flag] = f.value; });
		// Build select menu with label logic
		const select = new StringSelectMenuBuilder()
			.setCustomId('talk_npc')
			.setPlaceholder('Choose an NPC to talk to')
			.addOptions(npcs.map(npc => {
				const knownFlag = flagMap[`${npc.npc_id}_known`];
				return {
					label: (!knownFlag || knownFlag === false || knownFlag === 0) && npc.unknown_name ? npc.unknown_name : npc.name,
					value: String(npc.id),
				};
			}));
		const row = new ActionRowBuilder().addComponents(select);
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		await interaction.editReply({ content: 'Who do you want to talk to?', components: [row], flags: MessageFlags.Ephemeral });

		const message = (await interaction.fetchReply()) || interaction.message;
		const collector = message.createMessageComponentCollector({
			componentType: 3, // StringSelect
			time: 60000,
			filter: i => i.user.id === userId,
		});
		collector.on('collect', async i => {
			const npcId = i.values[0];
			const npc = await NPCBase.findOne({ where: { id: npcId } });
			await interaction.deleteReply();
			if (!npc) {
				return i.reply({ content: 'NPC not found.', flags: MessageFlags.Ephemeral });
			}
			await eventUtil.handleEvent(npc.start_event, i, userId, true);
		});
	},
};
