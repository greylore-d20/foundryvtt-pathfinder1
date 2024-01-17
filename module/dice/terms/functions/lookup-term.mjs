import { FunctionTerm } from "../base/function-term.mjs";

/**
 * lookup(search, ...values)
 *
 * Seach is evaluated to a number which is used as zero-based offset to values array, returning the value at evaluated offset.
 *
 * If index goes out of bounds, first value is used as fallback.
 *
 * Usage:
 * - For bounding lookups, use min(), max() and clamped() functions as appropriate.
 * - You may add +1 to your formula to use the first value as explicit error fallback.
 *
 * @example
 * lookup(2, 0, 10, 20, 30) // => 20
 * lookup(500, -100, 10, 20) // => -100
 */
export class LookupTerm extends FunctionTerm {
  constructor({ terms = [], search, result, options = {} } = {}) {
    super({ terms, options });

    this.search = search;
    this.result = result;

    // Less than 3 arguments is meaningless as it always has same result, or lacks even default result
    if (this.terms.length < 3) throw new Error(`LookupTerm requires minimum of 3 arguments`);
  }

  result = null;

  static SERIALIZE_ATTRIBUTES = ["terms", "search", "result"];

  get expression() {
    return `lookup(${this.terms.map((t) => (t instanceof ParentheticalTerm ? t.term : t.expression)).join(", ")})`;
  }

  get formula() {
    return `lookup(${this.terms.map((t) => t.formula).join(", ")})${this.flavor ? `[${this.flavor}]` : ""}`;
  }

  get total() {
    const search = this.terms[0];
    if (!search) return undefined;

    let offset = search.total;
    if (!this.terms[1 + offset]) offset = 0;
    return this.terms[1 + offset]?.total;
  }

  get dice() {
    const term = this.lookupResult;
    if (!term) return [];

    const roll = Roll.defaultImplementation.fromTerms(term);
    return roll.dice ?? [];
  }

  get lookupResult() {
    const search = this.terms[0];
    if (!search) return undefined;
    let offset = search.total;

    // Reset offset if invalid
    if (offset < 0) offset = 0;
    else if (this.terms.length < offset + 1) offset = 0;

    return this.terms[1 + offset];
  }

  get simplify() {
    return this.lookupResult.formula;
  }

  get isDeterministic() {
    return this.terms[0]?.isDeterministic && this.lookupResult?.isDeterministic;
  }

  _evaluateSync({ minimize = false, maximize = false } = {}) {
    const rollOpts = { minimize, maximize, async: false };
    const evalOffset = (i) => {
      const term = this.terms[i];
      if (!term._evaluated) term.evaluate(rollOpts);
    };

    const terms = [];
    for (let term of this.terms) {
      if (!term._evaluated) {
        if (term.isIntermediate) {
          term.evaluate(rollOpts);
          term = new NumericTerm({ number: term.total, options: term.options });
        }
      }
      terms.push(term);
    }
    this.terms = terms;

    evalOffset(0);

    const search = this.terms[0];
    const searchRoll = Roll.defaultImplementation.fromTerms([search]);
    if (!searchRoll._evaluated) searchRoll.evaluate(rollOpts);
    let offset = Math.max(0, searchRoll.total);
    if (!this.terms[1 + offset]) offset = 0;

    evalOffset(offset);

    if (this.flavor) this.result.terms[1 + offset].options.flavor = this.flavor;

    this.result ??= Roll.defaultImplementation.fromTerms(this.terms);

    return this;
  }

  async _evaluate({ minimize = false, maximize = false } = {}) {
    const rollOpts = { minimize, maximize };
    const evalOffset = async (i) => {
      const term = this.terms[i];
      if (!term._evaluated) await term.evaluate(rollOpts);
    };

    const terms = [];
    for (let term of this.terms) {
      if (!term._evaluated) {
        if (term.isIntermediate) {
          await term.evaluate(rollOpts);
          term = new NumericTerm({ number: term.total, options: term.options });
        }
      }
      terms.push(term);
    }
    this.terms = terms;

    await evalOffset(0);

    const search = this.terms[0];
    this.search ??= Roll.defaultImplementation.fromTerms([search]);
    if (!this.search._evaluated) await this.search.evaluate(rollOpts);
    let offset = Math.max(0, this.search.total);
    if (!this.terms[1 + offset]) offset = 0;

    await evalOffset(offset);

    if (this.flavor) this.terms[1 + offset].options.flavor ??= this.flavor;

    return this;
  }

  get hasNumericTooltip() {
    const term = this.lookupResult;
    return term?.isDeterministic ?? true;
  }

  /**
   * Get tooltip data for the result.
   *
   * @override
   */
  getTooltipData() {
    const term = this.lookupResult;
    if (!term) return;
    const roll = Roll.defaultImplementation.fromTerms([term]);
    return {
      total: roll.total,
      flavor: term.options.flavor ?? game.i18n.localize("PF1.Undefined"),
    };
  }

  static matchTerm(expression) {
    return expression === "lookup";
  }
}
