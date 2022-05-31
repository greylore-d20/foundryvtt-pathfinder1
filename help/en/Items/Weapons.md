# Weapons

Weapons are meant to represent physical weapons that a character can hold.

![Weapon Details](/Help/img/en/weapon-details.jpg)

**Category**: The weapon's category (simple, martial, exotic or misc)

**Type**: The weapon's type (light, one-handed, two-handed or ranged)

**Weapon Size**: The weapon's size, similar to a character's size

**Equipment Status**:

- **Equipped**: Whether the item is currently equipped, and transfers its changes to its actor (if any)
- **Identified (GM only)**: Whether the item is currently identified, and shows its identified information to players
- **Masterwork** Whether the item is masterwork, as per the Core rules
- **Broken** Whether the item is broken, as per the Core rules

**Weapon Properties**: The weapon's properties, as per the Core rules (does nothing mechanically)

**Enhancement Bonus**: The item's enhancement bonus, as per the Core rules

**Bonus Attack Formula**: The weapon's attack bonus formula. Examples:

- `@abilities.str.mod < 3 ? -2 : 0` will incur a penalty to the attack roll of -2 if the wielder's Strength modifier is lower than 3.

**Base Weapon Damage**: The first field indicates the damage die a Medium-sized weapon would deal, and the second field indicates the type of damage it deals (i.e. Bludgeoning, Slashing, etc.).

**Bonus Damage Formula**: The bonus damage the weapon deals. Examples:

- `min(4, @abilities.str.mod)` will add either 4 or the wielder's Strength modifier to the damage roll, whichever is lower.

**Base Weapon Critical**: The first field indicates the lowest result of the attack's d20 to be a critical threat, and the second field indicates the amount by which the damage is multiplied.
