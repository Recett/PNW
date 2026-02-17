# Event Logger - Debug Interview Flag Issues

## Purpose
This logger tracks EVERY event processed and EVERY flag action executed during registration/interview to help you debug why JPTF values exceed 24.

## How It Works

The logger creates detailed log files in `src/logs/` showing:
1. Every event processed in order
2. Every virtue flag action (Justice, Prudence, Temperance, Fortitude)
3. Running totals for JPTF
4. Duplicate events (events visited multiple times)

## Quick Start

The logger is already integrated into `eventUtility.js`. Just run registration:

```bash
# 1. Delete your test character
/deletechar

# 2. Register a new character  
/register

# 3. Complete the interview (answer all Ngài York's questions)

# 4. Check the log file
ls src/logs/

# 5. Read the log
cat src/logs/<your_user_id>_interview_registration_<timestamp>.log
```

## What To Look For

### ✅ Normal Output (JPTF ≤ 24):
```
VIRTUE TOTALS:
--------------------------------------------------------------------------------
Justice:     6
Prudence:    6
Temperance:  6
Fortitude:   6
TOTAL JPTF:  24 ✓
```

### ❌ Problem Output (JPTF > 24):
```
VIRTUE TOTALS:
--------------------------------------------------------------------------------
Justice:     10
Prudence:    12
Temperance:  8
Fortitude:   10
TOTAL JPTF:  40 ⚠️  EXCEEDS 24!  

DUPLICATE EVENTS (visited multiple times):
--------------------------------------------------------------------------------
  event_waylan_york_flag_cg: 2 times
  event_waylan_york_flag_ch: 2 times
  event_waylan_york_flag_ci: 2 times
  event_waylan_york_flag_cj: 2 times
```

This tells you:
- JPTF total is 40 (16 over limit)
- Events `cg`, `ch`, `ci`, `cj` ran TWICE
- These are the "common path" events I suspected

## Log File Sections

### 1. EVENTS PROCESSED
Shows every event in the order they were processed:
```
1.   event_waylan_york_a (depth: 0)
2.     event_waylan_york_flag_a (depth: 1)
3.       event_waylan_york_b (depth: 2)
```
Indentation shows nested event calls.

### 2. VIRTUE FLAG ACTIONS
Lists every time a virtue flag was modified:
```
1. event_waylan_york_flag_a: Prudence add 1 (type: Local)
2. event_waylan_york_flag_e: Justice add 1 (type: Local)
3. event_waylan_york_flag_e: Prudence add 2 (type: Local)
```

### 3. VIRTUE TOTALS
The final accumulated values for J, P, T, F and total.

### 4. DUPLICATE EVENTS
**CRITICAL**: If any events appear here, they're being executed multiple times.
This is likely your bug - the same virtue-adding events running repeatedly.

## Manual Debugging

If you want to trace specific events:

```javascript
// In src/scripts/ create check-specific-event.js:
const { EventBase, EventOption, EventActionFlag } = require('@root/dbObject.js');

async function checkEvent(eventId) {
    const event = await EventBase.findByPk(eventId);
    const options = await EventOption.findAll({ where: { event_id: eventId } });
    const flags = await EventActionFlag.findAll({ where: { event_id: eventId } });
    
    console.log(`Event: ${event.name}`);
    console.log(`Tags: ${event.tags}`);
    console.log(`Next: ${event.next_event_id}`);
    console.log(`\\nOptions (${options.length}):`);
    options.forEach(opt => console.log(`  "${opt.text}" → ${opt.next_event_id}`));
    console.log(`\\nFlag Actions:`);
    flags.forEach(f => console.log(`  ${f.flag_name}: ${f.flag_operation} ${f.flag_value}`));
}

checkEvent('event_waylan_york_flag_cg').then(() => process.exit());
```

## Expected Result

Based on my analysis, I predict you'll see:
- Events `event_waylan_york_flag_cg`, `event_waylan_york_flag_ch`, `event_waylan_york_flag_ci`, `event_waylan_york_flag_cj` appearing multiple times
- Each adds +1 to a virtue (J, P, T, F respectively)
- They're a "common final path" that all interview branches converge to
- This causes the base +4 JPTF to be added multiple times

## The Fix

Once you confirm which events are duplicated:

**Option 1**: Remove virtue flags from the common path events
**Option 2**: Add a flag check to prevent re-execution
**Option 3**: Restructure the interview event chain to avoid convergence

Let me know what the log shows!
