const { Client, Collection, Events, GatewayIntentBits, MessageFlags } = require('discord.js');
const Discord = require("discord.js");
const PFB = Discord.PermissionFlagsBits;

function flattenOptions(options) {
	if (!options.find((o) => o.options)) return options;
	let tempOptions = options.filter((o) => !o.options);
	options.filter((o) => o.options).forEach((o) => tempOptions.push(...flattenOptions(o.options)));
	tempOptions.forEach((o) => (o.value = o.attachment?.name ?? o.role?.name ?? o.channel?.name ?? o.member?.displayName ?? o.user?.username ?? o.value));
	return tempOptions;
}

function checkUserPermission(ia, command) {
	switch (command.authority) {
		case "developer":
			return ia.user.id == '275992469764833280';
		case "owner":
			return ia.member == ia.guild.owner;
		case "administrators":
			return ia.member.permissions.has(PFB.Administrator);
		case "moderators":
			return ia.member.permissions.has(PFB.Administrator);
		case "dungeonmasters":
			return ia.guild.id == ia.client.data.tlg.id
				? ia.member.roles.cache.find((r) => r.id == ia.client.data.tlg.dmRoleID) ||
						ia.member.roles.cache.find((r) => r.id == ia.client.data.tlg.modRoleID) ||
						ia.member.permissions.has(PFB.Administrator)
				: ia.member.permissions.has(PFB.Administrator);
		default:
			return true;
	}
}

function checkBotPermission(ia, command) {
	if (ia.channel.type == "dm") return true;
/*	if (!ia.guild.members.me.permissions.has([...command.botPermissions, PFB.SendMessages])) {
		ia.reply({
			content:
				"Cannot execute the command because the bot lacks the following permissions:\n" +
				`\`${ia.guild.members.me.permissions.missing(Discord.PermissionsBitField.resolve(command.botPermissions))}\``,
			flags: MessageFlags.Ephemeral,
		});
		return false;
	}*/
	return true;
}

function commandLog(ia, subcommand, subgroup) {
	const data = flattenOptions(ia.options.data);
	const maxLength = Math.max(...data.map((o2) => o2.name.length));
	return (
		`${ia.commandName}${subgroup ? " | " + subgroup : ""}${subcommand ? " | " + subcommand : ""}` +
		`\n				Options : ${data.map((o) => `\n								${o.name.padEnd(maxLength)} : ${`${o.value}`.slice(0, 20)}`)}` +
		`\n				Guild	 : ${ia.guild?.name ?? "None"}${ia.guild ? " (" + ia.guildId + ")" : ""}` +
		`\n				Channel : ${ia.guild ? ia.channel.name : "Direct Message"} (${ia.channelId})` +
		`\n				Caller	: ${ia.member.displayName ?? ia.user.username} (${ia.user.id})` +
		`\n				Time		: ${ia.createdAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} GMT+7`
	);
}

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isChatInputCommand()) return;

		// Check developer mode
/*				if ((ia.client.developerMode && ia.user.id != process.env.OWNER_ID)
					return interaction.reply({ content: pickRandom(ia.client.data.replies.developerMode) });*/
		//let [subcommand, subgroup] = [ia.options.getSubcommand(false), ia.options.getSubcommandGroup(false)];
		const command = interaction.client.commands.get(interaction.commandName);

				// Check permissions
		if (!checkUserPermission(interaction, command)) return interaction.reply({ content: pickRandom(ia.client.data.replies[command.authority]) });
		if (!checkBotPermission(interaction, command)) return;
		//interaction.client.log("COMMAND", commandLog(interaction, subcommand, subgroup), 2, 0);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}


		const { cooldowns } = interaction.client;

		if (!cooldowns.has(command.data.name)) {
			cooldowns.set(command.data.name, new Collection());
		}

		const now = Date.now();
		const timestamps = cooldowns.get(command.data.name);
		const defaultCooldownDuration = 3;
		const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1_000;

		if (timestamps.has(interaction.user.id)) {
			const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;

			if (now < expirationTime) {
				const expiredTimestamp = Math.round(expirationTime / 1_000);
				return interaction.reply({ content: `Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`, flags: MessageFlags.Ephemeral });
			}
		}

		timestamps.set(interaction.user.id, now);
		setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
			} else {
				await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
			}
		}
	},
};