/**
 * Function Term override to support sizeRoll
 */
export class FunctionTermPF extends CONFIG.Dice.termTypes.FunctionTerm {
  /** @override */
  get expression() {
    // Evaluated sizeRoll has extra term to store the roll in
    if (this._evaluated && this.fn === "sizeRoll") {
      const terms = [...this.terms];
      terms.pop(); // Remove the result
      return `sizeRoll(${terms.join(",")})`;
    }
    return super.expression;
  }

  /**
   * Simpler formula expression if possible
   *
   * @remarks - Used mainly by {@link pf1.utils.formula.simplify()}
   * @type {string}
   */
  get simplify() {
    if (this.fn === "sizeRoll") {
      return this.terms.at(-1);
    }
    return this.expression;
  }

  /** @type {string} - Flavor text if any. */
  get flavor() {
    return this.options.flavor || "";
  }

  /** @override */
  get isDeterministic() {
    if (this.fn === "sizeRoll") return false; // sizeRoll is never deterministic
    return super.isDeterministic;
  }

  /** @override */
  _evaluateSync(options = {}) {
    super._evaluateSync(options);
    if (this.fn === "sizeRoll") {
      const result = this.rolls.at(-1);
      result.options.flavor ||= this.flavor;
      result.propagateFlavor(this.flavor);
      result.evaluateSync(options);
      this.result = result.total;
    }
    return this;
  }

  /** @override */
  async _evaluateAsync(options = {}) {
    await super._evaluateAsync(options);
    if (this.fn === "sizeRoll") {
      const result = this.rolls.at(-1);
      result.options.flavor ||= this.flavor;
      result.propagateFlavor(this.flavor);
      await result.evaluate(options);
      this.result = result.total;
    }
    return this;
  }

  /** @override */
  toJSON() {
    const json = super.toJSON();
    json.class = super.constructor.name; // Alias to original function term to allow de-serialization to work
    return json;
  }
}
