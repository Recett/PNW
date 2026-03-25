const {
	SlashCommandBuilder,
	InteractionContextType,
	MessageFlags,
	EmbedBuilder,
	StringSelectMenuBuilder,
	ActionRowBuilder,
	ComponentType,
} = require('discord.js');
const { Op } = require('sequelize');
const {
	CharacterBase,
	CharacterFlag,
	LocationBase,
	LocationLink,
	LocationCluster,
	LocationInstance,
	LocationResourceNodeSpawn,
	LocationEnemySpawn,
	LocationInstanceResourceNode,
	LocationInstanceEnemy,
	EnemyInstance,
} = require('@root/dbObject.js');
const contentStore = require('@root/contentStore.js');
const characterUtil = require('@utility/characterUtility.js');
const { v4: uuidv4 } = require('uuid');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('interact')
		.setDescription('Interact with your environment.')
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(sub =>
			sub.setName('look')
				.setDescription('Look around your current location.'),
		)
		.addSubcommand(sub =>
			sub.setName('move')
				.setDescription('Travel to another location.'),
		)
		.addSubcommand(sub =>
			sub.setName('talk')
				.setDescription('Talk with an NPC.'),
		)
		.addSubcommand(sub =>
			sub.setName('explore')
				.setDescription('Explore deeper into the current location.'),
		),

	async execute(interaction) {
		try {
			const sub = interaction.options.getSubcommand();
			const userId = interaction.user.id;

			if (sub === 'look') await handleLook(interaction, userId);
			else if (sub === 'move') await handleMove(interaction, userId);
			else if (sub === 'talk') await handleTalk(interaction, userId);
			else if (sub === 'explore') await handleExplore(interaction, userId);
		}
		catch (error) {
			console.error('Error in interact command:', error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
			}
			else {
				await interaction.editReply({ content: 'An error occurred.' }).catch(() => {});
			}
		}
	},
};

// ─── Look ─────────────────────────────────────────────────────────────────────
async function handleLook(interaction, userId) {
	const channel = interaction.channel;
	const channelId = channel.isThread() ? channel.parentId : interaction.channelId;
	const currentLocation = await interaction.client.locationUtil.getLocationByChannel(channelId);
	if (!currentLocation) {
		return interaction.reply({ content: 'This channel is not mapped to any location.', flags: MessageFlags.Ephemeral });
	}

	let description = `${currentLocation.description}`;
	const locationUtil = interaction.client.locationUtil;
	const { objects, pcs, npcs, enemies } = await locationUtil.getLocationContents(currentLocation.id);

	if (objects.length > 0) {
		description += `\n\n**Objects:** ${objects.map(obj => obj.name).join(', ')}`;
	}
	if (pcs.length > 0) {
		description += `\n\n**Characters:** ${pcs.map(pc => pc.id ? `<@${pc.id}>` : pc.name).join(', ')}`;
	}
	if (npcs.length > 0) {
		const npcKnownFlags = npcs.map(npc => `${npc.id}_known`);
		const flags = await CharacterFlag.findAll({
			where: { character_id: userId, flag: { [Op.in]: npcKnownFlags } },
		});
		const flagMap = {};
		flags.forEach(f => { flagMap[f.flag] = f.value; });
		description += `\n\n**NPCs:** ${npcs.map(npc => {
			const knownFlag = flagMap[`${npc.id}_known`];
			return (!knownFlag || knownFlag === false || knownFlag === 0) && npc.unknown_name ? npc.unknown_name : npc.name;
		}).join(', ')}`;
	}
	if (enemies.length > 0) {
		description += `\n\n**Enemies:** ${enemies.map(enemy => enemy.name).join(', ')}`;
	}

	const embed = new EmbedBuilder().setTitle(currentLocation.name).setDescription(description);
	await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ─── Move ─────────────────────────────────────────────────────────────────────
async function handleMove(interaction, userId) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const character = await CharacterBase.findOne({ where: { id: userId } });
	if (!character) return await interaction.editReply({ content: 'Character not found.' });

	const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
	if (unregistered === 1) return await interaction.editReply({ content: 'You must complete the registration process before using this command.' });

	// Clean up excess location roles
	try {
		const member = await interaction.guild.members.fetch(userId);
		const allLocations = await LocationBase.findAll();
		const dbLocation = character.location_id ? await LocationBase.findByPk(character.location_id) : null;
		const currentRoleId = dbLocation?.role;
		const locationRoleIds = allLocations.map(loc => loc.role).filter(role => role && role !== currentRoleId);
		console.log(`[Move Cleanup] User ${userId} - DB location: ${dbLocation?.name || 'NONE'}, keeping role: ${currentRoleId || 'NONE'}`);
		for (const roleId of locationRoleIds) {
			if (member.roles.cache.has(roleId)) {
				console.log(`[Move Cleanup] Removing excess role: ${roleId}`);
				await member.roles.remove(roleId).catch(() => {});
			}
		}
	}
	catch (cleanupErr) { console.error('Error cleaning up location roles:', cleanupErr); }

	const channel = interaction.channel;
	const channelId = channel.isThread() ? channel.parentId : interaction.channelId;
	const locationUtil = interaction.client.locationUtil;
	let currentLocation = await locationUtil.getLocationByChannel(channelId);
	if (!currentLocation && character.location_id) {
		currentLocation = await LocationBase.findByPk(character.location_id);
	}
	if (!currentLocation) return await interaction.editReply({ content: 'Unable to determine your current location.' });

	const linkedRecords = await LocationLink.findAll({ where: { location_id: currentLocation.id } });
	const linkedIds = linkedRecords.map(r => String(r.linked_location_id));

	let clusterIds = [];
	const clusterEntry = await LocationCluster.findOne({ where: { location_id: currentLocation.id } });
	if (clusterEntry) {
		const clusterLocs = await LocationCluster.findAll({ where: { cluster_id: clusterEntry.cluster_id } });
		clusterIds = clusterLocs.map(l => String(l.location_id)).filter(id => id != character.location_id);
	}

	const allLinkedIds = Array.from(new Set([...linkedIds, ...clusterIds])).filter(id => id != character.location_id);
	if (allLinkedIds.length === 0) return await interaction.editReply({ content: 'There are no available locations to move to from here.' });

	const locations = (await Promise.all(allLinkedIds.map(id => LocationBase.findByPk(id)))).filter(loc => loc != null);
	const select = new StringSelectMenuBuilder()
		.setCustomId('move_location')
		.setPlaceholder('Choose a location to move to')
		.addOptions(locations.map(loc => ({ label: loc.name, value: String(loc.id) })));
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
		const { newLocation } = await interaction.client.locationUtil.transitionLocationRoles({
			guild: interaction.guild,
			memberId: userId,
			newLocationId: selectedId,
			delayMs: 5000,
		});
		let replyContent = `You traveled to **${newLocation?.name || 'the new location'}**!`;
		if (newLocation?.channel) replyContent += ` Head over to <#${newLocation.channel}>`;
		await i.reply({ content: replyContent, flags: MessageFlags.Ephemeral });
	});
}

// ─── Talk ─────────────────────────────────────────────────────────────────────
async function handleTalk(interaction, userId) {
	const character = await CharacterBase.findOne({ where: { id: userId } });
	if (!character) return interaction.reply({ content: 'Character not found.', flags: MessageFlags.Ephemeral });

	const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
	if (unregistered === 1) return interaction.reply({ content: 'You must complete the registration process before using this command.', flags: MessageFlags.Ephemeral });

	const channel = interaction.channel;
	const channelId = channel.isThread() ? channel.parentId : interaction.channelId;
	const locationUtil = interaction.client.locationUtil;
	const currentLocation = await locationUtil.getLocationByChannel(channelId);
	if (!currentLocation) return interaction.reply({ content: 'This channel is not mapped to any location.', flags: MessageFlags.Ephemeral });

	const { npcs } = await locationUtil.getLocationContents(currentLocation.id);
	if (!npcs || npcs.length === 0) return interaction.reply({ content: 'There are no NPCs to talk to here.', flags: MessageFlags.Ephemeral });

	const npcKnownFlags = npcs.map(npc => `${npc.id}_known`);
	const flags = await CharacterFlag.findAll({
		where: { character_id: userId, flag: { [Op.in]: npcKnownFlags } },
	});
	const flagMap = {};
	flags.forEach(f => { flagMap[f.flag] = f.value; });

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
	await interaction.editReply({ content: 'Who do you want to talk to?', components: [row] });

	const message = (await interaction.fetchReply()) || interaction.message;
	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.StringSelect,
		time: 60000,
		filter: i => i.user.id === userId,
	});

	collector.on('collect', async i => {
		try {
			const npcId = i.values[0];
			const npc = contentStore.npcs.findByPk(npcId);
			await interaction.deleteReply();

			if (!npc) return i.reply({ content: 'NPC not found.', flags: MessageFlags.Ephemeral });
			if (!npc.start_event) return i.reply({ content: 'This NPC has nothing to say.', flags: MessageFlags.Ephemeral });

			const eventUtil = interaction.client.eventUtil;
			const eventResult = await eventUtil.processEvent(
				npc.start_event,
				i,
				userId,
				{ metadata: { npcId: npc.id, npcName: npc.name }, ephemeral: false },
			);

			if (eventResult.success) {
				console.log(`Dialogue started. Session: ${eventResult.sessionId}`);
			}
			else {
				console.warn('Event processing failed:', eventResult);
			}
		}
		catch (error) {
			console.error('Error in NPC dialogue:', error);
			if (!i.replied && !i.deferred) {
				await i.reply({ content: 'An error occurred while talking to the NPC.', flags: MessageFlags.Ephemeral });
			}
		}
	});

	collector.on('end', async () => {
		try {
			if (!interaction.replied) return;
			await interaction.editReply({ content: 'NPC selection timed out.', components: [] });
		}
		catch (error) { console.log('Could not update expired NPC selection:', error.message); }
	});
}

// ─── Explore ──────────────────────────────────────────────────────────────────
async function handleExplore(interaction, userId) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const character = await CharacterBase.findOne({ where: { id: userId } });
	if (!character) return await interaction.editReply({ content: 'Character not found. Use `/register` to create one.' });

	const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
	if (unregistered === 1) return await interaction.editReply({ content: 'You must complete the registration process before using this command.' });

	const channel = interaction.channel;
	const channelId = channel.isThread() ? channel.parentId : interaction.channelId;
	const locationUtil = interaction.client.locationUtil;
	const currentLocation = await locationUtil.getLocationByChannel(channelId);
	if (!currentLocation) return await interaction.editReply({ content: 'This channel is not mapped to any location.' });

	if (!currentLocation.tag || !Array.isArray(currentLocation.tag) || !currentLocation.tag.includes('explorable')) {
		return await interaction.editReply({ content: 'This location cannot be explored further.' });
	}

	const newDepth = (character.depth || 0) + 1;
	await CharacterBase.update({ depth: newDepth }, { where: { id: userId } });

	const depthBonus = newDepth * 0.5;
	const rarityRoll = Math.random() * 100;
	let targetRarity = 1;
	if (rarityRoll < -6 + (depthBonus * 0.5)) targetRarity = 5;
	else if (rarityRoll < -4 + (depthBonus * 0.8)) targetRarity = 4;
	else if (rarityRoll < -3 + (depthBonus * 1.2)) targetRarity = 3;
	else if (rarityRoll < -1 + (depthBonus * 2)) targetRarity = 2;

	return await generateLocationInstance(interaction, character, currentLocation, targetRarity, newDepth);
}

async function generateLocationInstance(interaction, character, location, targetRarity, depth) {
	let instance = await LocationInstance.findOne({
		where: { character_id: character.id, base_location_id: location.id },
	});

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
		await instance.update({ last_accessed: new Date(), instance_name: `${location.name} - Depth ${depth}` });
	}

	const resourceSpawns = (await LocationResourceNodeSpawn.findAll({
		where: { location_id: location.id, rarity: { [Op.lte]: targetRarity } },
	})).map(spawn => ({
		...spawn.get({ plain: true }),
		resourceNodeTemplate: contentStore.resourceNodes.findByPk(String(spawn.resource_node_lib_id)),
	}));

	const enemySpawns = (await LocationEnemySpawn.findAll({
		where: { location_id: location.id, rarity: { [Op.lte]: targetRarity } },
	})).map(spawn => ({
		...spawn.get({ plain: true }),
		enemyTemplate: contentStore.enemies.findByPk(String(spawn.enemy_base_id)),
	}));

	await LocationInstanceResourceNode.destroy({ where: { instance_id: instance.id } });
	await LocationInstanceEnemy.destroy({ where: { instance_id: instance.id } });

	const generatedContent = [];

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

	for (const spawn of enemySpawns) {
		if (Math.random() * 100 < spawn.spawn_chance) {
			const count = Math.floor(Math.random() * (spawn.max_count - spawn.min_count + 1)) + spawn.min_count;
			for (let i = 0; i < count; i++) {
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
