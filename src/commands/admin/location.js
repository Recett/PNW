const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { LocationBase, LocationContain, LocationLink } = require('@root/dbObject.js');
const locationUtil = require('@utility/locationUtility.js');
const contentStore = require('@root/contentStore.js');
const gamecon = require('@root/Data/gamecon.json');

// Helper to create a role
async function createLocationRole(guild, name) {
	return guild.roles.create({
		name,
		mentionable: true,
	});
}

// Helper to create a channel
async function createLocationChannel(guild, channelName, parentId, permissionOverwrites) {
	return guild.channels.create({
		name: channelName,
		parent: parentId,
		permissionOverwrites,
	});
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('location')
		.setDescription('Location management commands')
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(subcommand =>
			subcommand
				.setName('new')
				.setDescription('Create a new location')
				.addStringOption(option =>
					option
						.setName('name')
						.setDescription('Location Name')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('edit')
				.setDescription('Edit location data for the current channel')
				.addStringOption(option =>
					option.setName('name')
						.setDescription('New name for the location')
						.setRequired(false))
				.addStringOption(option =>
					option.setName('type')
						.setDescription('Type of the location (affects HP/stamina regen eligibility)')
						.setRequired(false)
						.addChoices(
							{ name: 'Town (HP/stamina regen)', value: 'town' },
							{ name: 'Dungeon', value: 'dungeon' },
							{ name: 'Field', value: 'field' },
							{ name: 'None (clear type)', value: 'none' },
						))
				.addBooleanOption(option =>
					option.setName('lock')
						.setDescription('Lock or unlock the location')
						.setRequired(false))
				.addBooleanOption(option =>
					option.setName('hidden')
						.setDescription('Hide or show the location in move command')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('sync')
				.setDescription('Sync locations - create missing channels and roles, update database'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('lock')
				.setDescription('Lock the current location'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('unlock')
				.setDescription('Unlock the current location'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('hide')
				.setDescription('Hide the current location from the move command'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('unhide')
				.setDescription('Make the current location visible in the move command'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('addnpc')
				.setDescription('Add an NPC to a location')
				.addStringOption(option =>
					option
						.setName('npc_id')
						.setDescription('NPC ID from content store')
						.setRequired(true))
				.addStringOption(option =>
					option
						.setName('location_id')
						.setDescription('Location ID (defaults to current channel location)')
						.setRequired(false))
				.addStringOption(option =>
					option
						.setName('time')
						.setDescription('Optional time restriction for the NPC')
						.setRequired(false)
						.addChoices(
							{ name: 'Morning', value: 'morning' },
							{ name: 'Afternoon', value: 'afternoon' },
							{ name: 'Night', value: 'night' },
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('addobject')
				.setDescription('Add an interactable object to a location')
				.addStringOption(option =>
					option
						.setName('object_id')
						.setDescription('Object ID from content store')
						.setRequired(true))
				.addStringOption(option =>
					option
						.setName('location_id')
						.setDescription('Location ID (defaults to current channel location)')
						.setRequired(false))
				.addStringOption(option =>
					option
						.setName('time')
						.setDescription('Optional time restriction for the object')
						.setRequired(false)
						.addChoices(
							{ name: 'Morning', value: 'morning' },
							{ name: 'Afternoon', value: 'afternoon' },
							{ name: 'Night', value: 'night' },
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('removenpc')
				.setDescription('Remove an NPC from a location')
				.addStringOption(option =>
					option
						.setName('npc_id')
						.setDescription('NPC ID to remove')
						.setRequired(true))
				.addStringOption(option =>
					option
						.setName('location_id')
						.setDescription('Location ID (defaults to current channel location)')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('removeobject')
				.setDescription('Remove an object from a location')
				.addStringOption(option =>
					option
						.setName('object_id')
						.setDescription('Object ID to remove')
						.setRequired(true))
				.addStringOption(option =>
					option
						.setName('location_id')
						.setDescription('Location ID (defaults to current channel location)')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('link')
				.setDescription('Add a connection between two locations')
				.addStringOption(option =>
					option
						.setName('to_location')
						.setDescription('Target location ID or name')
						.setRequired(true))
				.addStringOption(option =>
					option
						.setName('from_location')
						.setDescription('Source location ID or name (defaults to current channel)')
						.setRequired(false))
				.addBooleanOption(option =>
					option
						.setName('bidirectional')
						.setDescription('Also add the reverse link (default: true)')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('unlink')
				.setDescription('Remove a connection between two locations')
				.addStringOption(option =>
					option
						.setName('to_location')
						.setDescription('Target location ID or name')
						.setRequired(true))
				.addStringOption(option =>
					option
						.setName('from_location')
						.setDescription('Source location ID or name (defaults to current channel)')
						.setRequired(false))
				.addBooleanOption(option =>
					option
						.setName('bidirectional')
						.setDescription('Also remove the reverse link (default: true)')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('duplicate')
				.setDescription('Duplicate a location with a different time of day')
				.addStringOption(option =>
					option
						.setName('location')
						.setDescription('Location ID or name to duplicate')
						.setRequired(true))
				.addStringOption(option =>
					option
						.setName('time')
						.setDescription('Time of day for the new version')
						.setRequired(true)
						.addChoices(
							{ name: 'Morning (6am-2pm)', value: 'morning' },
							{ name: 'Afternoon (2pm-10pm)', value: 'afternoon' },
							{ name: 'Night (10pm-6am)', value: 'night' },
						))
				.addStringOption(option =>
					option
						.setName('description')
						.setDescription('Optional: Override description for this time version')
						.setRequired(false))),


	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'new') {
			return this.handleNew(interaction);
		}
		else if (subcommand === 'edit') {
			return this.handleEdit(interaction);
		}
		else if (subcommand === 'sync') {
			return this.handleSync(interaction);
		}
		else if (subcommand === 'lock') {
			return this.handleLock(interaction);
		}
		else if (subcommand === 'unlock') {
			return this.handleUnlock(interaction);
		}
		else if (subcommand === 'duplicate') {
			return this.handleDuplicate(interaction);
		}
		else if (subcommand === 'hide') {
			return this.handleHide(interaction);
		}
		else if (subcommand === 'unhide') {
			return this.handleUnhide(interaction);
		}
		else if (subcommand === 'addnpc') {
			return this.handleAddNpc(interaction);
		}
		else if (subcommand === 'addobject') {
			return this.handleAddObject(interaction);
		}
		else if (subcommand === 'removenpc') {
			return this.handleRemoveNpc(interaction);
		}
		else if (subcommand === 'removeobject') {
			return this.handleRemoveObject(interaction);
		}
		else if (subcommand === 'link') {
			return this.handleLink(interaction);
		}
		else if (subcommand === 'unlink') {
			return this.handleUnlink(interaction);
		}
	},

	/**
	 * Resolve location: use provided location_id, or fall back to current channel's location.
	 */
	async _resolveLocation(interaction, locationIdInput) {
		if (locationIdInput) {
			const loc = await LocationBase.findByPk(locationIdInput);
			if (!loc) {
				const byName = await LocationBase.findOne({ where: { name: locationIdInput } });
				return byName || null;
			}
			return loc;
		}
		return await locationUtil.getLocationByChannel(interaction.channel.id);
	},

	async handleAddNpc(interaction) {
		const npcId = interaction.options.getString('npc_id', true).trim();
		const locationIdInput = interaction.options.getString('location_id');
		const time = interaction.options.getString('time');

		const npc = contentStore.npcs.findByPk(npcId);
		if (!npc) {
			return interaction.reply({ content: `NPC \`${npcId}\` not found in content store.`, flags: MessageFlags.Ephemeral });
		}

		const location = await this._resolveLocation(interaction, locationIdInput);
		if (!location) {
			return interaction.reply({ content: 'No location found. Run this in a location channel or provide a location ID.', flags: MessageFlags.Ephemeral });
		}

		const existing = await LocationContain.findOne({
			where: { location_id: String(location.id), object_id: npcId, type: gamecon.NPC },
		});
		if (existing) {
			return interaction.reply({ content: `NPC \`${npcId}\` is already in **${location.name}**.`, flags: MessageFlags.Ephemeral });
		}

		await LocationContain.create({
			location_id: String(location.id),
			object_id: npcId,
			type: gamecon.NPC,
			time: time || null,
		});

		const embed = new EmbedBuilder()
			.setTitle('NPC Added')
			.setColor(0x00CC66)
			.addFields(
				{ name: 'NPC', value: `${npc.name} (\`${npcId}\`)`, inline: true },
				{ name: 'Location', value: `${location.name} (ID: ${location.id})`, inline: true },
				{ name: 'Time', value: time || 'All times', inline: true },
			);

		return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
	},

	async handleAddObject(interaction) {
		const objectId = interaction.options.getString('object_id', true).trim();
		const locationIdInput = interaction.options.getString('location_id');
		const time = interaction.options.getString('time');

		const obj = contentStore.objects.findByPk(objectId);
		if (!obj) {
			return interaction.reply({ content: `Object \`${objectId}\` not found in content store.`, flags: MessageFlags.Ephemeral });
		}

		const location = await this._resolveLocation(interaction, locationIdInput);
		if (!location) {
			return interaction.reply({ content: 'No location found. Run this in a location channel or provide a location ID.', flags: MessageFlags.Ephemeral });
		}

		const existing = await LocationContain.findOne({
			where: { location_id: String(location.id), object_id: objectId, type: gamecon.OBJECT },
		});
		if (existing) {
			return interaction.reply({ content: `Object \`${objectId}\` is already in **${location.name}**.`, flags: MessageFlags.Ephemeral });
		}

		await LocationContain.create({
			location_id: String(location.id),
			object_id: objectId,
			type: gamecon.OBJECT,
			time: time || null,
		});

		const embed = new EmbedBuilder()
			.setTitle('Object Added')
			.setColor(0x00CC66)
			.addFields(
				{ name: 'Object', value: `${obj.name || objectId} (\`${objectId}\`)`, inline: true },
				{ name: 'Location', value: `${location.name} (ID: ${location.id})`, inline: true },
				{ name: 'Time', value: time || 'All times', inline: true },
			);

		return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
	},

	async handleRemoveNpc(interaction) {
		const npcId = interaction.options.getString('npc_id', true).trim();
		const locationIdInput = interaction.options.getString('location_id');

		const location = await this._resolveLocation(interaction, locationIdInput);
		if (!location) {
			return interaction.reply({ content: 'No location found. Run this in a location channel or provide a location ID.', flags: MessageFlags.Ephemeral });
		}

		const deleted = await LocationContain.destroy({
			where: { location_id: String(location.id), object_id: npcId, type: gamecon.NPC },
		});

		if (deleted === 0) {
			return interaction.reply({ content: `NPC \`${npcId}\` was not found in **${location.name}**.`, flags: MessageFlags.Ephemeral });
		}

		return interaction.reply({ content: `NPC \`${npcId}\` removed from **${location.name}**.`, flags: MessageFlags.Ephemeral });
	},

	async handleRemoveObject(interaction) {
		const objectId = interaction.options.getString('object_id', true).trim();
		const locationIdInput = interaction.options.getString('location_id');

		const location = await this._resolveLocation(interaction, locationIdInput);
		if (!location) {
			return interaction.reply({ content: 'No location found. Run this in a location channel or provide a location ID.', flags: MessageFlags.Ephemeral });
		}

		const deleted = await LocationContain.destroy({
			where: { location_id: String(location.id), object_id: objectId, type: gamecon.OBJECT },
		});

		if (deleted === 0) {
			return interaction.reply({ content: `Object \`${objectId}\` was not found in **${location.name}**.`, flags: MessageFlags.Ephemeral });
		}

		return interaction.reply({ content: `Object \`${objectId}\` removed from **${location.name}**.`, flags: MessageFlags.Ephemeral });
	},

	async handleNew(interaction) {
		let tlg = require('@/data/tlg.json');
		const guild = interaction.client.guilds.resolve(tlg.id);
		const name = interaction.options.getString('name', true);
		const channelName = name.split(/ +/).join('-').toLowerCase();
		let role, channel;
		
		try {
			await interaction.reply({ content: 'Creating location...', flags: MessageFlags.Ephemeral });

			// Create role
			role = await createLocationRole(guild, name);

			// Create channel
			const parentChannel = guild.channels.resolve(tlg.alCat);
			if (!parentChannel) throw new Error('Parent category not found.');
			channel = await createLocationChannel(
				guild,
				channelName,
				tlg.alCat,
				parentChannel.permissionOverwrites.cache,
			);

			// Set permissions for the new role
			await channel.permissionOverwrites.create(role, tlg.permissions.textRole);
		}
		catch (error) {
			// Cleanup if role was created but something failed
			if (role && interaction.client.util.role(interaction.guild, role.id)) {
				await role.delete().catch(() => undefined);
			}
			interaction.client.error(error);
			if (interaction.replied) {
				await interaction.editReply({ content: '...oops, seems like there is an error. Creation incomplete.', flags: MessageFlags.Ephemeral });
				return interaction.followUp(`\u0060\u0060\u0060\n${error}\n\u0060\u0060\u0060`);
			}
			else {
				return interaction.reply({ content: '...oops, seems like there is an error. Creation incomplete.', flags: MessageFlags.Ephemeral });
			}
		}

		const newLocation = {
			name: name,
			channel: channel.id,
			role: role.id,
			lock: false,
			type: 'town',
		};

		await LocationBase.create(newLocation);

		const embed = new EmbedBuilder()
			.setTitle(name)
			.setDescription('Location creation completed. Here are the initial details of the location:');

		await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
	},

	async handleEdit(interaction) {
		const channelId = interaction.channel.id;
		const updates = {};
		const name = interaction.options.getString('name');
		const type = interaction.options.getString('type');
		const lock = interaction.options.getBoolean('lock');
		const hidden = interaction.options.getBoolean('hidden');

		if (name !== null) updates.name = name;
		if (type !== null) updates.type = type === 'none' ? null : type;
		if (lock !== null) updates.lock = lock;
		if (hidden !== null) updates.hidden = hidden;

		if (Object.keys(updates).length === 0) {
			return interaction.reply({ content: 'No fields to update.', flags: MessageFlags.Ephemeral });
		}

		// Find and update the location by channel id
		const [updatedRows] = await LocationBase.update(updates, {
			where: { channel: channelId },
		});

		if (updatedRows === 0) {
			return interaction.reply({ content: 'No location found for this channel.', flags: MessageFlags.Ephemeral });
		}

		await interaction.reply({ content: 'Location updated successfully.', flags: MessageFlags.Ephemeral });
	},

	async handleSync(interaction) {
		const tlg = require('@/data/tlg.json');
		const guild = interaction.client.guilds.resolve(tlg.id);

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		// Find all locations
		const locationsToSync = await LocationBase.findAll();

		if (locationsToSync.length === 0) {
			return interaction.editReply({ content: 'No locations found in database.' });
		}

		const results = {
			success: [],
			failed: [],
		};

		const parentChannel = guild.channels.resolve(tlg.alCat);
		if (!parentChannel) {
			return interaction.editReply({ content: 'Error: Parent category not found. Please check tlg.json configuration.' });
		}

		for (const location of locationsToSync) {
			const locationName = location.name;
			const channelName = locationName.split(/ +/).join('-').toLowerCase();
			let role = null;
			let channel = null;
			let createdRole = false;
			let createdChannel = false;
			let syncedPermissions = false;

			try {
				// Check if role exists, create if missing in DB or Discord
				role = (!location.role || location.role === 0) ? null : guild.roles.resolve(location.role);
				if (!role) {
					role = await createLocationRole(guild, locationName);
					createdRole = true;
				}

				// Check if channel exists, create if missing in DB or Discord
				channel = (!location.channel || location.channel === 0) ? null : guild.channels.resolve(location.channel);
				if (!channel) {
					channel = await createLocationChannel(
						guild,
						channelName,
						tlg.alCat,
						parentChannel.permissionOverwrites.cache,
					);
					createdChannel = true;

					// Set permissions for the role on the new channel
					if (role) {
						await channel.permissionOverwrites.create(role, tlg.permissions.textRole);
					}
				}

				// Sync permissions based on lock status
				if (channel && role) {
					if (location.lock) {
						// Location is locked - remove send message permission
						await channel.permissionOverwrites.edit(role, {
							SendMessages: false,
						});
						syncedPermissions = true;
					}
					else {
						// Location is unlocked - restore default permission
						await channel.permissionOverwrites.edit(role, {
							SendMessages: null,
						});
						syncedPermissions = true;
					}
				}

				// Update database with new IDs
				const updateData = {};
				if (createdRole && role) {
					updateData.role = role.id;
				}
				if (createdChannel && channel) {
					updateData.channel = channel.id;
				}

				if (Object.keys(updateData).length > 0) {
					await location.update(updateData);
				}

				results.success.push({
					name: locationName,
					createdRole,
					createdChannel,
					syncedPermissions,
					locked: location.lock,
					roleId: role?.id,
					channelId: channel?.id,
				});
			}
			catch (error) {
				// Cleanup on failure
				if (createdRole && role) {
					await role.delete().catch(() => undefined);
				}
				if (createdChannel && channel) {
					await channel.delete().catch(() => undefined);
				}

				interaction.client.error(error);
				results.failed.push({
					name: locationName,
					error: error.message,
				});
			}
		}

		// Build result embed
		const embed = new EmbedBuilder()
			.setTitle('Location Sync Results')
			.setColor(results.failed.length === 0 ? 0x00FF00 : 0xFFFF00)
			.setTimestamp();

		if (results.success.length > 0) {
			const successList = results.success.map(s => {
				const actions = [];
				if (s.createdRole) actions.push('role');
				if (s.createdChannel) actions.push('channel');
				if (s.syncedPermissions) actions.push(s.locked ? '🔒 locked' : '🔓 unlocked');
				return `✅ **${s.name}** - ${actions.length > 0 ? actions.join(', ') : 'synced'}`;
			}).join('\n');
			embed.addFields({ name: `Successful (${results.success.length})`, value: successList.substring(0, 1024) });
		}

		if (results.failed.length > 0) {
			const failedList = results.failed.map(f =>
				`❌ **${f.name}** - ${f.error}`,
			).join('\n');
			embed.addFields({ name: `Failed (${results.failed.length})`, value: failedList.substring(0, 1024) });
		}

		embed.setDescription(`Synced ${locationsToSync.length} location(s) - verified channels, roles, and lock permissions.`);

		await interaction.editReply({ embeds: [embed] });
	},

	async handleLock(interaction) {
		const channelId = interaction.channel.id;
		
		// Find the location for this channel
		const location = await LocationBase.findOne({
			where: { channel: channelId },
		});

		if (!location) {
			return interaction.reply({ content: 'No location found for this channel.', flags: MessageFlags.Ephemeral });
		}

		// Show modal to get lock message (even if already locked - allows updating the message)
		const modal = new ModalBuilder()
			.setCustomId(`location_lock_modal_${location.id}`)
			.setTitle('Lock Location');

		const titleInput = new TextInputBuilder()
			.setCustomId('lock_title')
			.setLabel('Title (optional)')
			.setStyle(TextInputStyle.Short)
			.setPlaceholder('Enter a title for the lock message...')
			.setRequired(false)
			.setMaxLength(256);

		const messageInput = new TextInputBuilder()
			.setCustomId('lock_message')
			.setLabel('Lock Message')
			.setStyle(TextInputStyle.Paragraph)
			.setPlaceholder('Enter the message to display when the location is locked...')
			.setRequired(true)
			.setMaxLength(2000);

		modal.addComponents(
			new ActionRowBuilder().addComponents(titleInput),
			new ActionRowBuilder().addComponents(messageInput),
		);

		await interaction.showModal(modal);
	},

	async handleUnlock(interaction) {
		const channelId = interaction.channel.id;
		const guild = interaction.guild;
		
		// Find the location for this channel
		const location = await LocationBase.findOne({
			where: { channel: channelId },
		});

		if (!location) {
			return interaction.reply({ content: 'No location found for this channel.', flags: MessageFlags.Ephemeral });
		}

		if (!location.lock) {
			return interaction.reply({ content: 'This location is not locked.', flags: MessageFlags.Ephemeral });
		}

		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			// Update database - set lock to false
			await location.update({ lock: false });

			// Restore send message permission for the location role
			const channel = guild.channels.resolve(location.channel);
			const role = guild.roles.resolve(location.role);

			if (channel && role) {
				// Reset to default/inherit
				await channel.permissionOverwrites.edit(role, {
					SendMessages: null,
				});
			}

			await interaction.editReply({ content: '✅ Location unlocked successfully.' });
		}
		catch (error) {
			interaction.client.error(error);
			const errorMessage = interaction.deferred
				? { content: 'Error unlocking location.' }
				: { content: 'Error unlocking location.', flags: MessageFlags.Ephemeral };
			
			if (interaction.deferred) {
				await interaction.editReply(errorMessage);
			}
			else {
				await interaction.reply(errorMessage);
			}
		}
	},

	async handleDuplicate(interaction) {
		try {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			const locationInput = interaction.options.getString('location', true);
			const timeOfDay = interaction.options.getString('time', true);
			const customDescription = interaction.options.getString('description', false);

			let sourceLocation;
			if (!isNaN(locationInput)) {
				sourceLocation = await LocationBase.findOne({ where: { id: parseInt(locationInput) } });
			}
			else {
				sourceLocation = await LocationBase.findOne({ where: { name: locationInput } });
			}

			if (!sourceLocation) {
				return await interaction.editReply({ content: `Location not found: ${locationInput}` });
			}

			const existingTimeVersion = await LocationBase.findOne({
				where: { channel: sourceLocation.channel, time: timeOfDay },
			});

			if (existingTimeVersion) {
				return await interaction.editReply({
					content: `A ${timeOfDay} version already exists for this location (ID: ${existingTimeVersion.id}).\nUse /location edit to modify it instead.`,
				});
			}

			const newLocation = await LocationBase.create({
				name: sourceLocation.name,
				channel: sourceLocation.channel,
				description: customDescription || sourceLocation.description,
				type: sourceLocation.type,
				role: sourceLocation.role,
				lock: sourceLocation.lock,
				tag: sourceLocation.tag,
				time: timeOfDay,
			});

			const embed = new EmbedBuilder()
				.setTitle('✅ Location Duplicated')
				.setColor(0x00FF00)
				.addFields(
					{ name: 'New Location ID', value: `${newLocation.id}`, inline: true },
					{ name: 'Time of Day', value: timeOfDay, inline: true },
					{ name: 'Name', value: newLocation.name, inline: false },
					{ name: 'Channel', value: `<#${newLocation.channel}>`, inline: true },
					{ name: 'Source ID', value: `${sourceLocation.id}`, inline: true },
				)
				.setDescription('The location has been duplicated. Note: LocationContain (NPCs/enemies), LocationLink, and other junction tables were NOT copied.');

			await interaction.editReply({ embeds: [embed] });
		}
		catch (error) {
			interaction.client.error(error);
			const errorMessage = `Error duplicating location: ${error.message}`;
			if (interaction.deferred) {
				return await interaction.editReply({ content: errorMessage });
			}
			else {
				return await interaction.reply({ content: errorMessage, flags: MessageFlags.Ephemeral });
			}
		}
	},

	async handleHide(interaction) {
		const channelId = interaction.channel.id;

		const location = await LocationBase.findOne({ where: { channel: channelId } });

		if (!location) {
			return interaction.reply({ content: 'No location found for this channel.', flags: MessageFlags.Ephemeral });
		}

		if (location.hidden) {
			return interaction.reply({ content: 'This location is already hidden.', flags: MessageFlags.Ephemeral });
		}

		await location.update({ hidden: true });
		return interaction.reply({ content: 'Location hidden. It will no longer appear in the move command.', flags: MessageFlags.Ephemeral });
	},

	async handleUnhide(interaction) {
		const channelId = interaction.channel.id;

		const location = await LocationBase.findOne({ where: { channel: channelId } });

		if (!location) {
			return interaction.reply({ content: 'No location found for this channel.', flags: MessageFlags.Ephemeral });
		}

		if (!location.hidden) {
			return interaction.reply({ content: 'This location is not hidden.', flags: MessageFlags.Ephemeral });
		}

		await location.update({ hidden: false });
		return interaction.reply({ content: 'Location is now visible in the move command.', flags: MessageFlags.Ephemeral });
	},

	async handleLink(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		try {
			const fromInput = interaction.options.getString('from_location');
			const toInput = interaction.options.getString('to_location');
			const bidirectional = interaction.options.getBoolean('bidirectional') ?? true;

			const fromLocation = await this._resolveLocation(interaction, fromInput);
			if (!fromLocation) {
				return interaction.editReply({ content: 'Source location not found.' });
			}

			const toLocation = await this._resolveLocation(interaction, toInput);
			if (!toLocation) {
				return interaction.editReply({ content: 'Target location not found.' });
			}

			if (fromLocation.id === toLocation.id) {
				return interaction.editReply({ content: 'Cannot link a location to itself.' });
			}

			const lines = [];

			const [, createdFwd] = await LocationLink.findOrCreate({
				where: { location_id: fromLocation.id, linked_location_id: toLocation.id },
			});
			lines.push(createdFwd
				? `Added: **${fromLocation.name}** → **${toLocation.name}**`
				: `Already exists: **${fromLocation.name}** → **${toLocation.name}**`);

			if (bidirectional) {
				const [, createdRev] = await LocationLink.findOrCreate({
					where: { location_id: toLocation.id, linked_location_id: fromLocation.id },
				});
				lines.push(createdRev
					? `Added: **${toLocation.name}** → **${fromLocation.name}**`
					: `Already exists: **${toLocation.name}** → **${fromLocation.name}**`);
			}

			return interaction.editReply({ content: lines.join('\n') });
		}
		catch (error) {
			interaction.client.error(error);
			return interaction.editReply({ content: `Error linking locations: ${error.message}` });
		}
	},

	async handleUnlink(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		try {
			const fromInput = interaction.options.getString('from_location');
			const toInput = interaction.options.getString('to_location');
			const bidirectional = interaction.options.getBoolean('bidirectional') ?? true;

			const fromLocation = await this._resolveLocation(interaction, fromInput);
			if (!fromLocation) {
				return interaction.editReply({ content: 'Source location not found.' });
			}

			const toLocation = await this._resolveLocation(interaction, toInput);
			if (!toLocation) {
				return interaction.editReply({ content: 'Target location not found.' });
			}

			const lines = [];

			const deletedFwd = await LocationLink.destroy({
				where: { location_id: fromLocation.id, linked_location_id: toLocation.id },
			});
			lines.push(deletedFwd
				? `Removed: **${fromLocation.name}** → **${toLocation.name}**`
				: `Not found: **${fromLocation.name}** → **${toLocation.name}**`);

			if (bidirectional) {
				const deletedRev = await LocationLink.destroy({
					where: { location_id: toLocation.id, linked_location_id: fromLocation.id },
				});
				lines.push(deletedRev
					? `Removed: **${toLocation.name}** → **${fromLocation.name}**`
					: `Not found: **${toLocation.name}** → **${fromLocation.name}**`);
			}

			return interaction.editReply({ content: lines.join('\n') });
		}
		catch (error) {
			interaction.client.error(error);
			return interaction.editReply({ content: `Error unlinking locations: ${error.message}` });
		}
	},

	async handleLockModal(interaction) {
		const locationId = interaction.customId.split('_')[3];
		const lockTitle = interaction.fields.getTextInputValue('lock_title')?.trim() || '🔒 Location Locked';
		const lockMessage = interaction.fields.getTextInputValue('lock_message').trim();
		const guild = interaction.guild;

		try {
			await interaction.deferReply();

			// Get the location
			const location = await LocationBase.findOne({
				where: { id: locationId },
			});

			if (!location) {
				return interaction.editReply({ content: 'Location not found.' });
			}

			const wasAlreadyLocked = location.lock;

			// Update database and permissions only if not already locked
			if (!wasAlreadyLocked) {
				await location.update({ lock: true });

				// Remove send message permission from the role
				const channel = guild.channels.resolve(location.channel);
				const role = guild.roles.resolve(location.role);

				if (channel && role) {
					await channel.permissionOverwrites.edit(role, {
						SendMessages: false,
					});
				}
			}

			// Always send the lock message (allows updating message for already locked locations)
			const channel = guild.channels.resolve(location.channel);
			
			// Get linked locations for the exit button
			const linkedLocations = await locationUtil.getLinkedLocations(location.id);
			
			// Create the exit button
			const exitButton = new ButtonBuilder()
				.setCustomId(`location_exit_${location.id}`)
				.setLabel('Leave Location')
				.setStyle(ButtonStyle.Primary);

			const row = new ActionRowBuilder().addComponents(exitButton);

			// Send the lock message to the channel
			const embed = new EmbedBuilder()
				.setTitle(lockTitle)
				.setDescription(lockMessage)
				.setColor(0xFF0000)
				.setTimestamp();

			await channel.send({
				embeds: [embed],
				components: linkedLocations.length > 0 ? [row] : [],
			});

			const responseMessage = wasAlreadyLocked
				? '✅ Lock message sent (location was already locked).'
				: '✅ Location locked successfully and message sent.';
			
			await interaction.editReply({ content: responseMessage });
		}
		catch (error) {
			interaction.client.error(error);
			if (interaction.deferred) {
				await interaction.editReply({ content: 'Error processing lock command.' });
			}
			else {
				await interaction.reply({ content: 'Error processing lock command.', flags: MessageFlags.Ephemeral });
			}
		}
	},
};
