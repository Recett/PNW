const { SlashCommandBuilder, InteractionContextType, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder, ComponentType } = require('discord.js');
const { Op } = require('sequelize');
const { CharacterBase, NpcBase, CharacterFlag } = require('@root/dbObject.js');
const eventUtil = require('@utility/eventUtility.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('talk')
		.setDescription('Talk with an NPC!')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			const userId = interaction.user.id;
			const character = await CharacterBase.findOne({ where: { id: userId } });
			if (!character) {
				return interaction.reply({ content: 'Character not found.', flags: MessageFlags.Ephemeral });
			}

		// Check if registration is incomplete
		const characterUtil = require('@utility/characterUtility.js');
		const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
		if (unregistered === 1) {
			return interaction.reply({ content: 'You must complete the registration process before using this command.', flags: MessageFlags.Ephemeral });
		}

			// Get location by channelId (use parent channel if in thread)
			const channel = interaction.channel;
			const channelId = channel.isThread() ? channel.parentId : interaction.channelId;
			const locationUtil = interaction.client.locationUtil;
			const currentLocation = await locationUtil.getLocationByChannel(channelId);
			if (!currentLocation) {
				return interaction.reply({ content: 'This channel is not mapped to any location.', flags: MessageFlags.Ephemeral });
			}

			// Get all NPCs in this location using the same method as lookaround
			const { npcs } = await locationUtil.getLocationContents(currentLocation.id);
			if (!npcs || npcs.length === 0) {
				return interaction.reply({ content: 'There are no NPCs to talk to here.', flags: MessageFlags.Ephemeral });
			}

			// Get NPC-specific known flags for this character
			const npcKnownFlags = npcs.map(npc => `${npc.id}_known`);
			const flags = await CharacterFlag.findAll({
				where: {
					character_id: userId,
					flag: { [Op.in]: npcKnownFlags },
				},
			});
			const flagMap = {};
			flags.forEach(f => { flagMap[f.flag] = f.value; });

			// Build select menu with label logic
			const select = new StringSelectMenuBuilder()
				.setCustomId('talk_npc')
				.setPlaceholder('Choose an NPC to talk to')
				.addOptions(npcs.map(npc => {
					const knownFlag = flagMap[`${npc.id}_known`];
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
				componentType: ComponentType.StringSelect,
				time: 60000,
				filter: i => i.user.id === userId,
			});

			collector.on('collect', async i => {
				try {
					const npcId = i.values[0];
					const npc = await NpcBase.findOne({ where: { id: npcId } });
					
					// Clean up the NPC selection interface
					await interaction.deleteReply();
					
									if (!npc) {
						return i.reply({ content: 'NPC not found.', flags: MessageFlags.Ephemeral });
					}

					if (!npc.start_event) {
						return i.reply({ content: 'This NPC has nothing to say.', flags: MessageFlags.Ephemeral });
					}

					// Start the dialogue event using the new event system
					const eventResult = await eventUtil.processEvent(
						npc.start_event,
						i,
						userId,
						{
							metadata: { npcId: npc.id, npcName: npc.name },
							// Dialogue should be ephemeral like the rest of talk command
							ephemeral: true,
						},
					);

					// Handle the result
					if (eventResult.awaitingInput) {
						// Event has options - user will see them and can respond
						// The event system will handle the user's choice automatically
						console.log(`Dialogue started, awaiting user input. Session: ${eventResult.sessionId}`);
					}
					else if (eventResult.complete) {
						// Dialogue completed without user choices
						console.log('Dialogue completed automatically');
					}
					else {
						// Something went wrong
						console.warn('Unexpected dialogue result:', eventResult);
					}

				}
				catch (error) {
					console.error('Error in NPC dialogue:', error);
					if (!i.replied && !i.deferred) {
						await i.reply({ content: 'An error occurred while talking to the NPC.', flags: MessageFlags.Ephemeral });
					}
					else if (i.deferred) {
						await i.editReply({ content: 'An error occurred while talking to the NPC.' });
					}
				}
			});

			collector.on('end', async () => {
				try {
					// Clean up if user didn't select anyone
					if (!interaction.replied) return;
					await interaction.editReply({ content: 'NPC selection timed out.', components: [] });
				}
				catch (error) {
					// Interaction may have been deleted already
					console.log('Could not update expired NPC selection:', error.message);
				}
			});

		}
		catch (error) {
			console.error('Error in talk command:', error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'An error occurred while trying to talk.', flags: MessageFlags.Ephemeral });
			}
			else if (interaction.deferred) {
				await interaction.editReply({ content: 'An error occurred while trying to talk.', components: [] });
			}
		}
	},
};
