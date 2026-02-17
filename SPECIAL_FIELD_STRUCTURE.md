# Special Field JSON Structure

## Overview
The `special` field in various models (weaponLib, armorLib, perkLib) is now a JSON type that contains special abilities or effects with their associated values.

## Data Structure

### Single Special Effect
```json
{
  "name": "special_effect_name",
  "value": 10
}
```

### Multiple Special Effects
```json
[
  {
    "name": "special_effect_name_1",
    "value": 10
  },
  {
    "name": "special_effect_name_2",
    "value": 25
  }
]
```

## Examples by Model

### Weapon Special
```json
{
  "name": "lifesteal",
  "value": 15
}
```
or
```json
[
  {
    "name": "lifesteal",
    "value": 15
  },
  {
    "name": "armor_penetration",
    "value": 20
  }
]
```

### Armor Special
```json
{
  "name": "fire_resistance",
  "value": 25
}
```
or
```json
[
  {
    "name": "fire_resistance",
    "value": 25
  },
  {
    "name": "poison_resistance",
    "value": 15
  }
]
```

### Perk Special
```json
{
  "name": "cooldown_reduction",
  "value": 30
}
```

## Usage Notes
- Store as a single object `{}` for a single special effect
- Store as an array `[]` for multiple special effects
- `name`: The identifier/key of the special effect
- `value`: The numeric value or magnitude of the effect
- Values can be percentages, flat numbers, or durations depending on the effect type
