const {
	SlashCommandBuilder,
	InteractionContextType,
	MessageFlags,
	EmbedBuilder,
	AttachmentBuilder,
	PermissionFlagsBits,
	StringSelectMenuBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} = require('discord.js');
const {
	CharacterBase,
	CharacterPerk,
	CharacterCombatStat,
	CharacterAttackStat,
	CharacterEquipment,
	CharacterFlag,
	CharacterItem,
	CharacterQuest,
	CharacterRelation,
	CharacterSetting,
	CharacterSkill,
	CharacterStatus,
	CharacterThread,
	LocationBase,
	LocationContain,
} = require('@root/dbObject.js');
const characterUtil = require('@utility/characterUtility.js');
const itemUtility = require('@utility/itemUtility.js');
const { setCharacterSetting, getCharacterSetting } = require('@utility/characterSettingUtility.js');
const contentStore = require('@root/contentStore.js');
const { generateStatCard } = require('@utility/imageGenerator.js');

const STAT_LABELS = {
	str: 'Strength (STR)',
	dex: 'Dexterity (DEX)',
	agi: 'Agility (AGI)',
	con: 'Constitution (CON)',
};

function createColorBar(current, max, type = 'hp', length = 8) {
	if (max == null || max <= 0) return '- / -';
	const curr = current ?? 0;
	const percent = Math.max(0, Math.min(100, (curr / max) * 100));
	const filled = Math.min(length, Math.floor((percent / 100) * length));
	const empty = length - filled;
	let filledEmoji;
	if (type === 'stamina') {
		filledEmoji = '🟦';
	}
	else if (percent > 50) {
		filledEmoji = '🟩';
	}
	else if (percent > 25) {
		filledEmoji = '🟨';
	}
	else {
		filledEmoji = '🟥';
	}
	return `${filledEmoji.repeat(filled)}${'⬛'.repeat(empty)} ${curr}/${max}`;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('character')
		.setDescription('Manage your character.')
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(sub =>
			sub.setName('stat')
				.setDescription('View your character\'s stats and equipped items.')
				.addUserOption(option =>
					option.setName('user')
						.setDescription('User to view stats for (admin only)')
						.setRequired(false))
				.addBooleanOption(option =>
					option.setName('plain')
						.setDescription('Show text-based stats instead of image card (default: false)')
						.setRequired(false))
				.addBooleanOption(option =>
					option.setName('public')
						.setDescription('Show the stats publicly (default: hidden)')
						.setRequired(false)),
		)
		.addSubcommand(sub =>
			sub.setName('inventory')
				.setDescription('View your character inventory.'),
		)
		.addSubcommand(sub =>
			sub.setName('edit')
				.setDescription('Edit your character\'s details (name, avatar, description).'),
		)
		.addSubcommand(sub =>
			sub.setName('allocate')
				.setDescription('Spend free points to increase your stats.'),
		)
		.addSubcommandGroup(group =>
			group.setName('perk')
				.setDescription('Manage your character\'s perks.')
				.addSubcommand(sub =>
					sub.setName('list')
						.setDescription('View all your available and equipped perks.'),
				)
				.addSubcommand(sub =>
					sub.setName('activate')
						.setDescription('Activate an available perk.'),
				)
				.addSubcommand(sub =>
					sub.setName('deactivate')
						.setDescription('Deactivate an equipped perk.'),
				),
		)
		.addSubcommand(sub =>
			sub.setName('delete')
				.setDescription('Delete your character and all associated data.')
				.addUserOption(option =>
					option.setName('user')
						.setDescription('(Admin only) The user whose character to delete')
						.setRequired(false)),
		),

	async execute(interaction) {
		try {
			const subGroup = interaction.options.getSubcommandGroup(false);
			const sub = interaction.options.getSubcommand();
			const userId = interaction.user.id;

			// stat may be public — handles its own defer
			if (sub === 'stat') {
				const isPublic = interaction.options.getBoolean('public') ?? false;
				await interaction.deferReply({ ephemeral: !isPublic });
				await handleStat(interaction, userId);
				return;
			}

			// edit shows a modal — cannot defer first
			if (sub === 'edit') {
				await handleEdit(interaction, userId);
				return;
			}

			// All other subcommands are ephemeral
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });

			if (sub === 'inventory') {
				await handleInventory(interaction, userId);
			}
			else if (sub === 'allocate') {
				await handleAllocate(interaction, userId);
			}
			else if (sub === 'delete') {
				await handleDelete(interaction, userId);
			}
			else if (subGroup === 'perk') {
				const character = await characterUtil.getCharacterBase(userId);
				if (!character) return await interaction.editReply({ content: 'You do not have a registered character.' });
				const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
				if (unregistered) return await interaction.editReply({ content: 'You must complete registration before managing perks.' });

				if (sub === 'list') await handlePerkList(interaction, userId);
				else if (sub === 'activate') await handlePerkActivate(interaction, userId);
				else if (sub === 'deactivate') await handlePerkDeactivate(interaction, userId);
			}
		}
		catch (error) {
			console.error('Error in character command:', error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
			}
			else {
				await interaction.editReply({ content: 'An error occurred.' }).catch(() => {});
			}
		}
	},

	async handleModal(interaction) {
		try {
			const userId = interaction.user.id;
			const character = await characterUtil.getCharacterBase(userId);
			if (!character) {
				return await interaction.reply({
					content: 'You do not have a registered character.',
					flags: MessageFlags.Ephemeral,
				});
			}

			const fullname = interaction.fields.getTextInputValue('character_name').trim();
			const name = fullname.split(/\s+/)[0];
			const ageStr = interaction.fields.getTextInputValue('character_age')?.trim();
			const avatar = interaction.fields.getTextInputValue('character_avatar')?.trim();
			const description = interaction.fields.getTextInputValue('character_description')?.trim();

			let age = character.age;
			if (ageStr) {
				age = parseInt(ageStr);
				if (isNaN(age) || age < 1 || age > 999) {
					return await interaction.reply({
						content: 'Please enter a valid age (1–999).',
						flags: MessageFlags.Ephemeral,
					});
				}
			}
			else if (ageStr === '') {
				age = null;
			}

			if (avatar) {
				if (!/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)($|\?)/i.test(avatar)) {
					return await interaction.reply({
						content: 'Please provide a valid image URL (jpg, jpeg, png, gif, webp).',
						flags: MessageFlags.Ephemeral,
					});
				}
			}

			await CharacterBase.update(
				{ name, fullname, age },
				{ where: { id: userId } },
			);

			if (avatar !== undefined) {
				await setCharacterSetting(userId, 'avatar', avatar || '');
			}
			if (description !== undefined) {
				await setCharacterSetting(userId, 'description', description || '');
			}

			const changes = [`**Full Name:** ${fullname}`, `**Nickname:** ${name}`];
			if (age != null) changes.push(`**Age:** ${age}`);
			if (avatar) changes.push('**Avatar:** Updated');
			if (description) changes.push('**Description:** Updated');

			await interaction.reply({
				content: `Your character details have been updated!\n${changes.join('\n')}`,
				flags: MessageFlags.Ephemeral,
			});
		}
		catch (error) {
			console.error('Error handling character edit modal:', error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'An error occurred while saving your changes.', flags: MessageFlags.Ephemeral });
			}
		}
	},
};

// ─── Stat ─────────────────────────────────────────────────────────────────────
async function handleStat(interaction, userId) {
	const targetUser = interaction.options.getUser('user');
	const isPlain = interaction.options.getBoolean('plain') ?? false;

	if (targetUser && targetUser.id !== userId) {
		const member = await interaction.guild.members.fetch(userId);
		if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
			return await interaction.editReply({ content: 'You need admin permissions to view other users\' stats.' });
		}
	}

	const targetId = targetUser ? targetUser.id : userId;
	const displayUser = targetUser || interaction.user;

	const character = await characterUtil.getCharacterBase(targetId);
	if (!character) {
		const label = targetUser ? `${displayUser.username}'s character` : 'Character';
		return await interaction.editReply({ content: `${label} not found.` });
	}

	const unregistered = await characterUtil.getCharacterFlag(targetId, 'unregistered');
	if (unregistered === 1) {
		const who = targetUser ? displayUser.username : 'You';
		const they = targetUser ? 'they' : 'you';
		return await interaction.editReply({
			content: `${who} must complete the registration process before ${they} can use this command.`,
		});
	}

	const combat = await characterUtil.getCharacterCombatStat(targetId);
	const attack = await characterUtil.getCharacterAttackStat(targetId);
	const equipment = await characterUtil.getCharacterEquippedItems(targetId);
	const avatarUrl = character.avatar || displayUser.displayAvatarURL({ forceStatic: false });
	console.log('[Stat] Avatar URL:', avatarUrl, '(from DB:', !!character.avatar, ')');

	// Query active food buff rows for (+X) annotation
	const foodBuffRows = await CharacterStatus.findAll({ where: { character_id: targetId, source: 'food' } });

	// Build food gain map for plain-text annotation
	const FOOD_PLAIN_MULT = { attack: 1 / 3, defense: 1 / 5, defense_percent: 1 / 3, evade: 1 / 3, speed: 1 / 3, accuracy: 1 / 3, critical: 2, critical_damage: 2, crit_resistance: 2 };
	const foodGainMap = {};
	for (const fb of foodBuffRows) {
		const mult = FOOD_PLAIN_MULT[fb.stat_target];
		if (mult != null) {
			const gain = Math.floor(fb.potency * mult);
			if (gain > 0) foodGainMap[fb.stat_target] = (foodGainMap[fb.stat_target] || 0) + gain;
		}
	}
	const foodNote = (stat) => foodGainMap[stat] ? ` (+${foodGainMap[stat]})` : '';

	if (!isPlain) {
		try {
			const imageBuffer = await generateStatCard(character, combat, attack, equipment, avatarUrl, foodBuffRows);
			const attachment = new AttachmentBuilder(imageBuffer, { name: 'stat-card.png' });
			return await interaction.editReply({ files: [attachment] });
		}
		catch (canvasError) {
			console.error('Canvas generation failed, falling back to plain text:', canvasError.message);
		}
	}

	const statFields = [
		`STR: ${character.str ?? '-'}`,
		`DEX: ${character.dex ?? '-'}`,
		`AGI: ${character.agi ?? '-'}`,
		`CON: ${character.con ?? '-'}`,
	];
	const combatFields = combat ? [
		`Defense: ${combat.defense ?? '-'}${foodNote('defense')}`,
		`Speed: ${combat.speed ?? '-'}${foodNote('speed')}`,
		`Evade: ${combat.evade ?? '-'}${foodNote('evade')}`,
		`Current Weight: ${combat.currentWeight ?? '-'}`,
		`Max Weight: ${combat.maxWeight ?? '-'}`,
	] : ['None'];
	const attackFields = attack ? [
		`Attack: ${attack.attack ?? '-'}${foodNote('attack')}`,
		`Accuracy: ${attack.accuracy ?? '-'}${foodNote('accuracy')}`,
		`Critical: ${attack.critical ?? '-'}${foodNote('critical')}`,
	] : ['None'];
	const equipList = equipment.length > 0 ? equipment.map(eq => `- ${eq.itemName}`).join('\n') : 'None';
	const hpBar = createColorBar(character.currentHp, character.maxHp, 'hp');
	const staminaBar = createColorBar(character.currentStamina, character.maxStamina, 'stamina');

	await interaction.editReply({
		embeds: [{
			title: `${character.name}'s Stats`,
			description: statFields.join('\n'),
			thumbnail: { url: avatarUrl },
			fields: [
				{ name: 'HP', value: hpBar, inline: true },
				{ name: 'Stamina', value: staminaBar, inline: true },
				{ name: '\u200B', value: '\u200B', inline: true },
				{ name: 'Combat Stats', value: combatFields.join('\n'), inline: true },
				{ name: 'Attack Stats', value: attackFields.join('\n'), inline: true },
				{ name: 'Equipped Items', value: equipList },
			],
		}],
	});
}

// ─── Inventory ────────────────────────────────────────────────────────────────
async function handleInventory(interaction, userId) {
	const character = await characterUtil.getCharacterBase(userId);
	if (!character) return await interaction.editReply({ content: 'No character found for your account.' });

	const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
	if (unregistered === 1) return await interaction.editReply({ content: 'You must complete the registration process before using this command.' });

	const inventory = await characterUtil.getCharacterInventory(userId);
	if (!inventory || inventory.length === 0) return await interaction.editReply({ content: 'Your inventory is empty.' });

	const inventoryList = inventory.map(inv => {
		const item = inv.item;
		const equipped = inv.equipped ? ' (Equipped)' : '';
		return `**${item.name}** x${inv.amount}${equipped}`;
	}).join('\n');

	const selectOptions = inventory.slice(0, 25).map(inv => ({
		label: `${inv.item.name} (x${inv.amount})`,
		value: String(inv.item.id),
		description: inv.item.description ? inv.item.description.substring(0, 100) : 'No description',
	}));

	const select = new StringSelectMenuBuilder()
		.setCustomId('inventory_item_select')
		.setPlaceholder('Select an item to view details')
		.addOptions(selectOptions);

	const row = new ActionRowBuilder().addComponents(select);
	await interaction.editReply({
		embeds: [{
			title: `${character.name}'s Inventory`,
			description: inventoryList,
			footer: { text: 'Select an item below to view detailed information and perform actions.' },
		}],
		components: [row],
	});

	const message = await interaction.fetchReply();
	const collector = message.createMessageComponentCollector({
		componentType: ComponentType.StringSelect,
		time: 60_000,
		filter: i => i.user.id === userId,
	});

	collector.on('collect', async i => {
		try {
			const selectedItem = await itemUtility.getItemWithDetails(i.values[0]);
			if (!selectedItem) {
				await i.reply({ content: 'Item not found.', flags: MessageFlags.Ephemeral });
				return;
			}

			const inventoryEntry = await CharacterItem.findOne({
				where: { character_id: character.id, item_id: selectedItem.id },
			});
			if (!inventoryEntry) {
				await i.reply({ content: 'You do not have this item in your inventory.', flags: MessageFlags.Ephemeral });
				return;
			}

			const embed = itemUtility.buildItemEmbed(selectedItem, inventoryEntry);
			const isEquipped = inventoryEntry.equipped;
			const components = itemUtility.buildItemActionButtons(selectedItem, isEquipped, itemUtility.isItemEquippable(selectedItem));

			await i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, components });

			if (components.length) {
				const buttonCollector = i.channel.createMessageComponentCollector({
					componentType: ComponentType.Button,
					time: 60_000,
					filter: btnI => btnI.user.id === userId,
				});
				buttonCollector.on('collect', async btnI => {
					await itemUtility.handleItemButtonAction(btnI, selectedItem, character, () => buttonCollector.stop());
				});
			}
		}
		catch (itemError) {
			console.error('Error in inventory item selection:', itemError);
			await i.reply({ content: 'An error occurred while viewing this item.', flags: MessageFlags.Ephemeral }).catch(() => {});
		}
	});
}

// ─── Edit ─────────────────────────────────────────────────────────────────────
async function handleEdit(interaction, userId) {
	const character = await characterUtil.getCharacterBase(userId);
	if (!character) {
		return await interaction.reply({
			content: 'You do not have a registered character.',
			flags: MessageFlags.Ephemeral,
		});
	}

	const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
	if (unregistered) {
		return await interaction.reply({
			content: 'You must complete the registration process before editing your character.',
			flags: MessageFlags.Ephemeral,
		});
	}

	const currentAvatar = await getCharacterSetting(userId, 'avatar') || character.avatar || '';
	const currentDescription = await getCharacterSetting(userId, 'description') || '';

	const modal = new ModalBuilder()
		.setCustomId('character_edit_modal')
		.setTitle('Edit Character Details');

	const nameInput = new TextInputBuilder()
		.setCustomId('character_name')
		.setLabel('Full Name')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('Your character\'s full name')
		.setRequired(true)
		.setMinLength(2)
		.setMaxLength(64);
	if ((character.fullname || '').length >= 2) nameInput.setValue(character.fullname);

	const ageInput = new TextInputBuilder()
		.setCustomId('character_age')
		.setLabel('Age')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('e.g. 25 (optional)')
		.setRequired(false)
		.setMaxLength(3);
	const ageStr = character.age != null ? String(character.age) : '';
	if (ageStr.length >= 2) ageInput.setValue(ageStr);

	const avatarInput = new TextInputBuilder()
		.setCustomId('character_avatar')
		.setLabel('Avatar URL')
		.setStyle(TextInputStyle.Short)
		.setPlaceholder('https://example.com/image.png (optional)')
		.setRequired(false)
		.setMaxLength(500);
	if (currentAvatar.length >= 2) avatarInput.setValue(currentAvatar);

	const descriptionInput = new TextInputBuilder()
		.setCustomId('character_description')
		.setLabel('Description')
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder('A brief description of your character (optional)')
		.setRequired(false)
		.setMaxLength(1000);
	if (currentDescription.length >= 2) descriptionInput.setValue(currentDescription);

	modal.addComponents(
		new ActionRowBuilder().addComponents(nameInput),
		new ActionRowBuilder().addComponents(ageInput),
		new ActionRowBuilder().addComponents(avatarInput),
		new ActionRowBuilder().addComponents(descriptionInput),
	);

	await interaction.showModal(modal);
}

// ─── Allocate ─────────────────────────────────────────────────────────────────
async function handleAllocate(interaction, userId) {
	const character = await characterUtil.getCharacterBase(userId);
	if (!character) return await interaction.editReply({ content: 'You do not have a registered character.' });

	const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
	if (unregistered) return await interaction.editReply({ content: 'You must complete registration before allocating stats.' });

	if ((character.free_point || 0) <= 0) {
		return await interaction.editReply({ content: 'You have no free points to spend.' });
	}

	let selectedStat = null;
	let pendingAmount = null;

	const embed = buildStatEmbed(character);
	const row = new ActionRowBuilder().addComponents(buildStatSelect());
	const reply = await interaction.editReply({ embeds: [embed], components: [row] });

	const collector = reply.createMessageComponentCollector({
		time: 60_000,
		filter: i => i.user.id === userId,
	});

	collector.on('collect', async i => {
		try {
			if (i.customId === 'allocate_stat_select') {
				selectedStat = i.values[0];
				const fresh = await characterUtil.getCharacterBase(userId);
				const fp = fresh.free_point || 0;
				if (fp <= 0) {
					collector.stop();
					return await i.update({ content: 'You have no free points left.', embeds: [], components: [] });
				}
				const amountRow = new ActionRowBuilder().addComponents(
					buildAmountSelect(selectedStat, fresh[selectedStat] || 0, fp),
				);
				await i.update({ embeds: [embed], components: [amountRow] });
			}
			else if (i.customId === 'allocate_amount_select') {
				pendingAmount = parseInt(i.values[0]);
				const fresh = await characterUtil.getCharacterBase(userId);
				const fp = fresh.free_point || 0;
				if (pendingAmount > fp) {
					collector.stop();
					return await i.update({ content: `You only have **${fp}** free point(s) remaining.`, embeds: [], components: [] });
				}
				const currentVal = fresh[selectedStat] || 0;
				const confirmEmbed = new EmbedBuilder()
					.setTitle('Confirm Stat Allocation')
					.setDescription(
						`Spend **${pendingAmount}** free point(s) to increase **${STAT_LABELS[selectedStat]}**?\n\n` +
						`${STAT_LABELS[selectedStat]}: **${currentVal}** → **${currentVal + pendingAmount}**\n` +
						`Free Points: **${fp}** → **${fp - pendingAmount}**`,
					)
					.setColor(0x3498db);
				const confirmRow = new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('allocate_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
					new ButtonBuilder().setCustomId('allocate_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
				);
				await i.update({ embeds: [confirmEmbed], components: [confirmRow] });
			}
			else if (i.customId === 'allocate_confirm') {
				collector.stop();
				const fresh = await CharacterBase.findOne({ where: { id: userId } });
				const fp = fresh.free_point || 0;
				if (pendingAmount > fp) {
					return await i.update({ content: `You only have **${fp}** free point(s) — allocation cancelled.`, embeds: [], components: [] });
				}
				const oldVal = fresh[selectedStat] || 0;
				await CharacterBase.update(
					{ [selectedStat]: oldVal + pendingAmount, free_point: fp - pendingAmount },
					{ where: { id: userId } },
				);
				await characterUtil.calculateCombatStat(userId);
				await characterUtil.calculateAttackStat(userId);
				await i.update({
					content:
						`✅ **${STAT_LABELS[selectedStat]}** increased from **${oldVal}** to **${oldVal + pendingAmount}**.\n` +
						`Free points remaining: **${fp - pendingAmount}**`,
					embeds: [],
					components: [],
				});
			}
			else if (i.customId === 'allocate_cancel') {
				collector.stop();
				await i.update({ content: 'Stat allocation cancelled.', embeds: [], components: [] });
			}
		}
		catch (err) {
			console.error('allocate collector error:', err);
		}
	});

	collector.on('end', (_, reason) => {
		if (reason === 'time') {
			interaction.editReply({ content: 'Stat allocation timed out.', embeds: [], components: [] }).catch(() => {});
		}
	});
}

function buildStatSelect() {
	return new StringSelectMenuBuilder()
		.setCustomId('allocate_stat_select')
		.setPlaceholder('Choose a stat to increase')
		.addOptions(
			Object.entries(STAT_LABELS).map(([value, label]) => ({ label, value })),
		);
}

function buildAmountSelect(stat, currentVal, maxPoints) {
	const maxSpend = Math.min(maxPoints, 10);
	const options = [];
	for (let n = 1; n <= maxSpend; n++) {
		options.push({
			label: `+${n} → ${currentVal + n}`,
			value: String(n),
			description: `Spend ${n} point${n > 1 ? 's' : ''} on ${STAT_LABELS[stat]}`,
		});
	}
	return new StringSelectMenuBuilder()
		.setCustomId('allocate_amount_select')
		.setPlaceholder(`How many points into ${STAT_LABELS[stat]}?`)
		.addOptions(options);
}

function buildStatEmbed(character) {
	return new EmbedBuilder()
		.setTitle(`${character.name}'s Stats`)
		.setDescription(
			`**Free Points available: ${character.free_point || 0}**\n\n` +
			`STR (Strength): **${character.str || 0}**\n` +
			`DEX (Dexterity): **${character.dex || 0}**\n` +
			`AGI (Agility): **${character.agi || 0}**\n` +
			`CON (Constitution): **${character.con || 0}**`,
		)
		.setColor(0xf39c12);
}

// ─── Perk ─────────────────────────────────────────────────────────────────────
async function handlePerkList(interaction, userId) {
	const charPerks = await CharacterPerk.findAll({ where: { character_id: userId } });
	if (!charPerks || charPerks.length === 0) return await interaction.editReply({ content: 'You have no perks.' });

	const equipped = [], available = [], learning = [];
	for (const cp of charPerks) {
		const perkData = getPerkData(cp.perk_id);
		const name = perkData ? perkData.name : `Perk #${cp.perk_id}`;
		const desc = perkData ? (perkData.description || '') : '';
		const entry = { name, desc, cp };
		if (cp.status === 'equipped') equipped.push(entry);
		else if (cp.status === 'available') available.push(entry);
		else learning.push(entry);
	}

	const embed = new EmbedBuilder().setTitle('Your Perks').setColor(0x9b59b6);
	if (equipped.length > 0) {
		embed.addFields({ name: '🟢 Equipped (Active)', value: equipped.map(e => `**${e.name}**${e.desc ? `\n${e.desc}` : ''}`).join('\n\n') });
	}
	if (available.length > 0) {
		embed.addFields({ name: '🟡 Available (Inactive)', value: available.map(e => `**${e.name}**${e.desc ? `\n${e.desc}` : ''}`).join('\n\n') });
	}
	if (learning.length > 0) {
		embed.addFields({ name: '🔵 Learning', value: learning.map(e => `**${e.name}** — ${e.cp.stamina_spent} stamina spent`).join('\n') });
	}
	await interaction.editReply({ embeds: [embed] });
}

async function handlePerkActivate(interaction, userId) {
	const available = await CharacterPerk.findAll({ where: { character_id: userId, status: 'available' } });
	if (!available || available.length === 0) return await interaction.editReply({ content: 'You have no available (inactive) perks to activate.' });

	const options = available.slice(0, 25).map(cp => {
		const perkData = getPerkData(cp.perk_id);
		const name = perkData ? perkData.name : `Perk #${cp.perk_id}`;
		const desc = perkData ? (perkData.description || '') : '';
		return { label: name.substring(0, 100), value: String(cp.perk_id), description: desc ? desc.substring(0, 100) : undefined };
	});

	const select = new StringSelectMenuBuilder()
		.setCustomId('perk_activate_select')
		.setPlaceholder('Choose a perk to activate')
		.addOptions(options);
	const row = new ActionRowBuilder().addComponents(select);
	const reply = await interaction.editReply({ content: 'Select a perk to activate:', components: [row] });

	const collector = reply.createMessageComponentCollector({
		componentType: ComponentType.StringSelect,
		time: 60_000,
		max: 1,
		filter: i => i.user.id === userId && i.customId === 'perk_activate_select',
	});

	collector.on('collect', async i => {
		try {
			const perkId = parseInt(i.values[0]);
			const cp = await CharacterPerk.findOne({ where: { character_id: userId, perk_id: perkId, status: 'available' } });
			if (!cp) return await i.update({ content: 'That perk is no longer available to activate.', components: [] });
			cp.status = 'equipped';
			await cp.save();
			const name = getPerkData(perkId)?.name ?? `Perk #${perkId}`;
			await i.update({ content: `✅ **${name}** is now active.`, components: [] });
		}
		catch (err) { console.error('perk activate error:', err); }
	});

	collector.on('end', (collected, reason) => {
		if (reason === 'time' && collected.size === 0) {
			interaction.editReply({ content: 'Perk activation timed out.', components: [] }).catch(() => {});
		}
	});
}

async function handlePerkDeactivate(interaction, userId) {
	const equipped = await CharacterPerk.findAll({ where: { character_id: userId, status: 'equipped' } });
	if (!equipped || equipped.length === 0) return await interaction.editReply({ content: 'You have no equipped (active) perks to deactivate.' });

	const options = equipped.slice(0, 25).map(cp => {
		const perkData = getPerkData(cp.perk_id);
		const name = perkData ? perkData.name : `Perk #${cp.perk_id}`;
		const desc = perkData ? (perkData.description || '') : '';
		return { label: name.substring(0, 100), value: String(cp.perk_id), description: desc ? desc.substring(0, 100) : undefined };
	});

	const select = new StringSelectMenuBuilder()
		.setCustomId('perk_deactivate_select')
		.setPlaceholder('Choose a perk to deactivate')
		.addOptions(options);
	const row = new ActionRowBuilder().addComponents(select);
	const reply = await interaction.editReply({ content: 'Select a perk to deactivate:', components: [row] });

	const collector = reply.createMessageComponentCollector({
		componentType: ComponentType.StringSelect,
		time: 60_000,
		max: 1,
		filter: i => i.user.id === userId && i.customId === 'perk_deactivate_select',
	});

	collector.on('collect', async i => {
		try {
			const perkId = parseInt(i.values[0]);
			const cp = await CharacterPerk.findOne({ where: { character_id: userId, perk_id: perkId, status: 'equipped' } });
			if (!cp) return await i.update({ content: 'That perk is no longer equipped.', components: [] });
			cp.status = 'available';
			await cp.save();
			const name = getPerkData(perkId)?.name ?? `Perk #${perkId}`;
			await i.update({ content: `🟡 **${name}** has been deactivated.`, components: [] });
		}
		catch (err) { console.error('perk deactivate error:', err); }
	});

	collector.on('end', (collected, reason) => {
		if (reason === 'time' && collected.size === 0) {
			interaction.editReply({ content: 'Perk deactivation timed out.', components: [] }).catch(() => {});
		}
	});
}

function getPerkData(perkId) {
	return contentStore.perks.findByPk(perkId) || null;
}

// ─── Delete ───────────────────────────────────────────────────────────────────
async function handleDelete(interaction, userId) {
	const targetUser = interaction.options.getUser('user');
	const targetId = targetUser ? targetUser.id : userId;

	if (targetUser && targetUser.id !== userId) {
		const member = await interaction.guild.members.fetch(userId);
		if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
			return await interaction.editReply({ content: 'You need Administrator permission to delete another user\'s character.' });
		}
	}

	const character = await CharacterBase.findOne({ where: { id: targetId } });
	if (!character) return await interaction.editReply({ content: 'Character not found.' });

	// Reply before deleting threads — if the command was run inside a character thread,
	// deleting that thread invalidates the interaction message and editReply throws 10008.
	const message = targetUser && targetUser.id !== userId
		? `Character for ${targetUser.username} has been deleted.`
		: 'Your character and all associated data have been deleted.';
	await interaction.editReply({ content: message });

	// Delete threads: grant each thread's parent channel role first, then delete, then clean up.
	// Mirrors the pattern in register.js — private thread ops require the user to have
	// access to the parent channel. We temporarily re-grant the role to guarantee access.
	const rolesToRemove = new Set();
	try {
		const threads = await CharacterThread.findAll({ where: { character_id: targetId } });
		const targetMember = await interaction.guild.members.fetch(targetId);
		for (const threadRecord of threads) {
			if (!threadRecord.thread_id) continue;
			try {
				// Re-grant the thread's parent channel role so the member has access
				if (threadRecord.location_id) {
					const threadLocation = await LocationBase.findByPk(threadRecord.location_id);
					if (threadLocation?.role) {
						await targetMember.roles.add(threadLocation.role).catch(() => {});
						rolesToRemove.add(threadLocation.role);
					}
				}
				// force: true bypasses stale cache (archived threads are evicted from gateway cache)
				const thread = await interaction.guild.channels.fetch(threadRecord.thread_id, { force: true });
				if (thread && thread.isThread()) {
					await thread.delete('Character deleted');
				}
				else {
					console.log(`[DeleteChar] Thread ${threadRecord.thread_id} returned null after role grant.`);
				}
			}
			catch (threadError) {
				// code 10003 = Unknown Channel
				console.log(`[DeleteChar] Could not delete thread ${threadRecord.thread_id} (code: ${threadError.code}): ${threadError.message}`);
			}
		}
	}
	catch (err) { console.log('Error handling thread deletion:', err); }

	// Remove location role + any thread channel roles granted above
	try {
		const currentLocationId = await characterUtil.getCharacterCurrentLocationId(targetId);
		if (currentLocationId) {
			const location = await LocationBase.findByPk(currentLocationId);
			if (location?.role) rolesToRemove.add(location.role);
		}
		if (rolesToRemove.size > 0) {
			const member = await interaction.guild.members.fetch(targetId);
			await member.roles.remove([...rolesToRemove]).catch(() => {});
		}
	}
	catch (err) { console.log('Error removing location role:', err); }

	// Delete all related data
	await Promise.all([
		CharacterEquipment.destroy({ where: { character_id: targetId } }),
		CharacterCombatStat.destroy({ where: { character_id: targetId } }),
		CharacterAttackStat.destroy({ where: { character_id: targetId } }),
		CharacterFlag.destroy({ where: { character_id: targetId } }),
		CharacterItem.destroy({ where: { character_id: targetId } }),
		CharacterQuest.destroy({ where: { character_id: targetId } }),
		CharacterRelation.destroy({ where: { character_id: targetId } }),
		CharacterSetting.destroy({ where: { character_id: targetId } }),
		CharacterSkill.destroy({ where: { character_id: targetId } }),
		CharacterStatus.destroy({ where: { character_id: targetId } }),
		CharacterThread.destroy({ where: { character_id: targetId } }),
		LocationContain.destroy({ where: { object_id: targetId } }),
	]);
	await CharacterBase.destroy({ where: { id: targetId } });
}
