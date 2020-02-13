/**
 * The Dungeons & Dragons 5th Edition game system for Foundry Virtual Tabletop
 * Author: Atropos
 * Software License: GNU GPLv3
 * Content License: https://media.wizards.com/2016/downloads/DND/SRD-OGL_V5.1.pdf
 * Repository: https://gitlab.com/foundrynet/PF1
 * Issue Tracker: https://gitlab.com/foundrynet/PF1/issues
 */

// Import Modules
import { PF1 } from "./module/config.js";
import { registerSystemSettings } from "./module/settings.js";
import { preloadHandlebarsTemplates } from "./module/templates.js";
import { addChatMessageContextOptions } from "./module/combat.js";
import { measureDistance, getBarAttribute } from "./module/canvas.js";
import { ActorPF } from "./module/actor/entity.js";
import { ActorSheetPFCharacter } from "./module/actor/sheets/character.js";
import { ActorSheetPFNPC } from "./module/actor/sheets/npc.js";
import { ItemPF } from "./module/item/entity.js";
import { ItemSheetPF } from "./module/item/sheets/base.js";
import { PatchCore } from "./module/patch-core.js";
import { DicePF } from "./module/dice.js";
import * as chat from "./module/chat.js";
import * as migrations from "./module/migration.js";

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
  };

  // Record Configuration Values
  CONFIG.PF1 = PF1;
  CONFIG.Actor.entityClass = ActorPF;
  CONFIG.Item.entityClass = ItemPF;

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
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("PF1", ItemSheetPF, { types: ["class", "feat", "spell", "consumable", "equipment", "loot", "weapon", "buff"], makeDefault: true });
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
    "timePeriods", "savingThrows", "ac", "acValueLabels", "featTypes"
  ];
  for ( let o of toLocalize ) {
    CONFIG.PF1[o] = Object.entries(CONFIG.PF1[o]).reduce((obj, e) => {
      obj[e[0]] = game.i18n.localize(e[1]);
      return obj;
    }, {});
  }
});

/* -------------------------------------------- */

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 */
Hooks.once("ready", async function() {
  // const NEEDS_MIGRATION_VERSION = 0.174;
  // let needMigration = game.settings.get("pf1", "systemMigrationVersion") < NEEDS_MIGRATION_VERSION;
  // if ( needMigration && game.user.isGM ) {
  //   await migrations.migrateWorld();
  // }

  game.actors.entities.forEach(obj => { obj._updateChanges({ sourceOnly: true }); });
});

/* -------------------------------------------- */
/*  Canvas Initialization                       */
/* -------------------------------------------- */

Hooks.on("canvasInit", function() {

  // Extend Diagonal Measurement
  canvas.grid.diagonalRule = game.settings.get("pf1", "diagonalMovement");
  SquareGrid.prototype.measureDistance = measureDistance;

  // Extend Token Resource Bars
  Token.prototype.getBarAttribute = getBarAttribute;
});


/* -------------------------------------------- */
/*  Other Hooks                                 */
/* -------------------------------------------- */

Hooks.on("renderChatMessage", (app, html, data) => {
  // Display action buttons
  chat.displayChatActionButtons(app, html, data);

  // Highlight critical success or failure
  chat.highlightCriticalSuccessFailure(app, html, data);

  // Optionally collapse the content
  if (game.settings.get("pf1", "autoCollapseItemCards")) html.find(".card-content").hide();
});

Hooks.on("getChatLogEntryContext", addChatMessageContextOptions);
Hooks.on("renderChatLog", (_, html) => ItemPF.chatListeners(html));
Hooks.on("updateOwnedItem", (actor, _, changedData) => {
  if (!(actor instanceof Actor)) return;
  actor.refresh();

  const item = actor.getOwnedItem(changedData._id);
  if (item == null) return;
  actor.updateItemResources(item);
});

Hooks.on("createOwnedItem", (actor) => {
  if (!(actor instanceof Actor)) return;
  actor.refresh();
});
Hooks.on("deleteOwnedItem", (actor) => {
  if (!(actor instanceof Actor)) return;
  actor.refresh();
});
Hooks.on("updateToken", (_, sceneId, changedData) => {
  if (canvas.scene._id === sceneId) {
    const actor = canvas.tokens.get(changedData._id).actor;
    actor.refresh();
  }
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
  const command = `game.pf1.rollItemMacro("${item.name}");`;
  let macro = game.macros.entities.find(m => (m.name === item.name) && (m.command === command));
  if ( !macro ) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: {"dnd5e.itemMacro": true}
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
function rollItemMacro(itemName, actorName) {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (actorName != null) actor = game.actors.entities.filter(o => { return o.name === actorName; })[0];
  if ( speaker.token && !actor ) actor = game.actors.tokens[speaker.token];
  if ( !actor ) actor = game.actors.get(speaker.actor);
  const item = actor ? actor.items.find(i => i.name === itemName) : null;
  if ( !item ) return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);

  // Trigger the item roll
  if (item.hasAction) return item.useAttack();
  if ( item.data.type === "spell" ) return actor.useSpell(item);
  return item.roll();
}
