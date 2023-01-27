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
  const combatant = combat.combatants.filter((o) => o.id === combatantId)[0];
  if (!combatant) {
    ui.notifications.warn(game.i18n.localize("PF1.WarningNoCombatantFound"));
    return;
  }

  new Dialog(
    {
      title: `${game.i18n.localize("PF1.DuplicateInitiative")}: ${combatant.actor.name}`,
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
   * Override the default Initiative formula to customize special behaviors of the game system.
   * Apply advantage, proficiency, or bonuses where appropriate
   * Apply the dexterity score as a decimal tiebreaker if requested
   * See Combat._getInitiativeFormula for more detail.
   *
   * @param {ActorPF} actor - Actor to fetch roll data for
   * @param {string} [d20="1d20"] - d20 roll formula
   * @returns {string} Initiative formula
   */
  _getInitiativeFormula(actor, d20) {
    const defaultParts = [d20 || "1d20", `@attributes.init.total[${game.i18n.localize("PF1.Initiative")}]`];
    if (actor && game.settings.get("pf1", "initiativeTiebreaker"))
      defaultParts.push(`(@attributes.init.total / 100)[${game.i18n.localize("PF1.Tiebreaker")}]`);
    const parts = CONFIG.Combat.initiative.formula ? CONFIG.Combat.initiative.formula.split(/\s*\+\s*/) : defaultParts;
    if (!actor) return parts[0] || "0";
    return parts.filter((p) => p !== null).join(" + ");
  }

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
    { formula = null, bonus = null, rollMode, updateTurn = true, messageOptions = {}, skipDialog = null } = {}
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
      formula = dialogData.d20;
      if (dialogData.stop) return this;
    }

    // Iterate over Combatants, performing an initiative roll for each
    const [updates, messages] = await ids.reduce(
      async (results, id, i) => {
        const result = await results;
        const [updates, messages] = result;

        // Get Combatant data (non-strictly)
        const c = this.combatants.get(id);
        if (!c || !c.isOwner) return results;

        // Produce an initiative roll for the Combatant
        const rollData = c.actor?.getRollData() ?? {};
        let initformula = this._getInitiativeFormula(c.actor ? c.actor : null, formula) || "1d20";
        if (bonus) initformula += ` + ${bonus}`;

        // Produce an initiative roll for the Combatant
        const isHidden = c.token?.hidden || c.hidden;
        if (isHidden) rollMode = messageOptions.rollMode ?? "gmroll";
        const roll = await RollPF.create(initformula, rollData).evaluate({ async: true });
        delete rollData.bonus;
        if (roll.err) ui.notifications.warn(roll.err.message);
        updates.push({ _id: id, initiative: roll.total });

        const [notes, notesHTML] = c.actor.getInitiativeContextNotes();

        // Create card template data
        const templateData = mergeObject(
          {
            user: game.user.id,
            formula: roll.formula,
            tooltip: await roll.getTooltip(),
            total: roll.total,
          },
          notes.length > 0 ? { hasExtraText: true, extraText: notesHTML } : {}
        );

        // Ensure roll mode is not lost
        if (rollMode) messageOptions.rollMode = rollMode;

        // Create chat card data
        const chatData = mergeObject(
          {
            user: game.user.id,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            sound: CONFIG.sounds.dice,
            speaker: {
              scene: canvas.scene?.id,
              actor: c.actor ? c.actor.id : null,
              token: c.token?.id,
              alias: c.token?.name,
            },
            flags: { pf1: { subject: { core: "init" } } },
            flavor: game.i18n.format("PF1.RollsForInitiative", { name: c.token?.name ?? c.actor.name }),
            rolls: [roll.toJSON()],
            content: await renderTemplate("systems/pf1/templates/chat/roll-ext.hbs", templateData),
          },
          messageOptions
        );

        // Handle different roll modes
        ChatMessage.applyRollMode(chatData, rollMode);

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
   * Process current combatant: expire active effects & buffs.
   */
  async _processCurrentCombatant() {
    try {
      this.combatant?.actor?.expireActiveEffects();
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * @override
   * @returns {Promise<Combat>}
   */
  async nextRound() {
    const combat = await super.nextRound();
    // TODO: Process skipped turns.
    await this._processCurrentCombatant();
    return combat;
  }

  /**
   * @override
   * @returns {Promise<Combat>}
   */
  async nextTurn() {
    const combat = await super.nextTurn();
    await this._processCurrentCombatant();
    return combat;
  }
}
