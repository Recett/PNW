const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const {
	CharacterBase,
	LocationInstance,
	LocationSpecialEvent,
	LocationSpecialEventTrigger,
	LocationResourceNodeSpawn,
	LocationEnemySpawn,
	LocationInstanceResourceNode,
	LocationInstanceEnemy,
	ResourceNodeLib,
	EnemyBase,
	EnemyInstance,
	SpecialEventBase,
	SpecialEventOption,
	SpecialEventOptionCheck,
} = require('@root/dbObject.js');
const { v4: uuidv4 } = require('uuid');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('explore')
		.setDescription('Explore deeper into the current location to find resources, enemies, or special events.'),

	async execute(interaction) {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const userId = interaction.user.id;
			const character = await CharacterBase.findOne({ where: { id: userId } });
			if (!character) {
				return await interaction.editReply({ content: 'Character not found. Use `/newchar` to create one.' });
			}

			// Check if registration is incomplete
			const characterUtil = require('@utility/characterUtility.js');
			const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
			if (unregistered === 1) {
				return await interaction.editReply({ content: 'You must complete the registration process before using this command.' });
			}

			// Get current location by channelId
			const channelId = interaction.channelId;
			const locationUtil = interaction.client.locationUtil;
			const currentLocation = await locationUtil.getLocationByChannel(channelId);
			if (!currentLocation) {
				return await interaction.editReply({ content: 'This channel is not mapped to any location.' });
			}

			// Check if location is explorable
			if (!currentLocation.tag || !Array.isArray(currentLocation.tag) || !currentLocation.tag.includes('explorable')) {
				return await interaction.editReply({ content: 'This location cannot be explored further.' });
			}

			// Increase character depth
			const newDepth = (character.depth || 0) + 1;
			await CharacterBase.update({ depth: newDepth }, { where: { id: userId } });

			// Calculate rarity chances based on depth
			const depthBonus = newDepth * 0.5;
			const rarityRoll = Math.random() * 100;

			let targetRarity = 1;
			// Each rarity has a base penalty, requiring depth to overcome
			// Legendary: -6 penalty (needs depth 12+ to appear)
			if (rarityRoll < -6 + (depthBonus * 0.5)) targetRarity = 5;
			// Epic: -4 penalty (needs depth 6+ to appear)
			else if (rarityRoll < -4 + (depthBonus * 0.8)) targetRarity = 4;
			// Rare: -3 penalty (needs depth 3+ to appear)
			else if (rarityRoll < -3 + (depthBonus * 1.2)) targetRarity = 3;
			// Uncommon: -1 penalty (needs depth 2+ to appear)
			else if (rarityRoll < -1 + (depthBonus * 2)) targetRarity = 2;

			// If rarity is not common (> 1), trigger special event instead
			if (targetRarity > 1) {
				return await handleSpecialEvent(interaction, character, currentLocation, targetRarity, newDepth);
			}

			// Generate regular location instance for common rarity
			return await generateLocationInstance(interaction, character, currentLocation, targetRarity, newDepth);

		}
		catch (error) {
			console.error('Error in explore command:', error);
			try {
				if (interaction.deferred) {
					await interaction.editReply({ content: 'An error occurred while exploring.' });
				}
				else {
					await interaction.reply({ content: 'An error occurred while exploring.', flags: MessageFlags.Ephemeral });
				}
			}
			catch (replyError) {
				console.error('Error sending error message:', replyError);
			}
		}
	},
};

async function handleSpecialEvent(interaction, character, location, targetRarity, depth) {
	// Try to find events starting from target rarity, cascading down to lower rarities
	let selectedEvent = null;
	let actualRarity = targetRarity;

	for (let rarity = targetRarity; rarity >= 2 && !selectedEvent; rarity--) {
		// Find available special events for this rarity level
		const specialEvents = await LocationSpecialEvent.findAll({
			where: {
				location_id: location.id,
				rarity: rarity,
			},
			include: [{
				model: SpecialEventBase,
				as: 'specialEvent',
				include: [{
					model: SpecialEventOption,
					as: 'options',
					include: [{ model: SpecialEventOptionCheck, as: 'checks' }],
				}],
			}],
		});

		if (specialEvents.length === 0) continue;

		// Filter by existing triggers (no restrictions)
		const validEvents = [];
		for (const specialEvent of specialEvents) {
			validEvents.push(specialEvent);
		}

		if (validEvents.length > 0) {
			// Select random event from valid events
			selectedEvent = validEvents[Math.floor(Math.random() * validEvents.length)];
			actualRarity = rarity;
			break;
		}
	}

	if (!selectedEvent) {
		// No special events available at any rarity, fall back to regular instance
		return await generateLocationInstance(interaction, character, location, targetRarity, depth);
	}

	// If this is a check event, process it in the background and proceed to the result event
	if (selectedEvent.specialEvent.check) {
		const resultEvent = await processSpecialEventCheck(character, selectedEvent.specialEvent);
		if (resultEvent) {
			// Find the result event in the same location
			const resultSpecialEvent = await LocationSpecialEvent.findOne({
				where: {
					location_id: location.id,
					special_event_id: resultEvent,
				},
				include: [{
					model: SpecialEventBase,
					as: 'specialEvent',
					include: [{
						model: SpecialEventOption,
						as: 'options',
						include: [{ model: SpecialEventOptionCheck, as: 'checks' }],
					}],
				}],
			});

			if (resultSpecialEvent) {
				selectedEvent = resultSpecialEvent;
			}
		}
	}

	// Record this trigger occurrence
	await LocationSpecialEventTrigger.create({
		character_id: character.id,
		location_id: location.id,
		special_event_id: selectedEvent.specialEvent.id,
		triggered_at: new Date(),
		instance_id: null,
	});

	// Create embed for special event
	const embed = new EmbedBuilder()
		.setTitle('🌟 Special Event Discovered!')
		.setDescription(`**${selectedEvent.specialEvent.title || selectedEvent.specialEvent.name}**\n\n${selectedEvent.specialEvent.text || selectedEvent.specialEvent.description}`)
		.addFields(
			{ name: 'Depth', value: `${depth}`, inline: true },
			{ name: 'Rarity', value: getRarityName(actualRarity), inline: true },
		)
		.setColor(getRarityColor(actualRarity))
		.setFooter({ text: `Event ID: ${selectedEvent.specialEvent.id}` });

	// Add available options if they exist
	if (selectedEvent.specialEvent.options && selectedEvent.specialEvent.options.length > 0) {
		const availableOptions = [];

		for (const option of selectedEvent.specialEvent.options) {
			if (!option.is_active) continue;

			if (!option.is_active) continue;

			// Check if this option is available to the character
			const isAvailable = await checkOptionAvailability(character, option);
			if (isAvailable) {
				availableOptions.push(option);
			}
		}

		if (availableOptions.length > 0) {
			const optionList = availableOptions
				.map((opt, index) => `${index + 1}. **${opt.name}** - ${opt.description}`)
				.join('\n');

			embed.addFields({ name: 'Available Actions', value: optionList, inline: false });
		}
		else {
			embed.addFields({ name: 'Available Actions', value: 'No actions are currently available to you.', inline: false });
		}
	}

	return await interaction.editReply({ embeds: [embed] });
}

async function generateLocationInstance(interaction, character, location, targetRarity, depth) {
	// Check if character already has an instance for this location
	let instance = await LocationInstance.findOne({
		where: {
			character_id: character.id,
			base_location_id: location.id,
		},
	});

	// Create new instance if none exists
	if (!instance) {
		instance = await LocationInstance.create({
			id: uuidv4(),
			base_location_id: location.id,
			character_id: character.id,
			instance_name: `${location.name} - Depth ${depth}`,
			seed_value: Math.random().toString(36),
			created_at: new Date(),
			last_accessed: new Date(),
		});
	}
	else {
		// Update existing instance
		await instance.update({
			last_accessed: new Date(),
			instance_name: `${location.name} - Depth ${depth}`,
		});
	}

	// Generate content based on spawn templates and rarity
	const resourceSpawns = await LocationResourceNodeSpawn.findAll({
		where: {
			location_id: location.id,
			rarity: { [require('sequelize').Op.lte]: targetRarity },
		},
		include: [{ model: ResourceNodeLib, as: 'resourceNodeTemplate' }],
	});

	const enemySpawns = await LocationEnemySpawn.findAll({
		where: {
			location_id: location.id,
			rarity: { [require('sequelize').Op.lte]: targetRarity },
		},
		include: [{ model: EnemyBase, as: 'enemyTemplate' }],
	});

	// Clear existing instance content to regenerate
	await LocationInstanceResourceNode.destroy({ where: { instance_id: instance.id } });
	await LocationInstanceEnemy.destroy({ where: { instance_id: instance.id } });

	const generatedContent = [];

	// Generate resource nodes
	for (const spawn of resourceSpawns) {
		if (Math.random() * 100 < spawn.spawn_chance) {
			const count = Math.floor(Math.random() * (spawn.max_count - spawn.min_count + 1)) + spawn.min_count;

			for (let i = 0; i < count; i++) {
				await LocationInstanceResourceNode.create({
					instance_id: instance.id,
					resource_node_lib_id: spawn.resource_node_lib_id,
					current_yield: spawn.resourceNodeTemplate.max_yield,
					max_yield: spawn.resourceNodeTemplate.max_yield,
					position_x: Math.random() * 100,
					position_y: Math.random() * 100,
				});
			}

			generatedContent.push(`${count}x ${spawn.resourceNodeTemplate.name} (${getRarityName(spawn.rarity)})`);
		}
	}

	// Generate enemies
	for (const spawn of enemySpawns) {
		if (Math.random() * 100 < spawn.spawn_chance) {
			const count = Math.floor(Math.random() * (spawn.max_count - spawn.min_count + 1)) + spawn.min_count;

			for (let i = 0; i < count; i++) {
				// Create enemy instance
				const enemyInstance = await EnemyInstance.create({
					enemy_base_id: spawn.enemy_base_id,
					current_health: 100,
					is_alive: true,
					created_at: new Date(),
				});

				await LocationInstanceEnemy.create({
					instance_id: instance.id,
					enemy_instance_id: enemyInstance.id,
					position_x: Math.random() * 100,
					position_y: Math.random() * 100,
					is_boss: spawn.is_boss,
				});
			}

			const bossText = spawn.is_boss ? ' (Boss)' : '';
			generatedContent.push(`${count}x ${spawn.enemyTemplate.name}${bossText} (${getRarityName(spawn.rarity)})`);
		}
	}

	// Create result embed
	const embed = new EmbedBuilder()
		.setTitle('🗺️ Exploration Complete!')
		.setDescription(`**Depth ${depth}** - You've ventured deeper into ${location.name}`)
		.addFields(
			{ name: 'Target Rarity', value: getRarityName(targetRarity), inline: true },
			{ name: 'Your Depth', value: `${depth}`, inline: true },
			{ name: 'Instance ID', value: instance.id.slice(0, 8), inline: true },
		)
		.setColor(getRarityColor(targetRarity));

	if (generatedContent.length > 0) {
		embed.addFields({ name: 'Generated Content', value: generatedContent.join('\n'), inline: false });
	}
	else {
		embed.addFields({ name: 'Generated Content', value: 'No special content generated this time.', inline: false });
	}

	embed.setFooter({ text: 'Use other commands to interact with the generated content.' });

	return await interaction.editReply({ embeds: [embed] });
}

function getRarityName(rarity) {
	switch (rarity) {
	case 1: return '⚪ Common';
	case 2: return '🟢 Uncommon';
	case 3: return '🔵 Rare';
	case 4: return '🟣 Epic';
	case 5: return '🟡 Legendary';
	default: return '⚪ Common';
	}
}

function getRarityColor(rarity) {
	switch (rarity) {
	case 1: return 0x808080;
	case 2: return 0x00FF00;
	case 3: return 0x0080FF;
	case 4: return 0x8000FF;
	case 5: return 0xFFD700;
	default: return 0x808080;
	}
}

async function checkOptionAvailability(character, option) {
	// If no checks are defined, the option is always available
	if (!option.checks || option.checks.length === 0) {
		return true;
	}

	// Load character data needed for checks
	const { CharacterFlag, CharacterCombatStat, CharacterItem, CharacterSkill } = require('@root/dbObject.js');

	for (const check of option.checks) {
		switch (check.check_type) {
		case 'stat': {
			// Check character combat stats
			const stat = await CharacterCombatStat.findOne({
				where: { character_id: character.id, stat_name: check.target_stat },
			});
			if (!stat || stat.stat_value < check.minimum_value) {
				return false;
			}
			break;
		}

		case 'skill': {
			// Check character skills
			const skill = await CharacterSkill.findOne({
				where: { character_id: character.id, skill_name: check.target_stat },
			});
			if (!skill || skill.skill_level < check.minimum_value) {
				return false;
			}
			break;
		}

		case 'flag': {
			// Check required flags
			if (check.required_flag) {
				const flag = await CharacterFlag.findOne({
					where: { character_id: character.id, flag_name: check.required_flag },
				});
				if (!flag || (check.required_flag_value && flag.flag_value !== check.required_flag_value)) {
					return false;
				}
			}

			// Check forbidden flags
			if (check.forbidden_flag) {
				const flag = await CharacterFlag.findOne({
					where: { character_id: character.id, flag_name: check.forbidden_flag },
				});
				if (flag && (!check.forbidden_flag_value || flag.flag_value === check.forbidden_flag_value)) {
					return false;
				}
			}
			break;
		}

		case 'item': {
			// Check required items
			if (check.required_item) {
				const item = await CharacterItem.findOne({
					where: { character_id: character.id, item_name: check.required_item },
				});
				if (!item || item.item_count < check.required_quantity) {
					return false;
				}
			}
			break;
		}

		default:
			// Unknown check type, assume it passes
			continue;
		}
	}

	return true;
}

async function processSpecialEventCheck(character, specialEvent) {
	// Load event checks (using standard EventCheck for special events too)
	const { EventCheck } = require('@root/dbObject.js');

	const checks = await EventCheck.findAll({
		where: { event_id: specialEvent.id },
	});

	if (checks.length === 0) {
		return specialEvent.default_child_event_id;
	}

	// Process each check
	for (const check of checks) {
		const checkResult = await performCheck(character, check);

		// Return the appropriate result event based on check outcome
		if (checkResult) {
			return check.event_if_true;
		}
		else {
			return check.event_if_false;
		}
	}

	return specialEvent.default_child_event_id;
}

async function performCheck(character, check) {
	const { CharacterCombatStat, CharacterSkill } = require('@root/dbObject.js');

	let checkValue = 0;

	// Get the character's stat/skill value
	switch (check.check_source) {
	case 'character': {
		if (check.check_type === 'stealth' || check.check_type === 'dexterity') {
			const stat = await CharacterCombatStat.findOne({
				where: { character_id: character.id, stat_name: 'dexterity' },
			});
			checkValue = stat ? stat.stat_value : 10;
		}
		else {
			const stat = await CharacterCombatStat.findOne({
				where: { character_id: character.id, stat_name: check.check_type },
			});
			checkValue = stat ? stat.stat_value : 10;
		}
		break;
	}
	case 'skill': {
		const skill = await CharacterSkill.findOne({
			where: { character_id: character.id, skill_name: check.check_type },
		});
		checkValue = skill ? skill.skill_level : 0;
		break;
	}
	default:
		checkValue = check.check_value || 10;
	}

	// Apply difficulty modifier
	checkValue += check.difficulty_mod;

	// Perform roll if required
	if (check.roll) {
		const roll = Math.floor(Math.random() * 20) + 1;
		checkValue += roll;
	}

	// Compare against target
	return checkValue >= check.target;
}
