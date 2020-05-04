/**
 * The Pathfinder 1st edition game system for Foundry Virtual Tabletop
 * Author: Furyspark
 * Software License: GNU GPLv3
 */

// Import Modules
import { PF1 } from "./module/config.js";
import { registerSystemSettings } from "./module/settings.js";
import { preloadHandlebarsTemplates } from "./module/templates.js";
import { addChatMessageContextOptions } from "./module/combat.js";
import { measureDistance } from "./module/canvas.js";
import { ActorPF } from "./module/actor/entity.js";
import { ActorSheetPFCharacter } from "./module/actor/sheets/character.js";
import { ActorSheetPFNPC } from "./module/actor/sheets/npc.js";
import { ActorSheetPFNPCLite } from "./module/actor/sheets/npc-lite.js";
import { ActorSheetPFNPCLoot } from "./module/actor/sheets/npc-loot.js";
import { ItemPF } from "./module/item/entity.js";
import { ItemSheetPF } from "./module/item/sheets/base.js";
import { CompendiumDirectoryPF } from "./module/sidebar/compendium.js";
import { PatchCore } from "./module/patch-core.js";
import { DicePF } from "./module/dice.js";
import { getItemOwner } from "./module/lib.js";
import { TokenQuickActions } from "./module/token-quick-actions.js";
import * as chat from "./module/chat.js";
import * as migrations from "./module/migration.js";

// Add String.format
if (!String.prototype.format) {
  String.prototype.format = function(...args) {
    return this.replace(/{(\d+)}/g, function(match, number) { 
      return args[number] != null
        ? args[number]
        : match
      ;
    });
  };
}

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function() {
  console.log(`PF1 | Initializing Pathfinder 1 System`);

  // Create a PF1 namespace within the game global
  game.pf1 = {
    ActorPF,
    DicePF,
    ItemPF,
    migrations,
    rollItemMacro,
    rollDefenses,
    CompendiumDirectoryPF,
  };

  // Record Configuration Values
  CONFIG.PF1 = PF1;
  CONFIG.Actor.entityClass = ActorPF;
  CONFIG.Item.entityClass = ItemPF;
  CONFIG.ui.compendium = CompendiumDirectoryPF;

  // Register System Settings
  registerSystemSettings();

  // Preload Handlebars Templates
  await preloadHandlebarsTemplates();

  // Patch Core Functions
  PatchCore();

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("PF1", ActorSheetPFCharacter, { types: ["character"], makeDefault: true });
  Actors.registerSheet("PF1", ActorSheetPFNPC, { types: ["npc"], makeDefault: true });
  Actors.registerSheet("PF1", ActorSheetPFNPCLite, { types: ["npc"], makeDefault: false });
  Actors.registerSheet("PF1", ActorSheetPFNPCLoot, { types: ["npc"], makeDefault: false });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("PF1", ItemSheetPF, { types: ["class", "feat", "spell", "consumable", "equipment", "loot", "weapon", "buff", "attack"], makeDefault: true });
});


/* -------------------------------------------- */
/*  Foundry VTT Setup                           */
/* -------------------------------------------- */

/**
 * This function runs after game data has been requested and loaded from the servers, so entities exist
 */
Hooks.once("setup", function() {

  // Localize CONFIG objects once up-front
  const toLocalize = [
    "abilities", "abilitiesShort", "alignments", "currencies", "distanceUnits", "itemActionTypes", "senses", "skills", "targetTypes",
    "timePeriods", "savingThrows", "ac", "acValueLabels", "featTypes", "conditions", "lootTypes", "flyManeuverabilities",
    "spellPreparationModes", "weaponTypes", "weaponProperties", "spellComponents", "spellSchools", "spellLevels", "conditionTypes",
    "favouredClassBonuses", "armorProficiencies", "weaponProficiencies", "actorSizes", "abilityActivationTypes", "abilityActivationTypesPlurals",
    "limitedUsePeriods", "equipmentTypes", "equipmentSlots", "consumableTypes", "attackTypes", "buffTypes", "buffTargets", "contextNoteTargets",
    "healingTypes", "divineFocus", "classSavingThrows", "classBAB", "classTypes", "measureTemplateTypes", "creatureTypes",
  ];

  const doLocalize = function(obj) {
    return Object.entries(obj).reduce((obj, e) => {
      if (typeof e[1] === "string") obj[e[0]] = game.i18n.localize(e[1]);
      else if (typeof e[1] === "object") obj[e[0]] = doLocalize(e[1]);
      return obj;
    }, {});
  };
  for ( let o of toLocalize ) {
    CONFIG.PF1[o] = doLocalize(CONFIG.PF1[o]);
  }
});

/* -------------------------------------------- */

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 */
Hooks.once("ready", async function() {
  const NEEDS_MIGRATION_VERSION = 0.411;
  let needMigration = game.settings.get("pf1", "systemMigrationVersion") < NEEDS_MIGRATION_VERSION;
  if (needMigration && game.user.isGM) {
    await migrations.migrateWorld();
  }

  game.actors.entities.forEach(obj => { obj._updateChanges({ sourceOnly: true }); });
  
  Hooks.on('renderTokenHUD', (app, html, data) => { TokenQuickActions.addTop3Attacks(app, html, data) });
});

/* -------------------------------------------- */
/*  Canvas Initialization                       */
/* -------------------------------------------- */

Hooks.on("canvasInit", function() {

  // Extend Diagonal Measurement
  canvas.grid.diagonalRule = game.settings.get("pf1", "diagonalMovement");
  SquareGrid.prototype.measureDistance = measureDistance;
});


/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */

Hooks.on("renderChatMessage", (app, html, data) => {
  // Display action buttons
  chat.displayChatActionButtons(app, html, data);

  // Highlight critical success or failure
  chat.highlightCriticalSuccessFailure(app, html, data);

  // Hide roll info
  chat.hideRollInfo(app, html, data);

  // Optionally collapse the content
  if (game.settings.get("pf1", "autoCollapseItemCards")) html.find(".card-content").hide();
});

Hooks.on("getChatLogEntryContext", addChatMessageContextOptions);
Hooks.on("renderChatLog", (_, html) => ItemPF.chatListeners(html));
Hooks.on("renderChatLog", (_, html) => ActorPF.chatListeners(html));

Hooks.on("updateOwnedItem", (actor, _, changedData) => {
  if (!(actor instanceof Actor)) return;
  actor.refresh();

  const item = actor.getOwnedItem(changedData._id);
  if (item == null) return;
  actor.updateItemResources(item);
});
Hooks.on("updateToken", (scene, sceneId, data) => {
  const actor = game.actors.tokens[data._id];
  if (actor != null && hasProperty(data, "actorData.items")) {
    actor.refresh();

    // Update items
    for (let i of actor.items) {
      actor.updateItemResources(i);
    }
  }
});

Hooks.on("createOwnedItem", (actor) => {
  if (!(actor instanceof Actor)) return;
  actor.refresh();
});
Hooks.on("deleteOwnedItem", (actor) => {
  if (!(actor instanceof Actor)) return;
  actor.refresh();
});


/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

Hooks.on("hotbarDrop", (bar, data, slot) => {
  if ( data.type !== "Item" ) return;
  createItemMacro(data.data, slot);
  return false;
});

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} item     The item data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(item, slot) {
  const actor = getItemOwner(item);
  const command = `game.pf1.rollItemMacro("${item.name}", {\n` +
  `  itemId: "${item._id}",\n` +
  `  itemType: "${item.type}",\n` +
  (actor != null ? `  actorId: "${actor._id}",\n` : "") +
  `});`;
  let macro = game.macros.entities.find(m => (m.name === item.name) && (m.command === command));
  if ( !macro ) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: {"pf1.itemMacro": true}
    }, {displaySheet: false});
  }
  game.user.assignHotbarMacro(macro, slot);
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @param {string} actorName
 * @return {Promise}
 */
function rollItemMacro(itemName, {itemId=null, itemType=null, actorId=null}={}) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (actorId != null) actor = game.actors.entities.filter(o => { return o._id === actorId; })[0];
  if (speaker.token && !actor) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  if (actor && !actor.hasPerm(game.user, "OWNER")) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));
  const item = actor ? actor.items.find(i => {
    if (itemId != null && i._id !== itemId) return false;
    if (itemType != null && i.type !== itemType) return false;
    return i.name === itemName;
  }) : null;
  if (!item) return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);

  // Trigger the item roll
  if (item.hasAction) return item.useAttack({skipDialog: keyboard.isDown("Shift")});
  if (item.data.type === "spell") return actor.useSpell(item, null, {skipDialog: keyboard.isDown("Shift")});
  return item.roll();
}

/**
 * Show an actor's defenses.
 */
function rollDefenses({actorName=null, actorId=null}={}) {
  const speaker = ChatMessage.getSpeaker();
  let actor = game.actors.entities.filter(o => {
    if (!actorName && !actorId) return false;
    if (actorName && o.name !== actorName) return false;
    if (actorId && o._id !== actorId) return false;
    return true;
  })[0];
  if (speaker.token && !actor) actor = game.actors.tokens[speaker.token];
  if (!actor) actor = game.actors.get(speaker.actor);
  if (!actor) return ui.notifications.warn("No applicable actor found");

  return actor.rollDefenses();
};
