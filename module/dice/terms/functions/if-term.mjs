import { RollPF } from "../../roll.mjs";
import { IfElseTerm } from "./ifelse-term.mjs";

/**
 * RollTerm for if(condition, if-true) function.
 *
 * @inheritdoc
 * @example
 * if(true, 5) // => 5
 * if(3 > 2) // => 1
 * if(1 > 3) // => 0
 */
export class IfTerm extends IfElseTerm {
  constructor({ terms = [], roll, options }) {
    super({ terms, roll, options });

    if (this.terms.length > 2) this.terms = this.terms.slice(0, 2);
  }

  get expression() {
    const terms = [this.terms[0].formula];
    const ifTrue = this.terms[1]?.formula || "1";
    // Omit default behaviour value
    if (ifTrue !== "1") terms.push(ifTrue);

    return `if(${terms.join(", ")})`;
  }

  get isDeterministic() {
    return !this.terms.some((t) => !t.isDeterministic);
  }

  static matchTerm(expression) {
    return expression === "if";
  }
}
