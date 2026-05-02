# HMS Divine Battle — Fix Session

## 🔴 Actively Broken
- [x] ~~1. Remove free cross-ship `/move` links~~ — **REJECTED** (current pattern is correct by design; links are the intended boarding path)
- [x] ~~2. `arb_supply_severed` flag never read by `runCannonExchange`~~ — **SUPERSEDED** (armory system via `getArmoryCannonDebuff()` already handles cannon debuff; `arb_supply_severed` flag removed from codebase)

## ❌ Core Loop Broken
- [x] ~~3. Stamina never restores during battle~~ — **RESOLVED** (`performBattleHourlyTasks` gives +20% stamina/hr to all battle-zone players; HP +50%/hr in Boong Sinh Hoat)
- [x] ~~4. Zone Resolution phase missing~~ — **RESOLVED** (undefended HMS zones deal -2 morale + -10 top deck HP per spawned enemy in `spawnEncounters()`)
- [x] ~~5. York cycle report is static~~ — **RESOLVED** (dynamic HP + morale values pulled in `york-cycle-report`)
- [x] ~~6. HMS Defense has no mechanic~~ — **REJECTED** (fighting spawned encounters in HMS zones IS the defense mechanic)
- [x] ~~7. Spawn rate formula not used~~ — **RESOLVED** (morale-based formula: `max(0, 4 + floor(-effectiveMorale/10))`; rigging zones halved; thresholds from `ZONE_MORALE_THRESHOLDS`)
- [x] ~~8. Momentum Breakthrough~~ — **REJECTED**
- [x] ~~9. Chaos events — Ambush, Tactical Displacement, Dynamic NPC Crisis~~ — **RESOLVED** (Ambush = random encounters A/B/C already in `hms_divine_opportunity.yaml`; NPC Crisis = same pool (Wounded Ally, Breach, Pinned Gunner); dispatched via 15% post-win roll in `fight.js`; Tactical Displacement rejected)
- [x] ~~10. Hale death event — scripted NPC crisis at fixed cycle~~ — **RESOLVED** (fires once after cycle 2; posts embed to battle channel, -10 morale; guarded by `hms_divine_hale_dead` flag)
- [ ] 11. Commander HP doesn't persist — no tracking across attempts

## ⚠️ Partial
- [x] ~~12. `hms_divine_sunk` flag never set to 1 in `endBattle()`~~ — **REJECTED**
- [x] ~~13. Fog-of-war descriptor thresholds may be reversed in `getMoraleDescriptor()`~~ — **RESOLVED** (`getMoraleDescriptor` removed entirely; admin status shows raw morale value only)
- [x] ~~14. York hub missing register/volunteer option~~ — **REJECTED**
- [x] ~~15. Intercept stamina cost (5) needs design confirmation~~ — **RESOLVED** (all fighters pay 5 stamina; insufficient stamina halves combat speed instead of blocking; interceptors always allowed to fight)
