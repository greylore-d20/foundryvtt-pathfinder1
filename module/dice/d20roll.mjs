import { getSkipActionPrompt } from "module/documents/settings.mjs";
import { RollPF } from "./roll.mjs";

/**
 * A class adding additional functionality to {@link Roll Rolls} for d20 based Pathfinder rolls.
 */
export class D20RollPF extends RollPF {
  /** @type {D20RollOptions} */
  options;

  /**
   * Standard roll used by the system (1d20).
   */
  static standardRoll = "1d20";

  /**
   * @param {string} formula - The roll formula to parse
   * @param {object} [data] - The data object against which to parse attributes within the formula
   * @param {Partial<D20RollConstructorOptions>} [options]
   * @param {D20RollContext} [context]
   */
  constructor(formula, data, options = {}, context = {}) {
    super(formula, data, options);
    this.options = foundry.utils.mergeObject(this.constructor.defaultOptions, options);

    this.context = context;

    // No dice in the formula
    if (!(this.terms[0] instanceof Die)) {
      // If the first term is a number, use it as the static roll
      if (this.terms[0] instanceof NumericTerm && this.options.staticRoll === null) {
        this.options.staticRoll = this.terms[0].total;
        this.terms[0] = new Die({ number: 1, faces: 20 });
        this._formula = this.constructor.getFormula(this.terms);
      } else {
        // Conflict between numeric term and static roll
        throw new Error(`Invalid D20RollPF formula provided: ${this._formula}`);
      }
    }
  }

  /**
   * Default options for D20Rolls
   *
   * @type {Partial<D20RollOptions>}
   */
  static get defaultOptions() {
    return { critical: 20, flavor: "", staticRoll: null, bonus: "" };
  }

  /**
   * The default handlebars template used to render the roll's dialog
   *
   * @type {string}
   */
  static DIALOG_TEMPLATE = "systems/pf1/templates/chat/roll-dialog.hbs";

  /**
   * The default handlebars template used to render the roll's chat message
   *
   * @type {string}
   */
  static CHAT_TEMPLATE = "systems/pf1/templates/chat/roll-ext.hbs";

  /**
   * Static roll results
   *
   * @enum {number}
   */
  static STATIC_ROLL = {
    TEN: 10,
    TWENTY: 20,
  };

  /**
   * The D20 die this roll is based on.
   *
   * @type {Die}
   */
  get d20() {
    // this.dice[0] returns wrong number if formula had, for example, a die roll inside parenthesis.
    return this.terms[0];
  }

  /**
   * Is this roll a critical success? Returns undefined if roll isn't evaluated.
   *
   * @type {boolean|void}
   */
  get isCrit() {
    if (!this._evaluated) return undefined;
    if (!Number.isNumeric(this.options.critical)) return false;
    return this.d20.total >= this.options.critical;
  }

  /**
   * Is this roll a natural 20? Returns undefined if roll isn't evaluated.
   *
   * @type {boolean|void}
   */
  get isNat20() {
    if (!this._evaluated) return undefined;
    return this.d20.total === 20;
  }

  /**
   * Is this roll a natural 1? Returns undefined if roll isn't evaluated.
   *
   * @type {boolean|void}
   */
  get isNat1() {
    if (!this._evaluated) return undefined;
    return this.d20.total === 1;
  }

  /**
   * Is this roll a misfire.
   *
   * @type {boolean|void}
   */
  get isMisfire() {
    if (!this._evaluated) return undefined;
    return this.natural <= (this.options.misfire ?? 0);
  }

  /**
   * Natural roll value. Undefined if the roll isn't evaluated.
   *
   * @type {number|void}
   */
  get natural() {
    if (!this._evaluated) return undefined;
    return this.d20.total;
  }

  /**
   * @type {boolean} - Is static roll (e.g. Take 20)
   */
  get isStatic() {
    return this.options.staticRoll !== null;
  }

  /**
   * @type {boolean} - Is normal d20 roll
   */
  get isNormal() {
    return this.terms[0].formula === this.constructor.standardRoll;
  }

  /**
   * Modifier on the roll besides natural roll. Undefined if the roll isn't evaluated.
   *
   * @type {number|void}
   */
  get bonus() {
    if (!this._evaluated) return undefined;
    return this.total - this.natural;
  }

  /**
   * Return a standardized representation for the displayed formula associated with this Roll.
   * This formula includes any {@link D20RollOptions.bonus bonus} that might not be part of this roll's {@link terms}.
   *
   * @type {string}
   */
  get formula() {
    let formula = this.constructor.getFormula(this.terms);
    const bonusTerms = this.constructor.parse(`${this.options.bonus}`, this.data);
    if (this.options.bonus && !this._evaluated) formula += ` + ${this.constructor.getFormula(bonusTerms)}`;
    return formula;
  }

  /**
   * The flavor this roll was created with.
   *
   * @type {string}
   */
  get flavor() {
    return this.options.flavor;
  }

  /**
   * Render a {@link Dialog} for the user to enter additional bonuses, set a static roll result, or take 10/20.
   *
   * @param {D20RollDialogOptions} [options] - Additional options determining what options to show in the dialog
   * @returns {Promise<this | null>} A promise that resolves when the dialog is closed
   */
  async promptDialog(options = {}) {
    const { rollMode = game.settings.get("core", "rollMode"), template = this.constructor.DIALOG_TEMPLATE } = options;
    const d20 = this.options.staticRoll === null ? this.d20.formula : this.options.staticRoll;
    const renderData = {
      data: this.data,
      rollMode: options.rollMode || rollMode,
      rollModes: CONFIG.Dice.rollModes,
      // TODO: Move this standard roll obfuscation to dialog handling
      d20: d20 === pf1.dice.D20RollPF.standardRoll ? "" : d20, // Do not show standard roll in the input field
      bonus: this.options.bonus,
    };

    const dialogOptions = options.dialogOptions || {};
    dialogOptions.classes ??= [];
    dialogOptions.classes.push(...Dialog.defaultOptions.classes, "pf1", "roll-prompt");

    const renderOptions = options.renderOptions || {};

    const html = await renderTemplate(template, renderData);

    return Dialog.wait(
      {
        title: options.title || game.i18n.localize("PF1.Roll"),
        content: html,
        buttons: {
          normal: {
            label: game.i18n.localize("PF1.Normal"),
            callback: (html) => this._onDialogSubmit(html, null),
          },
          takeTen: {
            label: game.i18n.format("PF1.TakeX", { number: this.constructor.STATIC_ROLL.TEN }),
            callback: (html) => this._onDialogSubmit(html, this.constructor.STATIC_ROLL.TEN),
          },
          takeTwenty: {
            label: game.i18n.format("PF1.TakeX", { number: this.constructor.STATIC_ROLL.TWENTY }),
            callback: (html) => this._onDialogSubmit(html, this.constructor.STATIC_ROLL.TWENTY),
          },
        },
        default: "normal",
        close: () => null,
      },
      {
        ...dialogOptions,
        jQuery: false,
        subject: options.subject,
        speaker: options.speaker,
        roll: this,
      },
      {
        ...(options.renderOptions || {}),
        focus: true,
      }
    );
  }

  /**
   * Converts form element to object
   *
   * @protected
   * @param {HTMLFormElement} html
   * @returns {object} - Expanded form data
   */
  _getFormData(html) {
    return foundry.utils.expandObject(new FormDataExtended(html).object);
  }

  /**
   * A callback applying the user's input from the dialog to the roll and its options.
   *
   * @protected
   * @param {HTMLElement} html - The dialog's submitted HTML
   * @param {number | null} [staticRoll] - A static roll result to use instead of rolling the dice
   * @returns {D20RollPF} This roll
   */
  _onDialogSubmit(html, staticRoll) {
    const form = html.querySelector("form");
    if (!form) return this;
    const formData = this._getFormData(form);

    if (formData.bonus) {
      this.options.bonus = formData.bonus;
    }

    if (formData.d20) {
      const baseDice = this.constructor.parse(formData.d20, this.data);
      // If a static roll is given as d20 input, Take X button clicks are ignored
      if (baseDice[0] instanceof NumericTerm) this.options.staticRoll = baseDice[0].total;
      else if (baseDice[0] instanceof Die) {
        this.terms = [...baseDice, ...this.terms.slice(1)];
        // d20 input is actual dice, so Take X buttons are respected
        if (staticRoll !== undefined) this.options.staticRoll = staticRoll;
      }
    } else {
      // No d20 input, base die is default, so Take X buttons are respected
      if (staticRoll !== undefined) this.options.staticRoll = staticRoll;
    }

    if (formData.rollMode) {
      this.options.rollMode = formData.rollMode;
    }

    this._formula = this.constructor.getFormula(this.terms);

    return this;
  }

  /**
   * Transform this roll into a {@link ChatMessage} displaying the result.
   * This function can either create a ChatMessage (by default) or return the data object that would be used to create one.
   *
   * @param {object} messageData - The data object to use when creating the message
   * @param {D20RollChatOptions} options - Additional options which configure how the message is created
   * @returns {Promise<ChatMessage | object>} The created ChatMessage document, or the object of data that would be used to create one
   */
  async toMessage(messageData = {}, options = {}) {
    if (!this._evaluated) await this.evaluate();

    const chatTemplate = options.chatTemplate || this.constructor.CHAT_TEMPLATE;
    const chatTemplateData = foundry.utils.mergeObject(
      {
        formula: this.formula,
        tooltip: await this.getTooltip(),
        total: Math.floor(this.total * 100) / 100,
        isCrit: this.isCrit,
        isMisfire: this.isMisfire,
        isNat20: this.isNat20,
        isNat1: this.isNat1,
        natural: this.natural,
        options: this.options,
        isStatic: this.isStatic,
        isNormal: this.isNormal,
        get isAbnormal() {
          return this.isStatic || !this.isNormal;
        },
        get abnormalTooltip() {
          if (this.isStatic) return game.i18n.format("PF1.TakeX", { number: this.options.staticRoll });
          else if (this.isAbnormal) return "PF1.CustomRollDesc";
          else return "";
        },
        bonus: this.bonus,
        flavor: this.options.flavor,
        compendiumEntry: options.compendium?.entry,
        compendiumEntryType: options.compendium?.type,
      },
      options.chatTemplateData || {}
    );

    const rollMode = options.rollMode || this.options.rollMode || game.settings.get("core", "rollMode");
    messageData = foundry.utils.mergeObject(
      {
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        sound: options.noSound ? undefined : CONFIG.sounds.dice,
        content: await renderTemplate(chatTemplate, chatTemplateData),
      },
      messageData
    );
    messageData.rolls = [this]; // merge/expandObject would otherwise destroy the `Roll` instance
    if (options.subject) foundry.utils.setProperty(messageData, "flags.pf1.subject", options.subject);

    // Add combat reference if such exists
    const actor = ChatMessage.getSpeakerActor(messageData.speaker);
    if (actor && game.combat?.combatants.some((c) => c.actor === actor)) {
      foundry.utils.setProperty(messageData, "flags.pf1.metadata.combat", game.combat.id);
    }

    const message = new ChatMessage.implementation(messageData);
    if (rollMode) message.applyRollMode(rollMode);
    messageData = message.toObject();

    if (options.create ?? true) {
      return ChatMessage.implementation.create(messageData, { rollMode });
    } else {
      return messageData;
    }
  }

  /** @inheritDoc */
  async _evaluate(options) {
    this._applyBonus();
    await super._evaluate(options);
    this._applyStaticRoll();
    return this;
  }

  /** @inheritDoc */
  _evaluateSync(options) {
    this._applyBonus();
    super._evaluateSync(options);
    this._applyStaticRoll();
    return this;
  }

  /**
   * Apply the bonus the roll was created with or the user entered into the dialog.
   *
   * @private
   */
  _applyBonus() {
    if (this.options.bonus) {
      const bonusTerms = this.constructor.parse(`${this.options.bonus}`, this.data);
      if (!(bonusTerms[0] instanceof OperatorTerm)) bonusTerms.unshift(new OperatorTerm({ operator: "+" }));
      this.terms.push(...bonusTerms);
      this._formula = this.constructor.getFormula(this.terms);
    }
  }

  /**
   * Replace the rolled result of the active d20 (or its replacement) with a static value,
   * and adjust the total accordingly.
   *
   * @remarks This requires the roll to be evaluated.
   * @private
   */
  _applyStaticRoll() {
    if (!this._evaluated) throw new Error("Roll must be evaluated before applying static roll.");

    if (this.options.staticRoll !== null && this.options.staticRoll >= 0) {
      const d20 = this.d20;
      const diff = this.options.staticRoll - d20.total;
      const newTotal = this._total + diff;
      const activeDie = d20.results.find((r) => r.active) ?? d20.results[0];
      activeDie.result = this.options.staticRoll;
      this._total = newTotal;
    }
  }
}

/**
 * Performs an actor based d20 roll.
 *
 * @param {Partial<D20ActorRollOptions>} [options]
 * @example Rolling a 1d20 + an actor's BAB + 2 for good behavior
 * ```js
 * const actor = game.actors.getName("Righteous Paladin");
 * await pf1.dice.d20Roll({
 *   skipDialog: true, // Roll away without a dialog
 *   flavor: "BAB", // Add a flavor/title to the roll
 *   parts: [`${actor.system.attributes.bab.total}[BAB]`], // Use the actor's BAB
 *   dice: "2d20kh", // Roll 2 d20s and keep the highest
 *   bonus: "2[Good Behavior]", // Add a static bonus of 2
 *   rollMode: "gmroll", // Make roll only visible to user and GM
 * });
 * ```
 */
export async function d20Roll(options = {}) {
  const {
    skipDialog = getSkipActionPrompt(),
    staticRoll = null,
    chatTemplateData = {},
    chatMessage = true,
    compendium,
    noSound = false,
    flavor = "",
    parts = [],
    dice = pf1.dice.D20RollPF.standardRoll,
    rollData = {},
    subject,
    bonus = "",
    speaker,
  } = options;

  let rollMode = options.rollMode;

  const formula = [dice, ...parts].join("+");

  const roll = new pf1.dice.D20RollPF(formula, rollData, { flavor, staticRoll, bonus }, { speaker });
  if (!skipDialog) {
    const title = speaker?.alias ? `${speaker.alias}: ${flavor}` : flavor;
    const dialogResult = await roll.promptDialog({ title, rollMode, subject, speaker });
    if (dialogResult === null) return;

    // Move roll mode selection from roll data
    rollMode = roll.options.rollMode;
    delete roll.options.rollMode;
  }

  return roll.toMessage({ speaker }, { create: chatMessage, noSound, chatTemplateData, compendium, subject, rollMode });
}
