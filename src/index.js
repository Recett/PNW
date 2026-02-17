// Load environment variables from .env file (for local development)
// Railway will provide environment variables directly
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Configure module aliases manually (since package.json is in parent directory)
const moduleAlias = require('module-alias');
moduleAlias.addAliases({
	'@root': __dirname,
	'@': __dirname,
	'@models': require('path').join(__dirname, 'models'),
	'@utility': require('path').join(__dirname, 'utility'),
	'@events': require('path').join(__dirname, 'events'),
	'@data': require('path').join(__dirname, 'Data'),
});

const Discord = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');

// Load environment variables (for Railway) or fallback to config.json (for local dev)
let token;
try {
	if (process.env.DISCORD_TOKEN) {
		token = process.env.DISCORD_TOKEN;
	}
	else {
		const config = require('./config.json');
		token = config.token;
	}
}
catch (error) {
	console.error('Failed to load Discord token. Please set DISCORD_TOKEN environment variable or create config.json');
	process.exit(1);
}

// Create a new client instance
const client = new Discord.Client({
	intents: [
		Discord.GatewayIntentBits.Guilds,
		Discord.GatewayIntentBits.GuildMessages,
		Discord.GatewayIntentBits.GuildMembers,
		Discord.GatewayIntentBits.GuildMessageReactions,
		Discord.GatewayIntentBits.DirectMessages,
		Discord.GatewayIntentBits.DirectMessageReactions,
	],
	partials: [
		Discord.Partials.Message,
		Discord.Partials.Reaction,
		Discord.Partials.User,
	],
});

client.characterUtil = require('@utility/characterUtility.js');
client.eventUtil = require('@utility/eventUtility.js');
client.locationUtil = require('@utility/locationUtility.js');
client.commands = new Collection();
client.util = require('@/utilities.js');
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		}
		else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

client.cooldowns = new Collection();


const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
	const filePath = path.join(eventsPath, file);
	const event = require(filePath);
	if (event.once) {
		client.once(event.name, (...args) => event.execute(...args));
	}
	else {
		client.on(event.name, (...args) => event.execute(...args));
	}
}

client.error = (error) => {
	let stack = error.stack.toString().split('\n');
	client.log('ERROR', stack.shift());
	console.error(error);
};

client.log = (cat = 'LOG', message = '', prependLines = 0, appendLines = 0) => {
	const breakLength = 60;
	const colours = new Map([
		// magenta
		['WATCHER', '\x1b[35m'],
		// magenta
		['API', '\x1b[35m'],
		// cyan
		['COMMAND', '\x1b[36m'],
		// blue
		['STARTED', '\x1b[34m'],
		// green
		['READY', '\x1b[32m'],
		// green
		['SUCCEEDED', '\x1b[32m'],
		// yellow
		['WARNING', '\x1b[33m'],
		// red
		['ERROR', '\x1b[31m'],
		// red
		['FAILED', '\x1b[31m'],
		// red
		['STOPPED', '\x1b[31m'],
		// white
		['LOG', '\x1b[37m'],
	]);
	cat = cat.toUpperCase();
	if (prependLines > 1) console.log(''.padEnd(prependLines - 1, '\n').padEnd(breakLength + prependLines - 1, '='));
	else if (prependLines > 0) console.log(''.padEnd(prependLines, '\n'));
	process.stdout.write(`[${colours.get(cat) ?? '\x1b[0m'}${cat.padStart(cat.length + Math.floor((11 - cat.length) / 2)).padEnd(11)}\x1b[0m] `);
	console.log(message);
	if (appendLines > 1) console.log(''.padEnd(breakLength, '=').padEnd(breakLength + appendLines - 1, '\n'));
	else if (appendLines > 0) console.log(''.padEnd(appendLines, '\n'));
};

// Start scheduled cron jobs (e.g., daily maintenance)
const { startCronJob } = require('./utility/cronUtility.js');
startCronJob();

client.login(token);
