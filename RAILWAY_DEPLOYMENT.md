# Discord RPG Bot - Railway Deployment Guide

## Prerequisites

1. A Railway account (https://railway.app/)
2. Your Discord bot token and application IDs
3. Git repository with your bot code

## Initial Setup

### 1. Create a New Railway Project

1. Go to [Railway.app](https://railway.app/) and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. Railway will automatically detect it's a Node.js project

### 2. Configure Environment Variables

In your Railway project dashboard, go to **Variables** and add the following:

```env
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_CLIENT_ID=your_discord_application_client_id_here
DISCORD_GUILD_ID=your_discord_server_guild_id_here
NODE_ENV=production
DATABASE_PATH=/data/database.sqlite
```

**Important:** Replace the placeholder values with your actual Discord credentials:
- `DISCORD_TOKEN`: Found in Discord Developer Portal > Bot section
- `DISCORD_CLIENT_ID`: Your application ID from Discord Developer Portal
- `DISCORD_GUILD_ID`: Your Discord server ID (right-click server > Copy ID with Developer Mode enabled)

### 3. Set Up Database Persistence (CRITICAL!)

SQLite requires persistent storage. Railway provides volumes for this:

1. In your Railway project, click **"+ Create"** → **"Volume"**
2. Set the mount path to `/data`
3. This ensures your database persists across deployments

**Without a volume, your database will reset on every deployment!**

### 4. Deploy the Bot

1. Railway will automatically deploy when you push to your main branch
2. Watch the deployment logs for any errors
3. Once deployed, your bot should come online in Discord

### 5. Register Slash Commands

After the first deployment, you need to register your slash commands:

**Option 1: Local Command Registration (Recommended for first time)**
```bash
# On your local machine with .env or config.json configured
npm run deploy-commands
```

**Option 2: Railway Shell**
```bash
# In Railway dashboard > Settings > Deploy Logs
# Click "Deploy Logs" then use the shell feature
npm run deploy-commands
```

## Project Structure

```
├── src/
│   ├── index.js              # Main bot entry point
│   ├── deploy-commands.js    # Slash command registration
│   ├── dbObject.js           # Database setup
│   ├── commands/             # Slash command implementations
│   ├── events/               # Discord event handlers
│   ├── models/               # Sequelize models
│   └── utility/              # Business logic utilities
├── .env.example              # Environment variable template
├── railway.json              # Railway configuration
├── Procfile                  # Process configuration
└── package.json              # Dependencies and scripts
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | ✅ Yes | Discord bot token from Developer Portal |
| `DISCORD_CLIENT_ID` | ✅ Yes | Discord application client ID |
| `DISCORD_GUILD_ID` | ✅ Yes | Discord server (guild) ID for slash commands |
| `NODE_ENV` | ⚠️ Recommended | Set to `production` for Railway |
| `DATABASE_PATH` | ⚠️ Recommended | Path to SQLite database file (use `/data/database.sqlite` with volume) |

## Database Management

### Initial Database Setup

On first deployment, the database will be automatically created when the bot starts. The schema is defined in `src/models/` and synced via `dbObject.js`.

### Database Schema Updates

If you modify database models:

```bash
# Run this locally or in Railway shell
node src/dbObject.js --alter
```

⚠️ **Warning:** This operation takes 5+ minutes. Be patient and don't interrupt it!

### Backup Database

To backup your production database from Railway:

1. Go to Railway project dashboard
2. Click on your service
3. Navigate to **Volumes**
4. Use Railway CLI to download:

```bash
railway volume download /data
```

## Monitoring and Logs

### View Bot Logs

- Railway Dashboard > Your Service > **Deploy Logs**
- Real-time logs show bot activity, errors, and Discord events

### Check Bot Status

- Ensure bot appears online in Discord
- Test slash commands with `/lookaround` or similar
- Check logs for connection errors

## Common Issues and Solutions

### Bot doesn't come online

**Check:**
- ✅ `DISCORD_TOKEN` is correctly set
- ✅ Bot has proper permissions in Discord Developer Portal
- ✅ Gateway intents are enabled (Guilds, Guild Messages, Guild Members, etc.)

### Slash commands not appearing

**Solution:**
```bash
npm run deploy-commands
```

### Database resets on every deployment

**Solution:**
- Ensure you have a Railway **Volume** mounted to `/data`
- Set `DATABASE_PATH=/data/database.sqlite` in environment variables

### Canvas/Image generation not working (stat command fails)

**Symptoms:**
- `/stat` command works with `plain:true` but fails with default image mode
- Error logs mention canvas, image generation, or `@napi-rs/canvas` errors

**Solution:**
The bot uses `@napi-rs/canvas` for generating stat cards, which requires native system libraries. Railway uses Nixpacks as its build system, which reads configuration from `nixpacks.toml` in the project root.

**Required Configuration:**

1. **Verify `nixpacks.toml` exists** in project root with the following content:
```toml
[phases.setup]
nixPkgs = [
  "nodejs_20",
  "cairo",
  "pango",
  "libjpeg",
  "giflib",
  "librsvg",
  "pixman",
  "liberation_ttf",
  "noto-fonts-emoji"
]
nixLibs = [
  "cairo",
  "pango",
  "libjpeg",
  "giflib",
  "librsvg",
  "pixman"
]

[phases.install]
cmds = ["npm ci"]

[start]
cmd = "node src/index.js"
```

2. **Redeploy** after adding/updating `nixpacks.toml`. Railway will detect the new configuration and install the required system packages during the build phase.

3. **Fallback:** The bot automatically falls back to plain text mode if canvas initialization fails, so the `/stat` command will still work but without the image card.

**Note:** The old `railpack.json` file was for Paketo buildpacks (Railway's legacy build system) and is no longer used. Railway now uses Nixpacks by default.

### "Module not found" errors

**Check:**
- All dependencies are in `package.json` dependencies (not devDependencies)
- `module-alias` is properly configured
- Railway has successfully run `npm install`

### SQLite locked database errors

**Solution:**
- Only run one instance of the bot
- Don't run `dbObject.js --alter` while bot is running
- Restart the Railway service

## Updating the Bot

1. Push changes to your GitHub repository
2. Railway automatically detects changes and redeploys
3. Database persists through updates (if using volume)
4. If you changed slash commands, run `npm run deploy-commands` again

## Local Development

To develop locally:

1. Copy `.env.example` to `.env` (or use `src/config.json`)
2. Fill in your Discord credentials
3. Run the bot:

```bash
npm install
npm start
```

## Security Best Practices

- ✅ Never commit `config.json`, `token.json`, or `.env` files
- ✅ Keep `.gitignore` updated
- ✅ Rotate Discord token if accidentally exposed
- ✅ Use Railway's environment variables for all secrets
- ✅ Enable 2FA on your Discord and Railway accounts

## Performance Tips

- Railway free tier restarts after inactivity - consider upgrading for 24/7 uptime
- SQLite is suitable for small-medium bots; consider PostgreSQL for larger deployments
- Monitor memory usage in Railway dashboard
- Use Railway's metrics to track performance

## Support and Resources

- [Railway Documentation](https://docs.railway.app/)
- [Discord.js Guide](https://discordjs.guide/)
- [Sequelize Documentation](https://sequelize.org/docs/v6/)

## Railway CLI Commands

Install Railway CLI:
```bash
npm i -g @railway/cli
```

Useful commands:
```bash
railway login                 # Login to Railway
railway link                  # Link local project to Railway
railway run npm start         # Run locally with Railway env vars
railway logs                  # View deployment logs
railway shell                 # Open shell in Railway environment
railway volume download /data # Backup database
```

---

## Quick Deployment Checklist

- [ ] Create Railway project from GitHub repo
- [ ] Add all required environment variables (DISCORD_TOKEN, CLIENT_ID, GUILD_ID)
- [ ] Create and mount volume to `/data`
- [ ] Set `DATABASE_PATH=/data/database.sqlite`
- [ ] Wait for initial deployment to complete
- [ ] Run `npm run deploy-commands` to register slash commands
- [ ] Verify bot is online in Discord
- [ ] Test basic commands

---

**Last Updated:** February 2026  
**Bot Version:** 1.0.0
