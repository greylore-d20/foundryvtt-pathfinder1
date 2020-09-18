/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function() {

  // Define template paths to load
  const templatePaths = [

    // Actor Sheet Partials
    "systems/pf1/templates/actors/parts/actor-details.html",
    "systems/pf1/templates/actors/parts/actor-traits.html",
    "systems/pf1/templates/actors/parts/actor-inventory.html",
    "systems/pf1/templates/actors/parts/actor-features.html",
    "systems/pf1/templates/actors/parts/actor-spellbook-front.html",
    "systems/pf1/templates/actors/parts/actor-spellbook.html",
    "systems/pf1/templates/actors/parts/actor-skills-front.html",
    "systems/pf1/templates/actors/parts/actor-skills.html",
    "systems/pf1/templates/actors/parts/actor-defenses.html",
    "systems/pf1/templates/actors/parts/actor-buffs.html",
    "systems/pf1/templates/actors/parts/actor-attacks.html",

    // Item Sheet Partials
    "systems/pf1/templates/items/parts/item-action.html",
    "systems/pf1/templates/items/parts/item-activation.html",
    "systems/pf1/templates/items/parts/item-description.html",
    "systems/pf1/templates/items/parts/item-changes.html",
    "systems/pf1/templates/items/parts/item-notes.html",
    "systems/pf1/templates/items/parts/item-template.html",
    "systems/pf1/templates/items/parts/item-links.html",
    "systems/pf1/templates/items/parts/links/item-template.html",

    // Misc
    "systems/pf1/templates/misc/token-config.html",

    // Apps
    "systems/pf1/templates/apps/attack-roll-dialog.html",
    "systems/pf1/templates/apps/links.html",
    "systems/pf1/templates/apps/link-options.html",
    "systems/pf1/templates/apps/vision-permission.html",

    // Chat
    "systems/pf1/templates/chat/roll-ext.html",
    "systems/pf1/templates/chat/defenses.html",

    // Internal Rendering Partials
    "systems/pf1/templates/internal/spell-description.html",
    "systems/pf1/templates/internal/consumable-description.html",
    "systems/pf1/templates/internal/damage-tooltip.html",
  ];

  // Load the template parts
  return loadTemplates(templatePaths);
};
