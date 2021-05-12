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
}
