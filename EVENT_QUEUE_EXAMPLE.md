# Non-Recursive Event System Example

## Problem Solved
- Events should complete fully before the next event is called
- `handleEvent` should not call `handleEvent` (no recursion)
- Next events are determined dynamically based on check results, combat outcomes, user choices

## How It Works

### 1. Event Resolution Flow
```javascript
handleEvent(eventId) 
  → processEvent() // Complete all processing
    ├─ Execute checks
    ├─ Process combat  
    ├─ Execute actions (may set session.nextEvent)
    ├─ Handle user interaction
    └─ Complete current event
  → Check session.nextEvent
  → If exists: handleEvent(nextEventId) // After current completes
```

### 2. Event Flow Example
```
Call: handleEvent("discover_cave")

Process "discover_cave":
├─ Player succeeds archaeology check
├─ Check success action sets: session.nextEvent = "enter_cave"
├─ Display message to user
├─ Handle user interaction
└─ Complete "discover_cave" ✓

Check session.nextEvent → "enter_cave" found
Call: handleEvent("enter_cave")

Process "enter_cave":
├─ Combat occurs: player defeats guardian  
├─ Combat victory action sets: session.nextEvent = "treasure_room"
├─ Display combat results
├─ Handle user interaction
└─ Complete "enter_cave" ✓

Check session.nextEvent → "treasure_room" found
Call: handleEvent("treasure_room")

Process "treasure_room":
├─ Player gains treasure
├─ No actions set nextEvent
├─ Display treasure message
└─ Complete "treasure_room" ✓

Check session.nextEvent → null
End of event chain
```

## Implementation Benefits

### ✅ **No Recursion**
- Current event completes fully before next begins
- `executeEventAction` stores next event info instead of calling it
- `handleEvent` calls next event only after current finishes

### ✅ **Complete Event Resolution** 
- All checks, combat, actions, UI interactions finish first
- Clean separation between events
- Predictable execution order

### ✅ **Dynamic Event Determination**
- Next event determined by actual results (check success/failure, combat victory/defeat, user choices)
- Not a pre-determined queue
- Multiple factors can influence next event

### ✅ **Last Action Wins**
- If multiple actions set `session.nextEvent`, the last one takes effect
- Allows complex conditional logic
- Higher execution_order actions can override earlier ones

## Session-Based Event Chaining

| Action Trigger | When nextEvent Set | Example |
|---------------|-------------------|---------|
| `check_success` | After check succeeds | Archaeology success → "secret_entrance" |
| `check_failure` | After check fails | Failed lockpick → "alert_guards" |
| `combat_victory` | After combat won | Defeat boss → "treasure_chamber" |
| `combat_defeat` | After combat lost | Player defeated → "respawn_location" |
| `option_selected` | After user choice | Choose "sneak" → "stealth_approach" |
| `immediate` | During event setup | Story progression → "next_chapter" |

This ensures events flow logically based on actual outcomes while maintaining complete separation between event lifecycles - exactly as requested!