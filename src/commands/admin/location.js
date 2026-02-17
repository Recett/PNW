const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType, EmbedBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { LocationBase } = require('@root/dbObject.js');
const locationUtil = require('@utility/locationUtility.js');

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
						.setDescription('Type of the location')
						.setRequired(false))
				.addBooleanOption(option =>
					option.setName('lock')
						.setDescription('Lock or unlock the location')
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
				.setDescription('Unlock the current location')),

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

		if (name !== null) updates.name = name;
		if (type !== null) updates.type = type;
		if (lock !== null) updates.lock = lock;

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
