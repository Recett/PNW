## Hidden Location Feature Implementation

### Changes Made

1. **Database Schema Update**: Added `hidden` field to `location_bases` table
   - Field: `hidden` (BOOLEAN, defaultValue: false)
   - Location: `src/models/location/locationModel.js`

2. **Move Command Update**: Modified `/interact move` command to filter out hidden locations
   - Location: `src/commands/adventuring/interact.js`
   - Change: Added `!loc.hidden` filter when building location options

3. **Admin Command Enhancement**: Added `hidden` parameter to `/location edit` command
   - Location: `src/commands/admin/location.js`
   - Usage: `/location edit hidden:true` or `/location edit hidden:false`

### Database Sync Required

**IMPORTANT**: After these changes, you must run:
```bash
node dbObject --alter
```
This will add the new `hidden` column to the `location_bases` table. The sync process takes 5+ minutes - be patient and don't interrupt it.

### Usage

1. **Hide a location**: In the location's channel run `/location edit hidden:true`
2. **Show a location**: In the location's channel run `/location edit hidden:false`
3. **Check effect**: Use `/interact move` - hidden locations won't appear in the list

### Implementation Details

- Hidden locations are filtered out in the move command after fetching linked and cluster locations
- The filtering happens when building the Discord select menu options
- Hidden locations can still be accessed directly if a user is already there
- Admin commands and other location utilities are unaffected by the hidden status
- Characters can still be moved to hidden locations programmatically (events, admin commands, etc.)