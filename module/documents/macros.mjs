import { ActorPF } from "./actor/actor-pf.mjs";

/**
 * Finds old macro with same name and command that user can execute and see.
 *
 * @param {string} name
 * @param {string} command
 * @returns {Macro|undefined}
 */
function findOldMacro(name, command) {
  return game.macros.find((m) => m.name === name && m.command === command && m.canExecute && m.visible && m.isAuthor);
}

/**
 * Various functions dealing with the creation and usage of macros.
 *
 * @module macros
 */

/**
 * Create a Macro from an Item drop, or get an existing one.
 *
 * @param {object} item The item data
 * @param {string} actor The actor ID
 * @param {object} uuid
 * @param {number} slot The hotbar slot to use
 * @returns {Promise<User>} The updated User
 */
export const createItemMacro = async (uuid, slot) => {
  const item = fromUuidSync(uuid);
  const command = `fromUuidSync("${uuid}").use();`;
  let macro = findOldMacro(item.name, command);
  if (!macro) {
    macro = await Macro.create(
      {
        name: item.name,
        type: "script",
        img: item.img,
        command,
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
 * @param {string} actionId Action ID
 * @param {string} uuid UUID to parent item
 * @param {number} slot Hotbar slot to assign to
 * @returns {Promise<User>} The updated User
 */
export const createActionMacro = async (actionId, uuid, slot) => {
  const item = fromUuidSync(uuid);

  const action = item?.actions.get(actionId);

  if (!action) {
    return void ui.notifications.error(
      game.i18n.format("PF1.Error.ActionNotFound", { id: actionId, item: item?.name, actor: item?.actor?.name })
    );
  }

  const command = `fromUuidSync("${uuid}")\n\t.actions.get("${actionId}")\n\t.use();`;

  let macro = findOldMacro(item.name, command);
  if (!macro) {
    macro = await Macro.create(
      {
        name: `${action.name} (${item.name})`,
        type: "script",
        img: action.img || item.img,
        command,
        flags: { pf1: { actionMacro: { item: uuid, action: actionId } } },
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
 * @param {string} uuid - The actor's UUID
 * @param {number} slot - The hotbar slot to use
 * @returns {Promise<User>} The updated User
 */
export const createSkillMacro = async (skillId, uuid, slot) => {
  const actor = fromUuidSync(uuid);
  if (!actor) return;

  const skillInfo = actor.getSkillInfo(skillId);
  const command = `fromUuidSync("${actor.uuid}")\n\t.rollSkill("${skillId}");`;
  const name = game.i18n.format("PF1.RollSkillMacroName", { actor: actor.name, skill: skillInfo.fullName });
  let macro = findOldMacro(name, command);
  if (!macro) {
    macro = await Macro.create(
      {
        name: name,
        type: "script",
        img: "systems/pf1/icons/items/inventory/dice.jpg",
        command,
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
 * @param {string} uuid - The actor's UUID
 * @param {number} slot - The hotbar slot to use
 * @returns {Promise<User>} The updated User
 */
export const createSaveMacro = async (saveId, uuid, slot) => {
  const actor = fromUuidSync(uuid);
  if (!actor) return;

  const saveName = game.i18n.localize("PF1.SavingThrow" + saveId.capitalize());

  const command = `fromUuidSync("${actor.uuid}")\n\t.rollSavingThrow("${saveId}");`;
  const name = game.i18n.format("PF1.RollSaveMacroName", { actor: actor.name, type: saveName });
  let macro = findOldMacro(name, command);
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
 * @param {string} type The type of macro to create
 * @param {string} uuid The actor's UUID
 * @param {number} slot The hotbar slot to use
 * @param {object} [data] Additional context data
 * @returns {Promise<User|void>} The updated User, if an update is triggered
 */
export const createMiscActorMacro = async (type, uuid, slot, data) => {
  const actor = fromUuidSync(uuid);
  if (!actor) return;

  const getBookLabel = (bookId) => actor.system.attributes?.spells?.spellbooks?.[bookId]?.label;

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
      command += `.rollAttack({maneuver:true});`;
      name = game.i18n.format("PF1.RollCMBMacroName", { actor: actor.name });
      img = "systems/pf1/icons/feats/improved-grapple.jpg";
      break;
    case "cl": {
      const { bookId } = data;
      command += `.rollCL("${bookId}");`;
      name = game.i18n.format("PF1.RollCLMacroName", { actor: actor.name, book: getBookLabel(bookId) });
      img = "systems/pf1/icons/spells/wind-grasp-eerie-3.jpg";
      break;
    }
    case "concentration": {
      const { bookId } = data;
      command += `.rollConcentration("${bookId}");`;
      name = game.i18n.format("PF1.RollConcentrationMacroName", { actor: actor.name, book: getBookLabel(bookId) });
      img = "systems/pf1/icons/skills/light_01.jpg";
      break;
    }
    case "bab":
      command += `.rollBAB();`;
      name = game.i18n.format("PF1.RollBABMacroName", { actor: actor.name });
      img = "systems/pf1/icons/skills/yellow_08.jpg";
      break;
    case "initiative":
      command += ".rollInitiative({ createCombatants: true });";
      name = game.i18n.format("PF1.RollInitiativeMacroName", { actor: actor.name });
      img = "systems/pf1/icons/skills/weapon_41.jpg";
      break;
    case "attack": {
      const { attack } = data;
      const isMelee = attack === "melee";
      command += `.rollAttack({ ranged: ${isMelee ? "false" : "true"}});`;
      name = game.i18n.format(isMelee ? "PF1.RollMeleeMacroName" : "PF1.RollRangedMacroName", { actor: actor.name });
      img = isMelee ? "systems/pf1/icons/skills/weapon_23.jpg" : "systems/pf1/icons/skills/arrow_07.jpg";
      break;
    }
    case "abilityScore": {
      const { ability } = data;
      command += `.rollAbilityTest("${ability}");`;
      name = game.i18n.format("PF1.RollAbilityMacroName", {
        actor: actor.name,
        ability: CONFIG.PF1.abilities[ability],
      });
      img = "systems/pf1/icons/skills/blue_35.jpg";
      break;
    }
  }

  if (!name) return;

  let macro = findOldMacro(name, command);
  macro ??= await Macro.create(
    {
      name,
      type: "script",
      img,
      command,
      flags: { pf1: { type, actor: uuid } },
    },
    { displaySheet: false }
  );

  return game.user.assignHotbarMacro(macro, slot);
};
