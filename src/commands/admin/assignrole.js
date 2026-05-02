const {
	SlashCommandBuilder,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
} = require('discord.js');
const { CharacterBase } = require('@root/dbObject.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('assignrole')
		.setDescription('Create the Explorer role (if missing) and assign it to all registered players.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
		.setContexts(InteractionContextType.Guild),

	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const guild = interaction.guild;

			// Create or find the Explorer role
			let role = guild.roles.cache.find(r => r.name === 'Explorer');
			if (!role) {
				role = await guild.roles.create({
					name: 'Explorer',
					reason: 'Auto-created by /assignrole admin command.',
				});
			}

			// Fetch all registered characters
			const characters = await CharacterBase.findAll({ attributes: ['id'] });
			if (!characters.length) {
				return await interaction.editReply({ content: 'No registered characters found in the database.' });
			}

			let assigned = 0;
			let skipped = 0;
			let failed = 0;

			for (const character of characters) {
				try {
					const member = await guild.members.fetch(character.id).catch(() => null);
					if (!member) {
						skipped++;
						continue;
					}
					if (member.roles.cache.has(role.id)) {
						skipped++;
						continue;
					}
					await member.roles.add(role, 'Assigned Explorer role via /assignrole admin command.');
					assigned++;
				}
				catch (err) {
					console.error(`[assignrole] Failed to assign role to ${character.id}:`, err);
					failed++;
				}
			}

			const roleCreatedNote = role.createdTimestamp > Date.now() - 5000
				? ' (role was just created)'
				: ' (role already existed)';

			return await interaction.editReply({
				content: [
					`**Explorer** role assigned${roleCreatedNote}.`,
					`- Assigned: **${assigned}**`,
					`- Already had role / not in server: **${skipped}**`,
					`- Failed: **${failed}**`,
				].join('\n'),
			});
		}
		catch (error) {
			console.error('[assignrole] Error:', error);
			return await interaction.editReply({ content: 'An error occurred while assigning the role.' });
		}
	},
};
