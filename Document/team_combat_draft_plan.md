# Team Combat Draft Plan

## Purpose

This document describes the first implementation pass for draft-only team combat.

The goal is to build an isolated proof of concept for raid-style co-op combat with multiple players versus multiple enemies without touching the current live combat path.

This draft is not integrated into raids, events, slash commands, reward persistence, or the live battle report formatter.

## Current Production State

The current production combat system lives in [src/utility/combatUtility.js](f:/Personal3/src/utility/combatUtility.js).

Current live behavior:

- `runInitTracker(actors, options)` already accepts an actor array.
- Target resolution inside the live engine still assumes exactly two combatants.
- `mainCombat(playerId, enemyId, options)` builds exactly one player actor and one enemy actor.
- The live path persists HP and statuses, applies combat rewards, and returns formatted battle-report output.
- `writeBattleReport(combatLog, actors, lootResults, combatLogSetting)` is part of the current working user-facing system and should not be changed during the draft phase.
- Event combat in [src/utility/eventUtility.js](f:/Personal3/src/utility/eventUtility.js) currently assumes one session character and one enemy.
- Raid combat in [src/utility/raidManager.js](f:/Personal3/src/utility/raidManager.js) currently runs one character versus one raid monster and tracks one `fighting_character_id`.
- The raid schema in [src/models/raid/raidModel.js](f:/Personal3/src/models/raid/raidModel.js) does not currently include a participant roster model for simultaneous co-op teams.

This current-state snapshot is recorded so future integration work has a stable baseline.

## Draft File Layout

- `src/utility/teamCombatDraft.js`
  Contains the draft team combat engine and the draft wrapper.

- `src/scripts/temp_teamCombatDraftHarness.js`
  A development-only harness used to run the draft engine safely with explicit test inputs.

This file split is intentional.

The draft engine stays isolated from the live combat utility, and the harness stays isolated from the live command flow.

## Definitions

- Engine
  The low-level fight logic that handles turn order, targeting, hit or miss, damage, death checks, and win conditions.

- Wrapper
  The helper that converts higher-level inputs such as character IDs and enemy IDs into combat actors, runs the engine, and shapes the result.

- Harness
  A development-only runner that calls the draft wrapper or engine with sample input so behavior can be inspected safely.

## Draft Scope

Included in the first pass:

- Multiple player actors versus multiple enemy actors.
- Side-based targeting.
- Runtime actor assembly from existing character and enemy data sources.
- Structured combat logs.
- Minimal summary output.

Explicitly excluded in the first pass:

- Live raid integration.
- Live event integration.
- Slash command integration.
- Reward persistence.
- HP persistence.
- Status persistence.
- Changes to the live battle report formatter.
- Schema changes for raid participants or parties.

## Draft Output Strategy

The first draft does not attempt to produce a polished Discord battle report.

Instead, it returns:

- Structured combat log entries.
- A minimal summary including:
  - winning side
  - end reason
  - ticks elapsed
  - final HP of each actor
  - surviving actors
  - defeated actors

This is enough to validate combat rules without risking changes to the current user-facing formatter.

## Draft Engine Rules

The draft engine should:

- support more than two actors
- distinguish teams by `side`
- only target living opponents on the other side
- stop when only one side remains alive or when max ticks is reached
- avoid any database writes

The first targeting rules are intentionally lightweight but no longer fully symmetric:

- player-side default: `focus-fire`
- enemy-side default: `spread-pressure`

Meaning:

- `focus-fire` prefers the most vulnerable opponent and helps a team finish kills.
- `spread-pressure` prefers opponents who have taken less recent target pressure, which reduces instant dogpiling by all enemies onto the first valid player target.

Additional draft strategies supported by the harness:

- `default`
- `focus-fire`
- `spread-pressure`
- `highest-attack`
- `random`

This can change later if the draft reaches an integration phase.

## Harness Usage

Run the draft harness from the project root:

```text
node src/scripts/temp_teamCombatDraftHarness.js --players=<id,id> --enemies=<id,id> [--ticks=400] [--strategy=default|focus-fire|spread-pressure|highest-attack|random] [--show-log] [--json]
```

Example:

```text
node src/scripts/temp_teamCombatDraftHarness.js --players=123,456 --enemies=1,1,2 --ticks=500 --show-log
```

The harness is meant for development only.

It should not be used as a production entry point.

## Future Follow-Up

If the draft proves stable, the future planning phase should answer these questions:

- Should the draft engine be promoted into a shared engine, or remain parallel to the live 1v1 engine?
- Should raid participation get a dedicated schema model?
- Should richer battle formatting be added for team fights later?
- Should team combat remain raid-only, or become a wider gameplay system?

These are future decisions and are intentionally out of scope for the first implementation pass.