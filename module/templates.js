/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async function() {

  // Define template paths to load
  const templatePaths = [

    // Actor Sheet Partials
    "systems/pf1/templates/actors/parts/actor-traits.html",
    "systems/pf1/templates/actors/parts/actor-inventory.html",
    "systems/pf1/templates/actors/parts/actor-features.html",
    "systems/pf1/templates/actors/parts/actor-spellbook-front.html",
    "systems/pf1/templates/actors/parts/actor-spellbook.html",
    "systems/pf1/templates/actors/parts/actor-skills-front.html",
    "systems/pf1/templates/actors/parts/actor-skills.html",
    "systems/pf1/templates/actors/parts/actor-defenses.html",
    "systems/pf1/templates/actors/parts/actor-buffs.html",

    // Item Sheet Partials
    "systems/pf1/templates/items/parts/item-action.html",
    "systems/pf1/templates/items/parts/item-activation.html",
    "systems/pf1/templates/items/parts/item-description.html",
    "systems/pf1/templates/items/parts/item-changes.html",
    "systems/pf1/templates/items/parts/item-notes.html",

    // Misc
    "systems/pf1/templates/misc/token-config.html",

    // Chat
    "systems/pf1/templates/chat/roll-ext.html",
  ];

  // Load the template parts
  return loadTemplates(templatePaths);
};
