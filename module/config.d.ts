/**
 * Valid types for the `subTarget` property of an {@link ItemChange}.
 * At runtime, the system's defaults can be expanded by adding to {@link pf1.config.buffTargets}.
 */
type BuffTarget = keyof typeof pf1.config.buffTargets;

/**
 * Valid types for the `modifier` property of an {@link ItemChange}.
 * At runtime, the system's defaults can be expanded by adding to {@link pf1.config.bonusModifiers}.
 */
type ModifierType = keyof typeof pf1.config.bonusModifiers;

/**
 * A unit system determining which measurement units are used.
 *
 * @see {@link pf1.config.measureUnits}
 */
type UnitSystem = "imperial" | "metric";

/**
 * Valid sizes for actors.
 *
 * @see {@link pf1.config.actorSizes}
 */
type ActorSize = keyof typeof pf1.config.actorSizes;

/**
 * Valid statures for actors.
 *
 * @see {@link pf1.config.actorStatures}
 */
type ActorStature = keyof typeof pf1.config.actorStatures;

/**
 * Types of coins.
 *
 * Used e.g. in actors' `system.attributes.currency`.
 */
type CoinType = "pp" | "gp" | "sp" | "cp";
