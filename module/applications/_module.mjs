/**
 * The various {@link Application}s used by the Pathfinder 1e system.
 *
 * @module
 */

import { CompendiumBrowser } from "./compendium-browser/compendium-browser.mjs";

export * as actor from "./actor/_module.mjs";
export * as item from "./item/_module.mjs";
export * as component from "./component/_module.mjs";
export * as settings from "./settings/_module.mjs";
export * as compendiumBrowser from "./compendium-browser/_module.mjs";
export * as journal from "./journal/_module.mjs";

export { ActionSelector } from "./action-selector.mjs";
export { AttackDialog } from "./attack-dialog.mjs";
export { Widget_CategorizedItemPicker } from "./categorized-item-picker.mjs";
export { ChangeLogWindow } from "./change-log.mjs";
export { CurrencyTransfer } from "./currency-transfer.mjs";
export { DamageTypeSelector } from "./damage-type-selector.mjs";
export { EntrySelector } from "./entry-selector.mjs";
export { ItemSelector } from "./item-selector.mjs";
export { HelpBrowserPF } from "./help-browser.mjs";
export { Widget_ItemPicker } from "./item-picker.mjs";
export { LevelUpForm } from "./level-up.mjs";
export { PointBuyCalculator } from "./point-buy-calculator.mjs";
export { ScriptEditor } from "./script-editor.mjs";
export { SensesSelector } from "./senses-selector.mjs";
export { SkillEditor } from "./skill-editor.mjs";
export { ContentSourceEditor } from "./content-source-editor.mjs";
export { ActorTraitSelector } from "./trait-selector.mjs";
export { VisionSharingSheet } from "./vision-sharing.mjs";
export { ExperienceDistributor } from "./experience-distributor.mjs";
export { ChangeEditor } from "./change-editor.mjs";

export { ItemDirectoryPF } from "./sidebar/items-directory.mjs";
export { Troubleshooter } from "./troubleshooter.mjs";

export { ActorSelector } from "./actor-selector.mjs";
export { SplitStack } from "./split-stack.mjs";

/**
 * {@link CompendiumBrowser}s for the various compendiums.
 *
 * @type {Record<string, CompendiumBrowser>}
 */
export const compendiums = {};
export { helpBrowser } from "./help-browser.mjs";
