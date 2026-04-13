# Shuleria — Combat Perk Reference

*Values are placeholders pending balance pass.*

---

## Sword

Unique three-tree core structure. Tempo builds via condition perks and discharges at cap into a random Art (attack) and Stance (stat shift). Art raises cap — bigger, rarer discharges. Stance lowers cap — smaller, more frequent discharges.

### Core — Tempo

| Perk | Effect |
|------|--------|
| Tempo I | Gain 1 Tempo per trigger. Unlock 1 Tempo condition perk slot. |
| Tempo II | Gain 2 Tempo per trigger. Unlock 1 additional Tempo condition perk slot. |
| Tempo III | Gain 3 Tempo per trigger. Unlock 1 additional Tempo condition perk slot. |
| Tempo IV | Gain 4 Tempo per trigger. Unlock 1 additional Tempo condition perk slot. |
| Tempo V | Gain 5 Tempo per trigger. Unlock 1 additional Tempo condition perk slot. |

### Core — Art

| Perk | Effect |
|------|--------|
| Art I | Tempo cap +5. Art power +10%. Unlocks Art build perks. |
| Art II | Tempo cap +5. Art power +10%. |
| Art III | Tempo cap +5. Art power +10%. |
| Art IV | Tempo cap +5. Art power +10%. |
| Art V | Tempo cap +5. Art power +10%. Unlocks Tier 2 Art build perks. |

### Core — Stance

| Perk | Effect |
|------|--------|
| Stance I | Tempo cap -3. Stance bonus +10%. Unlocks Stance build perks. |
| Stance II | Tempo cap -3. Stance bonus +10%. |
| Stance III | Tempo cap -3. Stance bonus +10%. |
| Stance IV | Tempo cap -3. Stance bonus +10%. |
| Stance V | Tempo cap -3. Stance bonus +10%. Unlocks Tier 2 Stance build perks. |

### Tempo Condition Perks

Free to equip. Acquisition cost applies. Each requires the corresponding Tempo level. Player selects which conditions generate Tempo.

| Perk | Effect |
|------|--------|
| On Damage Dealt | Gain Tempo when you deal damage. |
| On Damage Taken | Gain Tempo when you take damage. |
| On Evasion | Gain Tempo when you evade an enemy attack. |
| On Block | Gain Tempo when shield absorbs a hit. Requires Shield equipped. |
| On Miss | Gain Tempo when your attack misses. |

### Build Perks

| Perk | Cluster | Timing | Effect |
|------|---------|--------|--------|
| Weighted Draw | A | battle_start | At combat start, begin with partial Tempo already accumulated. |
| Favored Art | A | on_equip | Select one Art. Its chance to be randomly selected on discharge is doubled. |
| Resonance | A | after_turn | If the same Art fires twice in a row, its power is greatly increased on the second trigger. |
| Grand Art | A | after_turn | At maximum Art investment, Arts deal bonus damage equal to total Tempo accumulated before discharge. |
| Quick Shift | B | after_turn | After Stance shifts, gain a brief window of elevated evasion. |
| Favored Stance | B | on_equip | Select one Stance. Its chance to be randomly selected on shift is doubled. |
| Hold Stance | B | before_turn | Stance bonuses persist for X ticks after Tempo discharges before shifting. |
| Fluid Mastery | B | after_turn | At maximum Stance investment, each Stance shift also triggers a free attack. |
| Tempo Surge | A | after_turn | On discharge, immediately begin generating Tempo again at double speed for X ticks. |
| Chaos Master | A | on_equip | When both a rare Art and rare Stance align on the same discharge, deal massive bonus damage. |

---

## Rapier

Parry and counter. Core trees build passive parry chance and riposte damage. Build perks deepen defensive consistency or punish the enemy's aggression.

### Core — Parry

| Perk | Effect |
|------|--------|
| Parry I | Passive parry chance +2% per Rapier skill level. |
| Parry II | Passive parry chance +4% per Rapier skill level. |
| Parry III | Passive parry chance +6% per Rapier skill level. |
| Parry IV | Passive parry chance +8% per Rapier skill level. |
| Parry V | Passive parry chance +10% per Rapier skill level. |

### Core — Riposte

| Perk | Effect |
|------|--------|
| Riposte I | On successful parry, counter-attack deals +2% damage per Rapier skill level. |
| Riposte II | On successful parry, counter-attack deals +4% damage per Rapier skill level. |
| Riposte III | On successful parry, counter-attack deals +6% damage per Rapier skill level. |
| Riposte IV | On successful parry, counter-attack deals +8% damage per Rapier skill level. |
| Riposte V | On successful parry, counter-attack deals +10% damage per Rapier skill level. |

### Build Perks

| Perk | Cluster | Timing | Effect |
|------|---------|--------|--------|
| Steel Patience | A | before_turn | Each parried hit reduces damage taken from the next incoming hit. |
| Deflect | A | before_turn | Parry chance increases when HP is below 50%. Defense sharpens under pressure. |
| Iron Wall | A | on_equip | Flat damage reduction while parry is off cooldown — primed guard reduces incoming hits passively. |
| Perfect Form | A | before_turn | Each consecutive successful parry increases parry chance slightly, max 3 stacks. Resets on failed parry. |
| Follow Through | B | after_turn | Riposte counter-attack deals bonus damage scaled by how much the parry absorbed. |
| Chain Riposte | B | after_turn | On a Riposte hit, parry chance is elevated for 1 additional incoming attack. |
| Wounded Pride | B | after_turn | Riposte applies a debuff — enemy accuracy reduced for X ticks. |
| Death's Patience | B | after_turn | On a Riposte crit, parry chance is greatly elevated for 1 tick. |
| Punish The Bold | B | after_turn | If an enemy crits and you parry it, Riposte deals triple damage. |
| Mirror Edge | B | after_turn | At maximum investment in both trees, successful Riposte has a chance to trigger a second free Riposte. |

---

## Dagger

Bleed application and crit scaling. Build perks deepen bleed payoff or crit expression.

### Core — Bleed

| Perk | Effect |
|------|--------|
| Bleed I | Bleed stack damage +2% per Dagger skill level. |
| Bleed II | Bleed stack damage +4% per Dagger skill level. |
| Bleed III | Bleed stack damage +6% per Dagger skill level. |
| Bleed IV | Bleed stack damage +8% per Dagger skill level. |
| Bleed V | Bleed stack damage +10% per Dagger skill level. |

### Core — Lethality

| Perk | Effect |
|------|--------|
| Lethality I | Crit chance +2% per Dagger skill level. |
| Lethality II | Crit chance +4% per Dagger skill level. |
| Lethality III | Crit chance +6% per Dagger skill level. |
| Lethality IV | Crit chance +8% per Dagger skill level. |
| Lethality V | Crit chance +10% per Dagger skill level. |

### Build Perks

| Perk | Cluster | Timing | Effect |
|------|---------|--------|--------|
| Deep Cut | A | after_turn | Each connecting hit applies 2 bleed stacks instead of 1. |
| Frenzy | A | after_turn | Each bleed stack on the enemy increases your accuracy slightly. |
| Hemorrhage | A | after_turn | Bleed stacks trigger more frequently — enemy movement triggers bleed more often. |
| Bleed Out | A | before_turn | When enemy HP drops below 20%, if they have X or more bleed stacks, deal a burst of bonus damage. |
| Vital Point | B | before_turn | Crit chance increases against enemies above X bleed stacks. |
| Exposed Wound | B | after_turn | On crit, enemy defense is reduced for X ticks. |
| Lethal Precision | B | before_turn | Crit chance scales with number of hits landed this combat. Resets on combat end. |
| Killing Blow | B | before_turn | Against enemies below 30% HP, crit ignores defense AND deals bonus damage. |
| Bleeding Edge | B | after_turn | Crits apply bonus bleed stacks equal to Lethality level. |
| Death Mark | B | before_turn | At maximum investment in both trees, crits against bleeding enemies deal massively increased damage. |

---

## Spear

Tank identity. Passive damage mitigation scaling with Con. Counter-attack on taking a hit, scaling with Str and damage received — can miss. Three stats involved: Con (mitigation), Str (counter power), Dex (counter accuracy). AGI irrelevant.

### Core — Reduction

| Perk | Effect |
|------|--------|
| Reduction I | Incoming damage reduced by X% scaling with Con. Unlocks Cluster A build perks. |
| Reduction II | Damage reduction increased. |
| Reduction III | Damage reduction increased. |
| Reduction IV | Damage reduction increased. |
| Reduction V | Damage reduction increased. Unlocks Tier 2 Cluster A. |

### Core — Counter

| Perk | Effect |
|------|--------|
| Counter I | On taking a hit, fire a counter-attack. Base damage scales with Str + damage received. Can miss. Unlocks Cluster B build perks. |
| Counter II | Counter damage increased. |
| Counter III | Counter damage increased. |
| Counter IV | Counter damage increased. |
| Counter V | Counter damage increased. Unlocks Tier 2 Cluster B. |

### Build Perks

| Perk | Cluster | Timing | Effect |
|------|---------|--------|--------|
| Threshold | A | before_turn | Hits below a damage threshold are reduced dramatically more. Rewards fighting swarms of weak enemies. |
| Fortify | A | after_turn | After taking X hits without dying, damage reduction increases for the rest of combat. |
| Iron Skin | A | on_equip | At maximum Reduction investment, a portion of damage reduction converts into flat defense. |
| Punishing Reach | B | after_turn | Counter hits apply initiative reduction to the enemy. |
| Measured Response | B | after_turn | Counter damage bonus scales higher the harder the triggering hit was. |
| Defiant | B | before_turn | While below 40% HP, counter damage significantly increased. |
| Wall | B | after_turn | At maximum investment in both trees, each successful counter temporarily increases damage reduction. Defense and offense reinforce each other. |

---

## Axe

Single identity: grows through damage taken. Fury stacks on hits received, amplifying damage. Wrath converts accumulated Fury into burst damage. AGI irrelevant.

### Core — Fury

| Perk | Effect |
|------|--------|
| Fury I | Gain 1 Fury per hit taken. Each stack adds X% damage. Max Fury 5. Unlocks Cluster A build perks. |
| Fury II | Max Fury +2. Stack bonus increased. |
| Fury III | Max Fury +2. Stack bonus increased. |
| Fury IV | Max Fury +2. Stack bonus increased. |
| Fury V | Max Fury +2. Stack bonus increased. Unlocks Tier 2 Cluster A. |

### Core — Wrath

| Perk | Effect |
|------|--------|
| Wrath I | At half max Fury or above, next attack deals bonus burst damage equal to current Fury count. Unlocks Cluster B build perks. |
| Wrath II | Wrath burst damage increased. |
| Wrath III | Wrath burst damage increased. |
| Wrath IV | Wrath burst damage increased. |
| Wrath V | Wrath burst damage increased. Unlocks Tier 2 Cluster B. |

### Build Perks

| Perk | Cluster | Timing | Effect |
|------|---------|--------|--------|
| Bloodied | A | battle_start | First hit taken in combat grants double Fury stacks. |
| Scar Tissue | A | after_turn | Fury stacks no longer decay mid-combat. Pain accumulates and stays. |
| Hardened | A | before_turn | At max Fury, gain temporary damage reduction. Taking enough punishment makes you indifferent to it. |
| Undying | A | before_turn | Below 20% HP, Fury stacks generate twice as fast. |
| Retaliation | B | after_turn | Wrath attacks apply initiative reduction to the enemy. |
| Savage | B | after_turn | Wrath attacks have increased crit chance. |
| Blood Frenzy | B | after_turn | Wrath crits generate additional Fury stacks. Pain feeding power feeding pain. |
| Breaking Point | B | after_turn | At maximum investment in both trees, Wrath attacks ignore defense entirely. |

---

## Mace

Tick-based Charge accumulation. Charge builds passively every tick the weapon is on cooldown, discharges entirely on the next attack. Missing wastes the discharge but not the Charge. Str scales discharge power. Slow cooldown is the resource generator, not a drawback.

### Core — Charge

| Perk | Effect |
|------|--------|
| Charge I | Max Charge 5. Gain 1 Charge per tick while on cooldown. Unlocks Cluster A build perks. |
| Charge II | Max Charge +5. Charge gain +1 per tick. |
| Charge III | Max Charge +5. Charge gain +1 per tick. |
| Charge IV | Max Charge +5. Charge gain +1 per tick. |
| Charge V | Max Charge +5. Charge gain +1 per tick. Unlocks Tier 2 Cluster A. |

### Core — Impact

| Perk | Effect |
|------|--------|
| Impact I | Discharge damage scales with Str. +X% per Mace skill level. Unlocks Cluster B build perks. |
| Impact II | Discharge damage bonus increased. |
| Impact III | Discharge damage bonus increased. |
| Impact IV | Discharge damage bonus increased. |
| Impact V | Discharge damage bonus increased. Unlocks Tier 2 Cluster B. |

### Build Perks

| Perk | Cluster | Timing | Effect |
|------|---------|--------|--------|
| Concussive | A | after_turn | Full Charge discharge stuns — enemy loses their next action. |
| Armor Crack | A | after_turn | Discharge strips a portion of enemy defense for X ticks. Scales with Charge at time of firing. |
| Inevitable | A | after_turn | At full Charge, discharge has a chance to ignore defense entirely. |
| Deadweight | A | after_turn | Each tick spent at full Charge before firing adds a flat bonus to the discharge. |
| Hair Trigger | B | on_equip | Charge cap halved. Weapon discharges more frequently at lower peak power. |
| Grit | B | after_turn | On a missed discharge, retain half Charge rather than losing it all. |
| Bruise | B | after_turn | Every discharge, hit or miss, applies a persistent damage-over-time debuff. |
| Unstoppable | B | after_turn | At maximum investment in both trees, discharge cannot miss. |

---

## Shield

Defensive modifier. Absorbs incoming hits when primed. Core trees scale absorption value and bash damage. Build perks deepen defensive stability or offensive discharge.

### Core — Reactive

| Perk | Effect |
|------|--------|
| Reactive I | Shield absorption value (base + Str) +2% per Shield skill level. |
| Reactive II | Shield absorption value +4% per Shield skill level. |
| Reactive III | Shield absorption value +6% per Shield skill level. |
| Reactive IV | Shield absorption value +8% per Shield skill level. |
| Reactive V | Shield absorption value +10% per Shield skill level. |

### Core — Aggressive

| Perk | Effect |
|------|--------|
| Aggressive I | Shield bash damage +2% per Shield skill level. |
| Aggressive II | Shield bash damage +4% per Shield skill level. |
| Aggressive III | Shield bash damage +6% per Shield skill level. |
| Aggressive IV | Shield bash damage +8% per Shield skill level. |
| Aggressive V | Shield bash damage +10% per Shield skill level. |

### Build Perks

| Perk | Cluster | Timing | Effect |
|------|---------|--------|--------|
| Quick Cover | A | on_equip | Shield prime cycle accelerated — initiative gain increased. |
| Stabilize | A | before_turn | Stop attacking entirely. Shield prime cycle greatly accelerated. Weapon goes idle while active. |
| Turtle | A | before_turn | While Stabilize is active, incoming damage further reduced beyond absorption. |
| Impenetrable | A | before_turn | While shield is primed, incoming damage reduced by a percentage of absorption value. |
| Charging Ram | B | after_turn | Shield bash reduces enemy initiative by a flat amount on hit. |
| Build Momentum | B | before_turn | Each tick shield is primed without discharging, bash damage accumulates. Releases all at once. |
| Overwhelm | B | after_turn | If bash hits, enemy accuracy reduced for X ticks. |
| Battering Ram | B | after_turn | Fully charged bash causes enemy to lose their next attack entirely. |
| Counter Stance | B | after_turn | On successful block, bash damage is elevated for 1 tick — block feeds offense. |
| Iron Tide | B | after_turn | At maximum investment in both trees, each block automatically primes a bash at full accumulated value. |

---

## Shortbow

Evasion stacking. Each hit builds 1 evasion stack. All stacks consumed when enemy attacks or evades. Stacks grant evasion and attack speed — core trees scale each independently. Build perks deepen evasion survival, exploit the zero-stack window, or commit to an extreme specialisation.

### Core — Evasion Stack

| Perk | Effect |
|------|--------|
| Evasion Stack I | Each hit builds 1 evasion stack. Each stack: +5% evade. |
| Evasion Stack II | Per-stack evade bonus: +8%. |
| Evasion Stack III | Per-stack evade bonus: +11%. |
| Evasion Stack IV | Per-stack evade bonus: +14%. |
| Evasion Stack V | Per-stack evade bonus: +17%. |

### Core — Momentum

| Perk | Effect |
|------|--------|
| Momentum I | Each stack: +3% attack speed. |
| Momentum II | Each stack: +5% attack speed. |
| Momentum III | Each stack: +7% attack speed. |
| Momentum IV | Each stack: +9% attack speed. |
| Momentum V | Each stack: +11% attack speed. |

### Build Perks

| Perk | Cluster | Timing | Effect |
|------|---------|--------|--------|
| Fluid Motion I | A | after_turn | Every 5 consecutive hits, build 1 bonus stack. |
| Fluid Motion II | A | after_turn | Every 4 consecutive hits, build 1 bonus stack. |
| Fluid Motion III | A | after_turn | Every 3 consecutive hits, build 1 bonus stack. |
| Fluid Motion IV | A | after_turn | Every 2 consecutive hits, build 1 bonus stack. |
| Ghost Step | A | after_turn | When enemy misses, lose half stacks instead of all. |
| Blur | A | after_turn | When a connecting hit would wipe all stacks, retain 1 instead. |
| Counter Draw | B | after_turn | While 3+ stacks active, enemy misses trigger an immediate counter shot. |
| Double Draw | B | after_turn | At 0 stacks, attacks fire a second arrow at reduced damage. |
| Burning Momentum | B | after_turn | Each stack consumed grants +20% attack speed for 4 ticks. |
| Speed Extreme | B | on_equip | Each stack grants ×2 Momentum attack speed bonus. Each stack also reduces evade by the Momentum per-stack value. |
| Evasion Extreme | B | on_equip | Each stack grants ×2 evade bonus. Each stack also reduces attack speed by the Evasion Stack per-stack value. |
| Crit Focus | B | on_equip | Stacks grant +X% crit chance per stack instead of attack speed. |

---

## Longbow

Opening shot identity. Fires first within the tick system via Dex initiative bonus. Core trees scale opening shot damage and debuff potency. Build perks deepen burst or fight-shaping debuffs.

### Core — Sniper

| Perk | Effect |
|------|--------|
| Sniper I | Opening shot damage +2% per Longbow skill level. |
| Sniper II | Opening shot damage +4% per Longbow skill level. |
| Sniper III | Opening shot damage +6% per Longbow skill level. |
| Sniper IV | Opening shot damage +8% per Longbow skill level. |
| Sniper V | Opening shot damage +10% per Longbow skill level. |

### Core — Marksman

| Perk | Effect |
|------|--------|
| Marksman I | Opening shot debuff potency +2% per Longbow skill level. |
| Marksman II | Opening shot debuff potency +4% per Longbow skill level. |
| Marksman III | Opening shot debuff potency +6% per Longbow skill level. |
| Marksman IV | Opening shot debuff potency +8% per Longbow skill level. |
| Marksman V | Opening shot debuff potency +10% per Longbow skill level. |

### Build Perks

| Perk | Cluster | Timing | Effect |
|------|---------|--------|--------|
| Power Draw | A | battle_start | Opening shot damage scales more aggressively with Dex initiative bonus. |
| Armor Pierce | A | battle_start | Opening shot ignores a percentage of target defense. |
| Deadeye | A | battle_start | If opening shot is a crit, damage is further multiplied. |
| True Strike | A | battle_start | Opening shot cannot miss. Accuracy check bypassed entirely. |
| Crippling Shot | B | battle_start | Opening shot reduces enemy initiative gain per tick for X ticks. |
| Pinning Shot | B | battle_start | Opening shot reduces enemy current initiative by a flat amount. |
| Exposed | B | battle_start | Opening shot reduces enemy defense for the remainder of combat. |
| Blinding Shot | B | battle_start | Opening shot reduces enemy accuracy for X ticks. |
| Kill Shot | A | battle_start | If opening shot reduces enemy below 30% HP, deal a bonus execution burst. |
| Marked Target | B | battle_start | Opening shot applies both a damage debuff and an accuracy debuff simultaneously. |

---

## Light Armor

Evasion and counter. Core trees scale evasion chance and attack speed bonus on evasion. Build perks deepen survival or punish enemy aggression.

### Core — Evasion

| Perk | Effect |
|------|--------|
| Evasion I | Evasion chance +2% per Light Armor skill level. |
| Evasion II | Evasion chance +4% per Light Armor skill level. |
| Evasion III | Evasion chance +6% per Light Armor skill level. |
| Evasion IV | Evasion chance +8% per Light Armor skill level. |
| Evasion V | Evasion chance +10% per Light Armor skill level. |

### Core — Counter

| Perk | Effect |
|------|--------|
| Counter I | On evasion: attack speed bonus +2% per Light Armor skill level for X ticks. |
| Counter II | On evasion: attack speed bonus +4% per Light Armor skill level. |
| Counter III | On evasion: attack speed bonus +6% per Light Armor skill level. |
| Counter IV | On evasion: attack speed bonus +8% per Light Armor skill level. |
| Counter V | On evasion: attack speed bonus +10% per Light Armor skill level. |

### Build Perks

| Perk | Cluster | Timing | Effect |
|------|---------|--------|--------|
| Second Skin | A | on_equip | Light armor weight reduced. Easier to wear without Str investment. |
| Shadow Movement | A | before_turn | Evasion chance increases slightly with each tick in combat as movement becomes natural. |
| Untouchable | A | on_equip | Evasion has a minimum floor — cannot drop below this value regardless of enemy accuracy. |
| Ghost | A | before_turn | After evading X times in combat, become temporarily untargetable for 1 tick. |
| Flowing Strike | B | after_turn | On evasion, next attack deals bonus damage. |
| Dance Of Blades | B | after_turn | On 2 consecutive evasions, counter-attack fires automatically. |
| Knife's Edge | B | after_turn | Each evasion this combat stacks a small damage bonus. Resets on combat end. |
| Phantom Strike | B | after_turn | After evading 3 times consecutively, next attack ignores defense entirely. |
| Momentum Weave | B | after_turn | Each evasion both adds evasion stack value AND increases next hit damage simultaneously. |
| Perfect Dodge | B | after_turn | At maximum investment in both trees, evading a crit fires an immediate free counter-attack. |

---

## Medium Armor

Stability and reliability. No hard counter. Core trees reduce incoming crits and debuff application. Build perks deepen crit immunity or status shrug-off.

### Core — Crit Resistance

| Perk | Effect |
|------|--------|
| Crit Resistance I | Incoming crit damage reduced by X% per Medium Armor skill level. |
| Crit Resistance II | Incoming crit damage reduced further. |
| Crit Resistance III | Chance to downgrade incoming crit to normal hit unlocked. |
| Crit Resistance IV | Downgrade chance increased. |
| Crit Resistance V | Downgrade chance increased further. |

### Core — Status Resistance

| Perk | Effect |
|------|--------|
| Status Resistance I | Debuff duration reduced by X% per Medium Armor skill level. |
| Status Resistance II | Debuff duration reduced further. |
| Status Resistance III | Chance to fully resist debuff application unlocked. |
| Status Resistance IV | Full resist chance increased. |
| Status Resistance V | Full resist chance increased further. |

### Build Perks

| Perk | Cluster | Timing | Effect |
|------|---------|--------|--------|
| Grounded | A | on_equip | Cannot be crit while HP is above 70%. |
| Tempered | A | before_turn | After being crit, gain a temporary damage bonus. The body hardens in response. |
| Crit Wall | A | on_equip | Downgraded crits deal below-normal damage rather than normal damage. |
| Iron Constitution | B | on_equip | Bleed stacks applied to you are reduced by a flat amount. |
| Steady Mind | B | on_equip | Initiative reduction debuffs applied to you are reduced by a percentage. |
| Shrug It Off | B | before_turn | After fully resisting a debuff, gain a flat damage bonus for X ticks. |
| Unbreakable | B | on_equip | While any debuff is active on you, gain flat damage reduction. Suffering sharpens defense. |
| Resilient Fury | B | before_turn | After resisting or downgrading both a crit and a debuff in the same combat, gain a damage burst. |
| Immovable | A | on_equip | Incoming damage reduced by a flat percentage while above 80% HP. |
| Unyielding | B | on_equip | At maximum investment in both trees, cannot be reduced below 1 HP in a single hit. |

---

## Heavy Armor

Passive mitigation. Accept hits, don't care. Core trees reduce effective armor weight and enhance armor mitigation. Build perks push further into load-bearing or make the weight itself a weapon.

### Core — Weight Management

| Perk | Effect |
|------|--------|
| Weight Management I | Effective armor weight reduced. Wear heavier with less Str. |
| Weight Management II | Dex/Agi penalties from overweight armor reduced by X%. |
| Weight Management III | Effective weight further reduced. |
| Weight Management IV | Attack speed penalty from heavy armor reduced. |
| Weight Management V | Overweight armor no longer penalizes Dex. Only Agi penalty remains. |

### Core — Fortification

| Perk | Effect |
|------|--------|
| Fortification I | Armor defense value +2% per Heavy Armor skill level. |
| Fortification II | Armor defense value +4% per Heavy Armor skill level. |
| Fortification III | Armor defense value +6% per Heavy Armor skill level. |
| Fortification IV | Armor defense value +8% per Heavy Armor skill level. |
| Fortification V | Armor defense value +10% per Heavy Armor skill level. |

### Build Perks

| Perk | Cluster | Timing | Effect |
|------|---------|--------|--------|
| Veteran's Carry | A | on_equip | Max armor weight capacity increased. Can equip armor that would otherwise exceed limits. |
| Iron Body | A | on_equip | While wearing maximum weight armor you can bear, gain bonus Str scaling on weapon damage. |
| Natural Weight | A | on_equip | Agi penalty from overweight armor reduced. Both penalties now minimal. |
| Burden Bearer | A | on_equip | Heavy armor weight reduced to near-zero. Move as freely as light armor. |
| Living Fortress | B | before_turn | While wearing max weight armor, gain bonus defense per turn spent in combat. |
| Damage Soak | B | before_turn | Chance to fully negate an incoming hit. The armor simply absorbs it entirely. |
| Immovable Object | B | on_equip | While at or above 80% HP, incoming damage reduced by a flat percentage. |
| Siege Plate | B | on_equip | Defense percent applies to all damage types including damage-over-time effects. |
| Steel Soul | B | before_turn | While wearing maximum weight armor, incoming crits are downgraded to normal hits. |
| Living Wall | B | on_equip | At maximum investment in both trees, gain a flat HP bonus equal to total armor weight carried. |
