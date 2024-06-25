/**
 * @typedef {typeof templatePaths[number]} CachedTemplatePath
 * A path to a template that has been cached as part of the partial preloading process.
 */

/**
 * A list of template paths to pre-load
 *
 * @private
 */
const templatePaths = /** @type {const} */ ([
  // Actor Sheet Partials
  "systems/pf1/templates/actors/parts/actor-summary.hbs",
  "systems/pf1/templates/actors/parts/actor-level.hbs",
  "systems/pf1/templates/actors/parts/actor-traits.hbs",
  "systems/pf1/templates/actors/parts/actor-inventory.hbs",
  "systems/pf1/templates/actors/parts/actor-features.hbs",
  "systems/pf1/templates/actors/parts/actor-spellbook-front.hbs",
  "systems/pf1/templates/actors/parts/actor-spellbook.hbs",
  "systems/pf1/templates/actors/parts/actor-skills-front.hbs",
  "systems/pf1/templates/actors/parts/actor-skills.hbs",
  "systems/pf1/templates/actors/parts/actor-combat.hbs",
  "systems/pf1/templates/actors/parts/actor-defenses_tables.hbs",
  "systems/pf1/templates/actors/parts/actor-buffs.hbs",
  "systems/pf1/templates/actors/parts/actor-attributes.hbs",
  "systems/pf1/templates/actors/parts/actor-settings.hbs",
  "systems/pf1/templates/actors/parts/actor-settings-ability-scores.hbs",
  "systems/pf1/templates/actors/parts/actor-item-summary.hbs",

  "systems/pf1/templates/internal/item-search.hbs",

  "systems/pf1/templates/internal/table_magic-items.hbs",

  // Item Sheet Partials
  "systems/pf1/templates/items/parts/item-actions.hbs",
  "systems/pf1/templates/items/parts/item-advanced.hbs",
  "systems/pf1/templates/items/parts/item-alignments.hbs",
  "systems/pf1/templates/items/parts/item-ammo.hbs",
  "systems/pf1/templates/items/parts/item-aura.hbs",
  "systems/pf1/templates/items/parts/item-base-types.hbs",
  "systems/pf1/templates/items/parts/item-changes.hbs",
  "systems/pf1/templates/items/parts/item-class-link.hbs",
  "systems/pf1/templates/items/parts/item-contents.hbs",
  "systems/pf1/templates/items/parts/item-description.hbs",
  "systems/pf1/templates/items/parts/item-sidebar-inputs.hbs",
  "systems/pf1/templates/items/parts/item-sidebar-tags.hbs",
  "systems/pf1/templates/items/parts/item-sidebar-conditions.hbs",
  "systems/pf1/templates/items/parts/item-sidebar-aura.hbs",
  "systems/pf1/templates/items/parts/item-links.hbs",
  "systems/pf1/templates/items/parts/item-materials-addon.hbs",
  "systems/pf1/templates/items/parts/item-materials.hbs",
  "systems/pf1/templates/items/parts/item-name.hbs",
  "systems/pf1/templates/items/parts/item-notes.hbs",
  "systems/pf1/templates/items/parts/item-proficiencies.hbs",
  "systems/pf1/templates/items/parts/item-conditions.hbs",
  "systems/pf1/templates/items/parts/item-size.hbs",
  "systems/pf1/templates/items/parts/item-tag.hbs",
  "systems/pf1/templates/items/parts/item-tags.hbs",
  "systems/pf1/templates/items/parts/item-weapon-groups.hbs",
  "systems/pf1/templates/items/parts/spell-descriptors.hbs",

  "systems/pf1/templates/internal/content-source-view.hbs",

  // Apps
  "systems/pf1/templates/apps/attack-roll-dialog.hbs",
  "systems/pf1/templates/apps/vision-sharing.hbs",
  "systems/pf1/templates/apps/help-browser.hbs",
  "systems/pf1/templates/apps/action-select.hbs",
  "systems/pf1/templates/apps/item-select.hbs",
  "systems/pf1/templates/apps/actor-select.hbs",

  // Item Action Partials
  "systems/pf1/templates/apps/item-action/action.hbs",
  "systems/pf1/templates/apps/item-action/activation.hbs",
  "systems/pf1/templates/apps/item-action/template.hbs",
  "systems/pf1/templates/apps/item-action/conditionals.hbs",

  // Compendium browser partials
  "systems/pf1/templates/apps/compendium-browser/entries.hbs",
  "systems/pf1/templates/apps/compendium-browser/checkbox-filter.hbs",
  "systems/pf1/templates/apps/compendium-browser/text-filter.hbs",

  // Chat
  "systems/pf1/templates/chat/roll-ext.hbs",
  "systems/pf1/templates/chat/defenses.hbs",
  "systems/pf1/templates/chat/parts/gm-description.hbs",

  // Chat card partials
  "systems/pf1/templates/chat/parts/attack-roll-header.hbs",
  "systems/pf1/templates/chat/parts/attack-roll-footer.hbs",
  "systems/pf1/templates/chat/parts/attack-roll-targets.hbs",

  "systems/pf1/templates/chat/parts/item-notes.hbs",

  // Internal Rendering Partials
  "systems/pf1/templates/internal/spell-description.hbs",
  "systems/pf1/templates/internal/token-config_vision.hbs",
  "systems/pf1/templates/internal/damage-type-visual.hbs",

  // Tooltip
  "systems/pf1/templates/hud/tooltip.hbs",

  "systems/pf1/templates/hud/quick-actions.hbs",

  // Level Up sections
  "systems/pf1/templates/apps/level-up/health.hbs",
  "systems/pf1/templates/apps/level-up/ability-score.hbs",
  "systems/pf1/templates/apps/level-up/fcb.hbs",
  "systems/pf1/templates/apps/level-up/summary.hbs",

  // Dynamic tooltips
  "systems/pf1/templates/extended-tooltip.hbs",
]);

/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 *
 * @internal
 * @private
 * @returns {Promise<Function[]>} - A Promise resolving to an array of template functions
 */
export const preloadHandlebarsTemplates = async () => {
  // Load the template parts
  return loadTemplates(templatePaths);
};

/**
 * Synchronously render a cached Handlebars template using provided data.
 *
 * @internal
 * @private
 * @see {renderTemplate}
 * @param {CachedTemplatePath} path - The template identifier
 * @param {object} [data={}] - The data provided to the template
 * @returns {string} The rendered HTML
 * @throws {Error} If the requested template could not be found in the cache
 */
export const renderCachedTemplate = (path, data = {}) => {
  /** @type {Handlebars.TemplateDelegate|undefined} */
  const template = Handlebars.partials[path];
  if (!template) throw new Error(`Template ${path} not found in cache`);

  return template(data, {
    allowProtoMethodsByDefault: true,
    allowProtoPropertiesByDefault: true,
    preventIndent: true,
  });
};
