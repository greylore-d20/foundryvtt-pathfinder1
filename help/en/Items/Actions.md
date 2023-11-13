# Actions

Each action defines singular way to use an item. Although most usable items have only one action associated with them, some may have more, such as a dagger might have stab and throw actions.

## Usage Tab

Usage tab defines how the action is used, action cost, charge cost, its targeting, range, duration, area, ammunition usage and similar information. Anything that is needed to know _before_ you can resolve the effects of the action.

## Action Tab

Here you define the actual effects of the action.

### Attack

Attack Roll Bonus is used to define any modifiers specific to this attack, such as two-weapon fighting penalty

### Extra Attacks

You can add static extra attacks here with specific modifiers that are performed on full attack always, for example if you have multiple identical claw attacks, defining them in the static top part is an easy way to deal with them.

The formula-based extra attacks below is for more advanced cases, but commonly holds extra attacks from iteratives or any other more complicated case.

#### Iteratives

|              | Formula                                       |
| :----------- | :-------------------------------------------- |
| Attack count | `min(3, ceil(@attributes.bab.total / 5) - 1)` |
| Attack bonus | `@formulaicAttack * -5`                       |

### Damage

**Damage Formula** is for the base damage of the action. This is multiplied on critical if the action has an attack roll.

**Critical Damage Bonus Formula** is damage added _only_ to critical damage rolls. This is multiplied by critical multiplier with one subtracted, so Flaming Burst for example should only be entered simply as `1d10`.

**Non-critical Damage Bonus Formula** is damage added to base damage that is unaffected by critical hits, usually this is elemental and precision bonus damge, such as from magical weapon qualities.

See [Formulas](Help/Formulas) article for more help in how to write damage formulas.

#### Special Variables

| Variable       | Description                                        |
| :------------- | :------------------------------------------------- |
| `@critCount`   | Which critical multiplier pass is being processed. |
| `@attackCount` | Which attack is being processed.                   |

#### Advanced Formulas

Critical-only bonus damage that is not multiplied:
`(@critCount == 1) ? 1d6 : 0`

Damage only on the second attack:
`(@attackCount == 1) ? 2d8 : 0`

## Miscellaneous

This allows you to define a template for the action or sound effect.

The template size formula should resolve to number of feet.

Non-square rectangles are not possible, nor placing multiple templates.

## Conditional Modifiers

Conditional Modifiers are useful for any modifiers that affect specific attack or are only occasionally true.

The available options here depend on the action and item they're used on.

These are presented as choices in the attack dialog. Any default on conditionals are enabled even when skipping the dialog.
