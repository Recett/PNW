# Discord RPG Bot

A text-based RPG Discord bot built with Discord.js v14 and SQLite.

## Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Fill in your Discord bot credentials
   - Or use `src/config.json` (see `.env.example` for structure)

3. **Register slash commands:**
   ```bash
   npm run deploy-commands
   ```

4. **Start the bot:**
   ```bash
   npm start
   ```

### Railway Deployment

See [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) for complete deployment instructions.

**Quick steps:**
1. Create Railway project from GitHub repo
2. Add environment variables (DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
3. Create volume mounted to `/data`
4. Deploy and register commands

## Project Structure

- `src/index.js` - Main bot entry point
- `src/commands/` - Slash command implementations
- `src/models/` - Database models (Sequelize)
- `src/utility/` - Business logic utilities
- `src/events/` - Discord event handlers

## Scripts

- `npm start` - Start the bot
- `npm run deploy-commands` - Register slash commands with Discord

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Your Discord bot token |
| `DISCORD_CLIENT_ID` | Discord application client ID |
| `DISCORD_GUILD_ID` | Discord server (guild) ID |
| `DATABASE_PATH` | Path to SQLite database (default: `database.sqlite`) |
| `NODE_ENV` | Environment mode (`development` or `production`) |

## Database

This bot uses SQLite with Sequelize ORM. Database schema is automatically created on first run.

## License

Apache-2.0
