export class RollPF extends Roll {
  get totalHalved() {
    foundry.utils.logCompatibilityWarning("RollPF.totalHalved is deprecated in favor fo RollPF.half.", {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });
    return Math.floor(this.total / 2);
  }

  /** @type {number} - Half of the total, rounded down. */
  get half() {
    return Math.floor(this.total / 2);
  }

  /**
   * Synchronous and thrown error consuming roll evaluation.
   *
   * @remarks
   * - Returned roll has `.err` set if an error occurred during evaluation.
   * - If error occurs, the returned roll will have its formula replaced.
   * @param {string} formula - Roll formula
   * @param {object} rollData - Data supplied to roll
   * @param {object} context - If error occurs, this will be included in the error message.
   * @param {object} [options] - Additional options
   * @param {boolean} [options.suppressError=false] - If true, no error will be printed even if one occurs.
   * @param {object} [evalOpts] - Additional options to pass to Roll.evaluate()
   * @returns {Promise<RollPF>} - Evaluated roll, or placeholder if error occurred.
   */
  static async safeRoll(formula, rollData = {}, context, { suppressError = false } = {}, evalOpts = {}) {
    let roll;
    try {
      roll = await this.create(formula, rollData).evaluate({ ...evalOpts });
    } catch (err) {
      roll = this.create("0", rollData).evaluateSync({ ...evalOpts });
      roll.err = err;
    }
    if (roll.warning) roll.err = Error("This formula had a value replaced with null.");
    if (roll.err) {
      if (context && !suppressError) console.error(context, roll.err);
      else if (CONFIG.debug.roll) console.error(roll.err);
    }
    return roll;
  }

  /**
   * Synchronous version of {@link safeRoll safeRoll()}
   *
   * {@inheritDoc safeRoll}
   *
   * @param formula - Formula to evaluate
   * @param rollData - Roll data
   * @param context - Context data to log if error occurs
   * @param options - Additional options
   * @param options.suppressError - If true, no error will be printed
   * @param evalOpts - Options to pass to Roll.evaluate()
   * @returns {RollPF} - Evaluated roll
   */
  static safeRollSync(formula, rollData = {}, context, { suppressError = false } = {}, evalOpts = {}) {
    let roll;
    try {
      roll = new this(formula, rollData).evaluateSync({ ...evalOpts });
    } catch (err) {
      roll = new this("0", rollData).evaluateSync({ ...evalOpts });
      roll.err = err;
    }
    if (roll.warning) roll.err = Error("This formula had a value replaced with null.");
    if (roll.err) {
      if (context && !suppressError) console.error(context, roll.err);
      else if (CONFIG.debug.roll) console.error(roll.err);
    }
    return roll;
  }

  static cleanFlavor(flavor) {
    return flavor.replace(/\[\];/g, "");
  }

  static getTermTooltipData(term) {
    if (typeof term.total !== "number") return null; // Ignore terms that don't result in numbers

    const ttdata = term.getTooltipData?.() ?? {
      formula: term.expression,
      total: term.total,
      flavor: term.flavor,
    };

    ttdata.flavor ||= game.i18n.localize("PF1.Undefined");

    return ttdata;
  }

  /**
   * Render the tooltip HTML for a RollPF instance
   *
   * @returns {Promise<string>} The rendered HTML tooltip as a string
   */
  async getTooltip() {
    const parts = this.dice.filter((d) => d.results.some((r) => r.active)).map(this.constructor.getTermTooltipData);
    const numericParts = this.terms.reduce((cur, t, idx, arr) => {
      if (t instanceof foundry.dice.terms.DiceTerm) return cur; // Ignore dice already handled above
      if (t instanceof foundry.dice.terms.FunctionTerm && t.dice.length) return cur; // Ignore function terms with dice

      const ttdata = this.constructor.getTermTooltipData(t);
      if (!ttdata) return cur;

      const prior = arr[idx - 1];
      if (
        t instanceof foundry.dice.terms.NumericTerm &&
        prior &&
        prior instanceof foundry.dice.terms.OperatorTerm &&
        prior.operator === "-"
      ) {
        ttdata.total = -ttdata.total;
      }

      cur.push(ttdata);

      return cur;
    }, []);

    return renderTemplate("systems/pf1/templates/dice/tooltip.hbs", { parts, numericParts });
  }
}
