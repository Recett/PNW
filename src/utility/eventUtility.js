const { EventBase, EventFlag, EventTag, EventResolution, GlobalFlag, EventResolutionCheck, CharacterFlag, NPCBase } = require('@root/dbObject.js');
const Discord = require('discord.js');
const characterUtil = require('./characterUtility');

let getEventBase = async (eventId) => {
	return await EventBase.findOne({
		where: {
			event_Id: eventId,
		},
	});
};

let getEventFlag = async (eventId) => {
	return await EventFlag.findAll({
		where: {
			event_Id: eventId,
		},
	});
};

let getEventResolution = async (eventId) => {
	return await EventResolution.findAll({
		where: {
			event_Id: eventId,
		},
	});
};

let getEventResolutionOne = async (eventId, resolutionId) => {
	return await EventResolution.findOne({
		where: {
			event_id: eventId,
			resolution_id: resolutionId
		},
	});
};

let getEventTag = async (eventId) => {
	return await EventTag.findAll({
		where: {
			event_Id: eventId,
		},
	});
};

async function updateGlobalFlags(flags) {
	if (!flags || typeof flags !== 'object') return;
	for (const [flag, value] of Object.entries(flags)) {
		await GlobalFlag.upsert({
			flag: flag,
			value: value,
		});
	}
}

async function updateCharacterFlags(characterId, flags) {
	if (!characterId || !flags || typeof flags !== 'object') return;
	await characterUtil.updateMultipleCharacterFlags(characterId, flags);
}

async function handleEvent(eventId, interaction, flags = {}, characterId = null, ephemeral = true) {
	// Fetch event base for embed details
	const eventBase = await interaction.client.eventUtil.getEventBase(eventId);
	let embed = {};
	if (eventBase) {
		if (eventBase.npc) {
			const npc = await NPCBase.findOne({ where: { id: eventBase.npc } });
			if (npc) {
				embed.title = npc.name || undefined;
				embed.thumbnail = npc.avatar ? { url: npc.avatar } : undefined;
			}
			else {
				embed.title = eventBase.title || undefined;
				embed.thumbnail = eventBase.avatar ? { url: eventBase.avatar } : undefined;
			}
		}
		else {
			embed.title = eventBase.title || undefined;
			embed.thumbnail = eventBase.avatar ? { url: eventBase.avatar } : undefined;
		}
		// Pronoun substitution for event text
		const { pronoun } = require('./generalUtility');
		let eventText = eventBase.text || undefined;
		if (eventText && characterId) {
			const character = await characterUtil.getCharacterBase(characterId);
			if (character) {
				eventText = pronoun(eventText, character.age, character.gender);
			}
		}
		embed.description = eventText;
		if (eventBase.illustration) {
			embed.image = { url: eventBase.illustration };
		}
	}

	let eventResolutions = await interaction.client.eventUtil.getEventResolution(eventId);
	let eventFlag = await interaction.client.eventUtil.getEventFlag(eventId);

	// --- NEW: Get EventResolutionCheck, characterFlag, and GlobalFlag ---

	let eventResolutionChecks = await EventResolutionCheck.findAll({ where: { event_id: eventId } });
	let characterFlags = {};
	if (characterId) {
		const charFlags = await CharacterFlag.findAll({ where: { character_id: characterId } });
		charFlags.forEach(f => { characterFlags[f.flag] = f.value; });
	}
	let globalFlagValues = {};
	const globalFlagRows = await GlobalFlag.findAll();
	globalFlagRows.forEach(f => { globalFlagValues[f.flag] = f.value; });

	// Helper to determine if a resolution option should be shown
	function shouldShowResolutionOption(check, charFlags, globalFlags) {
		if (!check) return true;
		const flagName = check.flag;
		let showOption = true;
		let flagValue;
		if (check.flag_local) {
			showOption = Object.prototype.hasOwnProperty.call(charFlags, flagName);
			flagValue = charFlags[flagName];
		}
		else {
			showOption = Object.prototype.hasOwnProperty.call(globalFlags, flagName);
			flagValue = globalFlags[flagName];
		}
		if (showOption && check.condition && typeof check.value !== 'undefined') {
			const cond = check.condition;
			const val = check.value;
			switch (cond) {
			case '>':
				showOption = flagValue > val;
				break;
			case '<':
				showOption = flagValue < val;
				break;
			case '>=':
				showOption = flagValue >= val;
				break;
			case '<=':
				showOption = flagValue <= val;
				break;
			case '==':
				showOption = flagValue == val;
				break;
			case '!=':
				showOption = flagValue != val;
				break;
			default:
				showOption = false;
			}
		}
		return showOption;
	}

	// Build select menu if there are resolutions
	let select = null;
	if (eventResolutions && eventResolutions.length > 0) {
		select = new Discord.StringSelectMenuBuilder()
			.setCustomId('talk_choice')
			.setPlaceholder('Choose your response');
		eventResolutions.forEach((res, idx) => {
			const check = eventResolutionChecks.find(c => c.resolution_id == res.resolution_id);
			if (!shouldShowResolutionOption(check, characterFlags, globalFlagValues)) {
				return;
			}
			select.addOptions(
				new Discord.StringSelectMenuOptionBuilder()
					.setLabel(`${idx + 1}. ${res.resolution_text}`)
					.setValue(`${res.resolution_id}`),
			);
		});
	}

	// Separate flags into global and local
	let globalFlags = {};
	let localFlags = {};

	// Show select menu or just reply
	if (select) {
		const row = new Discord.ActionRowBuilder().addComponents(select);
		const replyMethod = interaction.reply ? 'reply' : 'update';
		const response = await interaction[replyMethod]({ embeds: [embed], components: [row], ephemeral });
		const message = response.resource?.message || interaction.message;
		const collector = message.createMessageComponentCollector({
			componentType: Discord.ComponentType.StringSelect,
			time: 3_600_000,
			filter: i => i.user.id === interaction.user.id,
		});
		collector.on('collect', async i => {
			const selected = i.values[0];
			const resolution = await interaction.client.eventUtil.getEventResolutionOne(eventId, selected);
			// Update flags based on eventFlag
			if (eventFlag && eventFlag.length > 0) {
				eventFlag.forEach(flag => {
					if (flag.resolution_id == 0 || flag.resolution_id == selected) {
						if (flag.global) {
							if (flag.method === 'set') {
								globalFlags[flag.flag] = flag.amount;
							}
							else {
								if (globalFlags[flag.flag] == null) globalFlags[flag.flag] = 0;
								globalFlags[flag.flag] += flag.amount;
							}
						}
						else if (flag.method === 'set') {
							localFlags[flag.flag] = flag.amount;
						}
						else {
							if (localFlags[flag.flag] == null) localFlags[flag.flag] = 0;
							localFlags[flag.flag] += flag.amount;
						}
					}
				});
			}
			const nextEventId = resolution && resolution.child_event_id ? resolution.child_event_id : null;
			if (nextEventId && nextEventId !== 'end') {
				await handleEvent(nextEventId, i, flags, characterId, ephemeral);
			}
			else {
				if (characterId) await updateCharacterFlags(characterId, localFlags);
				await updateGlobalFlags(globalFlags);
			}
		});
	}
	else {
		// If no select, add a single button to continue
		const button = new Discord.ButtonBuilder()
			.setCustomId('continue_event')
			.setLabel('Continue')
			.setStyle(Discord.ButtonStyle.Primary);
		const row = new Discord.ActionRowBuilder().addComponents(button);
		const replyMethod = interaction.reply ? 'reply' : 'update';
		const response = await interaction[replyMethod]({ embeds: [embed], components: [row], ephemeral });
		const message = response.resource?.message || interaction.message;
		const collector = message.createMessageComponentCollector({
			componentType: Discord.ComponentType.Button,
			time: 3_600_000,
			filter: i => i.user.id === interaction.user.id,
		});
		// Remove redeclaration of eventBase in collector for button
		collector.on('collect', async i => {
			// Find the next event (if any)
			const nextEventBase = await interaction.client.eventUtil.getEventBase(eventId);
			const nextEventId = nextEventBase && nextEventBase.default_child_event_id ? nextEventBase.default_child_event_id : null;
			if (nextEventId && nextEventId !== 'end') {
				await handleEvent(nextEventId, i, flags, characterId, ephemeral);
			}
			else {
				if (characterId) await updateCharacterFlags(characterId, localFlags);
				await updateGlobalFlags(globalFlags);
			}
		});
	}
}

module.exports = {
	getEventBase,
	getEventFlag,
	getEventResolution,
	getEventResolutionOne,
	getEventTag,
	handleEvent,
	updateCharacterFlags,
	updateGlobalFlags,
};
