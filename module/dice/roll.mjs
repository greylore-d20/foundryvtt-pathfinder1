export class RollPF extends Roll {
  get totalHalved() {
    return Math.floor(this.total / 2);
  }

  /**
   * Return an Array of the individual DiceTerm instances contained within this Roll.
   * Override to recognize dice in SizeRollTerm.
   *
   * @override
   * @returns {DiceTerm[]}
   */
  get dice() {
    return (
      this.terms
        .reduce((dice, t) => {
          if (t instanceof foundry.dice.terms.DiceTerm) dice.push(t);
          else if (t instanceof foundry.dice.terms.PoolTerm) dice = dice.concat(t.dice);
          else if (t.inheritDice) dice = dice.concat(t.dice);
          return dice;
        }, [])
        // Append dice from parenthesis and similar eliminated rolls.
        .concat(this._dice)
    );
  }

  get flavor() {
    return this.options?.flavor;
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
   * @param formula
   * @param rollData
   * @param context
   * @param root0
   * @param root0.suppressError
   * @param evalOpts
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

  /**
   * @override
   */
  static simplifyTerms(terms) {
    // Simplify terms by combining with pending strings
    let simplified = terms.reduce((terms, term) => {
      const prior = terms[terms.length - 1];
      const isOperator = term instanceof OperatorTerm;

      // Combine a non-operator term with prior StringTerm
      if (!isOperator && prior instanceof foundry.dice.terms.StringTerm) {
        prior.term += term.total;
        foundry.utils.mergeObject(prior.options, term.options);
        return terms;
      }

      // Attach string terms as flavor texts to numeric terms, if appropriate
      const priorNumeric = prior instanceof foundry.dice.terms.NumericTerm;
      if (prior && priorNumeric && term instanceof foundry.dice.terms.StringTerm && term.term.match(/\[(.+)\]/)) {
        prior.options.flavor = RegExp.$1;
        return terms;
      }

      /*
      // Attach string terms as flavor texts to size roll terms, if appropriate
      // TODO: Review the need for this bit with Foundry v10, according to staff it will no longer be required.
      const priorSizeRoll = prior instanceof pf1.dice.terms.SizeRollTerm;
      if (prior && priorSizeRoll && term instanceof StringTerm) {
        const re = term.term.match(pf1.dice.terms.SizeRollTerm.TRAILER_REGEXP);
        const [match, modifiers, flavor] = re;
        // Attach Flavor
        if (flavor) {
          prior.options.flavor = flavor;
        }
        // Attach modifiers
        if (modifiers) {
          prior.modifiers = Array.from((modifiers || "").matchAll(DiceTerm.MODIFIER_REGEXP)).map((m) => m[0]);
        }
        return terms;
      }
      */

      // Custom handling
      if (prior && term instanceof foundry.dice.terms.StringTerm) {
        const flavor = /^\[(?<flavor>.+)\]$/.exec(term.term)?.groups.flavor;
        if (flavor) {
          // Attach string terms as flavor texts to function terms, if appropriate
          if (prior instanceof pf1.dice.terms.base.FunctionTerm) {
            prior.options.flavor = flavor;
            return terms;
          }
        }
      }

      // Combine StringTerm with a prior non-operator term
      const priorOperator = prior instanceof foundry.dice.terms.OperatorTerm;
      if (prior && !priorOperator && term instanceof foundry.dice.terms.StringTerm) {
        term.term = String(prior.total) + term.term;
        foundry.utils.mergeObject(term.options, prior.options);
        terms[terms.length - 1] = term;
        return terms;
      }

      // Otherwise continue
      terms.push(term);
      return terms;
    }, []);

    // Convert remaining String terms to a RollTerm which can be evaluated
    simplified = simplified.map((term) => {
      if (!(term instanceof foundry.dice.terms.StringTerm)) return term;
      const t = this._classifyStringTerm(term.formula, { intermediate: false });
      t.options = foundry.utils.mergeObject(term.options, t.options, { inplace: false });
      return t;
    });

    // Eliminate leading or trailing arithmetic
    if (simplified[0] instanceof foundry.dice.terms.OperatorTerm && simplified[0].operator !== "-") simplified.shift();
    if (simplified.at(-1) instanceof foundry.dice.terms.OperatorTerm) simplified.pop();
    return simplified;
  }

  static cleanFlavor(flavor) {
    return flavor.replace(/\[\];/g, "");
  }

  /**
   * Render the tooltip HTML for a RollPF instance
   *
   * @returns {Promise<string>} The rendered HTML tooltip as a string
   */
  async getTooltip() {
    const parts = this.dice.filter((d) => d.results.some((r) => r.active)).map((d) => d.getTooltipData());
    const numericParts = this.terms.reduce((cur, t, idx, arr) => {
      const ttdata =
        t instanceof foundry.dice.terms.NumericTerm || t.hasNumericTooltip ? t.getTooltipData() : undefined;

      if (ttdata !== undefined) {
        const prior = arr[idx - 1];
        if (
          t instanceof foundry.dice.terms.NumericTerm &&
          prior &&
          prior instanceof foundry.dice.terms.OperatorTerm &&
          prior.operator === "-"
        ) {
          ttdata.total = -ttdata.total;
        }

        ttdata.flavor ??= game.i18n.localize("PF1.Undefined");
        cur.push(ttdata);
      }
      return cur;
    }, []);
    return renderTemplate("systems/pf1/templates/dice/tooltip.hbs", { parts, numericParts });
  }

  static parse(formula, data) {
    const terms = super.parse(formula, data);

    const final = [];

    for (let i = 0; i < terms.length; i++) {
      const term = terms[i],
        next = terms[i + 1],
        prior = terms[i - 1];

      // Standalone terms
      if (term instanceof foundry.dice.terms.StringTerm) {
        const systerm = Object.values(pf1.dice.terms.aux).find((t) => t.matchTerm(term.term));
        if (systerm) {
          final.push(new systerm({ term: term.term }));
          continue;
        }
      }
      // Function terms
      else if (term instanceof foundry.dice.terms.ParentheticalTerm && prior instanceof foundry.dice.terms.StringTerm) {
        const systerm = Object.values(pf1.dice.terms.fn).find((t) => t.matchTerm(prior.term));
        if (systerm?.isFunction) {
          const args = systerm.parseArgs(this._lenientSplitArgs(term.term));
          final.pop();
          final.push(new systerm({ terms: args }));
          continue;
        }
      }

      final.push(term);
    }

    return final;
  }

  /**
   * Variant of _splitMathArgs that takes system terms into consideration.
   *
   * @param {string} expression
   * @returns {foundry.dice.terms.RollTerm[]}
   */
  static _lenientSplitArgs(expression) {
    return expression.split(",").reduce((args, t) => {
      t = t.trim();
      if (!t) return args; // Blank args
      if (!args.length) {
        // First arg
        args.push(t);
        return args;
      }
      const p = args[args.length - 1]; // Prior arg
      const priorValid = this.validate(p);
      if (priorValid) args.push(t);
      else {
        const aux = Object.values(pf1.dice.terms.aux).find((t) => t.matchTerm(p));
        if (aux) args.push(t);
        else args[args.length - 1] = [p, t].join(","); // Collect inner parentheses or pools
      }
      return args;
    }, []);
  }
}
