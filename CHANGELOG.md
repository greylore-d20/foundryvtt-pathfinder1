# Changelog

## 0.23.1 (Emergency Update)

### Bug Fixes

- Certain elements (textareas) on item sheets not updating
- Saving throw butons on efense chat cards for unlinked tokens not working
- Certain actor data not updating

## 0.23

### Bug Fixes

- Carrying capacity for creatures small than medium with low strength
- Glitch with token with deleted actor
- Duplicate effect notes on multi attacks
- Missing attack notes on attacks
- Glitch with buff/change flags
- Unlinked tokens not updating with item changes
- Features as item resources sometimes not working
- Level Drain not subtracting hit points

### Changelog

- Add world options to automatically calculate class hit points
- Add or update items in the following compendiums:
  - Classes (added NPC classes)
  - Weapons (fixed description for Shortbows)
  - Spells (unticked SR flag and removed saving throw)
- Add the following compendiums:
  - Bestiary
  - Sample Macros
  - Roll Tables
- Show more info on defense chat logs, including buttons to roll saving throws
- A slight performance increase in actor and owned item sheets
- Remove sound effect from showing defenses

## 0.22

### Bug Fixes

- Defenses not showing with auto collapsing chat cards enabled
- Certain properties not working on inline rolls in chat logs (like @item.level on a buff)
- Item macros with duplicate names (you need to re-add item macros for this to work correctly)
- Restrict access on certain actor functions (so players can't roll an NPC's skill checks in a macro, for example)

### Changelog

- Add or update some items to the following compendiums:
  - Magic Items
  - Common Buffs
- Add macro'able function to show an actor's defenses as a chatlog (game.pf1.rollDefenses()) (see [documentation](https://furyspark.gitlab.io/foundryvtt-pathfinder1-doc/advanced/macros/))

## 0.21

### Bug Fixes

- Inability to delete custom skills and subskills
- Bug with quadruped actors
- Scrolling issue on skill pages
- Unformatted inline rolls in item chat logs

### Changelog

- Add a button to show static defenses

## 0.2002

### Changelog

- Add weapon range
- Automatically fill out more slots when creating an attack: attack ability,
damage ability, damage ability multiplier, action type and action range
- Speed up actor sheets slightly
- Add ability to change loot item subtypes
- Fix measurement tools (cone and circle) to be more Pathfinder rule-friendly
- Support inline rolls for item roll messages
- Add compendiums for armor, weapons and magic items
