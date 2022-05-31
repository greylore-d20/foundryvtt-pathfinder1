# Changes

![Changes examples](/Help/img/item-changes.jpg)

1. **Flags**
   - **Lose Dex to AC**: While an item with this change is active, a character loses his Dexterity bonuses to Armor Class.
   - **X Ability**: Sets the appropriate ability to the flag's specified value. This might be removed in a later version, since the same can be accomplished with the '=' operator (see below).
   - **Dwarf-like Encumbrance**: While an item with this change is active, its actor will not be slowed down by being in a medium or heavy load.
   - **Full Speed in Medium Armor**: While an item with this change is active, its actor will not be slowed down by wearing medium armor.
   - **Full Speed in Heavy Armor**: While an item with this change is active, its actor will not be slowed down by wearing heavy armor.
2. **Changes**: This is a list of changes which affect the actor owning the item directly. From left to right:
   - **Operator**: The operators are '+' (relative), '=' (absolute) or 'S' (script). Relative values add to an attribute, while absolute values set the attribute to the result of the formula. See below for the script operator.
   - **Formula**: The formula by which to affect this particular change. The way this alters an actor's attribute depends on the operator (see next). See this page for more details.
   - **Target**: A general category of the attribute to alter.
   - **Sub-Target**: The specific attribute to alter with this change.
   - **Modifier**: The modifier of this change.
   - **Priority**: The priority of this change. Changes with lower priorities will be processed later.
3. **Context Notes**: This a list of contextual notes, which are shown in appropriate situations. From left to right:
   - **Description**: The description to show in appropriate situations. Every newline adds a new description to the same target. You can use Foundry-style inline rolls in these.
   - **Target**: A general category of the attribute to alter.
   - **Sub-Target**: The specific attribute to alter with this change.

## Script Operator

The 'formula' of changes using the Script operator are actually small JavaScript scripts that are run when processing changes. Some JavaScript knowledge is required to understand these.

Within these scripts, the following variables can be used:

- `d` The roll data at the time of processing the change. Contains any variable you could use within a normal change formula using the `@` symbol.
- `result` This contains two more variables, `value` and `operator`. Set `value` to the numeric result you want for the change, and `operator` to either "add" or "set".
  `value` defaults to 0 and `operator` defaults to "add".
