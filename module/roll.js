export class RollPF extends Roll {
  static safeRoll(formula, data = {}, context, options = { suppressError: false }) {
    let roll;
    try {
      roll = this.create(formula, data).evaluate({ async: false });
    } catch (err) {
      roll = this.create("0", data).evaluate({ async: false });
      roll.err = err;
    }
    if (roll.warning) roll.err = Error("This formula had a value replaced with null.");
    if (roll.err) {
      if (context && !options.suppressError) console.error(context, roll.err);
      else if (CONFIG.debug.roll) console.error(roll.err);
    }
    return roll;
  }

  static safeTotal(formula, data) {
    return isNaN(+formula) ? RollPF.safeRoll(formula, data).total : +formula;
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
      if (!isOperator && prior instanceof StringTerm) {
        prior.term += term.total;
        foundry.utils.mergeObject(prior.options, term.options);
        return terms;
      }

      // Attach string terms as flavor texts to numeric terms, if appropriate
      const priorNumeric = prior instanceof NumericTerm;
      if (prior && priorNumeric && term instanceof StringTerm && term.term.match(/\[(.+)\]/)) {
        prior.options.flavor = RegExp.$1;
        return terms;
      }

      // Combine StringTerm with a prior non-operator term
      const priorOperator = prior instanceof OperatorTerm;
      if (prior && !priorOperator && term instanceof StringTerm) {
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
      if (!(term instanceof StringTerm)) return term;
      const t = this._classifyStringTerm(term.formula, { intermediate: false });
      t.options = term.options;
      return t;
    });

    // Eliminate leading or trailing arithmetic
    if (simplified[0] instanceof OperatorTerm && simplified[0].operator !== "-") simplified.shift();
    if (simplified[terms.length - 1] instanceof OperatorTerm) simplified.pop();
    return simplified;
  }

  /**
   * @override
   *
   * Split a formula by identifying its outer-most parenthetical and math terms
   * @param {string} _formula      The raw formula to split
   * @returns {string[]}          An array of terms, split on parenthetical terms
   * @private
   */
  static _splitParentheses(_formula) {
    return this._splitGroup(_formula, {
      openRegexp: ParentheticalTerm.OPEN_REGEXP,
      closeRegexp: ParentheticalTerm.CLOSE_REGEXP,
      openSymbol: "(",
      closeSymbol: ")",
      onClose: (group) => {
        const fn = group.open.slice(0, -1);
        const options = { flavor: group.flavor ? group.flavor.slice(1, -1) : undefined };
        const term = group.terms.join("");
        const terms = [];

        if (fn in game.pf1.rollPreProcess) {
          const fnParams = group.terms
            // .slice(2, -1)
            .reduce((cur, s) => {
              cur.push(...s.split(/\s*,\s*/));
              return cur;
            }, [])
            .map((o) => {
              // Return raw string
              if ((o.startsWith('"') && o.endsWith('"')) || (o.startsWith("'") && o.endsWith("'"))) {
                return o.slice(1, -1);
              }
              // Return raw string without quotes
              if (o.match(/^[a-zA-Z0-9]+$/)) {
                return parseRollStringVariable(o);
              }
              // Return roll result
              return RollPF.safeRoll(o, this.data).total;
            });

          return game.pf1.rollPreProcess[fn](...fnParams);
        } else if (fn in Math) {
          const args = this._splitMathArgs(term);
          terms.push(new MathTerm({ fn, terms: args, options }));
        } else {
          if (fn) terms.push(new StringTerm({ term: fn }));
          terms.push(new ParentheticalTerm({ term, options }));
        }
        return terms;
      },
    });
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
    const parts = this.dice.map((d) => d.getTooltipData());
    const numericParts = this.terms.reduce((cur, t, idx, arr) => {
      const result = t instanceof NumericTerm ? t.getTooltipData() : undefined;

      const prior = arr[idx - 1];
      if (t instanceof NumericTerm && prior && prior instanceof OperatorTerm && prior.operator === "-") {
        result.total = -result.total;
      }

      if (result !== undefined) {
        if (!result.flavor) result.flavor = game.i18n.localize("PF1.Undefined");
        cur.push(result);
      }
      return cur;
    }, []);
    return renderTemplate("systems/pf1/templates/dice/tooltip.hbs", { parts, numericParts });
  }
}

export const parseRollStringVariable = function (value) {
  if (value === "false") return false;
  if (value === "true") return true;
  if (value === "null") return null;
  if (value === "undefined") return undefined;

  if (value.match(/^(?:[0-9]+)?(?:\.[0-9]+)?$/)) {
    return parseFloat(value);
  }
  return value;
};
