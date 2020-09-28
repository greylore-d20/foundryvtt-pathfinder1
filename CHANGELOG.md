# Changelog

## 0.74.7

### Bug Fixes

- Giving items to another owned actor did not work in 0.6.6 if not done as GM

### Changelog

- Added Chinese localization, due to the efforts of bnp800 (many thanks!)
- Hovering over a skill now shows whether it's boosted by being a class skill or ability score, due to the efforts of Nico Weichbrodt (many thanks!)
- Added more languages, due to the efforts of Nico Weichbrodt (many thanks!)
- Hovering over a skill now shows whether it's being penalized by armor check penalty (if any, and if applicable)
- Added changes to modify ACP and Max Dex Bonus granted/limited by armor and shields
- Improved the macros 'Roll Skill' and 'Roll Saving Throw' so they don't produce an abundance of roll sounds
- Improved the macro 'Roll Skill' so it doesn't need to have a label for custom skills

## 0.74.6

### Bug Fixes

- Creating attacks from two-handed weapons didn't set the attack's held type to be two-handed
- Non-default NPC sheets were sometimes returning to default due to a race condition
- Changes to unlinked tokens' actor data did nothing

### Changelog

- Loot sheets now show a total sell value without the added currencies
- Added button to give item from inventory to another (owned) actor
- Buffs and conditions are now shown as icons on tokens (unless turned off by a world setting)
- Added conditions to actors without mechanical benefits

## 0.74.5

### Bug Fixes

- Fixed Dice So Nice integration, due to the efforts of Ethaks (many thanks!)
- Fixed critical hit and fumble recognition in Foundry 0.7.2, due to the efforts of Ethaks (many thanks!)
- Fixed various Class Abilities, due to the efforts of Nico Weichbrodt (many thanks!)
- Cantrips couldn't be used without having spell uses

### Changelog

- Improved Dice So Nice roll order on attacks, due to the efforts of Ethaks (many thanks!)
- Updated the German translation, due to the efforts of Nico Weichbrodt (many thanks!)
- Added more translatable strings, due to the efforts of Nico Weichbrodt (many thanks!)
- Added Spanish translation, due to the efforts of Wharomaru Zhamal (many thanks!)
- Added the option to share token vision between players, independent of normal actor permissions
- Added a note to attacks for charged items telling how many charges are left after the attack
- Added a new option to weapon attacks to tell how it's held, which interacts with power attacks

## 0.74.4 (Hotfix)

### Bug Fixes

- Certain rolls (like skill rolls) didn't work in Foundry 0.6.6

## 0.74.3 (Hotfix)

### Bug Fixes

- Attacks without ammo didn't work
- DC showed as 0 on spell attack cards

## 0.74.2 (Hotfix)

### Bug Fixes

- Error with attack rolls while Dice So Nice is enabled on Foundry 0.6.6
- Use isPC in Foundry 0.6.6

### Changelog

- Sped up attacks using ammo

## 0.74.1 (Initial FoundryVTT 0.7.2 support)

### Bug Fixes

- Added safeguard to avoid an infinite loop in the formula for charges on a charged item
- Certain fields like currency fields didn't accept a number-only value, and didn't apply by clicking on something else
- Subtracting hit points from a token which has temporary hit points resulted in a faulty value for hit points

### Changelog

- Updated the German translation, due to the efforts of Nico Weichbrodt (many thanks!)
- Default to not having a custom tag for classes
- Added the ability to drag and drop skills, bab, cmb, defenses, concentration and caster level from an actor's sheet to the macro hotbar to quickly create a macro for it
- Added a new link type for attacks: ammunition

## 0.74.0

### Bug Fixes

- Creating attacks from weapons on unlinked tokens caused a glitch where the item window wouldn't close (fixed by Ethaks (many thanks!))
- Bardic Knowledge used an incorrect formula (fixed by Ethaks (many thanks!))
- Changing anything on an actor sheet while their current hit points were negative caused the negative hit points to accumulate
- Changing all speeds with a change item didn't work
- Deleting items that were linked to another item didn't remove links

### Changelog

- Added a label to attack chat cards saying it's a power attack, due to the efforts of Ethaks (many thanks!)
- Actors of the Character type now have their tokens linked by default, due to the efforts of Ethaks (many thanks!)
- Actor health and token bars can now use the '--' operator to set to a negative value (e.g. '--8' would set the attribute to -8, rather than subtracting 8 from the current value)
- Add Dice So Nice integration for damage rolls
- Add broken condition for equipment, weapons and attacks
- Add compendium filter to compendium browsers
- Remove the possibility of critically hitting for attacks with a critical multiplier of 1

## 0.73.8

### Bug Fixes

- NPC classes were missing
- Update actor on adding items
- Fixed spell durations to make them more universally consistent
- Weight on items could not be set back to 0 (#159)
- Unchained Monks didn't have the AC Bonus class feature associated
- Unchained Monks used an incorrect Fast Movement class feature

### Changelog

- Added ability to change CMB ability
- Added field to change the base dice used for attack rolls in attack roll dialogs, due to the efforts of Ethaks (many thanks!)
- Added a checkbox to enable a buff from the buff's sheet

## 0.73.7

### Bug Fixes

- Using spell points, spells with no cost were still unuseable with an empty spell pool
- Critical confirmation bonuses applied on following attack rolls
- Creating an actor caused an error
- Charged features threw an error on use
- Changing charges on an item (except spells) from an actor sheet didn't update the item in question
- Concentration and Caster Level notes from actor sheets caused an error
- Fixed spell capitalization to what they are on Archives of Nethys, due to the efforts of Noon (many thanks!)

### Changelog

- Linked class abilities to classes, due to the efforts of holyplankton (many thanks!)

## 0.73.6 (Hotfix)

### Bug Fixes

- Some spells were no longer rendering
- Fix tooltip for spontaneous spellbooks

### Changelog

- Added support for spell points

## 0.73.5

### Bug Fixes

- Actor stats were no longer immediately updated with item changes
- Context notes from buffs didn't take `@item.level` into consideration for every type of note
- AC labels for armor and shields didn't take enhancement bonuses into consideration
- Item data wasn't taken into consideration in inline rolls on item descriptions when shown to chat
- Enhancement bonuses were still shown on unidentified armor for players

### Changelog

- Improved spellbook accessability

## 0.73.4 (Hotfix)

### Bug Fixes

- Re-enabled system migration

## 0.73.3

### Bug Fixes

- Experience values were occasionally stored as strings, resulting in unexpected behavior
- Entering values in fields on the NPC Lite sheet didn't do anything
- Non-lethal hit point damage wasn't healed with rest

### Changelog

- Reduced amount of actor updates in some cases, resulting in improved performance
- Improved spellbook accessability, especially in regards to the 'All' tab
- Added customizable class tag
- Added a new item link type for classes, which automatically adds class abilities at certain levels
- Added Caster Level and Concentration context notes

## 0.73.2

### Bug Fixes

- Chat metadata used an incorrect measure template ID
- Entering a non-working formula for bonus feats caused the character sheet to not open anymore
- Some item properties were still visible while unidentified which should have been invisible
  
### Changelog

- Added sample macro for creating a loot sheet from one or more tokens

## 0.73.1

### Bug Fixes

- Non-critical damage formulas didn't get applied to critical hits at all (they should just not be multiplied)
- Clearing certain fields (like temporary hit points, non-lethal damage and currencies) reverted them back to the previous value

### Changelog

- Added the `template` property to chat card metadata (for use by module/macro developers)

## 0.73

### Bug Fixes

- Temporary hit points were not being added to a token's hit point bar
- Unidentified items showed up at their identified value in actors' inventories
- Items without damage rolls, attack rolls or effect notes, but which did have a measure template, didn't show a chat card on use
- The equipment tab (on actor inventories) didn't show action buttons where appropriate
- Fixed CSS for Lite NPC sheets, and the CR display on normal NPC sheets (the CR went off-sheet partially for wide CR text)
- Nested Ultimate Equipment roll tables were not working correctly, because they were set to reference roll tables in the world, rather than in their own compendium
- The Ultimate Equipment roll table for Greater Medium Weapons had an incorrect reference type

### Changelog

- Improved the way item weight is edited, due to the efforts of Dorgendubal (many thanks!)
  - When using the metric system, item weights can now be edited in kg values (2 kg = 1 lbs)
  - Internally, the item stores an lbs value, but that shouldn't affect gameplay
- Added additional inventory statistics (carrying above head, above ground and dragging/pushing)
- Added the ability to add non-critical hit damage formulas (damage that only gets applied on normal hits)
- Changed the way damage is displayed on chat cards
- Critical hit damage now includes the non-critical hit damage part
  - Due to the way damage handling has changed, the variable `@critMult` may no longer be required, and old formulas will need to be changed
  - This also makes the last parameter on `sizeRoll` obsolete, though it won't do harm to leave it in (for now, at least)

## 0.72.1

### Bug Fixes

- TinyMCE editors were showing 2 scrollbars, depending on the content
- Added backwards compatibility with old changes
  
### Changelog

- Improved visibility of tabs
- You can now drop world or compendium entities onto items' attack, effect and change notes to create a link to them
- Added a feat tracking interface from the feat tab on actor sheets

## 0.72

### Bug Fixes

- Change formulas incorrectly used base data
- Changes with the set (=) operator didn't show up in source info

### Changelog

- Added more class abilities, due to the efforts of holyplankton (many thanks!)
- Updated the italian translation, due to the efforts of Marco (many thanks!)
- Added a race compendium browser
- Compendium browsers now implement natural sorting in regards to filters and entries
- Changes with the '=' operator no longer get applied before changes with the '+' operator, but will instead depend on priority
- Added base ability scores and modifiers which are unaffected by changes except for the modifiers 'Untyped (Permanent)', 'Racial', 'Trait' and 'Base'
  - These can be accessed for formulas by writing something like `@abilities.str.base` or `@abilities.wis.baseMod` (see ability score tooltips as well)

## 0.71

### Bug Fixes

- Fixed a compability issue with Babele, due to the efforts of Simone Ricciardi (many thanks!)

### Changelog

- Updated the French translation, due to the efforts of rectulo (many thanks!)
- Added the ability to offset currencies by entering things like '+5' or '-5'
- Added buttons to convert currencies
- Added metadata to ChatMessagePF attacks for use by macro and module creators
- Added the '=' operator to changes, setting an actor variable to a given value rather than adding to it
  - The '=' operator is modifier-specific, meaning that for example multiple Enhancement modifiers replace one another, but an Enhancement modifier and a Deflection modifier are added to each other
  - Changes with the '=' operator get applied before changes with the '+' operator
  - Internally, the base speeds as entered on the front page of an actor sheet is used as a change with the appropriate target, a 'Base' modifier, an '=' operator and a priority of 1000
- Added the ability to assign a sound effect to attacks, which will be fired upon showing the message for it

## 0.701

### Bug Fixes

- Token quick actions were no longer working
- Unlinked tokens linked size with the main actor

### Changelog

- Added more class abilities, due to the efforts of holyplankton (many thanks!)
- Updated the Ultimate Equipment roll tables, due to the efforts of Iron (many thanks!)

## 0.7

### Bug Fixes

- When deleting an item, links to that item remained
- Inventory items of different types couldn't be sorted manually
- The merfolk race had an incorrect amount of Charisma bonus

### Changelog

- Big revamp to actor sheets
- Added more class abilities, due to the efforts of holyplankton (many thanks!)
- Alexandre Nizoux updated the French translation (many thanks!)
- Added most human languages to the list of pre-selectable languages
- There's now a tab in actors' spellbooks that shows all spells
- Certain input fields can now be clicked once to select their content
- Certain input fields now react to the mouse wheel while hovering over them
- Add client-side setting for quick rolling items
- Skills which require training and have no ranks are now displayed in a lighter shade

## 0.69

### Bug Fixes

- Compendium filters weren't being sorted since last update
- Results from rollable tables were not private (solves issue #65)

### Changelog

- Added more class abilities, due to the efforts of holyplankton (many thanks!)
- Added roll tables for Ultimate Equipment, due to the efforts of Iron (many thanks!)
- Implemented lazy loading of list items in compendium browsers, improving performance
- Show number of matching filtered items on compendium browsers
- Removed the option to preload compendiums
- Made the metric system more useable (solves issue #71, possibly)
- Added an option to change the weight of coins, on a per-world basis (solves issue #99)
- Items now refresh upon being created on an actor, which helps clear up actor-dependent formulas after getting one from the compendiums, for example
- Buttons for saving throws on chat cards will now roll saving throws for all selected tokens
- Added chat card buttons for applying half damage/healing

## 0.68

### Bug Fixes

- Fixed sizeRoll (again...)
- Loot sheets with items other than inventory items on them gave NaN for prices
- Dragging spells to the loot sheet added them as an actual spell, rather than showing the Create Consumable dialog
- Creating consumables from 0 level spells gave them a 0gp value

### Changelog

- Improved actor sheets in regards to scrollable areas
- Improved load speeds of compendium browsers

## 0.67

### Bug Fixes

- sizeRoll for smaller characters was using the incorrect die
- Couldn't select spellcasting classes for spellbooks anymore

### Changelog

- Added a rectangle measure template for items with actions
- Added fields for adjusting the CL and SL of Spells in their attack dialogs
- Made critical hits more compact in chat
- Added an Italian translation, due to the efforts of Marco (many thanks!)

## 0.66

### Bug Fixes

- Charged items will now check their charge cost before usage, rather than only denying usage at 0 charges
- A bunch of formula fields on actors didn't use the correct function for fetching roll data

### Changelog

- Added more class abilities to its compendium, due to the efforts of holyplankton (many thanks!)
- Loot sheets now show the total value and the sale value of its contents
- Added mythic paths, due to the efforts of ManaHime (many thanks!)
- Show at-will status instead of spell uses in spellbooks for at-will useable spells

## 0.65

### Bug Fixes

- Concentration checks didn't roll
- Limit power attack damage multiplier to 1.5x

### Changelog

- Added more class abilities to its compendium, due to the efforts of holyplankton (many thanks!)
- Added more creatures to the bestiary, due to the efforts of Dorgendubal, Primer and jimjambojangles (many thanks!)
- You can now choose how many charges charged items cost to use
- Consumables and attacks can now have items linked to them to share charges

## 0.64

### Bug Fixes

- Added a safeguard for SR calculation
- Word wrap attack and effect notes, due to the efforts of Marco (many thanks!)
- Selecting a measure template texture for an attack item didn't submit the form, possibly resulting in not updating the value
- Measure templates from attacks with textures couldn't be placed due to hitbox issues
- Strength added (or subtracted) from item changes didn't alter carrying capacity

### Changelog

- Made attack chat cards a bit more compact
- Moved setting for disabling xp tracking to the new experience config panel
- Added more class abilities, due to the efforts of holyplankton (many thanks!)
- Added a class compendium browser

## 0.63

### Bug Fixes

- Actors' caster levels were being temporarily increased under certain circumstances

### Changelog

- Sizes for measure templates on items are now formulas, rather than static numbers
- Added an option for a custom experience track

## 0.627

### Changelog

- Removed some space from spellbook checkboxes so it's more difficult to accidentally click them, due to the efforts of Marco (many thanks!)
- Changed spell counts in spellbooks to be easily adjustable numbers, thanks to the efforts of Marco (many thanks!)

### Bug Fixes

- Actor sheets couldn't be opened in FoundryVTT 0.6.5
- Changing the type of change the first time around had a delay of being applied until the next change to the item

## 0.626

### Changelog

- Added many entries to the bestiary, due to the efforts of Dorgendubal, Primer and jimjambojangles (many thanks!)
  - The individual entries of the bestiary are missing some info, so it's probably best to use them as a base only
- Added a lot more class abilities, due to the efforts of holyplankton (many thanks!)

## 0.625

### Bug Fixes

- Spells were not updating since 0.624

## 0.624

### Bug Fixes

- Changing the masterwork flag on equipment changed the ACP another update later
- Spells no longer show duplicate chat information when used
- Showing defenses didn't work if some item added AC notes (Fixed by Marco (many thanks!))

### Changelog

- holyplankton added more class abilities (many thanks!)
- Added a loading bar when opening compendium browsers
- Adam added an initial version of a Wild Shape sample macro (many thanks!)

## 0.623

### Bug Fixes

- Entering a CR lower than 1 resulted in it becoming NaN
- Item descriptions should now correctly use their normal roll data for inline rolls
- The Distribute XP macro sometimes wasn't correctly adding xp to characters
- Negative dexterity wasn't being added to FF AC

## 0.622

### Bug Fixes

- Spells didn't auto subtract uses under certain circumstances
- Will Saving Throws didn't use an ability modifier
- Critical confirmation bonuses were not being applied
- Divine Favor (buff) formula was incorrect

### Changelog

- Add button to duplicate an item on an actor

## 0.621

### Bug Fixes

- Items compendium was empty since v0.62
- Races compendium items' changes were empty since v0.62

## 0.62

### Bug Fixes

- Inspire Courage was using an incorrect formula for its bonuses
- Pressing enter to confirm a change on an actor sheet triggered the point buy calculator
- Ammunition now uses the price and weight for a single unit in their compendium
- Melee weapons' attacks were being created as ranged attacks
- Client freeze when adding a certain number of item links

### Changelog

- Changed the way alignment is selected (WARNING: Creature alignments will have to be re-selected this update)
- Pecomica added missing items to the items compendium (many thanks!)
- holyplankton created a compendium for creature templates (many thanks!)
- Added a priority field to item changes

## 0.61

### Bug Fixes

- Dice So Nice integration
- Defense Chat Card saving throw buttons not working

### Changelog

- Added initial class abilities compendium
- DC offsets for creature templates are now formulas
- Added a new item link type: charge sharing (only for features for now)
- Added a point buy calculator to actor sheets

## 0.601

### Bug Fixes

- Point-blank Shot was not adding damage
- Shift-clicking attacks to bypass the dialog didn't work
- Amulets of Natural Armor other than +1 didn't give the right amount of AC
- Haste didn't give speed increases
- The Toggle Buff sample macro incorrectly tried to toggle items that weren't buffs if the name matched

### Changelog

- Improved visibility of saving throw DCs on attack and spell chat cards

## 0.6

### Bug Fixes

- 1/6 CR was not an option
- Token tint was missing from the token configuration window

### Changelog

- Added a flag for spell preparation in spontaneous spellbooks (for Arcanists, mainly)
- Added a CR offset field to creature templates
- Improved visibility of editing base spell slots
- Added initial item linking support, which for now only has one type of linking (automatic deletion of linked child items)
- Creating attacks from weapons now adds the newly created attack as a linked child of the weapon (see above)
- Marc Robinson added Rapid Shot and Point-blank Shot to attack dialogs (many thanks!)
- rectulo updated the French translation (many thanks!)

## 0.561

### Bug Fixes

- Fatal bug with feats causing character sheets to be unopenable

### Changelog

- Added fields for damage that's only applied on critical hits

## 0.56

### Bug Fixes

- Chat card buttons were not visible to players who didn't own the message

### Changelog

- Added title coloring to chat cards involving items
- holyplankton added the Esufey (many thanks!)
- Added ability to drag spells to an actor's inventory tab to create a consumable item from it
- Added ability types (ex, su and sp) to features
- Added masterwork property to armor and shields
- Added creature templates to actors' feature lists

### Internal Changes

- Class items now use 'data.level' instead of 'data.levels', to be in sync with the internal data of buff levels

## 0.551

### Bug Fixes

- Some sample macros were throwing errors
- Hidden tokens would not show up on the combat tracker
- sizeRoll with an original die of 1d6 would increase too much for larger sizes
- Races couldn't be dragged from actor sheets

### Changelog

- holyplankton added unchained classes (many thanks!)
- Added Omdura as a class
- Added Lo's item compendium (many thanks!)
- holyplankton added a bunch of races (many thanks!)

## 0.55

### Bug Fixes

- Fixed Dice So Nice integration with attack rolls
- Power attack damage bonuses are no longer applied to additional damage formulas on attacks
- Fixed the 'toggle buff' sample macro

### Changelog

- Added races as item types
- Added the possibility to add features to token quickbars
- You can now add specific skill changes to items without an associated actor
- You can now easily select what ability score affects your hit points and saving throws
- Added an option to preload compendiums

## 0.54

### Bug Fixes

- Attack measure templates appeared frozen during the preview under certain circumstances
- sizeRoll was not functioning correctly under certain circumstances
- Fixed power attack (again)

### Changelog

- You can now use features that have no real action, but do have charges, making it subtract a charge before showing its chat entry
- You can now add features to the token quickbar
- The modifier key to show an item from the macro bar, rather than using the item, has been changed from Shift to Control

## 0.53

### Bug Fixes

- Maximum dexterity bonus was not showing up on actor sheets
- Power attack didn't add damage
- Changes to a category of skill bonuses didn't apply to subskills

### Changelog

- Added a way to select the ability damage multiplier one time on attack roll dialogs
- Add fields for fast healing and regeneration
- Shift-clicking an item macro now just shows the item to chat, rather than using it when applicable
- Once-per-attack attack notes can now be added to all attacks, not just those with attack rolls
- A spell resistance table is no longer shown on defense chat entries for creatures without spell resistance
- Dan Gomme greatly improved the PF1 style measure templates (many thanks!)

## 0.52

### Bug Fixes

- Normal measure templates were no longer working
- Applying damage from an item attack chat entry gave an error
- Compendium browsers were working incorrectly when reopening after previously filtering by name
- Worlds that were just being migrated from an older version had actors with missing items
- Positive dexterity modifiers were being applied to flat-footed CMD
- CSS styling for actors' skill tabs looked strange since the FoundryVTT 0.5.7 update

### Changelog

- Effect Notes (on attacks and spells) are now added to each individual attack roll, rather than once in the whole (full-round) attack

## 0.51

### Bug Fixes

- Measure templates for attacks didn't work since Foundry 0.5.6 anymore
- CMB incorrectly used Strength instead of Dexterity for actors that were Tiny or smaller

### Changelog

- Spellbooks are now set to spontaneous or not, rather than individual spells
- Added a rest option to actors which will automatically heal hit point and ability score damage, as well as restore daily uses of items, features, attacks, spells and spellbooks
- Measure template previews now highlight the grid they affect

## 0.5

### Bug Fixes

- Saving throw and skill roll criticals and fumbles weren't being highlighted anymore
- Dice So Nice integration for multi attacks was showing the result of the last roll on every dice toss
- Attacks without damage or effect notes weren't useable

### Changelog

- Attacks with multiple damage parts now have their parts clearly separated in the chat tooltip
- Full attacks are now consolidated into a single chat card again
- Added a few more bestiary entries
- Edited the Award XP sample macro to add an option for distributing experience evenly among those selected

## 0.44

### Bug Fixes

- Quick attack actions not using token data when applicable
- Pre-processed functions (sizeRoll) couldn't use calculated parameters
- Attack and effect/damage notes were not using any actor data

### Changelog

- Dice So Nice integration
- Obfuscate roll notes from players without at least LIMITED permission over the actor
- Added mechanism to automatically deduct spell uses
- Added sample macro to award experience points

## 0.431

### Changelog

- Now pre-processes the `sizeRoll` function, which gives the ability to show the die you rolled as a result

## 0.43

### Bug Fixes

- Fix missing icons for classes

### Changelog

- Added a few more tooltips for formula uses
- Added a new variable for formulas: `@size`, which is a number in the range of -4 to 4, based on the actor's size, where 0 equals Medium
- Added a new function to use in formulas: `sizeRoll(c, s[, size[, crit]])`, which returns a random number based on a given die for different sizes (for more information, check [https://furyspark.gitlab.io/foundryvtt-pathfinder1-doc/advanced/formula-data/](https://furyspark.gitlab.io/foundryvtt-pathfinder1-doc/advanced/formula-data/))
- Added some data fields for weapons to account for the new size functionality, and creating an attack from a weapon now uses the new function
- Added feat tags and a feat compendium browser
- Added context note options for all attack and damage rolls to items with changes

## 0.42

### Bug Fixes

- Inability to rename items in certain conditions

### Changelog

- Improved styling of attack and effect notes
- Added a quick way of adding and subtracting item quantities in inventory screens
- Og added more weapons, ammo, armor and shields (this did change around some icon files, so unfortunately it'll mean you have to manually change icons or replace items) (many thanks!)
- Turned certain dice rolls (such as skills and saving throws, but not attacks) into actual Roll type messages again, meaning they will work with modules that rely on that data (such as BubbleRolls)
- Dorgendubal added quick attacks to tokens (many thanks!)

## 0.411

### Bug Fixes

- Shields were not applying their AC

### Changelog

- Dorgendubal added initial support for the metric system (many thanks!)
- Moved defense tab on character and npc sheets

## 0.41

### Bug Fixes

- Actor inventories didn't show an equipment's label under certain circumstances
- An error in physical item updates
- A niche error with item attacks
- Actors weren't being slowed down by armor anymore

### Changelog

- @Grenadier added an advanced health configuration screen (many thanks!)
- A lot of feats were updated (thanks, @Og and @Krise !)
- Added 3 creatures to the bestiary

## 0.4

### Changelog

- @Xam changed up some hardcoded strings (many thanks!)
- Add an actor inventory column for GMs to set an item's identified state
- Refactored weapons' and equipments' categories, adding subcategories to them as well
  - The items compendium has been updated to reflect these changes
  - The migration will do a decent job at updating the (sub)types of these items, but sometimes it's not possible to get appropriate data from previous entries (most notably with shield subtypes)
- Added a sample macro for toggling buffs
- Add an option to automatically deduct charges from items
- Changed styling of character sheet tabs somewhat
- Add an option to adjust the base DC formula of spells, on a per-spellbook basis
- Spells dropped on an actor's sheet now start out belonging to the currently open spellbook
- Hovering over certain attributes on character sheets now shows a tooltip, where previously the intent was completely hidden (such as with alignment, deity, temp hp, etc.)

## 0.361

### Bug Fixes

- Automated HP calculation was not being done properly past level 2
- Identified weapon names were being forgotten

## 0.36

### Bug Fixes

- Blind rolls were not hidden

### Changelog

- Slightly improve styling of actor sheets with limited visibility
- Add initial support for unidentified items
  - Only GMs can toggle an item's identified state
  - Players will see an alternate name, description and price, and some info is completely missing for unidentified items
  - Actions of unidentified items are unusable by players
- Add separate carried column for actors' inventories, and a quick way to mark an item as carried/not carried.
- Add an alternate style for item names without a quantity in actors' inventories (a line through the name)
- @Grenadier added the Wounds and Vigor optional rules system (many thanks!)
- @Grenadier changed automatic hit point calculation to be slightly higher (acknowledge the fact that there's no 0 on a dice) (many thanks!)

## 0.35

### Bug Fixes

- Using spells with multiple attacks showed the spell description multiple times
- John Shetler fixed a giant oversight in the Fractional Base Bonuses optional rule system (many thanks!)

### Changelog

- Add color and texture override options to measure templates on items
- Added a dedicated field for darkvision in token configurations
  - Unlike bright vision, darkvision radius ignores the scene's darkness level, making it seem fully lit for darkvision owners (up to their darkvision radius)
  - Updated creatures in the bestiary to use darkvision instead of bright vision
- @Dorgendubal and @rectulo improved the French translation (many thanks!)

## 0.34

### Bug Fixes

- Armor Check Penalty stacked incorrectly
- Fog of War was not being loaded
- Items from hidden compendiums were visible to players in the compendium browsers
- Dexterity penalties didn't apply to flat-footed CMD
- Having multiple spell level checkboxes ticked in the compendium browser used to be an AND comparison, when it should have been an OR comparison

### Changelog

- Imported most (if not all) spells into a compendium
  - The old spells compendium is replaced
  - The spells all have a generic icon, and a lot of them don't have a damage formula or template yet when they could make use of one

## 0.33

### Changelog

- Add level requirement data fields for spells
  - Updated the spells compendium to reflect these changes
- Add compendium browsers
  - Currently only for spells, items and a bestiary, but more to come
- Creatures with a climb or swim speed now gain a +8 Racial bonus to the Climb and Swim skills, respectively, as per the core rules
- Merged the Armor, Weapons and Magic Items compendium into a single compendium
- Added a bunch of entries to the following compendiums: bestiary, spells and items

## 0.32

### Bug Fixes

- Sample macros' accidental reliance on Furnace

### Changelog

- Add Fractional Base Bonuses optional ruleset as a world setting
- Add another type of class, Racial HD, which represents a creature's racial hit die
  - Added a compendium for racial hit die
  - What little exists in the bestiary compendium has been updated to reflect this
- Classes can now have changes, similar to buffs, feats, weapons and equipment
- Added a list of all skills to classes with checkboxes to make them class skills
  - A skill is now a class skill if it's checked as a class skill on at least one of the actor's classes
  - Updated all classes in the classes compendium to reflect these changes
- Add option for items with actions (like spells and attacks) to have an associated measure template
  - When using the attack or spell, you get an option on whether you want to automatically insert the template
- Add option to ignore arcane spell failure, on a per-spellbook basis

## 0.311

### Bug Fixes

- Character sheet glitch with incorrect class type set

## 0.31

### Bug Fixes

- Freeze on adding/removing items to/from unlinked tokens

### Changelog

- Improved existing sample macros
- Added a journal compendium for conditions
- Shows a warning on character sheets without a class, indicating that some attributes require one
- Add option for natural attacks on whether it's a primary or secondary attack, and apply penalties as appropriate

## 0.302

### Bug Fixes

- Error with actor sheets in certain circumstances, causing them to not update

## 0.301

### Changelog

- Increased the compatible core version so that it works with FoundryVTT 0.5.5

## 0.3

### Bug Fixes

- Rectangle and ray measurements using too strict snapping

### Changelog

- Allow rolling initiative without combat
- Add another type of NPC sheet, which only shows inventory (useful for party loot tracking, for example)
- Automate scaling of BAB and Saving Throws with class levels (NOTE: you'll have to re-enter that info on your existing classes, one time only)
- Add a german translation (thanks, arwec!)
- Add a french translation (thanks, rectulo!)

## 0.26

### Bug Fixes

- Only base strength was used for calculating carrying capacity.
- Item changes with wrong formulas crashing/locking the actor's updates
- Delay with encumbrance penalties rolling in
- Low-light Vision always on under certain circumstances for players with multiple owned tokens

### Changelog

- Add power attack option to attack rolls, and show their dialog by default (shift-click or right-click to circumvent dialog)
- Add world setting to change low-light vision behaviour for players

## 0.25

### Bug Fixes

- Error with looking up fly maneuverability

### Changelog

- Turned most of the hardcoded UI text into translatable strings
- Generate spell descriptions automatically (will require some re-editing of spells)
- Updated spells compendium to reflect spell changes

## 0.24

### Bug Fixes

- Actor permissions not updating without a page refresh

### Changelog

- Add more movement types, and automate movement speedt totals based on encumbrance and armor
- Automation of spell slot count (you'll have to re-enter your casters' spell slot count for this update)
- Add lite version of the NPC sheet, which is meant to be used alongside an NPC stat block, and only shows the bare minimum
- Added a bunch of feats to their compendium, thanks to Amakiir (some icons still missing, for now)

## 0.23.2 (Shameful Emergency Update 2)

### Bug Fixes

- Certain actor data not updating

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
