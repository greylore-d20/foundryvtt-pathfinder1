import { getSkipActionPrompt } from "./settings.mjs";

/* -------------------------------------------- */

/**
 * @internal
 * @param {string} combatantId - Combatant ID
 */
async function duplicateCombatantInitiativeDialog(combatantId) {
  /** @type {CombatantPF} */
  const combatant = game.combat.combatants.get(combatantId);
  if (!combatant) return void ui.notifications.warn(game.i18n.localize("PF1.Warning.NoCombatantFound"));

  const offset = await pf1.utils.dialog.getNumber({
    title: `${game.i18n.localize("PF1.DuplicateInitiative")}: ${combatant.name}`,
    label: game.i18n.localize("PF1.InitiativeOffset"),
    initial: 0,
    classes: ["duplicate-initiative"],
  });

  if (!Number.isFinite(offset)) return; // Cancelled

  return combatant.duplicateWithData({ initiative: (combatant.initiative ?? 0) + offset });
}

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
        /** @type {CombatantPF} */
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
        const templateData = {
          formula: roll.formula,
          tooltip: await roll.getTooltip(),
          total: roll.total,
          extraText: notesHTML,
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
    const chatMessages = await ChatMessage.implementation.create(messages, { rollMode });
    return { combat: this, messages: chatMessages };
  }

  /**
   * @param {object} options
   * @param {string} options.d20 Formula override
   * @param {string} options.bonus Bonus formula override
   * @param {string} options.name Name of the roller
   * @returns {object}
   */
  static async showInitiativeDialog({ d20 = null, bonus = null, name } = {}) {
    const rollMode = game.settings.get("core", "rollMode");

    const template = "systems/pf1/templates/chat/roll-dialog.hbs";
    const dialogData = { d20, bonus, rollMode, rollModes: CONFIG.Dice.rollModes };

    // Show dialog
    // TODO: Use D20RollPF's prompt instead
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
        classes: [...Dialog.defaultOptions.classes, "pf1", "roll-prompt", "roll-initiative"],
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
    super._onUpdate(changed, context, userId);

    if (changed.turn !== undefined || changed.round !== undefined) {
      // Cache current world time here since actual time update can happen at random time in the future due to async code.
      context.pf1 ??= {};
      context.pf1.worldTime = game.time.worldTime;
      this._onNewTurn(changed, context, userId);
    }
  }

  /**
   * @internal
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    if ("turn" in changed || "round" in changed) {
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
    if (!this._isForwardTime(changed, context)) return;

    const timeOffset = context.advanceTime ?? 0;

    if (context.pf1?.from) {
      const skipped = this._detectSkippedTurns(context.pf1.from, context);

      if (game.users.activeGM?.isSelf) {
        this._handleSkippedTurns(skipped, context);
      }

      const previous = this.turns.at(this.turn - 1);
      if (!skipped.has(previous)) this._processEndTurn(context.pf1?.from, context);
    }

    this._processTurnStart(changed, context, userId);

    this._processInitiative(context);
  }

  _isForwardTime(changed, context) {
    // Non-UI turn progression does not have context.direction present to detect this otherwise
    const t0 = context.pf1.from.turn,
      r0 = context.pf1.from.round,
      t1 = changed.turn ?? t0,
      r1 = changed.round ?? r0,
      rd = r1 - r0, // round delta
      td = t1 - t0; // turn delta

    if (rd < 0) return false;
    else if (rd == 0 && td <= 0) return false;
    return true;
  }

  /**
   * Determine skipped turns
   *
   * @internal
   * @param {object} from
   * @param {number} from.turn From turn
   * @param {number} from.round From round
   * @param {object} context - Update context
   * @returns {Set<Combatant>} - Set of combatant IDs whose turn was skipped
   */
  _detectSkippedTurns({ turn, round } = {}, context) {
    const roundChange = this.round !== round;

    const skipped = new Set();

    // No combatants skipped
    if (!roundChange && turn + 1 === this.turn) return skipped;

    // Determine skipped combatants
    for (const [index, combatant] of this.turns.entries()) {
      // Seeking first, not actually skipped
      if (!roundChange && index <= turn) continue;
      // Skipped
      else if (index < this.turn) skipped.add(combatant);
      // Skipped (usually via nextRound)
      else if (roundChange && index > turn) skipped.add(combatant);
    }

    Hooks.callAll("pf1CombatTurnSkip", this, skipped, context);

    return skipped;
  }

  /**
   * Handle effects of skipped turns.
   *
   * @internal
   * @param {Set<Combatant>} skipped - Combatant IDs of those whose turn was skipped.
   * @param {object} context - Combat update context
   */
  _handleSkippedTurns(skipped, context) {
    const currentTurn = this.turn;
    const event = "turnEnd";

    const timeOffset = context.advanceTime ?? 0;
    const worldTime = context.pf1?.worldTime ?? game.time.worldTime;

    // Expire effects for skipped combatants
    for (const combatant of skipped) {
      const actor = combatant.actor;
      if (!actor) continue;

      // Adjust expiration time for those who come after in initiative (their expiration was for previous round)
      const turn = this.turns.findIndex((c) => c === combatant);
      const turnTimeOffset = timeOffset + (turn > currentTurn) ? -CONFIG.time.roundTime : 0;

      actor.expireActiveEffects?.({ timeOffset: timeOffset + turnTimeOffset, worldTime, combat: this, event });
    }
  }

  /**
   * Handle end of turn
   *
   * @internal
   * @param {object} originTime
   * @param {number} originTime.turn - Turn that ended
   * @param {number} originTime.round - Round on which the turn ended
   * @param {object} context
   */
  async _processEndTurn({ turn, round } = {}, context = {}) {
    const previous = this.turns.at(turn);
    const actor = previous.actor;
    if (!actor) return;

    const owner = actor.activeOwner;
    if (!owner?.isSelf) return;

    const timeOffset = context.advanceTime ?? 0;
    const worldTime = context.pf1?.worldTime ?? game.time.worldTime;

    try {
      await actor.expireActiveEffects?.({
        combat: this,
        worldTime,
        timeOffset,
        event: "turnEnd",
      });
    } catch (error) {
      console.error(error, actor);
    }
  }

  /**
   * Process current combatant: expire active effects & buffs.
   *
   * @param {object} changed Update data
   * @param {options} context Context options
   * @param {string} userId Triggering user ID
   */
  async _processTurnStart(changed, context, userId) {
    const actor = this.combatant?.actor;
    if (!actor) return;

    // Attempt to perform expiration on owning active user
    const owner = actor.activeOwner;
    if (!owner?.isSelf) return;

    const timeOffset = context.advanceTime ?? 0;
    const worldTime = context.pf1?.worldTime ?? game.time.worldTime;

    try {
      await actor.expireActiveEffects?.({
        combat: this,
        worldTime,
        timeOffset,
        event: "turnStart",
      });
    } catch (error) {
      console.error(error, actor);
    }

    try {
      await actor.rechargeItems?.({ period: "round", exact: true });
    } catch (error) {
      console.error(error, actor);
    }
  }

  /**
   * Process end of durations based on initiative.
   *
   * Only active GM processes these to avoid conflicts and logic bloat.
   *
   * @internal
   * @param {object} [context] - Update context
   */
  _processInitiative(context = {}) {
    if (!game.users.activeGM?.isSelf) return;

    const worldTime = context.pf1?.worldTime ?? game.time.worldTime;
    const timeOffset = context.advanceTime ?? 0;

    const initiative = this.initiative;
    for (const combatant of this.combatants) {
      if (combatant.isDefeated) continue;
      const actor = combatant.actor;
      if (!actor) continue;

      actor.expireActiveEffects?.({ combat: this, initiative, timeOffset, worldTime });
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
