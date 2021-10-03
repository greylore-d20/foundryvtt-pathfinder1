import { ActorPF } from "./actor/entity.js";
import { getActorFromId, getItemOwner } from "./lib.js";
import { getSkipActionPrompt } from "./settings.js";

/**
 * Various functions dealing with the creation and usage of macros.
 *
 * @module macros
 */

/**
 * Create a Macro from an Item drop, or get an existing one.
 *
 * @param {object} item     The item data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise<User>} The updated User
 */
export const createItemMacro = async function (item, slot) {
  const actor = getItemOwner(item);
  const command =
    `game.pf1.rollItemMacro("${item.name}", {\n` +
    `  itemId: "${item._id}",\n` +
    `  itemType: "${item.type}",\n` +
    (actor != null ? `  actorId: "${actor._id}",\n` : "") +
    `});`;
  let macro = game.macros.contents.find((m) => m.name === item.name && m.data.command === command);
  if (!macro) {
    macro = await Macro.create(
      {
        name: item.name,
        type: "script",
        img: item.img,
        command: command,
        flags: { "pf1.itemMacro": true },
      },
      { displaySheet: false }
    );
  }
  return game.user.assignHotbarMacro(macro, slot);
};

/**
 * Create a Macro from skill data to roll an actor's skill, or get an existing one.
 *
 * @async
 * @param {string} skillId - The skill's identifier
 * @param {string} actorId - The actor's identifier
 * @param {number} slot - The hotbar slot to use
 * @returns {Promise<User>} The updated User
 */
export const createSkillMacro = async function (skillId, actorId, slot) {
  const actor = getActorFromId(actorId);
  if (!actor) return;

  const skillInfo = actor.getSkillInfo(skillId);
  const command = `game.pf1.rollSkillMacro("${actorId}", "${skillId}");`;
  const name = game.i18n.format("PF1.RollSkillMacroName", { 0: actor.name, 1: skillInfo.name });
  let macro = game.macros.contents.find((m) => m.name === name && m.data.command === command);
  if (!macro) {
    macro = await Macro.create(
      {
        name: name,
        type: "script",
        img: "systems/pf1/icons/items/inventory/dice.jpg",
        command: command,
        flags: { "pf1.skillMacro": true },
      },
      { displaySheet: false }
    );
  }

  return game.user.assignHotbarMacro(macro, slot);
};

/**
 * Create a Macro from save data to roll an actor's save, or get an existing one.
 *
 * @async
 * @param {string} saveId - The save's identifier
 * @param {string} actorId - The actor's identifier
 * @param {number} slot - The hotbar slot to use
 * @returns {Promise<User>} The updated User
 */
export const createSaveMacro = async function (saveId, actorId, slot) {
  const actor = getActorFromId(actorId);
  const saveName = game.i18n.localize("PF1.SavingThrow" + saveId.substr(0, 1).toUpperCase() + saveId.substr(1));
  if (!actor) return;

  const command = `game.pf1.rollSaveMacro("${actorId}", "${saveId}");`;

  const name = game.i18n.format("PF1.RollSaveMacroName", { 0: actor.name, 1: saveName });
  let macro = game.macros.contents.find((m) => m.name === name && m.data.command === command);
  if (!macro) {
    macro = await Macro.create(
      {
        name: name,
        type: "script",
        img: "systems/pf1/icons/items/inventory/dice.jpg",
        command: command,
        flags: { "pf1.saveMacro": true },
      },
      { displaySheet: false }
    );
  }

  return game.user.assignHotbarMacro(macro, slot);
};

/**
 * Create a Macro to roll one of various checks for an actor
 *
 * @async
 * @param {string} type - The type of macro to create
 * @param {string} actorId - The actor's identifier
 * @param {number} slot - The hotbar slot to use
 * @param {string} [altType] - An alternative type, used to denote a spellbook
 * @returns {Promise<User|void>} The updated User, if an update is triggered
 */
export const createMiscActorMacro = async function (type, actorId, slot, altType = null) {
  const actor = getActorFromId(actorId);
  if (!actor) return;

  let altTypeLabel = "";
  switch (altType) {
    case "primary":
      altTypeLabel = "Primary";
      break;
    case "secondary":
      altTypeLabel = "Secondary";
      break;
    case "tertiary":
      altTypeLabel = "Tertiary";
      break;
    case "spelllike":
      altTypeLabel = "Spell-like";
      break;
  }

  const command = altType
    ? `game.pf1.rollActorAttributeMacro("${actorId}", "${type}", "${altType}");`
    : `game.pf1.rollActorAttributeMacro("${actorId}", "${type}");`;
  let name, img;
  switch (type) {
    case "defenses":
      name = game.i18n.format("PF1.RollDefensesMacroName", { 0: actor.name });
      img = "systems/pf1/icons/items/armor/shield-light-metal.png";
      break;
    case "cmb":
      name = game.i18n.format("PF1.RollCMBMacroName", { 0: actor.name });
      img = "systems/pf1/icons/feats/improved-grapple.jpg";
      break;
    case "cl":
      name = game.i18n.format("PF1.RollCLMacroName", { 0: actor.name, 1: altTypeLabel });
      img = "systems/pf1/icons/spells/wind-grasp-eerie-3.jpg";
      break;
    case "concentration":
      name = game.i18n.format("PF1.RollConcentrationMacroName", { 0: actor.name, 1: altTypeLabel });
      img = "systems/pf1/icons/skills/light_01.jpg";
      break;
    case "bab":
      name = game.i18n.format("PF1.RollBABMacroName", { 0: actor.name });
      img = "systems/pf1/icons/skills/yellow_08.jpg";
      break;
  }

  if (!name) return;

  let macro = game.macros.contents.find((o) => o.name === name && o.data.command === command);
  if (!macro) {
    macro = await Macro.create(
      {
        name: name,
        type: "script",
        img: img,
        command: command,
        flags: { "pf1.miscMacro": true },
      },
      { displaySheet: false }
    );
  }

  return game.user.assignHotbarMacro(macro, slot);
};

/**
 * Roll an actor's item
 *
 * @param {string} itemName - The item's name
 * @param {object} [options] - Additional options
 * @param {string} [options.itemId] - The item's identifier
 * @param {string} [options.itemType] - The item's type
 * @param {string} [options.actorId] - The actorś identifier
 * @returns {Promise|void} The item's roll or void if any requirements are not met
 */
export const rollItemMacro = function (itemName, { itemId, itemType, actorId } = {}) {
  const actor = getActorFromId(actorId);
  if (actor && !actor.testUserPermission(game.user, "OWNER")) {
    const msg = game.i18n.localize("PF1.ErrorNoActorPermission");
    console.warn(msg);
    return ui.notifications.warn(msg);
  }
  const item = actor
    ? actor.items.find((i) => {
        if (itemId != null && i.id !== itemId) return false;
        if (itemType != null && i.type !== itemType) return false;
        return i.name === itemName;
      })
    : null;
  if (!item) {
    const msg = game.i18n.format("PF1.WarningNoItemOnActor", { 0: actor.name, 1: itemName });
    console.warn(msg);
    return ui.notifications.warn(msg);
  }

  // Trigger the item roll
  if (!game.keyboard.isDown("Control")) {
    return item.use({ skipDialog: getSkipActionPrompt() });
  }
  return item.roll();
};

/**
 * Roll an actor's skill
 *
 * @param {string} actorId - The actor's identifier
 * @param {string} skillId - The skill's identifier
 * @returns {Promise|void} The skill roll, or void if no skill is found
 */
export const rollSkillMacro = function (actorId, skillId) {
  const actor = getActorFromId(actorId);
  if (!actor) {
    const msg = game.i18n.format("PF1.ErrorActorNotFound", { 0: actorId });
    console.warn(msg);
    return ui.notifications.error(msg);
  }

  return actor.rollSkill(skillId, { skipDialog: getSkipActionPrompt() });
};

/**
 * Roll an actor's save
 *
 * @param {string} actorId - The actor's identifier
 * @param {string} saveId - The save's identifier
 * @returns {Promise|void} The save roll, or void if no save is found
 */
export const rollSaveMacro = function (actorId, saveId) {
  const actor = getActorFromId(actorId);
  if (!actor) {
    const msg = game.i18n.format("PF1.ErrorActorNotFound", { 0: actorId });
    console.warn(msg);
    return ui.notifications.error(msg);
  }

  return actor.rollSavingThrow(saveId, { skipDialog: getSkipActionPrompt() });
};

/**
 * Show an actor's defenses
 *
 * @param {object} [options] - Additional parameters
 * @param {string} [options.actorName] - The actor's name
 * @param {string} [options.actorId] - The actor's identifier
 * @returns {Promise|void} The defense roll, or void if no actor is found
 */
export const rollDefenses = function ({ actorName = null, actorId = null } = {}) {
  const actor = ActorPF.getActiveActor({ actorName: actorName, actorId: actorId });
  if (!actor) {
    const msg = game.i18n.format("PF1.ErrorNoApplicableActorFoundForAction", {
      0: game.i18n.localize("PF1.Action_RollDefenses"),
    });
    console.warn(msg);
    return ui.notifications.warn(msg);
  }

  return actor.rollDefenses();
};

/**
 * Roll one of an actor's various attributes
 *
 * @param {string} actorId - The actor's identifier
 * @param {string} type - The attribute to roll
 * @param {string} [altType] - An additional qualifier, used e.g. to determine a roll's spellbook
 * @returns {Promise|void} The roll, or void if no actor is found
 */
export const rollActorAttributeMacro = function (actorId, type, altType = null) {
  const actor = getActorFromId(actorId);
  if (!actor) {
    const msg = game.i18n.format("PF1.ErrorActorNotFound", { 0: actorId });
    console.error(msg);
    return ui.notifications.error(msg);
  }

  switch (type) {
    case "defenses":
      return actor.rollDefenses();
    case "cmb":
      return actor.rollCMB();
    case "cl":
      return actor.rollCL(altType);
    case "concentration":
      return actor.rollConcentration(altType);
    case "bab":
      return actor.rollBAB();
  }
};
