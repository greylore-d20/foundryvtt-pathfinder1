# Formulas

This section is currently a Work In Progress (WIP).

Formulas are an important aspect in the Pathfinder 1e system. They can be as simple as a single numerical value, or as complex as single lines of code. They play a great role in item changes.

## Variables

For a quick reference, you can find a lot of this information in tooltips on actor sheets as well.

### `@abilities.X.total`

The total value of an ability score. Replace `X` with one of the following: `str`, `dex`, `con`, `int`, `wis`, `cha`.

### `@abilities.X.mod`

The modifier of an ability score. Replace `X` with one of the following: `str`, `dex`, `con`, `int`, `wis`, `cha`.

### `@attributes.hd.total`

The total hit die the actor has. This is a combination of class levels and racial hit die, and it excludes mythic tiers.

### `@attributes.savingThrows.X.total`

The total bonus of the appropriate saving throw for that actor. X can be either 'fort' (Fortitude), 'ref' (Reflex) or 'will' (Will)

### `@attributes.savingThrows.X.base`

The total bonus of the appropriate saving throw for that actor. X can be either 'fort' (Fortitude), 'ref' (Reflex) or 'will' (Will)

### `@attributes.encumbrance.level`

The current encumbrance level of the actor.

- `0`: Light Load
- `1`: Medium Load
- `2`: Heavy Load

### `@armor.type`

The type of armor the actor is wearing.

- `0`: No Armor
- `1`: Light Armor
- `2`: Medium Armor
- `3`: Heavy Armor

### `@shield.type`

The type of shield the actor is holding.

- `0`: No Shield
- `1`: Miscellaneous Shield (such as a buckler)
- `2`: Light Shield
- `3`: Heavy Shield
- `4`: Tower Shield

### `@combat.round`

The current round of combat, or `0` if not in combat.

### `@critMult`

The critical multiplier of the attack, or `1` if the attack is not a critical threat.
Only appropriate for use in damage rolls and attack and effect notes.

### `@sizeBonus`

Effective attack roll bonus or penalty from size.

### `@powerAttackBonus`

Base bonus damage given by power attack to individual damage. E.g. two-handed attack at level 2 would always give 3 for this.

Defaults to `0` if power attack is disabled.

### `@powerAttackPenalty`

Attack penalty power attacking causes. Goes hand in hand with `@powerAttackBonus`.

For example furious focus is easy to implement with conditional attack roll modifier of `-@powerAttackPenalty` on the first attack.

Defaults to `0` if power attack is disabled.

### `@attackCount`

Zero-indexed counter for which attack is being processed. So if this was placed as damage bonus, it would give you `0`, `1`, `2`, `3`, etc. bonus to damage as the attacks progress.

Can also be used for ternaries to add modifications to specific attack, e.g. `@attackCount == 0 ? 4 : 0` would add 4 to first attack but no other.

## Functions

Foundry (and by extension this system) allow using JavaScript's [`Math` functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math) in its formulas.
Information about writing formulas using such expressions and referencing actor and item data can be found in [Foundry's Knowledge Base](https://foundryvtt.com/article/dice-advanced/).
In addition to the functions mentioned there, the Pathfinder 1e system provides some specific helpers available for use in some formulas.

### `sizeRoll`

Alters a damage roll to that of another size category.

**Example:** `sizeRoll(1, 8, @size)` – Rolls 1d8 for medium actors, and alters the damage formula according to the calling actor's current size.

**Example:** `sizeRoll(1, 4, 6, 2)` – Translates a damage roll of `1d4` from a tiny actor (size `2`) to a huge actor (size `6`); Output: `3d6`

| `@size` | Actual     |
| :------ | :--------- |
| `0`     | Fine       |
| `1`     | Diminutive |
| `2`     | Tiny       |
| `3`     | Small      |
| `4`     | Small      |
| `5`     | Large      |
| `6`     | Huge       |
| `7`     | Gargantuan |
| `8`     | Colossal   |

Normally you should not need the fourth parameter. It's mainly useful if you have damage for non-medium character and use that info to fill the first two parameters, then the fourth parameter should include the size for which the first two were for.

The function does not really do anything useful with less than 3 parameters provided.

You can also use `@item.size` to use the item's own size instead of `@size` which refers to actor's size.

### `sizeReach`

Generates a number equal to the reach of a creature of a certain size and stature.

**Example:** `sizeReach(@size + 1, false, @traits.stature)` – Returns the normal melee reach as if the actor was 1 size category higher.

**Example:** `sizeReach(6, true, "long")` – Returns the reach a huge, long actor would have with a reach weapon.

### `ifelse`

If-Else logic, serving similar purpose to what ternary syntax did before, providing a method to have conditional numbers in the formulas.

**Example:** `ifelse(gt(@class.level, 7), 4, 2)` – REturns 4 if class level is greater than 7, and 2 otherwise.

### `if`

Alias for `ifelse()` with `if(a, b)` being equivalent of `ifelse(a, b, 0)`, the else statement set to zero.

**Example:** `if(gt(@attributes.hd.total, 5), 2)` – gives 2 if HD is greater than 5, and zero otherwise.

### Basic Logic Functions

| Function              | Name  | Math | Example                                                         | Example Explanation                                                   |
| :-------------------- | :---- | :--- | :-------------------------------------------------------------- | :-------------------------------------------------------------------- |
| Equal                 | `eq`  | `=`  | `eq(@attributes.hd.total, 5)`                                   | HD equal to 5                                                         |
| Not equal             | `ne`  | `!=` | `ne(@attributes.hd.total, 5)`                                   | HD not equal to 5                                                     |
| Less than             | `lt`  | `<`  | `lt(@class.level, 5)`                                           | Class level is less than 5                                            |
| Less or equal than    | `lte` | `<=` | `lte(@class.level, 9)`                                          | Class level is 9 or less                                              |
| Greater than          | `gt`  | `>`  | `gt(@class.level, 5)`                                           | Class level is greater than 5                                         |
| Greater or equal than | `gte` | `>=` | `gte(@class.level, 9)`                                          | Class level is 9 or greater                                           |
| And                   | `and` |      | `and(lt(@attributes.encumbrance.level, 2), lt(@armor.type, 3))` | Encumbrance level is lesser than 2 and worn armor type is less than 3 |
| Or                    | `or`  |      | `or(@armor.type, @shield.type)`                                 | Is equipped with any armor or shield (types is non-zero)              |
| Exclusive or          | `xor` |      | `xor(@armor.type, @shield.type)`                                | Is wearing armor or shield, but not both.                             |
| Not                   | `not` |      | `not(@armor.type)`                                              | Is not wearing armor (armor type is non-zero)                         |

🛈 Note! And, Or, and Exclusive Or functions allow any number of parameters.

### `lookup`

Lookup function when none of the above provide meaningful solution.

Format is approximately: `lookup(search, fallback, results...)`

Fallback value is provided if the search formula goes off bounds. If other form of bounding is desired, include it in your formula.

The results are 1-indexed, so 1 will give the first result. You can also treat the parameters as 0 indexed by using the fallback as result for 0, tho this does not strictly follow the underlying logic.

**Example**: `lookup(1d6, 0, 0, 2, 2, 4, 4, 5)` – Resulting in 1d6 roll turning into [1=0, 1=2, 3=2, 4=4, 5=4, 6=5] mapping.

**Example**: `lookup(min(@class.level, 7), 0, 1, 1, 1, 2, 2, 2, 4)` – resulting in 1 to 4 range from level being 1 to 7 or higher with 7 or higher giving 1 more than previous increments.

### `numericValue`

A function that provides the numeric equivalent of configuration keys for certain system types.
This is especially helpful for the change system to set specific values without having to rely on the
configuration being static.

Format is: `numericValue(type, key)`

Returns `-1` if the requested key is not found within the type.

Supported types are:

- `fly` - Fly Maneuverability
- `size` - Size Category

**Example**: `numericValue(size, med)` - Returns the numeric equivalent of medium size, which by default is `4`.

**Example**: `numericValue(fly, good)` - Returns `3` as the numeric equivalent of good fly maneuverability.

**Example**: `numericValue(fly, invalid)` - Returns `-1` as the key is not found.
