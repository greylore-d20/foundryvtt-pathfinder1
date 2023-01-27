import { RollPF } from "../roll.mjs";

/**
 * RollTerm for sizeRoll() function
 */
export class SizeRollTerm extends RollTerm {
  constructor({ terms = [], roll, options, modifiers = [] }) {
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

    this.modifiers = modifiers;

    if (roll) {
      if (roll instanceof Roll) this.roll = roll;
      else {
        roll.modifiers = modifiers;
        this.roll = Roll.fromData(roll);
      }
    }
  }

  _terms = [];

  terms = [];

  roll = undefined;

  isIntermediate = false;

  static SERIALIZE_ATTRIBUTES = ["terms", "roll", "modifiers"];

  /**
   * Regexp for identifying flavor and modifiers
   */
  static TRAILER_REGEXP = new RegExp(`${DiceTerm.MODIFIERS_REGEXP_STRING}?${DiceTerm.FLAVOR_REGEXP_STRING}?$`);

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
    return `sizeRoll(${this.terms.map((t) => t.formula).join(", ")})${this.modifiers.join("")}`;
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

  _prepareRoll() {
    const noRoll = !this.roll;
    // Map terms to sizeRoll params
    const sizeDice = noRoll ? pf1.utils.rollPreProcess.sizeRoll(...this.terms.map((r) => r.total)) : null;
    if (sizeDice) {
      // Copy flavor to die roll
      if (this.flavor) sizeDice[0].options.flavor = this.flavor;
      // Copy modifiers to die roll
      if (this.modifiers.length) sizeDice[0].modifiers = this.modifiers;
    }
    // Generate final roll
    const roll = noRoll ? RollPF.fromTerms(sizeDice) : this.roll;
    // Copy flavor to roll
    if (this.flavor) roll.options.flavor = this.flavor;

    return roll;
  }

  _evaluateSync({ minimize = false, maximize = false } = {}) {
    const rollOpts = { minimize, maximize, async: false };
    for (const term of this.terms) {
      if (term._evaluated) continue;
      term.evaluate(rollOpts);
    }

    const roll = this._prepareRoll();

    this.roll = roll._evaluated ? roll : roll.evaluate(rollOpts);

    return this;
  }

  async _evaluate({ minimize = false, maximize = false } = {}) {
    const rollOpts = { minimize, maximize, async: true };
    for (const term of this.terms) {
      if (term._evaluated) continue;
      await term.evaluate(rollOpts);
    }

    const roll = this._prepareRoll();

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
