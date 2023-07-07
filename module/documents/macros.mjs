import { ActorPF } from "./actor/actor-pf.mjs";
import { getActorFromId, getItemOwner } from "../utils/lib.mjs";

/**
 * Various functions dealing with the creation and usage of macros.
 *
 * @module macros
 */

/**
 * Create a Macro from an Item drop, or get an existing one.
 *
 * @param {object} item     The item data
 * @param {string} actor    The actor ID
 * @param data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise<User>} The updated User
 */
export const createItemMacro = async (data, slot) => {
  const item = fromUuidSync(data.uuid);
  const command = `fromUuidSync("${item.uuid}")\n\t.use();`;
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
 * Create action use macro from dropped action.
 *
 * @param {object} dropData
 * @param {number} slot
 * @returns {Promise<User>} The updated User
 */
export const createActionMacro = async (dropData, slot) => {
  const { source, data } = dropData;
  const item = fromUuidSync(source);

  const action = item?.actions.get(data._id);

  if (!action) {
    return void ui.notifications.error(
      game.i18n.format("PF1.ErrorActionNotFound", { id: data._id, item: item?.name, actor: item?.actor?.name })
    );
  }

  const command = `fromUuidSync("${source}")\n\t.actions.get("${action.id}")\n\t.use();`;

  let macro = game.macros.contents.find((m) => m.name === item.name && m.data.command === command);
  if (!macro) {
    macro = await Macro.create(
      {
        name: `${action.name} (${item.name})`,
        type: "script",
        img: action.img || item.img,
        command,
        flags: { pf1: { actionMacro: { item: source, action: data._id } } },
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
export const createSkillMacro = async (skillId, actorId, slot) => {
  const actor = getActorFromId(actorId);
  if (!actor) return;

  const skillInfo = actor.getSkillInfo(skillId);
  const command = `fromUuidSync("${actor.uuid}")\n\t.rollSkill("${skillId}");`;
  const name = game.i18n.format("PF1.RollSkillMacroName", { actor: actor.name, skill: skillInfo.name });
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
export const createSaveMacro = async (saveId, actorId, slot) => {
  const actor = getActorFromId(actorId);
  const saveName = game.i18n.localize("PF1.SavingThrow" + saveId.capitalize());
  if (!actor) return;

  const command = `fromUuidSync("${actor.uuid}")\n\t.rollSavingThrow("${saveId}");`;
  const name = game.i18n.format("PF1.RollSaveMacroName", { actor: actor.name, type: saveName });
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
export const createMiscActorMacro = async (type, actorId, slot, altType = null) => {
  const actor = getActorFromId(actorId);
  if (!actor) return;

  const altTypeLabel = altType ? actor.system.attributes?.spells?.spellbooks?.[altType]?.label : null;

  let name,
    img,
    command = `fromUuidSync("${actor.uuid}")\n\t`;
  switch (type) {
    case "defenses":
      command += `.displayDefenseCard();`;
      name = game.i18n.format("PF1.DisplayDefensesMacroName", { actor: actor.name });
      img = "systems/pf1/icons/items/armor/shield-light-metal.png";
      break;
    case "cmb":
      command += `.rollCMB();`;
      name = game.i18n.format("PF1.RollCMBMacroName", { actor: actor.name });
      img = "systems/pf1/icons/feats/improved-grapple.jpg";
      break;
    case "cl":
      command += `.rollCL("${altType}");`;
      name = game.i18n.format("PF1.RollCLMacroName", { actor: actor.name, book: altTypeLabel });
      img = "systems/pf1/icons/spells/wind-grasp-eerie-3.jpg";
      break;
    case "concentration":
      command += `.rollConcentration("${altType}");`;
      name = game.i18n.format("PF1.RollConcentrationMacroName", { actor: actor.name, book: altTypeLabel });
      img = "systems/pf1/icons/skills/light_01.jpg";
      break;
    case "bab":
      command += `.rollBAB();`;
      name = game.i18n.format("PF1.RollBABMacroName", { actor: actor.name });
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
 * @deprecated
 */
export const rollItemMacro = (itemName, { itemId, itemType, actorId } = {}) => {
  foundry.utils.logCompatibilityWarning("rollItemMacro() is deprecated in favor of Item.use()", {
    since: "PF1 0.83.0",
    until: "PF1 0.84.0",
  });

  const actor = getActorFromId(actorId);
  if (actor && !actor.testUserPermission(game.user, "OWNER")) {
    return void ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));
  }
  const item = actor
    ? actor.items.find((i) => {
        if (itemId != null && i.id !== itemId) return false;
        if (itemType != null && i.type !== itemType) return false;
        return i.name === itemName;
      })
    : null;
  if (!item) {
    return void ui.notifications.warn(
      game.i18n.format("PF1.WarningNoItemOnActor", { actor: actor?.name, item: itemName })
    );
  }

  // Trigger the item roll
  if (!pf1.forceShowItem && item.hasAction) {
    return item.use();
  }
  return item.roll();
};

/**
 * Roll an actor's skill
 *
 * @param {string} actorId - The actor's identifier
 * @param {string} skillId - The skill's identifier
 * @returns {Promise|void} The skill roll, or void if no skill is found
 * @deprecated
 */
export const rollSkillMacro = (actorId, skillId) => {
  foundry.utils.logCompatibilityWarning("rollSkillMacro() is deprecated in favor of Actor.rollSkill()", {
    since: "PF1 0.83.0",
    until: "PF1 0.84.0",
  });

  const actor = getActorFromId(actorId);
  if (!actor) {
    return void ui.notifications.error(game.i18n.format("PF1.ErrorActorNotFound", { id: actorId }));
  }

  return actor.rollSkill(skillId);
};

/**
 * Roll an actor's save
 *
 * @param {string} actorId - The actor's identifier
 * @param {string} saveId - The save's identifier
 * @returns {Promise|void} The save roll, or void if no save is found
 * @deprecated
 */
export const rollSaveMacro = (actorId, saveId) => {
  foundry.utils.logCompatibilityWarning("rollSaveMacro() is deprecated in favor of Actor.rollSavingThrow()", {
    since: "PF1 0.83.0",
    until: "PF1 0.84.0",
  });

  const actor = getActorFromId(actorId);
  if (!actor) {
    return void ui.notifications.error(game.i18n.format("PF1.ErrorActorNotFound", { id: actorId }));
  }

  return actor.rollSavingThrow(saveId);
};

/**
 * Show an actor's defenses
 *
 * @param {object} [options] - Additional parameters
 * @param {string} [options.actorName] - The actor's name
 * @param {string} [options.actorId] - The actor's identifier
 * @param options.rollMode
 * @returns {Promise|void} The defense roll, or void if no actor is found
 * @deprecated
 */
export const displayDefenses = ({ actorName = null, actorId = null, rollMode = null } = {}) => {
  foundry.utils.logCompatibilityWarning("displayDefenses() is deprecated in favor of Actor.displayDefenseCard()", {
    since: "PF1 0.83.0",
    until: "PF1 0.84.0",
  });

  const actor = ActorPF.getActiveActor({ actorName: actorName, actorId: actorId });
  if (!actor) {
    return void ui.notifications.warn(
      game.i18n.format("PF1.ErrorNoApplicableActorFoundForAction", {
        name: game.i18n.localize("PF1.Action_DisplayDefenses"),
      })
    );
  }

  return actor.displayDefenseCard({ rollMode });
};

/**
 * Roll one of an actor's various attributes
 *
 * @param {string} actorId - The actor's identifier
 * @param {string} type - The attribute to roll
 * @param {string} [altType] - An additional qualifier, used e.g. to determine a roll's spellbook
 * @returns {Promise|void} The roll, or void if no actor is found
 * @deprecated
 */
export const rollActorAttributeMacro = (actorId, type, altType = null) => {
  foundry.utils.logCompatibilityWarning(
    "rollActorAttributeMacro() is deprecated in favor of directly calling functions on the actor.",
    {
      since: "PF1 0.83.0",
      until: "PF1 0.84.0",
    }
  );

  const actor = getActorFromId(actorId);
  if (!actor) {
    return void ui.notifications.error(game.i18n.format("PF1.ErrorActorNotFound", { id: actorId }));
  }

  switch (type) {
    case "defenses":
      return actor.displayDefenseCard();
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
