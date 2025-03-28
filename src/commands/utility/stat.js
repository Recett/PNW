const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stat')
		.setDescription('Check your stat'),
	async execute(interaction) {
		await ia.embed
	      .setTitle(name)
	      .setDescription("Campaign creation completed. Here are the initial details of the camp:")
	      .addFields(
        { name: "Type", value: `${isOS ? "OS" : "Full"} / ${isVoice ? "Voice" : "Text"}`, inline: true },
        { name: "State", value: newCamp.state, inline: true },
        { name: "DM", value: `${guild.members.resolve(master)}`, inline: true },
        { name: "Roleplay Channel", value: `<#${newCamp.roleplayChannel}>`, inline: true },
        { name: "Discuss Channel", value: `<#${newCamp.discussChannel}>`, inline: true },
        { name: "Role", value: `<@&${newCamp.role}>`, inline: true },
        { name: "Players", value: "No one yet" },
        { name: "Description", value: newCamp.description || "None" },
        { name: "Notes", value: newCamp.notes || "None" }
      );
	},
};
