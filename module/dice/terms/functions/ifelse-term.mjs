import { RollPF } from "../../roll.mjs";
import { FunctionTerm } from "../base/function-term.mjs";

/**
 * RollTerm for ifelse(condition, if-true, if-false) function.
 *
 * Defaults:
 * - True: 1
 * - False: 0
 *
 * @example
 * ifelse(true) // => 1
 * ifelse(3 > 6, 100, 5) // => 5
 * ifelse(@boo == 2, 10) // => 0
 */
export class IfElseTerm extends FunctionTerm {
  constructor({ terms = [], options }) {
    super({ options });

    // Help fromData functionality to get things right
    if (terms) {
      if (terms[0] instanceof RollTerm) this.terms = terms;
      else if (typeof terms[0] === "string") {
        this.terms = terms.reduce((all, t) => {
          if (!t) {
            all.push(t);
            return all;
          }
          const ts = Roll.parse(t);
          if (ts.length > 1) all.push(ParentheticalTerm.fromTerms(ts));
          else all.push(ts[0]);
          return all;
        }, []);
      } else {
        try {
          this.terms = terms.map((t) => (t ? RollTerm.fromData(t) : null));
        } catch (err) {
          console.error({ terms }, err);
        }
      }
    }

    // Scrap excess arguments
    if (this.terms.length > 3) this.terms = this.terms.slice(0, 3);
  }

  terms = [];

  isIntermediate = false;

  static SERIALIZE_ATTRIBUTES = ["terms"];
  static MODIFIERS = {};

  get total() {
    const [condition, ifTrue, ifFalse] = this.terms;
    const state = !!condition.total;
    const term = state ? ifTrue : ifFalse;
    if (term) return term.total;
    return state ? 1 : 0;
  }

  /**
   * @type {Die[]}
   */
  get dice() {
    return this.terms.reduce((dice, t) => {
      if (t instanceof DiceTerm) dice.push(t);
      else if (t instanceof PoolTerm) dice = dice.concat(t.dice);
      return dice;
    }, []);
  }

  /**
   * @type {string}
   */
  get expression() {
    const terms = [this.terms[0].formula, this.terms[1]?.formula || "1", this.terms[2]?.formula || "0"];
    // Omit default behaviour values
    if (terms[2] === "0") {
      terms.pop();
      if (terms[1] === "1") terms.pop();
    }
    return `ifelse(${terms.join(", ")})`;
  }

  get isDeterministic() {
    return !this.terms.some((t) => !t.isDeterministic);
  }

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

    const [condition, ifTrue, ifFalse] = this.terms;

    const state = !!condition.total;
    const term = (state ? ifTrue : ifFalse) ?? new NumericTerm({ number: state ? 1 : 0 });

    // Copy flavor to active term
    if (this.flavor) term.options.flavor = this.flavor;

    // Omit unmatched result from stored data
    this.terms = [condition, state ? ifTrue : null, state ? null : ifFalse];

    return this;
  }

  async _evaluate({ minimize = false, maximize = false } = {}) {
    return this._evaluateSync({ minimize, maximize });
  }

  static matchTerm(expression) {
    return expression === "ifelse";
  }
}
