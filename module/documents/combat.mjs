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

/**
 * @internal
 * @param {string} combatantId - Combatant ID
 */
async function duplicateCombatantInitiativeDialog(combatantId) {
  /** @type {CombatantPF} */
  const combatant = game.combat.combatants.get(combatantId);
  if (!combatant) return void ui.notifications.warn(game.i18n.localize("PF1.WarningNoCombatantFound"));

  const offset = await pf1.utils.dialog.getNumber({
    title: `${game.i18n.localize("PF1.DuplicateInitiative")}: ${combatant.name}`,
    label: game.i18n.localize("PF1.InitiativeOffset"),
    initial: 0,
    classes: ["duplicate-initiative"],
  });

  if (!Number.isFinite(offset)) return; // Cancelled

  return combatant.duplicateWithData({ initiative: (combatant.initiative ?? 0) + offset });
}

// Deprecated
export const duplicateCombatantInitiative = function (combat, combatant, initiative) {
  foundry.utils.logCompatibilityWarning(
    "pf1.documents.duplicateCombatantInitiative() is deprecated in favor of CombatantPF.duplicateWithData()",
    {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    }
  );
  return combatant.duplicateWithData({ initiative });
};

Hooks.on("getCombatTrackerEntryContext", function addCombatTrackerContextOptions(html, menuItems) {
  menuItems.push({
    name: "PF1.DuplicateInitiative",
    icon: '<i class="fas fa-dice-d20"></i>',
    callback: ([li]) => duplicateCombatantInitiativeDialog(li.dataset.combatantId),
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
    ids = Array.isArray(ids) ? ids : [ids];

    const currentId = this.combatant?.id;

    const firstCombatant = this.combatants.get(ids[0]);
    const rollerName =
      (ids.length > 1 ? firstCombatant?.actor?.name : firstCombatant?.token?.name) ?? firstCombatant?.name;

    // Show initiative dialog
    if (!skipDialog) {
      const dialogData = await Combat.implementation.showInitiativeDialog({
        d20,
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
        await roll.evaluate();
        updates.push({ _id: id, initiative: roll.total });

        // Produce an initiative roll for the Combatant
        const isHidden = combatant.token?.hidden || combatant.hidden;
        if (isHidden) rollMode = messageOptions.rollMode ?? "gmroll";

        if (roll.err) ui.notifications.warn(roll.err.message);

        const [notes, notesHTML] = combatant.actor?.getInitiativeContextNotes?.() ?? [];

        // Create card template data
        const hasNotes = notes?.length > 0;
        const templateData = {
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
          speaker: ChatMessage.getSpeaker({
            actor: combatant.actor,
            token: combatant.token,
            alias: combatant.name,
          }),
          ...messageOptions,
        };

        // Mimic core Foundry data
        foundry.utils.setProperty(chatData, "flags.core.initiativeRoll", true);

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
   * @param {string} options.d20 Formula override
   * @param {string} options.bonus Bonus formula override
   * @param {string} options.name Name of the roller
   * @param {string} options.formula
   * @returns {object}
   */
  static async showInitiativeDialog({ d20 = null, formula, bonus = null, name } = {}) {
    const rollMode = game.settings.get("core", "rollMode");

    if (formula !== undefined) {
      foundry.utils.logCompatibilityWarning(
        "CombatPF.showInitiativeDialog() formula parameter is deprecated in favor of d20",
        {
          since: "PF1 v9",
          until: "PF1 v10",
        }
      );
      d20 ||= formula;
    }

    const template = "systems/pf1/templates/chat/roll-dialog.hbs";
    const dialogData = { d20, bonus, rollMode, rollModes: CONFIG.Dice.rollModes };

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
   * @override
   * @param {object} data Update data
   * @param {options} options Context options
   * @param {string} userId Triggering user ID
   */
  _onUpdate(changed, context, userId) {
    if (context.direction === 1 && (changed.turn !== undefined || changed.round !== undefined)) {
      this._onNewTurn(changed, context, userId);
    }
  }

  /**
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    if ("direction" in context && ("turn" in changed || "round" in changed)) {
      // Record origin turn and round
      context.pf1 ??= {};
      context.pf1.from = { turn: this.turn, round: this.round };
    }
  }

  /**
   * New turn handling.
   *
   * @param changed
   * @param context
   * @param userId
   * @private
   */
  async _onNewTurn(changed, context, userId) {
    if (game.users.activeGM?.isSelf && context.pf1?.from) {
      this._detectSkippedTurns(context.pf1.from, context);
    }

    this._processCurrentCombatant(changed, context, userId);
  }

  /**
   * Determine skipped turns
   *
   * @param {object} from
   * @param {number} from.turn From turn
   * @param {number} from.round From round
   * @param {object} context - Update context
   * @private
   */
  _detectSkippedTurns({ turn, round } = {}, context) {
    const roundChange = this.round !== round;

    // No combatants skipped
    if (!roundChange && turn + 1 === this.turn) return;

    // Determine skipped combatants
    const skipped = new Set();
    for (const [index, combatant] of this.turns.entries()) {
      // Seeking first, not actually skipped
      if (!roundChange && index <= turn) continue;
      // Skipped
      else if (index < this.turn) skipped.add(combatant);
      // Skipped (usually via nextRound)
      else if (roundChange && index > turn) skipped.add(combatant);
    }

    this._handleSkippedTurns(skipped, context);

    Hooks.callAll("pf1CombatTurnSkip", this, skipped, context);
  }

  /**
   * Handle effects of skipped turns.
   *
   * @internal
   * @param {Set<string>} skipped - Combatant IDs of those whose turn was skipped.
   * @param {object} context - Combat update context
   */
  _handleSkippedTurns(skipped, context) {
    // TODO
  }

  /**
   * Process current combatant: expire active effects & buffs.
   *
   * @param {object} changed Update data
   * @param {options} context Context options
   * @param {string} userId Triggering user ID
   */
  async _processCurrentCombatant(changed, context, userId) {
    const actor = this.combatant?.actor;
    if (!actor) return;

    // Attempt to perform expiration on owning active user
    const owner = actor.activeOwner;
    if (!owner?.isSelf) return;

    const timeOffset = context.advanceTime ?? 0;
    try {
      await actor.expireActiveEffects?.({ timeOffset, combat: this });
    } catch (error) {
      console.error(error, actor);
    }
  }

  _onDelete(options, userId) {
    super._onDelete(options, userId);

    if (game.user.id !== userId) return;

    // Show experience distributor after combat
    if (!this.started) return;
    const xpCfg = game.settings.get("pf1", "experienceConfig");
    if (xpCfg.disable) return;

    const openUI = xpCfg.openDistributor;
    const skipPrompt = pf1.documents.settings.getSkipActionPrompt();
    if (openUI ^ skipPrompt) {
      pf1.applications.ExperienceDistributor.fromCombat(this);
    }
  }

  /**
   * Get current initiative.
   *
   * @type {number|undefined}
   */
  get initiative() {
    return this.combatant?.initiative;
  }
}
