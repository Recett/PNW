const {
	SlashCommandBuilder, InteractionContextType,
	MessageFlags, EmbedBuilder,
	ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
} = require('discord.js');
const { CharacterBase } = require('@root/dbObject.js');
const characterUtil = require('@utility/characterUtility.js');
const combatUtil = require('@utility/combatUtility.js');
const battleUtil = require('@utility/battleUtility.js');
const itemUtility = require('@utility/itemUtility.js');
const { EMOJI } = require('../../enums');

const STAMINA_COST = 5;

// ── Officer Cabin helpers ─────────────────────────────────────────────────────

function buildOfficerEphemeralEmbed(session, defeatedMap, userRole) {
	const lines = [];
	for (const [roleKey, roleDef] of Object.entries(battleUtil.OFFICER_ROLES)) {
		let assignedText;
		if (defeatedMap[roleKey]) {
			assignedText = '~~Defeated~~';
		}
		else if (session.assignments[roleKey]) {
			assignedText = `**${session.names[roleKey]}**`;
		}
		else {
			assignedText = '*Unassigned*';
		}
		lines.push(`${roleDef.label}: ${assignedText}`);
	}
	const footerText = userRole
		? `Your role: ${battleUtil.OFFICER_ROLES[userRole].label}`
		: 'You have not claimed a role yet.';
	return new EmbedBuilder()
		.setTitle('\u2694\uFE0F Officer Cabin \u2014 Choose Your Role')
		.setDescription(lines.join('\n'))
		.setFooter({ text: footerText })
		.setColor(0x8B0000);
}

function buildOfficerRoleButtonRows(session, defeatedMap, userId, userRole) {
	const roleRow = new ActionRowBuilder();
	for (const [roleKey, roleDef] of Object.entries(battleUtil.OFFICER_ROLES)) {
		const takenByOther = session.assignments[roleKey] && session.assignments[roleKey] !== userId;
		const isDefeated = defeatedMap[roleKey];
		const isMine = userRole === roleKey;
		roleRow.addComponents(
			new ButtonBuilder()
				.setCustomId(`ocabin_select|${roleKey}`)
				.setLabel(roleDef.label)
				.setStyle(isMine ? ButtonStyle.Success : ButtonStyle.Primary)
				.setDisabled(takenByOther || isDefeated || (!isMine && userRole !== null)),
		);
	}
	const rows = [roleRow];
	if (userRole) {
		const releaseRow = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId('ocabin_release')
				.setLabel('Release My Slot')
				.setStyle(ButtonStyle.Secondary),
		);
		rows.push(releaseRow);
	}
	return rows;
}

async function updateOfficerSharedMessage(guild, session, defeatedMap) {
	const lines = [];
	for (const [roleKey, roleDef] of Object.entries(battleUtil.OFFICER_ROLES)) {
		let assignedText;
		if (defeatedMap[roleKey]) {
			assignedText = '~~Defeated~~';
		}
		else if (session.assignments[roleKey]) {
			assignedText = `**${session.names[roleKey]}**`;
		}
		else {
			assignedText = '*Unassigned*';
		}
		lines.push(`${roleDef.label}: ${assignedText}`);
	}
	const embed = new EmbedBuilder()
		.setTitle('\u2694\uFE0F Officer Cabin \u2014 Assault Plan')
		.setDescription(
			'An assault on the officer quarters is being organized.\n\n' +
			lines.join('\n') +
			'\n\nUse `/fight` to claim a role, then confirm to begin.',
		)
		.setColor(0x8B0000);
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`ocabin_confirm|${session.sessionId}`)
			.setLabel('Confirm Assault')
			.setStyle(ButtonStyle.Danger),
		new ButtonBuilder()
			.setCustomId(`ocabin_cancel|${session.sessionId}`)
			.setLabel('Abandon')
			.setStyle(ButtonStyle.Secondary),
	);
	let channel;
	try {
		channel = guild ? await guild.channels.fetch(session.channelId) : null;
	}
	catch {
		channel = null;
	}
	if (!channel) return;
	// Delete the old board (best-effort) so the fresh one always appears at the bottom.
	if (session.messageId) {
		try {
			const old = await channel.messages.fetch(session.messageId);
			await old.delete();
		}
		catch {
			// Already gone — no problem
		}
		session.messageId = null;
	}
	try {
		const newMsg = await channel.send({ embeds: [embed], components: [row] });
		session.messageId = newMsg.id;
	}
	catch (sendErr) {
		console.error('[OfficerCabin] Failed to post shared board:', sendErr);
	}
}

async function handleOfficerCabinFight(interaction, userId, character, currentZone) {
	// Check which officers are already defeated
	const [captainDefeated, firstMateDefeated, headGuardDefeated] = await Promise.all([
		battleUtil.getFlag(battleUtil.OFFICER_ROLES.captain.defeatFlag),
		battleUtil.getFlag(battleUtil.OFFICER_ROLES.first_mate.defeatFlag),
		battleUtil.getFlag(battleUtil.OFFICER_ROLES.head_guard.defeatFlag),
	]);
	const defeatedMap = {
		captain: captainDefeated === 1,
		first_mate: firstMateDefeated === 1,
		head_guard: headGuardDefeated === 1,
	};

	if (defeatedMap.captain) {
		return interaction.reply({
			content: 'All officers have been dealt with. The cabin is clear.',
			flags: MessageFlags.Ephemeral,
		});
	}

	// Get or create session
	const sessionKey = currentZone.id;
	let session = battleUtil.officerCabinSessions.get(sessionKey);
	if (!session) {
		const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
		session = {
			sessionId,
			assignments: { captain: null, first_mate: null, head_guard: null },
			names: { captain: null, first_mate: null, head_guard: null },
			channelId: interaction.channelId,
			messageId: null,
			timeout: setTimeout(() => {
				battleUtil.officerCabinSessions.delete(sessionKey);
				console.log('[OfficerCabin] Session expired for zone', sessionKey);
			}, 10 * 60 * 1000),
		};
		battleUtil.officerCabinSessions.set(sessionKey, session);
	}

	// Find current role for this user
	let userCurrentRole = Object.entries(session.assignments).find(([, uid]) => uid === userId)?.[0] ?? null;

	const embed = buildOfficerEphemeralEmbed(session, defeatedMap, userCurrentRole);
	const rows = buildOfficerRoleButtonRows(session, defeatedMap, userId, userCurrentRole);

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });
	const reply = await interaction.editReply({ embeds: [embed], components: rows });

	const collector = reply.createMessageComponentCollector({
		componentType: ComponentType.Button,
		filter: (i) => i.user.id === userId,
		time: 90_000,
		max: 10,
	});

	collector.on('collect', async (btn) => {
		const cid = btn.customId;
		if (cid === 'ocabin_release') {
			if (userCurrentRole) {
				session.assignments[userCurrentRole] = null;
				session.names[userCurrentRole] = null;
				userCurrentRole = null;
			}
		}
		else if (cid.startsWith('ocabin_select|')) {
			const role = cid.split('|')[1];
			if (!battleUtil.OFFICER_ROLES[role] || defeatedMap[role]) {
				await btn.deferUpdate();
				return;
			}
			if (session.assignments[role] && session.assignments[role] !== userId) {
				await btn.deferUpdate();
				return;
			}
			// Release previous slot if any
			if (userCurrentRole) {
				session.assignments[userCurrentRole] = null;
				session.names[userCurrentRole] = null;
			}
			session.assignments[role] = userId;
			session.names[role] = character.name;
			userCurrentRole = role;
		}
		try {
			await updateOfficerSharedMessage(interaction.guild, session, defeatedMap);
		}
		catch (boardErr) {
			console.error('[OfficerCabin] Failed to update shared board:', boardErr);
		}
		const updatedEmbed = buildOfficerEphemeralEmbed(session, defeatedMap, userCurrentRole);
		const updatedRows = buildOfficerRoleButtonRows(session, defeatedMap, userId, userCurrentRole);
		await btn.update({ embeds: [updatedEmbed], components: updatedRows });
		collector.stop('picked');
	});

	collector.on('end', async () => {
		try {
			await interaction.editReply({ components: [] });
		}
		catch (ignored) {
			// message may be gone
			void ignored;
		}
	});
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('fight')
		.setDescription('Engage a Arbrance enemy on the enemy vessel.')
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		try {
			const userId = interaction.user.id;

			const unregistered = await characterUtil.getCharacterFlag(userId, 'unregistered');
			if (unregistered === 1) {
				return await interaction.reply({
					content: 'You must complete registration before fighting.',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Check battle is active
			const battleActive = await battleUtil.getFlag('global.hms_divine_battle_active');
			if (!battleActive) {
				return await interaction.reply({
					content: 'There is no active battle. This command is only available during the Battle of HMS Divine.',
					flags: MessageFlags.Ephemeral,
				});
			}

			// Check player is in an Arbrance zone
			const arbranceZones = await battleUtil.getArbranceLocations();
			const character = await CharacterBase.findOne({ where: { id: userId } });
			if (!character) {
				return await interaction.reply({ content: 'Character not found.', flags: MessageFlags.Ephemeral });
			}

			const currentZone = arbranceZones.find(z => z.id === character.location_id);
			if (!currentZone) {
				return await interaction.reply({
					content: 'Hold your ground! Your ship must be defended. Cross to the enemy vessel when you are ready to fight.',
					flags: MessageFlags.Ephemeral,
				});
			}

			const enemyId = await battleUtil.pickEnemyForLocation(currentZone.id);
			const arbranceIds = battleUtil.getArbranceZoneIds();

			// ── Armory: hold-the-ground zone — no player-initiated fights ─────────────
			if (currentZone.id === arbranceIds.arb_armory) {
				return await interaction.reply({
					content: 'The armory must be secured — hold your ground and wait for the enemy to come to you.',
					flags: MessageFlags.Ephemeral,
				});
			}

			// ── Officer Cabin: 3v3 boss fight ──────────────────────────────────────────
			if (currentZone.id === arbranceIds.arb_officer_quarters) {
				await handleOfficerCabinFight(interaction, userId, character, currentZone);
				return;
			}

			// Build rigging attacker list for covering fire (only on main deck)
			const riggingAttackers = [];
			const riggingSnipers = [];
			if (currentZone.id === arbranceIds.arb_main_deck) {
				const riggingZone = arbranceZones.find(z => z.id === arbranceIds.arb_rigging);
				if (riggingZone) {
					const riggingPlayers = await CharacterBase.findAll({
						where: { location_id: riggingZone.id },
					});
					if (!riggingPlayers.length) {
						// Undefended rigging — compute morale-based trigger chance
						// effective morale = global morale - 20; base 8%, +1% per -10 eff. morale, -1% per +10
						const rawMorale = await battleUtil.getFlag('global.hms_divine_morale') || 0;
						const effectiveMorale = rawMorale - 20;
						const triggerChance = Math.min(1, Math.max(0, 0.08 + (-effectiveMorale / 10) * 0.01));
						riggingSnipers.push({ triggerChance, minDmg: 15, maxDmg: 20 });
					}
					for (const rc of riggingPlayers) {
						if (rc.id === userId) continue;
						const attackStats = await combatUtil.getAttackStat(rc.id);
						if (!attackStats || attackStats.length === 0) continue;
						// Only bowmen (longbow/shortbow are twohand — one attack row)
						let bowAttack = null;
						for (const a of attackStats) {
							if (!a.item_id) continue;
							const itemDetails = await itemUtility.getItemWithDetails(a.item_id);
							if (!itemDetails) continue;
							const sub = itemDetails.weapon && itemDetails.weapon.subtype;
							if (sub === 'longbow' || sub === 'shortbow') {
								bowAttack = a;
								break;
							}
						}
						if (!bowAttack) continue;
						const combatStats = await combatUtil.getDefenseStat(rc.id);
						const speed = combatStats ? (combatStats.speed || 10) : 10;
						riggingAttackers.push({
							name: rc.name,
							attack: bowAttack.attack || 0,
							cooldown: bowAttack.cooldown || 80,
							speed,
						});
					}
				}
			}

			// Stamina check
			if ((character.currentStamina || 0) < STAMINA_COST) {
				return await interaction.reply({
					content: `Not enough stamina. You need ${STAMINA_COST} stamina to fight (you have ${character.currentStamina || 0}).`,
					flags: MessageFlags.Ephemeral,
				});
			}

			await interaction.deferReply();
			await character.update({ currentStamina: character.currentStamina - STAMINA_COST });

			// ── Cannon Deck: Master Gunner chance + 3-round sequential fight ──
			if (currentZone.id === arbranceIds.arb_cannon_deck) {
				const CANNON_DECK_MAX_HP = 450;
				const [masterGunnerDefeated, cannonDeckHp] = await Promise.all([
					battleUtil.getFlag('global.arb_boss_master_gunner_defeated'),
					battleUtil.getFlag('global.arb_cannon_deck_hp'),
				]);
				const missingPct = (CANNON_DECK_MAX_HP - cannonDeckHp) / CANNON_DECK_MAX_HP * 100;
				const spawnChance = (missingPct / 2) / 100;
				const entryEvent = (!masterGunnerDefeated && Math.random() < spawnChance)
					? 'arb-cannon-master-gunner-intro'
					: 'arb-cannon-round-1-combat';
				await interaction.client.eventUtil.processEvent(entryEvent, interaction, userId);
				return;
			}

			// Run combat
			const enemyDamageMultiplier = await battleUtil.getArmoryDamageMultiplier(currentZone.id);
			const combatResult = await combatUtil.mainCombat(userId, enemyId, { riggingAttackers, riggingSnipers, enemyDamageMultiplier });

			// Display result
			const won = combatResult.finalState?.player?.hp > 0 && !(combatResult.finalState?.enemy?.hp > 0);
			const color = won ? 0x27ae60 : 0xe74c3c;
			const pages = combatResult.battleReportPages || [combatResult.battleReport || 'No combat details available.'];

			const firstPageContent = combatResult.narrativeText
				? `*${combatResult.narrativeText}*\n\n${pages[0]}`
				: pages[0];

			const firstEmbed = new EmbedBuilder()
				.setTitle(`${EMOJI.SWORD} Combat`)
				.setColor(color)
				.setDescription(firstPageContent);

			await interaction.editReply({ embeds: [firstEmbed] });

			for (let i = 1; i < pages.length; i++) {
				const pageEmbed = new EmbedBuilder()
					.setTitle(`${EMOJI.SWORD} Combat (${i + 1}/${pages.length})`)
					.setColor(color)
					.setDescription(pages[i]);
				await interaction.followUp({ embeds: [pageEmbed] });
			}

			// Update battle morale based on combat result
			const moraleDelta = won
				? (battleUtil.ENEMY_MORALE_VALUES[enemyId] ?? 1)
				: -3;
			await battleUtil.updateMorale(moraleDelta, won ? `fight win: ${enemyId}` : `fight loss: ${enemyId}`);
			if (!won) {
				const locationUtil = require('@utility/locationUtility.js');
				await locationUtil.moveCharacterToLocation(userId, battleUtil.BOONG_SINH_HOAT_ID, interaction.guild);
				console.log(`[Battle] Player ${userId} defeated — moved to living quarters.`);
			}
			// Boss kill: permanently reduce drain baseline by 2
			if (won && battleUtil.BOSS_ENEMIES.has(enemyId)) {
				const currentReduction = await battleUtil.getFlag('hms_divine_drain_reduction');
				await battleUtil.setFlag('hms_divine_drain_reduction', currentReduction + 2);
			}

			// 15% chance: trigger a random encounter/opportunity after a win (main deck only)
			if (won) {
				const isOnMainDeck = currentZone.id === arbranceIds.arb_main_deck;
				if (isOnMainDeck && Math.random() < 0.15) {
					const [
						armorySecured, cannonDeckHp, morale,
						boatswainDefeated, masterDefeated, firstMateDefeated,
					] = await Promise.all([
						battleUtil.getFlag('global.arb_armory_secured'),
						battleUtil.getFlag('global.arb_cannon_deck_hp'),
						battleUtil.getFlag('global.hms_divine_morale'),
						battleUtil.getFlag('global.arb_boss_boatswain_defeated'),
						battleUtil.getFlag('global.arb_boss_master_at_arms_defeated'),
						battleUtil.getFlag('global.arb_boss_first_mate_defeated'),
					]);

					const pool = [];
					if ((!armorySecured || cannonDeckHp > 0) && morale < 40) {
						pool.push('arb-armory-opening');
					}
					if (!boatswainDefeated) pool.push('arb-boss-boatswain-intro');
					if (!masterDefeated) pool.push('arb-boss-master-at-arms-intro');
					if (!firstMateDefeated) pool.push('arb-boss-first-mate-intro');
					pool.push('arb-renc-wounded-ally-intro', 'arb-renc-breach-intro', 'arb-renc-pinned-gunner-intro');

					if (pool.length > 0) {
						const picked = pool[Math.floor(Math.random() * pool.length)];
						await interaction.client.eventUtil.processEvent(picked, interaction, userId);

						// Cascade: random encounters (not bosses) can chain another opportunity
						const RENC_POOL = ['arb-renc-wounded-ally-intro', 'arb-renc-breach-intro', 'arb-renc-pinned-gunner-intro'];
						const MAX_CASCADE = 3;
						let cascadeDepth = 0;
						let lastPicked = picked;
						while (
							lastPicked.startsWith('arb-renc-') &&
							cascadeDepth < MAX_CASCADE &&
							Math.random() < 0.15
						) {
							const cascadePicked = RENC_POOL[Math.floor(Math.random() * RENC_POOL.length)];
							await interaction.client.eventUtil.processEvent(cascadePicked, interaction, userId);
							lastPicked = cascadePicked;
							cascadeDepth++;
						}
					}
				}
			}

		}
		catch (error) {
			console.error('Error in fight command:', error);
			if (!interaction.replied && !interaction.deferred) {
				await interaction.reply({ content: 'An error occurred.', flags: MessageFlags.Ephemeral });
			}
			else {
				await interaction.editReply({ content: 'An error occurred.' }).catch((editError) => {
					console.error('Failed to edit fight error reply:', editError);
				});
			}
		}
	},
};
