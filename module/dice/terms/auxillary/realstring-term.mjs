/**
 * Actual string to be passed to functions.
 *
 * Meant to remain a string instead of being parsed more by Foundry.
 */
export class RealStringTerm extends StringTerm {
  constructor({ term = null, options = {} } = {}) {
    super({ options });
    this.term = /^(\\?["'])(?<str>.*)\1$/.exec(term)?.groups.str ?? term;
    if (typeof this.term !== "string") throw new Error(`RealStringTerm can only accept strings, received: "${term}"`);
    this._evaluated = true;
  }

  static SERIALIZE_ATTRIBUTES = ["term"];

  /**
   * False expression to allow Roll.validate() passing when it includes this terms.
   */
  get expression() {
    return this.term;
  }

  get formula() {
    return `"${this.term}"`;
  }

  static matchTerm(expression) {
    return /^(\\?["']).*\1$/.test(expression);
  }
}
