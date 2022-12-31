import { RollPF } from "../roll.mjs";

/**
 * RollTerm for sizeRoll() function
 */
export class SizeRollTerm extends RollTerm {
  constructor({ terms = [], roll, options }) {
    super({ options });

    if (terms) {
      if (terms[0] instanceof RollTerm) this.terms = terms;
      else if (typeof terms[0] === "string") {
        this._terms = terms;
        this.terms = terms.reduce((all, t) => {
          const ts = RollPF.parse(t);
          if (ts.length > 1) all.push(ParentheticalTerm.fromTerms(ts));
          else all.push(ts[0]);
          return all;
        }, []);
      } else this.terms = terms.map((t) => RollTerm.fromData(t));
    }

    this.roll = roll ? (roll instanceof Roll ? roll : Roll.fromData(roll)) : undefined;
  }

  _terms = [];

  terms = [];

  roll = undefined;

  isIntermediate = false;

  static SERIALIZE_ATTRIBUTES = ["terms", "roll"];
  static MODIFIERS = {};

  get total() {
    return this.roll.total;
  }

  get dice() {
    return this.roll?.dice;
  }

  get formula() {
    return this.simplify ?? super.formula;
  }

  get expression() {
    return `sizeRoll(${this.terms.map((t) => t.formula).join(", ")})`;
  }

  /**
   * Return simpler representation of the sizeRoll (e.g. 3d6 instead of sizeRoll(3, 6)).
   */
  get simplify() {
    return this.roll?.formula;
  }

  get isDeterministic() {
    return false;
  }

  _evaluateSync({ minimize = false, maximize = false } = {}) {
    const rollOpts = { minimize, maximize, async: false };
    for (const term of this.terms) {
      if (term._evaluated) continue;
      term.evaluate(rollOpts);
    }

    const noRoll = !this.roll;
    // Map terms to sizeRoll params
    const sizeDice = noRoll ? pf1.utils.rollPreProcess.sizeRoll(...this.terms.map((r) => r.total)) : null;
    if (sizeDice && this.flavor) sizeDice[0].options.flavor = this.flavor;
    // Generate final roll
    const roll = noRoll ? RollPF.fromTerms(sizeDice) : this.roll;
    // Copy flavor
    if (this.flavor) roll.options.flavor = this.flavor;

    this.roll = roll._evaluated ? roll : roll.evaluate(rollOpts);

    return this;
  }

  async _evaluate({ minimize = false, maximize = false } = {}) {
    const rollOpts = { minimize, maximize, async: true };
    for (const term of this.terms) {
      if (term._evaluated) continue;
      await term.evaluate(rollOpts);
    }

    const noRoll = !this.roll;
    // Map terms to sizeRoll params
    const sizeDice = noRoll ? pf1.utils.rollPreProcess.sizeRoll(...this.terms.map((r) => r.total)) : null;
    if (sizeDice && this.flavor) sizeDice[0].options.flavor = this.flavor;
    // Generate final roll
    const roll = noRoll ? RollPF.fromTerms(sizeDice) : this.roll;
    // Copy flavor
    if (this.flavor) roll.options.flavor = this.flavor;

    this.roll = roll._evaluated ? roll : await roll.evaluate(rollOpts);

    return this;
  }

  /** @inheritDoc */
  toJSON() {
    return {
      ...super.toJSON(),
      roll: this.roll?.toJSON(),
    };
  }
}
