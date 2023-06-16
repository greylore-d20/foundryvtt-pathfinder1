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
