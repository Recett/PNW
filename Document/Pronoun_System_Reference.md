# Pronoun System Reference - Discord RPG Bot

## Overview

This Discord RPG bot uses a sophisticated Vietnamese pronoun system that reflects the cultural importance of age and gender relationships in Vietnamese society. Unlike English pronouns which are mostly gender-neutral (you, I), Vietnamese pronouns are **relational** - they depend on the age and gender relationship between the speaker and listener.

## Key Concepts

### Age Brackets

The system divides characters into 5 age brackets based on their numeric age:

| Bracket | Age Range | Vietnamese Context |
|---------|-----------|-------------------|
| `child` | 0-12 | Young children |
| `teen` | 13-17 | Teenagers |
| `young` | 18-30 | Young adults |
| `adult` | 31-50 | Middle-aged adults |
| `elder` | 51+ | Senior/elderly |

### Gender Support

- **Male**: `'nam'`, `'male'`, `'m'` → maps to `'male'`
- **Female**: `'nữ'`, `'female'`, `'f'` → maps to `'female'`
- **Default**: Any other value defaults to `'male'`

### Relational Pronouns

Pronouns are determined by comparing age brackets between two characters:

- **much_older**: NPC is 2+ brackets older than player
- **older**: NPC is 1 bracket older than player  
- **peer**: Same age bracket
- **younger**: NPC is 1 bracket younger than player
- **much_younger**: NPC is 2+ brackets younger than player

## Template Placeholders

### Player Pronouns

| Placeholder | Alternative | Description | Example |
|-------------|-------------|-------------|---------|
| `${1p}` | `${first_person}` | How player refers to self | tôi, em, cháu |
| `${player_name}` | - | Player's display name | "Minh" |
| `${player_fullname}` | - | Player's full name | "Nguyễn Văn Minh" |

### NPC-to-Player Pronouns (Relational)

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `${2p}` / `${second_person}` | How NPC addresses player | anh, chị, cháu, ông, bà |
| `${npc_1p}` | How NPC refers to self when talking to player | tôi, ta, em, cháu |

### Player-to-NPC Pronouns (Relational)

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `${npc_2p}` | How player addresses NPC | anh, chị, bác, ông, bà |
| `${npc_name}` | NPC's display name | "Bà Tám" |

## Pronoun Mapping Tables

### Player Self-Reference (${1p})

| Age Bracket | Male | Female | Default |
|-------------|------|--------|---------|
| child | cháu | cháu | cháu |
| teen | em | em | em |
| young | tôi | tôi | tôi |
| adult | tôi | tôi | tôi |
| elder | tôi | tôi | tôi |

### Relational Pronouns (NPC ↔ Player)

#### NPC Much Older Than Player (2+ brackets)
- NPC addresses player: `cháu` (regardless of player gender)
- NPC refers to self: `ông` (male NPC) / `bà` (female NPC)

#### NPC Older Than Player (1 bracket)
- NPC addresses player: `anh` (male player) / `chị` (female player)  
- NPC refers to self: `tôi` (regardless of NPC gender)

#### NPC Same Age as Player (peer)
- NPC addresses player: `anh` (male player) / `chị` (female player)
- NPC refers to self: `tôi` (regardless of NPC gender)

#### NPC Younger Than Player (1 bracket)
- Player is older, so NPC shows respect:
- NPC addresses player: `anh` (male player) / `chị` (female player)
- NPC refers to self: `em` (regardless of NPC gender)

#### NPC Much Younger Than Player (2+ brackets)
- NPC addresses player: `bác` (regardless of player gender)
- NPC refers to self: `cháu` (regardless of NPC gender)

## Usage Examples

### Example 1: Adult NPC talking to Young Player

**Setup:**
- NPC: Age 35, Male → Adult bracket
- Player: Age 22, Female → Young bracket
- Relationship: `older` (1 bracket difference)

**Text Template:**
```
"${2p} có muốn mua gì không? ${npc_1p} có nhiều hàng tốt đây."
```

**Processed Result:**
```
"Chị có muốn mua gì không? Tôi có nhiều hàng tốt đây."
```

### Example 2: Teen NPC talking to Elder Player

**Setup:**
- NPC: Age 16, Female → Teen bracket  
- Player: Age 55, Male → Elder bracket
- Relationship: `much_younger` (2+ brackets difference)

**Text Template:**
```
"Xin chào ${2p}! ${npc_1p} rất vui được gặp ${2p}."
```

**Processed Result:**
```
"Xin chào bác! Cháu rất vui được gặp bác."
```

### Example 3: Player addressing NPC

**Setup:**
- Player: Age 25, Male → Young bracket
- NPC: Age 45, Female → Adult bracket  
- Player's perspective: `younger` (player is younger than NPC)

**Text Template:**
```
"${1p} muốn hỏi ${npc_2p} về việc này."
```

**Processed Result:**
```
"Tôi muốn hỏi chị về việc này."
```

### Example 4: Custom Pronoun Override (Father Clement)

**Setup:**
- NPC: Age 55, Male → Elder bracket (Father Clement)
- Player: Age 22, Female → Young bracket  
- Relationship: `much_older` (2+ brackets difference)
- Custom pronouns: `player_to_npc: "cha"`, `pronouns.much_older.to_player.female: "con"`

**Text Template:**
```
"Xin chào ${2p}! ${npc_1p} có thể giúp ${npc_2p} không?"
```

**Processed Result:**
```
"Xin chào con! Cha có thể giúp cha không?"
```

Note how:
- `${2p}` uses custom override "con" instead of default "cháu" 
- `${npc_1p}` uses custom override "cha" instead of default "tôi"
- `${npc_2p}` uses `player_to_npc` override "cha" regardless of age relationship

## Technical Implementation

### Core Functions

**`processTextTemplate(text, playerAge, playerGender, character, npc)`**
- Main function for processing pronoun templates
- Handles all placeholder replacements
- Includes auto-capitalization features
- Located in `src/utility/generalUtility.js`

**Key Helper Functions:**
- `getAgeBracket(age)` - Converts numeric age to bracket
- `getGenderKey(gender)` - Normalizes gender strings  
- `getAgeRelationship(npcAge, playerAge)` - Determines relationship
- `getPlayerSelfPronoun(age, gender)` - Gets ${1p} pronoun
- `getNpcToPlayerPronoun(npcAge, playerAge, playerGender)` - Gets ${2p}
- `getPlayerToNpcPronoun(playerAge, npcAge, npcGender)` - Gets ${npc_2p}

**Custom Pronoun Support:**
- Functions check for NPC override fields before calculating pronouns
- `player_to_npc` field completely overrides `${npc_2p}` calculation
- `pronouns` object allows relationship-specific overrides for `${2p}` and `${npc_1p}`
- Maintains backward compatibility with age/gender-only NPCs

### Usage in Event System

The pronoun system is automatically applied in:

1. **Event Messages** (`eventUtility.js`)
   ```javascript
   const character = await characterUtil.getCharacterBase(characterId);
   if (character) {
       eventText = processTextTemplate(eventText, character.age, character.gender, character, session.npc);
   }
   ```

2. **Event Options**
   ```javascript
   if (character && option.text) {
       option.text = processTextTemplate(option.text, character.age, character.gender, character, session.npc);
   }
   ```

### Character Data Requirements

For pronouns to work properly, characters must have:
- `age` (number) - Used for age bracket calculation
- `gender` (string) - `'nam'`/`'nữ'` or English equivalents
- `name` (string) - For `${player_name}` placeholder
- `fullname` (string, optional) - For `${player_fullname}` placeholder

NPCs must have:
- `age` (number) - For relational pronoun calculation
- `gender` (string) - Affects how NPC refers to self
- `name` (string) - For `${npc_name}` placeholder

**Optional Custom Pronoun Fields:**
- `player_to_npc` (string) - Override for `${npc_2p}` (how player addresses NPC)
- `pronouns` (object) - Override relational pronouns by age relationship:
  - `much_older`, `older`, `peer`, `younger`, `much_younger` (relationship keys)
  - Each relationship can contain:
    - `to_player` (object/string) - Override for `${2p}` (how NPC addresses player)
    - `npc_self` (string) - Override for `${npc_1p}` (how NPC refers to self)

## Auto-Capitalization Features

The system automatically capitalizes letters after:
1. **Sentence-ending punctuation** (. ! ?) followed by space(s)
2. **Quotation marks** (""") followed by optional space(s)  
3. **Beginning of text** (first character)
4. **After newlines** (\n)

Supports both Vietnamese and ASCII characters.

## Best Practices

### Writing Event Text

1. **Always use placeholders** instead of hardcoded pronouns:
   ```yaml
   # ✅ Good
   text: "${2p} có thể giúp ${1p} không?"
   
   # ❌ Bad
   text: "Anh có thể giúp tôi không?"
   ```

2. **Test with different age/gender combinations** to ensure proper pronoun usage

3. **Use descriptive context** when relationships might be ambiguous

### Common Gotchas

1. **Missing NPC data**: When NPC is null, system defaults to peer relationship
2. **Missing character data**: Defaults to "Người lữ khách" for names, age 25 for calculations
3. **Case sensitivity**: Placeholders are case-insensitive but Vietnamese text case matters
4. **Encoding**: Always use Unicode escape sequences for Vietnamese text in source files (`\u1EA1` not `ạ`)

### Error Handling

The system gracefully handles missing data:
- Missing player age → defaults to 25 (young adult)
- Missing player gender → defaults to male
- Missing NPC → uses peer relationship pronouns
- Missing names → uses "Người lữ khách" (traveler)

### Performance Considerations

- Character data is cached in event sessions to avoid repeated database queries
- Pronoun calculations are lightweight string operations
- Auto-capitalization uses optimized regex patterns

## Legacy Support

### Deprecated Functions

- `pronoun(event, age, gender)` - Legacy function, use `processTextTemplate` instead
- `getPronoun(type, age, gender)` - Legacy function with limited NPC support

### Migration Notes

When updating old event content:
1. Replace hardcoded Vietnamese pronouns with placeholders
2. Ensure NPC objects have proper age/gender data
3. Test pronoun relationships with various character combinations
4. Update any custom event processing to use `processTextTemplate`

## Debugging Tips

### Checking Pronoun Output

1. **Log character and NPC data**:
   ```javascript
   console.log('Player:', character.age, character.gender);
   console.log('NPC:', npc.age, npc.gender);
   console.log('Relationship:', getAgeRelationship(npc.age, character.age));
   ```

2. **Test specific relationships**:
   ```javascript
   const testText = "${2p} và ${1p} - ${npc_1p} và ${npc_2p}";
   const result = processTextTemplate(testText, playerAge, playerGender, character, npc);
   ```

3. **Verify age bracket calculation**:
   ```javascript
   console.log('Player bracket:', getAgeBracket(character.age));
   console.log('NPC bracket:', getAgeBracket(npc.age));
   ```

### Common Issues

- **Wrong pronouns**: Check age and gender data accuracy, verify custom pronoun overrides
- **Missing placeholders**: Verify template syntax `${placeholder}` 
- **Capitalization issues**: Check auto-cap regex patterns
- **Encoding problems**: Use Unicode escapes in source files
- **Custom pronouns not working**: Verify YAML structure and field names in `player_to_npc`/`pronouns` objects
- **Partial overrides**: Remember that only specified relationships are overridden, others fall back to defaults

## Custom NPC Pronoun Overrides

NPCs can have custom pronoun fields that override the default age/gender-based calculations for specific characters with unique speech patterns.

### NPC Pronoun Fields

**`player_to_npc`** - Override for `${npc_2p}` placeholder:
```yaml
npcs:
  - id: "admiral-hale"
    name: "Ông Hale"
    age: 67
    player_to_npc: "cụ"    # Player always addresses him as "cụ" (respected elder)
  
  - id: "father-clement"  
    name: "Cha Clement"
    age: 55
    player_to_npc: "cha"   # Player always addresses him as "cha" (father/priest)
```

**`pronouns`** - Override relational pronoun calculations:
```yaml
npcs:
  - id: "admiral-hale"
    name: "Ông Hale"
    age: 67
    player_to_npc: "cụ"
    pronouns:
      much_older:
        npc_self: "lão"     # Refers to self as "lão" (old man) when much older
      older:
        npc_self: "lão"     # Always uses "lão" instead of standard "ông"
      peer:
        npc_self: "lão"     # Even with peers, uses "lão"
```

**Gender-specific overrides** for `to_player`:
```yaml
npcs:
  - id: "father-clement"
    name: "Cha Clement"
    player_to_npc: "cha"
    pronouns:
      much_older:
        to_player:          # How priest addresses players when he's much older
          male: "con"       # Addresses male players as "con" (child)
          female: "con"     # Addresses female players as "con" (child)
          default: "con"    # Default fallback
        npc_self: "cha"     # Always refers to self as "cha" (father)
      older:
        npc_self: "cha"     # Consistent self-reference across all relationships
      peer:
        npc_self: "cha"
      younger:
        npc_self: "cha"
      much_younger:
        npc_self: "cha"
```

### Override Rules

1. **`player_to_npc`** completely replaces `${npc_2p}` regardless of age relationship
2. **`pronouns.{relationship}.to_player`** overrides `${2p}` for specific age relationships
3. **`pronouns.{relationship}.npc_self`** overrides `${npc_1p}` for specific age relationships
4. **Fallback behavior**: If override not specified, uses standard age/gender calculation
5. **Gender specificity**: `to_player` can be object with `male`/`female`/`default` keys or simple string

### Use Cases

- **Religious figures**: Priests always called "cha", always refer to themselves as "cha"
- **Military ranks**: "thuyền trưởng", "đại úy" regardless of age relationship  
- **Formal characters**: Elderly nobles always use archaic forms like "lão", "ta"
- **Cultural roles**: Teachers, masters, mentors with specific address forms

## File Locations

- **Main Implementation**: `src/utility/generalUtility.js`
- **Event Processing**: `src/utility/eventUtility.js`
- **Character Data**: Database tables `character_bases`, `npc_bases`
- **Usage Examples**: Event YAML files in `content/events/`
- **Tests/Registration**: `src/commands/utility/registerStrings.js`