# Cron Jobs Reference

All scheduled jobs are defined in `src/utility/cronUtility.js` and started via `startCronJob(client)` called from `src/index.js` on bot startup.

Execution history is tracked in the `cron_logs` table (Sequelize model: `CronLog`). Health status is tracked in `cron_health_checks` (Sequelize model: `CronHealthCheck`), updated by the health monitor every 30 minutes.

---

## How Cron Syntax Works

```
┌──── minute (0–59)
│  ┌─── hour (0–23)
│  │  ┌── day of month (1–31)
│  │  │  ┌─ month (1–12)
│  │  │  │  ┌ day of week (0–7, 0 and 7 = Sunday)
│  │  │  │  │
*  *  *  *  *
```

Common shorthands: `*` = every, `0` = at zero/start of the unit.

Examples:
- `0 * * * *` → at minute 0 of every hour (hourly)
- `0 0 * * *` → at 00:00 every day (midnight)
- `0 0 * * 0` → at 00:00 every Sunday (weekly)
- `*/30 * * * *` → every 30 minutes

---

## Every 30 Minutes

### `health_monitor` — Cron Health Checks

| Field | Value |
|---|---|
| Schedule | `*/30 * * * *` |
| Fires | Every 30 minutes |
| DB key | `health_monitor` |
| Function | `performHealthCheck()` |

**What it does:**
- Iterates all jobs registered in `cron_logs` (excluding itself)
- Calls `monitor.updateHealthStatus(job_name)` for each, writing a row to `cron_health_checks`
- Logs a warning if any job reaches `critical` status
- Reports counts of `healthy` / `warning` / `critical` jobs to the enhanced monitor

**Catch-up on restart:** No — monitoring ticks are not replayed on startup.

---

## Hourly Jobs

### `hourly_job` — HP & Stamina Regeneration + World State

| Field | Value |
|---|---|
| Schedule | `0 * * * *` |
| Fires | Every hour at :00 |
| DB key | `hourly_job` |
| Function | `performHourlyJob()` |

**What it does:**
- Increases `currentStamina` by 5% of `maxStamina` (rounded up), capped at `maxStamina`, for all characters in a `town`-type location
- Increases `currentHp` by 5% of `maxHp` (same rule) for all characters in town
- Triggers `performPendingDeleteCleanup()` — cleans up stale deferred message deletions (see below)
- Triggers `performGalebyCycle()` — rolls Galeby's hourly presence (see below)

**Catch-up on restart:** Yes — replays every missed hourly tick between the last recorded run and now. For example, if the bot was down for 3 hours, 3 catch-up ticks fire immediately on startup.

---

### `pending_delete_cleanup` — Stale Event Message Cleanup

| Field | Value |
|---|---|
| Schedule | Runs inside `hourly_job` + once on startup |
| Fires | Every hour, and immediately when the bot starts |
| DB key | *(no dedicated log entry — part of `hourly_job`)* |
| Function | `performPendingDeleteCleanup()` |

**What it does:**
- Queries all `character_settings` rows where `setting = '_pending_delete'`
- Each row stores `channelId|messageId|timestamp`, written when an event conversation ends and its closing message is deferred for deletion
- Skips rows whose timestamp is less than 1 hour old (the normal in-memory `setTimeout` is still active for those)
- For rows older than 1 hour: fetches the Discord message and deletes it, then destroys the DB row
- If `_discordClient` is not available, skips silently

**Why it exists:**
Event conversations schedule their closing message for deletion after 1 hour so players can re-read it. If the bot restarts during that window, the in-memory `setTimeout` is lost. This routine catches those stragglers on the next hourly tick or immediately on startup.

---

### `galeby_cycle` — John Galeby Hourly Presence Roll

| Field | Value |
|---|---|
| Schedule | Runs inside `hourly_job` |
| Fires | Every hour at :00 |
| DB key | *(no dedicated log entry — part of `hourly_job`)* |
| Function | `performGalebyCycle()` |
| Constant | `GALEBY_APPEAR_CHANCE = 25` |

**What it does:**
- Rolls 1–100 at the start of each hour
- If roll ≤ 25 (25% chance): sets `global_flags.galeby_present = 1` — Galeby appears for all players this hour
- Otherwise: sets `global_flags.galeby_present = 0` — Galeby is absent
- Logs the roll result and outcome to console

**Effect on gameplay:**
- The NPC `john-galeby` has a `required_checks` entry gating on `global.galeby_present == 1`
- When the flag is 0, Galeby is invisible in `/look` and `/interact` for all players
- Expected ~6 visible hours per 24h; errors are caught silently so a failure does not affect the rest of `hourly_job`

**Initial state:** On first deploy, `galeby_present` does not exist in `global_flags` — Galeby is absent until the first hourly tick fires. Seed manually if needed: `INSERT OR REPLACE INTO global_flags (flag_name, flag_value) VALUES ('galeby_present', 1);`

---

## Daily Jobs

### `midnight_job` — Bilge Ecosystem Daily Cycle

| Field | Value |
|---|---|
| Schedule | `0 0 * * *` |
| Fires | Every day at 00:00 (midnight) |
| DB key | `midnight_job` |
| Function | `performCronJob()` → `performBilgeEcosystemDailyCycle()` |

**What it does (`performBilgeEcosystemDailyCycle`):**
- **Rat population growth** — logistic growth formula: `births = clamp(floor(adults × 0.8 × (1 − adults/100)), 10, 20)`. Previous babies become adults (capped at 100), new babies replace them.
- **Food stock drain** — each tick drains `(adults × 2) + (babies × 1) + 10` food from `global.food_stock` (minimum 0)
- **Rat King HP regen** — if `global.rat_king_slain == 0` and a `global.rat_king_hp` record exists, regenerates HP by `regen_per_day` (from enemy content) up to max HP
- **Flag initialization** — on first run, seeds `global.rat_adults = 20`, `global.rat_babies = 8`, `global.food_stock = 300` if they don't exist

**Global flags used:** `global.rat_adults`, `global.rat_babies`, `global.food_stock`, `global.rat_king_slain`, `global.rat_king_hp`

**Catch-up on restart:** Yes — if the last recorded run was more than 24 hours ago, runs once immediately on startup.

---

### `daily_task_processor` — YAML Task Runner

| Field | Value |
|---|---|
| Schedule | `0 1 * * *` |
| Fires | Every day at 01:00 (offset from midnight job) |
| DB key | `daily_task_processor` |
| Function | `performDailyTasks()` |

**What it does:**
- Calls `taskUtility.processScheduledTasks('daily')` to execute all active daily tasks defined in `src/content/tasks/all_tasks.yaml`
- Tasks are evaluated per-character: each character that passes the task's `checks` has its `actions` (flag/item/stat) applied
- Logs totals: tasks processed, characters processed, succeeded, failed
- Logs a warning to the monitor if any executions failed

**Currently active tasks:**
- `galeby-daily-progression` — for each character with `char.galeby_talked_today == 1`: resets that flag to 0 and increments `char.gale_met` by 1 (unlocks the next Galeby conversation stage)

**Catch-up on restart:** Yes — if the last recorded run was more than 24 hours ago, runs once immediately on startup.

---

## Weekly Jobs

### `weekly_stock_reset` — NPC Shop Restock

| Field | Value |
|---|---|
| Schedule | `0 0 * * 0` |
| Fires | Every Sunday at 00:00 |
| DB key | `weekly_stock_reset` |
| Function | `performWeeklyStockReset()` |

**What it does:**
- Deletes all rows from `npc_purchases` — resets purchase counts so NPC shop stock limits (defined per-NPC in YAML) are fully restored for the new week

**Catch-up on restart:** Yes — if the last recorded run was more than 7 days ago, runs once immediately on startup.

---

## Adding a New Cron Job

1. Define a `new CronJob('...cron expression...', async () => { ... })` at the top of `cronUtility.js`
2. Write a `performXxx()` async function with the job logic
3. Inside `startCronJob()`:
   - Upsert a `CronLog` row to register the job
   - Add catch-up logic if needed
   - Call `xxxJob.start()`
4. Export the job variable from `module.exports` if needed externally
5. Add an entry to this document under the appropriate timing section

### Sub-functions (no dedicated CronLog entry)
If the new job is a helper called from within an existing job (like `performGalebyCycle` or `performPendingDeleteCleanup`), document it under its parent job section rather than as a top-level entry. Wrap it in its own try/catch so failures don't abort the parent job.
