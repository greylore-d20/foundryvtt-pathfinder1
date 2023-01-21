import { RollPF } from "./roll.mjs";

/**
 * A class adding additional functionality to {@link Roll Rolls} for d20 based Pathfinder rolls.
 */
export class D20RollPF extends RollPF {
  /** @type {D20RollOptions} */
  options;

  /**
   * @param {string} formula - The roll formula to parse
   * @param {object} [data] - The data object against which to parse attributes within the formula
   * @param {Partial<D20RollConstructorOptions>} [options]
   */
  constructor(formula, data, options = {}) {
    super(formula, data, options);
    this.options = mergeObject(this.constructor.defaultOptions, options);

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
    return { critical: 20, fumble: 1, flavor: "", staticRoll: null, bonus: "" };
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
   * Is this roll a critical success? Returns undefined if roll isn't evaluated.
   *
   * @type {boolean|void}
   */
  get isCrit() {
    if (!this._evaluated) return undefined;
    if (!Number.isNumeric(this.options.critical)) return false;
    return this.dice[0].total >= this.options.critical;
  }

  /* -------------------------------------------- */

  /**
   * Is this roll a critical failure? Returns undefined if roll isn't evaluated.
   *
   * @type {boolean|void}
   */
  get isFumble() {
    if (!this._evaluated) return undefined;
    if (!Number.isNumeric(this.options.fumble)) return false;
    return this.dice[0].total <= this.options.fumble;
  }

  /**
   * Is this roll a natural 20? Returns undefined if roll isn't evaluated.
   *
   * @type {boolean|void}
   */
  get isNat20() {
    if (!this._evaluated) return undefined;
    return this.dice[0].total === 20;
  }

  /**
   * Return a standardized representation for the displayed formula associated with this Roll.
   * This formula includes any {@link pf1!types.D20RollOptions.bonus bonus} that might not be part of this roll's {@link terms}.
   *
   * @returns {string}
   */
  get formula() {
    let formula = this.constructor.getFormula(this.terms);
    const bonusTerms = this.constructor.parse(`${this.options.bonus}`, this.data);
    if (this.options.bonus && !this._evaluated) formula += ` + ${this.constructor.getFormula(bonusTerms)}`;
    return formula;
  }

  /**
   * Render a {@link Dialog} for the user to enter additional bonuses, set a static roll result, or take 10/20.
   *
   * @param {D20RollDialogOptions} [options={}] - Additional options determining what options to show in the dialog
   * @returns {Promise<this | null>} A promise that resolves when the dialog is closed
   */
  async promptDialog(options = {}) {
    const { rollMode = game.settings.get("core", "rollMode"), template = this.constructor.DIALOG_TEMPLATE } = options;
    const d20 = this.options.staticRoll === null ? this.terms[0].formula : this.options.staticRoll;
    const renderData = {
      data: this.data,
      rollMode: options.rollMode || rollMode,
      rollModes: CONFIG.Dice.rollModes,
      d20: d20 === "1d20" ? "" : d20,
      bonus: this.options.bonus,
    };

    const dialogOptions = options.dialogOptions || {};
    dialogOptions.subject = options.subject;
    dialogOptions.jQuery = false;

    const html = await renderTemplate(template, renderData);

    return new Promise((resolve) => {
      new Dialog(
        {
          title: options.title || game.i18n.localize("PF1.Roll"),
          content: html,
          buttons: {
            normal: {
              label: game.i18n.localize("PF1.Normal"),
              callback: (html) => resolve(this._onDialogSubmit(html, null)),
            },
            takeTen: {
              label: game.i18n.format("PF1.TakeX", { number: this.constructor.STATIC_ROLL.TEN }),
              callback: (html) => resolve(this._onDialogSubmit(html, this.constructor.STATIC_ROLL.TEN)),
            },
            takeTwenty: {
              label: game.i18n.format("PF1.TakeX", { number: this.constructor.STATIC_ROLL.TWENTY }),
              callback: (html) => resolve(this._onDialogSubmit(html, this.constructor.STATIC_ROLL.TWENTY)),
            },
          },
          default: "normal",
          close: () => {
            resolve(null);
          },
        },
        dialogOptions
      ).render(true);
    });
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
    if (form) {
      if (form.bonus.value) {
        this.options.bonus = form.bonus.value;
      }

      if (form.d20.value) {
        const baseDice = this.constructor.parse(form.d20.value, this.data);
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

      if (form.rollMode) {
        this.options.rollMode = form.rollMode.value;
      }

      this._formula = this.constructor.getFormula(this.terms);
    }

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
    if (!this._evaluated) await this.evaluate({ async: true });

    const chatTemplate = options.chatTemplate || this.constructor.CHAT_TEMPLATE;
    const chatTemplateData = mergeObject(
      {
        user: game.user.id,
        formula: this.formula,
        tooltip: await this.getTooltip(),
        total: this.total,
        isCrit: this.isCrit,
        isFumble: this.isFumble,
        isNat20: this.isNat20,
        flavor: this.options.flavor,
        compendiumEntry: options.compendium?.entry,
        compendiumEntryType: options.compendium?.type,
      },
      options.chatTemplateData || {}
    );

    const rollMode = options.rollMode || this.options.rollMode || game.settings.get("core", "rollMode");
    messageData = foundry.utils.mergeObject(
      {
        user: game.user.id,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        sound: options.noSound ? undefined : CONFIG.sounds.dice,
        content: await renderTemplate(chatTemplate, chatTemplateData),
        "flags.pf1.noRollRender": true,
      },
      messageData
    );
    messageData.rolls = [this]; // merge/expandObject would otherwise destroy the `Roll` instance
    if (options.subject) foundry.utils.setProperty(messageData, "flags.pf1.subject", options.subject);

    const messageClass = CONFIG.ChatMessage.documentClass;
    const message = new messageClass(messageData);
    const messageObject = message.toObject();

    const create = options.create ?? true;
    if (create) {
      return messageClass.create(message, { rollMode });
    } else {
      if (rollMode) messageClass.applyRollMode(messageObject, rollMode);
      return messageObject;
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
      this.terms = this.terms.concat(...bonusTerms);
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
      const diff = this.options.staticRoll - this.dice[0].total;
      const newTotal = this._total + diff;
      const activeDie = this.dice[0].results.find((r) => r.active) ?? this.dice[0].results[0];
      activeDie.result = this.options.staticRoll;
      this._total = newTotal;
      this.options.flavor += ` (${game.i18n.format("PF1.TakeX", { number: this.options.staticRoll })})`;
    }
  }
}

/**
 * Performs an actor based d20 roll.
 *
 * @param {Partial<D20ActorRollOptions>} [options={}]
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
    skipDialog = false,
    staticRoll = null,
    chatTemplateData = {},
    chatMessage = true,
    compendium,
    noSound = false,
    flavor = "",
    parts = [],
    dice = "1d20",
    rollData = {},
    subject,
    rollMode,
    bonus = "",
    speaker,
  } = options;
  const formula = [dice, ...parts].join("+");

  const roll = new CONFIG.Dice.rolls.D20RollPF(formula, rollData, { flavor, staticRoll, bonus });
  if (!skipDialog) {
    const title = speaker?.alias ? `${speaker.alias}: ${flavor}` : flavor;
    const dialogResult = await roll.promptDialog({ title, rollMode, subject });
    if (dialogResult === null) return;
  }
  return roll.toMessage({ speaker }, { create: chatMessage, noSound, chatTemplateData, compendium, subject });
}
