const { SlashCommandBuilder} = require('discord.js');
const Discord = require('discord.js');
const { CharacterBase } = require('@root/dbObject.js');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('newchar')
		.setDescription('Your journey begin'),
	async execute(interaction) {
		eventId = 'prologue_1';

		let first = true;
		let flags = [];

		eventHandler(eventId, interaction, first, flags);
		// Ask for name

		// Summarizing character

		// let maxhp = con * 20 + 100;
		// let maxstamina = con * 2 + 10;
/*		const character = {
			fullname = fullname,
			name = name,
			currentHp = maxHp,
			maxHp = maxHp,
			currentStamina = currentStamina,
			maxStamina = maxStamina,
			str = flag['str'],
			dex = flag['dex'],
			agi = flag['agi'],
			con = flag['con'],
		}*/

		/*	
		const characterEquipment = {
			fullname = fullname,
			name = name,
			nickname = nickname,
			currentHp = maxHp,
			maxHp = maxHp,
			currentStamina = currentStamina,
			maxStamina = maxStamina,
			str = str,
			dex = dex,
			agi = agi,
			con = con,
		}*/

		//To DB
/*		try {
			if (eventBase != null) {
				// equivalent to: INSERT INTO tags (name, description, username) values (?, ?, ?);
				const newEvent = await CharacterBase.create({
					fullname = fullname,
					name = name,
					currentHp = maxHp,
					maxHp = maxHp,
					currentStamina = maxStamina,
					maxStamina = maxStamina,
					str = str,
					dex = dex,
					agi = agi,
					con = con,
				});
				return interaction.reply(`Event ${newEvent.eventId} added.`);
			}
		}
		catch (error) {
			if (error.name === 'SequelizeUniqueConstraintError') {
				return interaction.reply('That tag already exists.');
			}

			return interaction.reply('Something went wrong.');
		}*/
	},
};

async function eventHandler(eventId, interaction, first, flags) {
	const collectorFilter = i => i.user.id === interaction.user.id;
	const eventBase = await interaction.client.eventUtil.getEventBase(eventId);
	const eventResolutions = await interaction.client.eventUtil.getEventResolution(eventId);
	const eventFlag = await interaction.client.eventUtil.getEventFlag(eventId);
	// Display event text
	const embed = { description: eventBase.event_text };
	let child_eventId;
	// Action Row
	const select = new Discord.StringSelectMenuBuilder()
		.setCustomId('starter')
		.setPlaceholder(eventBase.choose_placeholder != null ? eventBase.choose_placeholder : 'Choose carefully');
	let count = 0;
	console.log(`${count}`);
	eventResolutions.forEach(function(resolution) {
	   count += 1;
	   select.addOptions(
			new Discord.StringSelectMenuOptionBuilder()
				.setLabel(`${count}`)
				.setDescription(`. ${resolution.resolution_text}`)
				.setValue(`${resolution.resolution_id}`),
		);
	});

	const choose = new Discord.ButtonBuilder()
		.setCustomId('choose')
		.setLabel('Choose')
		.setStyle(Discord.ButtonStyle.Success);

	const row = new Discord.ActionRowBuilder()
		.addComponents(select);

	if (first) {
		let response = await interaction.reply({ embeds: [embed], components: [row], withResponse: true });
		first = false;
	}

	try {
		const choice = await response.resource.message.awaitMessageComponent({ filter: collectorFilter });
		child_eventId = interaction.values[0];
		// Update Flag
		eventFlag.forEach(function(flag) {
		   if (flag.resolution_id == 0 || flag.resolution_id == child_eventId) {
		   		if (flag.set != null) {
		   			flags[flag.flag_id] = flag.set;
		   		}
				else {
		   			flags[flag.flag_id] += flag.add;
		   		}
		   }
		});

		if (!first) {
			await choice.update({ embeds: [embed], components: [row], withResponse: true });
		}

		// Update Flag
		eventFlag.forEach(function(flag) {
		   if (flag.resolution_id == 0 || flag.resolution_id == child_eventId) {
		   		if (flag.set != null) {
		   			flags[flag.flag_id] = flag.set;
		   		}
		   		else {
		   			flags[flag.flag_id] += flag.add;
		   		}
		   }
		});

		// Get ChildEvent
		if (child_eventId != 'end') {
			eventHandler(childEventId, interaction, first);
		}
	}
	catch {
		// TODO
	}

}