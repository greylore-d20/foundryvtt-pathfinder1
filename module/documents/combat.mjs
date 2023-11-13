import { ActorPF } from "./actor/actor-pf.mjs";
import { getSkipActionPrompt } from "./settings.mjs";
import { RollPF } from "../dice/roll.mjs";

/* -------------------------------------------- */

/**
 * This function is used to hook into the Chat Log context menu to add additional options to each message
 * These options make it easy to conveniently apply damage to controlled tokens based on the value of a Roll
 *
 * @param {HTMLElement} html    The Chat Message being rendered
 * @param {Array} options       The Array of Context Menu options
 * @returns {Array}              The extended options Array including new context choices
 */
export const addChatMessageContextOptions = function (html, options) {
  const canApply = (li) => canvas.tokens.controlled.length && li.find(".damage-roll .dice-total").length;
  const canApplyCritical = (li) => canvas.tokens.controlled.length && li.find(".crit-damage-roll .dice-total").length;
  options.push(
    {
      name: game.i18n.localize("PF1.ApplyDamage"),
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApply,
      callback: (li) => ActorPF.applyDamage(li, 1),
    },
    {
      name: game.i18n.localize("PF1.ApplyHealing"),
      icon: '<i class="fas fa-user-plus"></i>',
      condition: canApply,
      callback: (li) => ActorPF.applyDamage(li, -1),
    },
    {
      name: game.i18n.localize("PF1.ApplyCriticalDamage"),
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApplyCritical,
      callback: (li) => ActorPF.applyDamage(li, 1, true),
    },
    {
      name: game.i18n.localize("PF1.ApplyCriticalHealing"),
      icon: '<i class="fas fa-user-minus"></i>',
      condition: canApplyCritical,
      callback: (li) => ActorPF.applyDamage(li, -1, true),
    }
  );
  return options;
};

const duplicateCombatantInitiativeDialog = function (combats, combatantId) {
  const combat = combats.find((c) => c.combatants.get(combatantId) !== undefined);
  if (!combat) {
    ui.notifications.warn(game.i18n.localize("PF1.WarningNoCombatantFound"));
    return;
  }
  const combatant = combat.combatants.get(combatantId);
  if (!combatant) {
    ui.notifications.warn(game.i18n.localize("PF1.WarningNoCombatantFound"));
    return;
  }

  new Dialog(
    {
      title: `${game.i18n.localize("PF1.DuplicateInitiative")}: ${combatant.name}`,
      content: `<div class="flexrow form-group">
      <label>${game.i18n.localize("PF1.InitiativeOffset")}</label>
      <input type="number" name="initiativeOffset" value="0"/>
    </div>`,
      buttons: {
        confirm: {
          label: game.i18n.localize("PF1.Confirm"),
          callback: (html) => {
            const offset = parseFloat(html.find('input[name="initiativeOffset"]').val());
            const prevInitiative = combatant.initiative != null ? combatant.initiative : 0;
            const newInitiative = prevInitiative + offset;
            duplicateCombatantInitiative(combat, combatant, newInitiative);
          },
        },
        cancel: {
          label: game.i18n.localize("Cancel"),
        },
      },
      default: "confirm",
    },
    {
      classes: [...Dialog.defaultOptions.classes, "pf1", "duplicate-initiative"],
    }
  ).render(true);
};

export const duplicateCombatantInitiative = function (combat, combatant, initiative) {
  console.debug("Duplicating combatant:", combatant);
  combat.createEmbeddedDocuments("Combatant", [
    mergeObject(combatant.toObject(), { initiative: initiative }, { inplace: false }),
  ]);
};

Hooks.on("getCombatTrackerEntryContext", function addCombatTrackerContextOptions(html, menuItems) {
  menuItems.push({
    name: "PF1.DuplicateInitiative",
    icon: '<i class="fas fa-dice-d20"></i>',
    callback: (li) => duplicateCombatantInitiativeDialog.call(game.combat, game.combats, li.data("combatant-id")),
  });
});

export class CombatPF extends Combat {
  /**
   * @override
   * @param {string[]} ids Combatant IDs to roll initiative for.
   * @param {object} [options={}] - Additional options
   * @param {string} [options.bonus=null] - Formula for bonus to initiative
   * @param {string} [options.rollMode] - Roll mode override
   * @param {boolean} [options.skipDialog=null] - Skip roll dialog
   */
  async rollInitiative(
    ids,
    { formula = null, d20, bonus = null, rollMode, updateTurn = true, messageOptions = {}, skipDialog = null } = {}
  ) {
    skipDialog ??= getSkipActionPrompt();
    // Structure input data
    ids = typeof ids === "string" ? [ids] : ids;
    const currentId = this.combatant?.id;

    const firstCombatant = this.combatants.get(ids[0]);
    const rollerName =
      (ids.length > 1 ? firstCombatant?.actor?.name : firstCombatant?.token?.name) ?? firstCombatant?.name;

    // Show initiative dialog
    if (!skipDialog) {
      const dialogData = await Combat.implementation.showInitiativeDialog({
        formula,
        bonus,
        rollMode,
        name: rollerName,
      });
      rollMode = dialogData.rollMode;
      bonus = dialogData.bonus || "";
      d20 = dialogData.d20;
      if (dialogData.stop) return this;
    }

    // Iterate over Combatants, performing an initiative roll for each
    const [updates, messages] = await ids.reduce(
      async (results, id, i) => {
        const result = await results;
        const [updates, messages] = result;

        // Get Combatant data (non-strictly)
        const combatant = this.combatants.get(id);
        if (!combatant?.isOwner) return results;

        // Produce an initiative roll for the Combatant
        const roll = combatant.getInitiativeRoll(formula, d20, bonus);
        roll.options.flavor = game.i18n.localize("PF1.Initiative");
        await roll.evaluate({ async: true });
        updates.push({ _id: id, initiative: roll.total });

        // Produce an initiative roll for the Combatant
        const isHidden = combatant.token?.hidden || combatant.hidden;
        if (isHidden) rollMode = messageOptions.rollMode ?? "gmroll";

        if (roll.err) ui.notifications.warn(roll.err.message);

        const [notes, notesHTML] = combatant.actor?.getInitiativeContextNotes?.() ?? [];

        // Create card template data
        const hasNotes = notes?.length > 0;
        const templateData = {
          user: game.user.id,
          formula: roll.formula,
          tooltip: await roll.getTooltip(),
          total: roll.total,
          hasExtraText: hasNotes,
          extraText: hasNotes ? notesHTML : undefined,
        };

        // Ensure roll mode is not lost
        if (rollMode) messageOptions.rollMode = rollMode;

        // Create base chat card data
        let chatData = {
          speaker: {
            scene: combatant.sceneId,
            actor: combatant.actorId,
            token: combatant.tokenId,
            alias: combatant.name,
          },
          ...messageOptions,
        };

        // Generate message proper via D20RollPF
        chatData = await roll.toMessage(chatData, {
          create: false,
          rollMode,
          subject: { core: "init" },
          chatTemplateData: templateData,
        });

        if (i > 0) chatData.sound = null; // Only play 1 sound for the whole set
        messages.push(chatData);

        // Return the Roll and the chat data
        return results;
      },
      [[], []]
    );
    if (!updates.length) return this;

    // Update multiple combatants
    await this.updateEmbeddedDocuments("Combatant", updates);

    // Ensure the turn order remains with the same combatant
    if (updateTurn && currentId) await this.update({ turn: this.turns.findIndex((t) => t.id === currentId) });

    // Create multiple chat messages
    const chatMessages = await ChatMessage.implementation.create(messages);
    return { combat: this, messages: chatMessages };
  }

  /**
   * @param {object} options
   * @param {string} options.formula Formula override
   * @param {string} options.bonus Bonus formula override
   * @param {string} options.name Name of the roller
   * @returns {object}
   */
  static async showInitiativeDialog({ formula = null, bonus = null, name } = {}) {
    const rollMode = game.settings.get("core", "rollMode");

    const template = "systems/pf1/templates/chat/roll-dialog.hbs";
    const dialogData = { d20: formula, bonus, rollMode, rollModes: CONFIG.Dice.rollModes };

    // Show dialog
    return Dialog.wait(
      {
        title: game.i18n.format("PF1.InitiativeCheck", { name }),
        content: await renderTemplate(template, dialogData),
        buttons: {
          normal: {
            label: game.i18n.localize("PF1.Roll"),
            callback: (html) => new FormDataExtended(html.querySelector("form")).object,
          },
        },
        default: "normal",
        close: (html) => ({ stop: true }),
      },
      {
        subject: { core: "init" },
        classes: [...Dialog.defaultOptions.classes, "pf1", "roll-initiative"],
        jQuery: false,
      },
      {
        focus: true,
      }
    );
  }

  /**
   * Expire active effects & buffs.
   *
   * @param {object} data Update data
   * @param {options} options Context options
   * @param {string} userId Triggering user ID
   */
  async _expireEffectsOnUpdate(data, options, userId) {
    if (data.turn === undefined && data.round === undefined) return;

    const actor = this.combatant?.actor;
    if (!actor) return;

    const timeOffset = options.advanceTime ?? 0;

    // Attempt to perform expiration on owning active user
    const firstOwner = Object.entries(actor.ownership)
      .filter(([_, level]) => level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)
      .map(([userId, _]) => game.users.get(userId))
      .filter((u) => u?.active)
      .sort((a, b) => a.id.localeCompare(b.id))[0];

    if (firstOwner) {
      if (firstOwner.id !== game.user.id) return;
    } else if (!game.user.isGM) return;

    actor.expireActiveEffects({ timeOffset, combat: this });
  }

  /**
   * @override
   * @param {object} data Update data
   * @param {options} options Context options
   * @param {string} userId Triggering user ID
   */
  _onUpdate(data, options, userId) {
    super._onUpdate(data, options, userId);
    try {
      this._expireEffectsOnUpdate(data, options, userId);
    } catch (error) {
      console.error(error);
    }
  }
}
