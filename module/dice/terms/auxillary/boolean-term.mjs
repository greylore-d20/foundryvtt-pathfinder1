export class BooleanTerm extends RollTerm {
  constructor({ term = true, options = {} } = {}) {
    super({ options });
    if (!["true", "false", true, false].includes(term))
      throw new Error(`BooleanTerm can only be "true" or "false", received: ${term}`);
    this.term = term === "true" || term === true;
    this._evaluated = true;
  }

  static SERIALIZE_ATTRIBUTES = ["term"];

  get total() {
    return this.term ? 1 : 0;
  }

  get expression() {
    return this.term;
  }

  get formula() {
    return this.term.toString();
  }

  static matchTerm(expression) {
    return ["true", "false"].includes(expression);
  }
}
