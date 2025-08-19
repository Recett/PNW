const { EventBase, EventFlag, EventTag, EventResolution, GlobalFlag, EventResolutionCheck, CharacterFlag, NPCBase, EventCheck } = require('@root/dbObject.js');
const Discord = require('discord.js');
const characterUtil = require('./characterUtility');

// Handles situations where eventBase.check is true
async function handleEventCheck(eventId, interaction, flags = { LocalFlag: {}, CharFlag: {}, GlobalFlag: {} }, characterId = null, ephemeral = true) {
	// Fetch the event base and check details
	const eventBase = await interaction.client.eventUtil.getEventBase(eventId);
	if (!eventBase || !eventBase.check) return;
	// Example: You may want to fetch a check condition from the DB
	const eventCheck = await EventCheck.findOne({ where: { event_id: eventId } });
	let result = true;
	if (eventCheck) {
		let flagValue;
		if (eventCheck.check_source === 'LocalFlag') {
			flagValue = flags.LocalFlag[eventCheck.check_value] || 0;
		}
		else if (eventCheck.check_source === 'GlobalFlag') {
			const globalFlagRow = await GlobalFlag.findOne({ where: { flag: eventCheck.check_value } });
			flagValue = globalFlagRow ? globalFlagRow.value : 0;
		}
		else if (eventCheck.check_source === 'CharFlag') {
			if (characterId) {
				const charFlagRow = await CharacterFlag.findOne({ where: { character_id: characterId, flag: eventCheck.check_value } });
				flagValue = charFlagRow ? charFlagRow.value : 0;
			}
			else {
				flagValue = 0;
			}
		}
		else {
			flagValue = flags.LocalFlag[eventCheck.flag] || 0;
		}
		switch (eventCheck.check_type) {
		case '>':
			result = flagValue > eventCheck.target;
			break;
		case '<':
			result = flagValue < eventCheck.target;
			break;
		case '>=':
			result = flagValue >= eventCheck.target;
			break;
		case '<=':
			result = flagValue <= eventCheck.target;
			break;
		case '==':
			result = flagValue == eventCheck.target;
			break;
		case '!=':
			result = flagValue != eventCheck.target;
			break;
		default:
			result = false;
		}
	}
	// Determine next event based on result
	const nextEventId = result ? eventCheck?.event_if_true : eventCheck?.event_if_false;
	if (nextEventId && nextEventId !== 'end') {
		await handleEvent(nextEventId, interaction, flags, characterId, ephemeral);
	}
}

let getEventBase = async (eventId) => {
	return await EventBase.findOne({
		where: {
			id: eventId,
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
			resolution_id: resolutionId,
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

// Helper function to update flags based on eventFlag
function updateFlagsFromEventFlags(eventFlags, flags, selectedResolutionId = null) {
	if (!eventFlags || eventFlags.length === 0) return;

	eventFlags.forEach(flag => {
		// Check if this flag applies to the current selection (0 means applies to all, or specific resolution)
		if (flag.resolution_id == 0 || flag.resolution_id == selectedResolutionId) {
			let targetFlags;

			if (flag.external === false) {
				// LocalFlag
				targetFlags = flags.LocalFlag;
			}
			else if (flag.external === true && flag.global === true) {
				// GlobalFlag
				targetFlags = flags.GlobalFlag;
			}
			else {
				// CharFlag (default case)
				targetFlags = flags.CharFlag;
			}

			if (flag.method === 'set') {
				targetFlags[flag.flag] = flag.amount;
			}
			else {
				if (targetFlags[flag.flag] == null) {
					targetFlags[flag.flag] = 0;
				}
				targetFlags[flag.flag] += flag.amount;
			}
		}
	});
}

// Helper to determine if a resolution option should be shown
async function shouldShowResolutionOption(check, characterId = null, flags = null) {
	if (!check) return true;
	const flagName = check.flag;
	let showOption = true;
	let flagValue;

	if (check.check_source === 'LocalFlag') {
		// LocalFlag should be searched in the flags collection
		if (flags && flags.LocalFlag) {
			showOption = Object.prototype.hasOwnProperty.call(flags.LocalFlag, flagName);
			flagValue = flags.LocalFlag[flagName] || 0;
		}
		else {
			showOption = false;
			flagValue = 0;
		}
	}
	else if (check.check_source === 'GlobalFlag') {
		const globalFlagRow = await GlobalFlag.findOne({ where: { flag: flagName } });
		showOption = !!globalFlagRow;
		flagValue = globalFlagRow ? globalFlagRow.value : 0;
	}
	else if (check.check_source === 'CharFlag') {
		if (!characterId) {
			showOption = false;
			flagValue = 0;
		}
		else {
			const charFlagRow = await CharacterFlag.findOne({ where: { character_id: characterId, flag: flagName } });
			showOption = !!charFlagRow;
			flagValue = charFlagRow ? charFlagRow.value : 0;
		}
	}
	else {
		// fallback to previous logic - assume GlobalFlag
		const globalFlagRow = await GlobalFlag.findOne({ where: { flag: flagName } });
		showOption = !!globalFlagRow;
		flagValue = globalFlagRow ? globalFlagRow.value : 0;
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

async function handleEvent(eventId, interaction, flags = { LocalFlag: {}, CharFlag: {}, GlobalFlag: {} }, characterId = null, ephemeral = true) {
	// Fetch event base for embed details
	const eventBase = await interaction.client.eventUtil.getEventBase(eventId);
	// If eventBase.check is true, handle check logic and return
	if (eventBase && eventBase.check) {
		await handleEventCheck(eventId, interaction, flags, characterId, ephemeral);
		return;
	}
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

	// Get EventResolutionCheck
	let eventResolutionChecks = await EventResolutionCheck.findAll({ where: { id: eventId } });

	// Build select menu if there are resolutions
	let select = null;
	if (eventResolutions && eventResolutions.length > 0) {
		select = new Discord.StringSelectMenuBuilder()
			.setCustomId('talk_choice')
			.setPlaceholder('Choose your response');

		for (let idx = 0; idx < eventResolutions.length; idx++) {
			const res = eventResolutions[idx];
			const check = eventResolutionChecks.find(c => c.resolution_id == res.resolution_id);
			if (!(await shouldShowResolutionOption(check, characterId, flags))) {
				continue;
			}
			select.addOptions(
				new Discord.StringSelectMenuOptionBuilder()
					.setLabel(`${idx + 1}. ${res.resolution_text}`)
					.setValue(`${res.resolution_id}`),
			);
		}
	}

	// Show select menu or just reply
	if (select) {
		const row = new Discord.ActionRowBuilder().addComponents(select);
		if (!(interaction.replied || interaction.deferred)) {
			await interaction.deferReply({ flags: ephemeral ? Discord.MessageFlags.Ephemeral : undefined });
		}
		await interaction.editReply({ embeds: [embed], components: [row], flags: ephemeral ? Discord.MessageFlags.Ephemeral : undefined });
		const message = await interaction.fetchReply();
		const collector = message.createMessageComponentCollector({
			componentType: Discord.ComponentType.StringSelect,
			time: 3_600_000,
			filter: i => i.user.id === interaction.user.id,
		});
		collector.on('collect', async i => {
			const selected = i.values[0];
			const resolution = await interaction.client.eventUtil.getEventResolutionOne(eventId, selected);

			// Update flags based on eventFlag
			updateFlagsFromEventFlags(eventFlag, flags, selected);

			const nextEventId = resolution && resolution.child_event_id ? resolution.child_event_id : null;
			await interaction.deleteReply();
			if (nextEventId && nextEventId !== 'end') {
				await handleEvent(nextEventId, i, flags, characterId, ephemeral);
			}
			else {
				if (characterId) await updateCharacterFlags(characterId, flags.CharFlag);
				await updateGlobalFlags(flags.GlobalFlag);
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
		if (!(interaction.replied || interaction.deferred)) {
			await interaction.deferReply({ flags: ephemeral ? Discord.MessageFlags.Ephemeral : undefined });
		}
		await interaction.editReply({ embeds: [embed], components: [row], flags: ephemeral ? Discord.MessageFlags.Ephemeral : undefined });
		const message = await interaction.fetchReply();
		const collector = message.createMessageComponentCollector({
			componentType: Discord.ComponentType.Button,
			time: 3_600_000,
			filter: i => i.user.id === interaction.user.id,
		});
		collector.on('collect', async i => {
			// Update flags based on eventFlag (no specific resolution selected)
			updateFlagsFromEventFlags(eventFlag, flags);

			// Use interaction.update for component interactions
			const nextEventBase = await interaction.client.eventUtil.getEventBase(eventId);
			const nextEventId = nextEventBase && nextEventBase.default_child_event_id ? nextEventBase.default_child_event_id : null;
			await interaction.deleteReply();
			if (nextEventId && nextEventId !== 'end') {
				await handleEvent(nextEventId, i, flags, characterId, ephemeral);
			}
			else {
				if (characterId) await updateCharacterFlags(characterId, flags.CharFlag);
				await updateGlobalFlags(flags.GlobalFlag);
				await interaction.deleteReply();
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
