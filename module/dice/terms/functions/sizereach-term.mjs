import { RollPF } from "../../roll.mjs";
import { FunctionTerm } from "../base/function-term.mjs";

/**
 * RollTerm for sizeReach() function
 *
 * @todo Remove roll from serialized data.
 */
export class SizeReachTerm extends FunctionTerm {
  constructor({ terms = [], options = {} } = {}) {
    super({ terms, options, maxArgs: 3 });
  }

  static SERIALIZE_ATTRIBUTES = ["terms", "roll"];
  static MODIFIERS = {};

  /** @type {number|undefined} */
  get total() {
    return this.roll?.total;
  }

  /** @type {Die[]|undefined} */
  get dice() {
    return this.roll?.dice;
  }

  get expression() {
    return `sizeReach(${this.terms.map((t) => t.formula).join(", ")})`;
  }

  get formula() {
    return `sizeReach(${this.terms.map((t) => t.formula).join(", ")})`;
  }

  /** @type {string|undefined} */
  get simplify() {
    return this.roll?.formula;
  }

  /**
   * The dice inside this term are valid for inclusion with parent.
   */
  get inheritDice() {
    return this.roll?.dice.length > 0;
  }

  /** @override */
  get isDeterministic() {
    return !this.terms.some((t) => !t.isDeterministic);
  }

  /** @override */
  static get isFunction() {
    return true;
  }

  /** @inheritDoc */
  _evaluateSync({ minimize = false, maximize = false } = {}) {
    const rollOpts = { minimize, maximize };

    const terms = [];
    for (let term of this.terms) {
      if (!term._evaluated) {
        if (term.isIntermediate) {
          term.evaluateSync(rollOpts);
          term = new NumericTerm({ number: term.total, options: term.options });
        }
      }
      terms.push(term);
    }
    this.terms = terms;

    for (const term of this.terms) {
      if (!term._evaluated) {
        term.evaluateSync(rollOpts);
      }
    }

    const noRoll = !this.roll;
    // Map terms to sizeRoll params
    const sizeDice = noRoll ? pf1.utils.roll.sizeReach(...this.terms.map((r) => r.total)) : null;
    if (sizeDice && this.flavor) sizeDice[0].options.flavor = this.flavor;
    // Generate final roll
    const roll = noRoll ? RollPF.fromTerms(sizeDice) : this.roll;
    // Copy flavor
    if (this.flavor) roll.options.flavor = this.flavor;

    this.roll = roll._evaluated ? roll : roll.evaluateSync(rollOpts);

    return this;
  }

  /** @inheritDoc */
  async _evaluate({ minimize = false, maximize = false } = {}) {
    const rollOpts = { minimize, maximize };

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

    const noRoll = !this.roll;
    // Map terms to sizeRoll params
    const reach = noRoll ? pf1.utils.roll.sizeReach(...this.terms.map((r) => r.total)) : null;
    if (reach && this.flavor) reach[0].options.flavor = this.flavor;
    // Generate final roll
    const roll = noRoll ? RollPF.fromTerms(reach) : this.roll;
    // Copy flavor
    if (this.flavor) roll.options.flavor = this.flavor;

    this.roll = roll._evaluated ? roll : await roll.evaluate(rollOpts);

    return this;
  }

  static matchTerm(expression) {
    return expression === "sizeReach";
  }

  get hasNumericTooltip() {
    return this.roll?.dice.length === 0;
  }

  getTooltipData() {
    this.roll.getTooltipData();
  }
}
