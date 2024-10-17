/**
 * @internal
 * @typedef {RollTerm|FormulaPart} AnyTerm
 */

/**
 * Removes flairs from a formula.
 *
 * @param {string} formula Formula
 * @returns {string} Stripped formula
 */
export const unflair = (formula) => formula.replace(/\[[^\]]*]/g, "");

/**
 * Compress basic math and space in produced formula.
 *
 * @param {string} formula - Formula to compress
 * @returns {string} - Compressed formula
 */
export const compress = (formula) =>
  formula
    .replace(/\s+/g, "") // remove whitespaces
    .replace(/\+-/g, "-") // + -n = -n
    .replace(/--/g, "+") // - -n = +n
    .replace(/-\+/g, "-") // - +n = -n
    .replace(/\+\++/g, "+"); // + +n = +n

/**
 * @param {AnyTerm} t
 * @returns {boolean}
 */
const isSimpleTerm = (t) => t instanceof foundry.dice.terms.NumericTerm || t?.simple || false;

class FormulaPart {
  /** @type {AnyChunk[]} */
  terms = [];
  simple = false;

  constructor(terms = [], simple = false, evaluate = true) {
    this.terms = terms.filter((t) => !!t);
    this.simple = simple;

    if (evaluate) this.evaluate();
  }

  get isDeterministic() {
    return this.terms.every((t) => t.isDeterministic);
  }

  #formula;
  get formula() {
    if (this.#formula) return this.#formula;

    const f = this.terms
      .map((t) => {
        if (t instanceof foundry.dice.terms.FunctionTerm) return `${t.simplify || t.expression}`;
        else if (t.isDeterministic) return `${t.total}`;
        // Dice eat up prefix parentheticals in v12
        else if (
          t instanceof foundry.dice.terms.Die &&
          t._number instanceof Roll &&
          t._number.terms.length == 1 &&
          t._number.terms[0] instanceof foundry.dice.terms.ParentheticalTerm
        ) {
          // Simplify prefix parenthetical part of (X)dY
          const formula = t._number.terms[0].roll.formula;
          const iformula = simplify(formula);
          t._number = new Roll.defaultImplementation(iformula).evaluateSync({ maximize: true });
          return t.formula;
        } else {
          return t.formula;
        }
      })
      .join("");

    const roll = new Roll.defaultImplementation(f);
    if (roll.isDeterministic) this.#formula = roll.evaluateSync({ minimize: true }).total.toString();
    else this.#formula = f;

    return this.#formula;
  }

  _total = null;

  evaluate() {
    const roll = new Roll.defaultImplementation(this.formula).evaluateSync({ minimize: true });
    this._total = roll.total;
  }

  get total() {
    if (this._total === null) {
      console.error("Must be evaluated first!", this);
      throw new Error("Must be evaluated first!");
    }
    return this._total;
  }
}

/**
 * Combine ["-", term] into single {@link FormulaPart}
 *
 * @param {AnyTerm[]} terms
 */
function negativeTerms(terms) {
  const nterms = [];
  while (terms.length) {
    const term = terms.shift();
    if (term instanceof foundry.dice.terms.OperatorTerm && term.operator === "-") {
      // Add preceding + if operators are fully consumed
      if (!(nterms.at(-1) instanceof foundry.dice.terms.OperatorTerm)) {
        const nt = new foundry.dice.terms.OperatorTerm({ operator: "+" });
        nt._evaluated = true;
        nterms.push(nt);
      }
      nterms.push(new FormulaPart([term, terms.shift()], true));
    } else nterms.push(term);
  }
  return nterms;
}

/**
 *
 * @param {AnyTerm[]} terms
 */
function stringTerms(terms) {
  const nterms = [];
  while (terms.length) {
    const term = terms.shift();
    if (term instanceof foundry.dice.terms.StringTerm) {
      // Partial dice terms combine left
      if (/^d\d/.test(term.expression)) {
        nterms.push(new FormulaPart([nterms.pop(), term]));
      }
      // Rest combine right
      else {
        nterms.push(new FormulaPart([term, terms.shift()]));
      }
    } else nterms.push(term);
  }
  return nterms;
}

/**
 * Combine [term, operator, term] cases into singular {@link FormulaPart}
 *
 * @param {AnyTerm[]} terms - Terms to combine
 * @param {string[]} operators - Operators to look for
 * @param {boolean} simpleOnly - Only combine simple terms
 * @returns {AnyTerm[]} - Product
 */
function triTermOps(terms, operators, simpleOnly = false) {
  const eterms = [];
  while (terms.length) {
    const term = terms.shift();
    if (term instanceof foundry.dice.terms.OperatorTerm && operators.includes(term.operator)) {
      // Only combine simple terms
      if (simpleOnly && !(isSimpleTerm(eterms.at(-1)) && isSimpleTerm(terms[0]))) {
        // Fall through
      }
      // Combine all
      else {
        const left = eterms.pop(),
          right = terms.shift();
        eterms.push(new FormulaPart([left, term, right], isSimpleTerm(left) && isSimpleTerm(right)));
        continue;
      }
    }
    eterms.push(term);
  }

  return eterms;
}

/**
 * Ternary wrapper
 */
class TernaryTerm {
  /** @type {RollTerm|FormulaPart}  */
  condition;
  /** @type {RollTerm|FormulaPart}  */
  ifTrue;
  /** @type {RollTerm|FormulaPart}  */
  ifFalse;

  constructor(condition, ifTrue, ifFalse) {
    if (!(condition instanceof FormulaPart))
      condition = new FormulaPart(Array.isArray(condition) ? condition : [condition]);
    this.condition = condition;

    if (!(ifTrue instanceof FormulaPart)) ifTrue = new FormulaPart(Array.isArray(ifTrue) ? ifTrue : [ifTrue]);
    this.ifTrue = ifTrue;

    if (!(ifFalse instanceof FormulaPart)) ifFalse = new FormulaPart(Array.isArray(ifFalse) ? ifFalse : [ifFalse]);
    this.ifFalse = ifFalse;
  }

  get isDeterministic() {
    return Roll.create(this.formula).isDeterministic;
  }

  get formula() {
    if (this.condition.isDeterministic) {
      this.condition.evaluateSync({ minimize: true });
      if (this.condition.total) {
        return this.ifTrue.formula;
      } else {
        return this.ifFalse.formula;
      }
    } else return [this.condition.formula, "?", this.ifTrue.formula, ":", this.ifFalse.formula].join(" ");
  }

  get total() {
    throw new Error("TernaryTerm.total called");
  }
}

/**
 * Simplifies formula to very basic level.
 *
 * @param {string} formula - Formula
 * @param {object} [rollData={}] - Roll data
 * @param {object} [options] - Additional options
 * @param {boolean} [options.strict] - Attempt to return something even slightly valid even with bad formulas
 * @returns {string} - Simpler formula
 * @throws {Error} - On invalid formula
 */
export function simplify(formula, rollData = {}, { strict = true } = {}) {
  formula = compress(Roll.replaceFormulaData(unflair(formula), rollData, { missing: 0 }));

  // Produce nicer formula
  formula = Roll.defaultImplementation
    .parse(formula)
    .map((t) => {
      if (t instanceof foundry.dice.terms.ParentheticalTerm) {
        if (t.isDeterministic) {
          // Parenthetical term doesn't have separate evaluate calls yet
          t.evaluate({ minimize: true });
          const v = t.total;
          return `${v}`;
        } else {
          const iformula = simplify(t.roll.formula);
          const isSingleTerm = Roll.defaultImplementation.parse(iformula).length === 1;
          if (isSingleTerm) return iformula;
          else return `(${iformula})`;
        }
      }
      return t.formula;
    })
    .join("");

  const roll = new Roll.defaultImplementation(formula);

  // Evaluate
  try {
    roll.evaluateSync({ minimize: true });
  } catch (err) {
    if (strict) throw err;
    else return compress(formula);
  }
  // Old evaluation, fails with parenthetical terms followed by d6 or the like
  //terms.forEach((term) => term.evaluateSync({ minimize: true }));
  let terms = roll.terms;

  // Negatives (combine - with the following term)
  terms = negativeTerms(terms);

  // PEMDAS
  // Foundry doesn't support juxtaposition so it's not handled here

  // Exponents
  terms = triTermOps(terms, ["**"]);
  // Multiply/Divide
  terms = triTermOps(terms, ["/", "*"]);
  // Conditionals
  terms = triTermOps(terms, ["==", "===", ">", ">=", "<", "<=", "!=", "!=="]);
  // Plus/Minus
  terms = triTermOps(terms, ["+", "-"], true);
  // String terms
  terms = stringTerms(terms);

  // Make final pass
  const final = new FormulaPart(terms, undefined, false);

  return final.formula.replace(/ \+ 0\b/g, "");
}

/**
 * Get action's damage formula.
 *
 * @internal
 * @param {ItemAction} action
 * @param {object} [options] - Additional options
 * @param {boolean} [options.simplify] - Simplify and compress the resulting formula before returning.
 * @param {boolean} [options.strict] - Strict option to pass to {@link pf1.utils.formula.simplify simplify}.
 * @returns {string}
 */
export function actionDamage(action, { simplify = true, strict = true } = {}) {
  const actor = action.actor,
    item = action.item,
    actorData = actor?.system,
    actionData = action.data;

  const parts = [];

  const lazy = {
    _rollData: null,
    get rollData() {
      this._rollData ??= action.getRollData();
      return this._rollData;
    },
  };

  const handleFormula = (formula, change) => {
    try {
      switch (typeof formula) {
        case "string": {
          // Ensure @item.level and similar gets parsed correctly
          const rd = formula.indexOf("@") >= 0 ? change?.parent?.getRollData() ?? lazy.rollData : {};
          if (formula != 0) {
            const newformula = pf1.utils.formula.simplify(formula, rd, { strict });
            if (newformula != 0) parts.push(newformula);
          }
          break;
        }
        case "number":
          if (formula != 0) parts.push(`${formula}`);
          break;
      }
    } catch (err) {
      console.error(`Action damage formula parsing error with "${formula}"`, err, action);
      parts.push("NaN");
    }
  };

  const handleParts = (parts) => parts.forEach(({ formula }) => handleFormula(formula));

  // Normal damage parts
  handleParts(actionData.damage.parts);

  const isNatural = action.item.subType === "natural";

  // Include ability score only if the string isn't too long yet
  const dmgAbl = actionData.ability.damage;
  if (dmgAbl) {
    const ablMax = actionData.ability?.max ?? Infinity;
    const dmgAblBaseMod = Math.min(actorData?.abilities[dmgAbl]?.mod ?? 0, ablMax);
    const held = action.data?.held || item?.system.held || "normal";
    let ablDmgMult =
      actionData.ability.damageMult ?? (isNatural ? null : pf1.config.abilityDamageHeldMultipliers[held]) ?? 1;
    if (isNatural && !(actionData.naturalAttack?.primaryAttack ?? true)) {
      ablDmgMult = actionData.naturalAttack?.secondary?.damageMult ?? 0.5;
    }

    const dmgAblMod = dmgAblBaseMod >= 0 ? Math.floor(dmgAblBaseMod * ablDmgMult) : dmgAblBaseMod;
    if (dmgAblMod != 0) parts.push(dmgAblMod);
  }

  // Include damage parts that don't happen on crits
  handleParts(actionData.damage.nonCritParts);

  // Include general sources. Item enhancement bonus is among these.
  action.allDamageSources.forEach((s) => handleFormula(s.formula, s));

  // Something probably went wrong
  // Early exit from invalid formulas
  if (parts.length === 0 || parts.some((p) => p === "NaN")) {
    console.warn("Action damage resulted in invalid formula:", parts.join(" + "), action);
    return "NaN";
  }

  const semiFinal = pf1.utils.formula.compress(parts.join("+"));
  if (!simplify) return semiFinal;

  // Simplification turns 1d12+1d8+6-8+3-2 into 1d12+1d8-1
  try {
    const rollData = semiFinal.indexOf("@") >= 0 ? lazy.rollData : undefined;
    const final = pf1.utils.formula.simplify(semiFinal, rollData, { strict });
    return pf1.utils.formula.compress(final);
  } catch (err) {
    console.error("Invalid action damage formula:", parts.join(" + "), action, err);
    return "NaN";
  }
}
