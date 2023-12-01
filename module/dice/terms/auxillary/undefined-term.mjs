export class UndefinedTerm extends RollTerm {
  constructor({ options = {} } = {}) {
    super({ options });
    this._evaluated = true;
  }

  get expression() {
    return undefined;
  }

  get formula() {
    return "undefined";
  }

  static matchTerm(expression) {
    return expression === "undefined";
  }
}
