import { RollPF } from "../../roll.mjs";

/**
 * Base term to identify function terms.
 */
export class FunctionTerm extends RollTerm {
  constructor({ terms = [], options = {}, maxArgs } = {}) {
    super({ options });

    this.terms = terms.map((t) => {
      if (t instanceof RollTerm) return t;
      if (t.class) return RollTerm.fromData(t);
      return t;
    });

    // Cap arguments
    if (maxArgs > 0 && this.terms.length > maxArgs) this.terms = this.terms.slice(0, maxArgs);
  }

  isIntermediate = false;

  /**
   * Function parameters
   *
   * @type {RollTerm[]}
   */
  terms = [];

  static parseArgs(args) {
    return args.map((t) => {
      if (t instanceof RollTerm) return t;

      const ts = RollPF.parse(t);
      if (ts.length > 1) return ParentheticalTerm.fromTerms(ts);
      else return ts[0];
    });
  }

  static SERIALIZE_ATTRIBUTES = ["terms"];

  /**
   * Determine if the string term expression is identifier for this function.
   *
   * @param {string} expression String identifier from StringTerm.term
   * @returns {boolean}
   */
  static matchTerm(expression) {
    return false;
  }

  /**
   * @type {string} - Simpler formula representation of the result if possible.
   */
  get simplify() {
    return this.formula;
  }

  /**
   * @type {true} Simple method of checking this is a FunctionTerm
   */
  static get isFunction() {
    return true;
  }
}
