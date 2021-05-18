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

  static _preProcessDiceFormula(formula, data = {}) {
    // Replace parentheses with semicolons to use for splitting
    let toSplit = formula
      .replace(/([A-z]+)?\(/g, (match, prefix) => {
        return prefix in game.pf1.rollPreProcess || prefix in Math ? `;${prefix};(;` : ";(;";
      })
      .replace(/\)/g, ";);");
    let terms = toSplit.split(";");

    // Match parenthetical groups
    let nOpen = 0,
      nOpenPreProcess = [];
    terms = terms.reduce((arr, t) => {
      // Handle cases where the prior term is a math function
      const beginPreProcessFn = t[0] === "(" && arr[arr.length - 1] in game.pf1.rollPreProcess;
      if (beginPreProcessFn) nOpenPreProcess.push([arr.length - 1, nOpen]);
      const beginMathFn = t[0] === "(" && arr[arr.length - 1] in Math;
      if (beginMathFn && nOpenPreProcess.length > 0) nOpenPreProcess.push([arr.length - 1, nOpen]);

      // Add terms to the array
      arr.push(t);

      // Increment the number of open parentheses
      if (t === "(") nOpen++;
      if (nOpen > 0 && t === ")") {
        nOpen--;
        for (let a = 0; a < nOpenPreProcess.length; a++) {
          let obj = nOpenPreProcess[a];
          // End pre process function
          if (obj[1] === nOpen) {
            const sliceLen = arr.length - obj[0];
            let fnData = arr.splice(obj[0], sliceLen),
              fn = fnData[0];
            let fnParams = fnData
              .slice(2, -1)
              .reduce((cur, s) => {
                cur.push(...s.split(/\s*,\s*/));
                return cur;
              }, [])
              .map((o) => {
                // Return raw string
                if ((o.startsWith('"') && o.endsWith('"')) || (o.startsWith("'") && o.endsWith("'"))) {
                  return o.slice(1, -1);
                }
                // Return data string
                else if (o.match(/^@([a-zA-Z0-9-.]+)$/)) {
                  const value = getProperty(data, RegExp.$1);
                  if (typeof value === "string") return value;
                }
                // Return roll result
                return RollPF.safeRoll(o, data).total;
              })
              .filter((o) => o !== "" && o != null);
            if (fn in Math) {
              arr.push(Math[fn](...fnParams).toString());
            } else {
              arr.push(game.pf1.rollPreProcess[fn](...fnParams).toString());
            }

            nOpenPreProcess.splice(a, 1);
            a--;
          }
        }
      }
      return arr;
    }, []);

    return terms.join("");
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
        const term = group.terms.join("");
        if (fn in game.pf1.rollPreProcess) {
          let fnParams = group.terms
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
              // Return data string
              else if (o.match(/^@([a-zA-Z0-9-.]+)$/)) {
                const value = getProperty(this.data, RegExp.$1);
                if (typeof value === "string") return value;
              }
              // Return roll result
              return RollPF.safeRoll(o, this.data).total;
            })
            .filter((o) => o !== "" && o != null);

          return game.pf1.rollPreProcess[fn](...fnParams);
        } else if (fn in Math) {
          const terms = term.split(",").filter((t) => !!t);
          return [new MathTerm({ fn, terms })];
        } else {
          const terms = [];
          if (fn) terms.push(new StringTerm({ term: fn }));
          terms.push(new ParentheticalTerm({ term }));
          return terms;
        }
      },
    });
  }

  static cleanFlavor(flavor) {
    return flavor.replace(/\[\];/, "");
  }

  /**
   * Render the tooltip HTML for a RollPF instance
   *
   * @returns {Promise<string>} The rendered HTML tooltip as a string
   */
  async getTooltip() {
    const parts = this.dice.map((d) => d.getTooltipData());
    const numericParts = this.terms.filter((t) => t instanceof NumericTerm).map((t) => t.getTooltipData());
    return renderTemplate("systems/pf1/templates/dice/tooltip.hbs", { parts, numericParts });
  }
}
