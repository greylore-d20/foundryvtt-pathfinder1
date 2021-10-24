/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 *
 * @returns {Promise}
 */
export const preloadHandlebarsTemplates = async function () {
  // Define template paths to load
  const templatePaths = [
    // Actor Sheet Partials
    "systems/pf1/templates/actors/parts/actor-summary.hbs",
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
    "systems/pf1/templates/actors/parts/actor-cmb.hbs",
    "systems/pf1/templates/actors/parts/actor-contextNotes.hbs",

    "systems/pf1/templates/internal/item-search.hbs",

    // Item Sheet Partials
    "systems/pf1/templates/items/parts/item-action.hbs",
    "systems/pf1/templates/items/parts/item-activation.hbs",
    "systems/pf1/templates/items/parts/item-description.hbs",
    "systems/pf1/templates/items/parts/item-changes.hbs",
    "systems/pf1/templates/items/parts/item-template.hbs",
    "systems/pf1/templates/items/parts/item-links.hbs",
    "systems/pf1/templates/items/parts/item-aura.hbs",
    "systems/pf1/templates/items/parts/item-conditionals.hbs",
    "systems/pf1/templates/items/parts/item-contents.hbs",
    "systems/pf1/templates/items/parts/item-tag.hbs",
    "systems/pf1/templates/items/parts/item-name.hbs",
    "systems/pf1/templates/items/parts/item-advanced.hbs",
    "systems/pf1/templates/items/parts/item-size.hbs",

    // Apps
    "systems/pf1/templates/apps/attack-roll-dialog.hbs",
    "systems/pf1/templates/apps/vision-permission.hbs",
    "systems/pf1/templates/apps/help-browser.hbs",

    // Chat
    "systems/pf1/templates/chat/roll-ext.hbs",
    "systems/pf1/templates/chat/defenses.hbs",

    // Chat card partials
    "systems/pf1/templates/chat/parts/attack-roll-header.hbs",
    "systems/pf1/templates/chat/parts/attack-roll-footer.hbs",

    // Internal Rendering Partials
    "systems/pf1/templates/internal/spell-description.hbs",
    "systems/pf1/templates/internal/consumable-description.hbs",
    "systems/pf1/templates/internal/damage-tooltip.hbs",
    "systems/pf1/templates/internal/token-config_vision.hbs",
    "systems/pf1/templates/internal/compendium-browser_entry.hbs",

    // Tooltip
    "systems/pf1/templates/hud/tooltip.hbs",
    "systems/pf1/templates/hud/tooltip_actor.hbs",
  ];

  // Load the template parts
  return loadTemplates(templatePaths);
};
