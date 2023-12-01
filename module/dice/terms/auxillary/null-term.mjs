export class NullTerm extends RollTerm {
  constructor({ options = {} } = {}) {
    super({ options });
    this._evaluated = true;
  }

  get expression() {
    return null;
  }

  get formula() {
    return "null";
  }

  static matchTerm(expression) {
    return expression === "null";
  }
}
