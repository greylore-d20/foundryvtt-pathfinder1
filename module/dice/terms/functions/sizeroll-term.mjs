import { RollPF } from "../../roll.mjs";
import { FunctionTerm } from "../base/function-term.mjs";

/**
 * RollTerm for sizeRoll() function
 */
export class SizeRollTerm extends FunctionTerm {
  constructor({ terms = [], roll, options = {} } = {}) {
    super({ terms, options, maxArgs: 4 });

    this.roll = roll ? (roll instanceof Roll ? roll : Roll.fromData(roll)) : undefined;
  }

  roll = null;

  static SERIALIZE_ATTRIBUTES = ["terms", "roll"];

  /** @type {number|undefined} */
  get total() {
    return this.roll.total;
  }

  /** @type {Die[]} */
  get dice() {
    return this.roll?.dice ?? [];
  }

  get expression() {
    return `sizeRoll(${this.terms.map((t) => t.formula).join(", ")})`;
  }

  /**
   * The dice inside this term are valid for inclusion with parent.
   */
  get inheritDice() {
    return true;
  }

  /**
   * @override
   * @type {string} - Simpler representation of the result (e.g. 3d6 instead of sizeRoll(3, 6)).
   */
  get simplify() {
    return this.roll?.formula;
  }

  /** @override */
  get isDeterministic() {
    return false;
  }

  /** @inheritDoc */
  _evaluateSync({ minimize = false, maximize = false } = {}) {
    const rollOpts = { minimize, maximize, async: false };

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

    for (const term of this.terms) {
      if (!term._evaluated) {
        term.evaluate(rollOpts);
      }
    }

    if (!this.roll) {
      // Map terms to sizeRoll params
      const sizeDice = pf1.utils.roll.sizeRoll(...this.terms.map((r) => r.total));
      if (sizeDice && this.flavor) sizeDice[0].options.flavor = this.flavor;
      // Generate final roll
      this.roll = RollPF.fromTerms(sizeDice);
    }

    // Copy flavor
    if (this.flavor) this.roll.options.flavor ??= this.flavor;

    if (!this.roll._evaluated) this.roll.evaluate(rollOpts);

    return this;
  }

  /** @inheritDoc */
  async _evaluate({ minimize = false, maximize = false } = {}) {
    const rollOpts = { minimize, maximize, async: true };

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

    for (const term of this.terms) {
      if (!term._evaluated) {
        await term.evaluate(rollOpts);
      }
    }

    if (!this.roll) {
      // Map terms to sizeRoll params
      const sizeDice = pf1.utils.roll.sizeRoll(...this.terms.map((r) => r.total));
      if (sizeDice && this.flavor) sizeDice[0].options.flavor = this.flavor;
      // Generate final roll
      this.roll = RollPF.fromTerms(sizeDice);
    }

    // Copy flavor
    if (this.flavor) this.roll.options.flavor ??= this.flavor;

    if (!this.roll._evaluated) await this.roll.evaluate(rollOpts);

    return this;
  }

  static matchTerm(expression) {
    return expression === "sizeRoll";
  }

  getTooltipData() {
    return this.roll.getTooltipData();
  }
}
