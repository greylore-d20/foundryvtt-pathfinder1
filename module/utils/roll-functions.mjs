/**
 * Returns the result of a roll of die, which changes based on different sizes.
 *
 * Applies size change damage progression as per Paizo's FAQ entry for it.
 *
 * @see https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9t3f
 *
 * @param {number} origCount - The original number of die to roll.
 * @param {number} origSides - The original number of sides per die to roll.
 * @param {string|number} [targetSize="M"] - The target size to change the die to.
 *   Can be a string of values "F", "D", "T", "S", "M", "L", "H", "G" or "C" for the different sizes.
 *   Can also be a number in the range of 0 to 8, where 4 is Medium.
 * @param {string|number} [initialSize="M"] - The initial size of the creature. See targetSize above.
 * @returns {Die[]|NumericTerm[]} The resulting roll.
 */
export function sizeRoll(origCount, origSides, targetSize = "M", initialSize = "M") {
  // Return NaN from invalid input
  if (!Number.isFinite(origCount) || !Number.isFinite(origSides)) {
    return [new foundry.dice.terms.NumericTerm({ number: NaN })];
  }

  const _getSizeIndex = function (size) {
    if (typeof size === "string") return Object.values(pf1.config.sizeChart).indexOf(size.toUpperCase());
    return size;
  };
  targetSize = _getSizeIndex(targetSize);
  initialSize = _getSizeIndex(initialSize);

  // Do no conversion if no size change is occurring
  if (targetSize === initialSize) {
    // Special case for 1d1
    if (origCount === 1 && origSides === 1) return [new foundry.dice.terms.NumericTerm({ number: 1 })];
    return [new foundry.dice.terms.Die({ number: origCount, faces: origSides })];
  }

  // Special rules
  // "If the die type is not referenced on this chart"
  if (origCount > 1) {
    // D10
    if (origSides === 10) {
      if (targetSize < initialSize) {
        initialSize--;
      } else {
        origCount *= 2;
        initialSize++;
      }
      origSides = 8;
    }
    // D4
    else if (origSides === 4) {
      // 2d4=1d8, 3d4=2d6, 4d4=2d8, 5d4=3d6, 6d4=3d8, etc...
      origSides = origCount % 2 == 0 ? 8 : 6;
      origCount = Math.floor((origCount + 1) / 2);
    }
  }

  // D12
  // Each d12 counts as 2d6
  if (origSides === 12) {
    origCount *= 2;
    origSides = 6;
  }

  // Get initial die type
  let currentDie = `${origCount}d${origSides}`;
  const c = pf1.config.sizeDie;

  // "If the exact number of original dice is not found on this chart..."
  if (c.indexOf(currentDie) === -1 && [6, 8].includes(origSides)) {
    // Xd6: "find the next lowest number of d6 on the chart and use that number of d8 as the original damage value"
    let shifted;
    const fc = c.map((d) => d.split("d").map((n) => Number(n)));
    if (origSides === 6) {
      shifted = fc.filter(([c, s]) => c < origCount && s === origSides).at(-1);
    }
    // Xd8: "find the next highest number of d8 on the chart and use that number of d6 as the original damage value"
    else if (origSides === 8) {
      shifted = fc.filter(([c, s]) => c > origCount && s === origSides).at(0);
    } else {
      // Paizo has not provided instructions how to resolve this
    }

    if (shifted) {
      const [count, sides] = shifted;
      // Swap d6 to d8 and vice versa
      const newSides = sides === 6 ? 8 : 6;
      currentDie = `${count}d${newSides}`;
    }
  }

  // Pick an index from the chart
  let index = c.indexOf(currentDie);
  if (index === -1 && currentDie === "1d1") index = 0;
  let formula = currentDie;
  // If found, shift size
  if (index >= 0) {
    const d6Index = c.indexOf("1d6");
    const d8Index = c.indexOf("1d8");
    let sizeOffset = initialSize - targetSize;
    let curSize = initialSize;

    // When decreasing in size (e.g. from medium to small)
    while (sizeOffset > 0) {
      if (curSize <= 4 || index <= d8Index) {
        index--;
        sizeOffset--;
        curSize--;
      } else {
        index -= 2;
        sizeOffset--;
        curSize--;
      }
    }
    // When increasing in size (e.g. from medium to large)
    while (sizeOffset < 0) {
      if (curSize <= 3 || index <= d6Index) {
        index++;
        sizeOffset++;
        curSize++;
      } else {
        index += 2;
        sizeOffset++;
        curSize++;
      }
    }

    index = Math.max(0, Math.min(c.length - 1, index));
    formula = c[index];
  }

  if (index === -1) {
    ui.notifications.warn(game.i18n.format("PF1.Warning.NoSizeDie", { fallback: currentDie, formula }));
  }

  const [number, faces] = formula.split("d").map((n) => parseInt(n));
  if (!faces || (number === 1 && faces === 1)) {
    return [new foundry.dice.terms.NumericTerm({ number })];
  }
  return [new foundry.dice.terms.Die({ number: number, faces: faces })];
}

/**
 * Return reach information for defined size and stature.
 *
 * @param {string|number} [size="M"] PF1.sizeChart key or offset
 * @param {boolean} [reach=false] Reach weapon
 * @param {"tall"|"long"} [stature="tall"] Character stature
 * @returns {NumericTerm[]}
 */
export const sizeReach = function (size = "M", reach = false, stature = "tall") {
  if (typeof size === "number") size = Object.values(pf1.config.sizeChart)[size];
  size = Object.entries(pf1.config.sizeChart).find((o) => o[1] === size)[0];

  return pf1.documents.actor.ActorPF.getReach(size, stature)[reach ? "reach" : "melee"];
};

/**
 * For use with roll formulas.
 *
 * @internal
 * @param {number} count - Number of dice
 * @param {number} sides - Number of sides
 * @param {number|string} target - Target size
 * @param {number|string} initial - Initial size
 * @returns {number}
 */
function sizeRollFn(count, sides, target, initial) {
  /** @type {Die[]|NumericTerm[]} */
  const [rt] = sizeRoll(count, sides, target, initial);

  this.terms.push(rt.formula);

  if (rt instanceof foundry.dice.terms.Die) {
    const roll = Roll.defaultImplementation.fromTerms([rt]);
    roll.options.final = true;
    this.rolls.push(roll);
    return 0; // The roll can not be evaluated here due to lacking eval opts.
  }
  // NumericTerm
  else {
    return rt.number;
  }
}

/**
 * `if-else` roll function
 *
 * ifelse(condition, if-true, if-else)
 *
 * @example
 * ```txt
 * ifelse(@powerAttackPenalty, 4, 0)
 * ```
 *
 * @param {*} condition
 * @param {*} ifTrue
 * @param {*} ifFalse
 * @returns
 */
function ifelse(condition, ifTrue, ifFalse) {
  return condition ? ifTrue : ifFalse;
}

/**
 * `if` roll function
 *
 * Alias for ifelse()
 *
 * @param {*} condition
 * @param {*} ifTrue
 * @returns
 */
function _if(condition, ifTrue) {
  return ifelse(condition, ifTrue, 0);
}

/**
 * `lookup` roll function
 *
 * lookup(condition, fallback, ...results)
 *
 * @example
 * ```txt
 * lookup(1d4, 0, 4, 3, 2, 1)
 * lookup(@cl, 0, 3, 2, 1)
 * ```
 *
 * @param {number} condition
 * @param {number} fallback
 * @param  {...any} results
 * @returns
 */
function lookup(condition, fallback, ...results) {
  // TODO: mark die terms disabled that are not in the end result
  return results[condition - 1] ?? fallback;
}

/**
 * Roll functions
 *
 * @example
 * ```js
 * eq(a,b) // equal (a === b)
 * ne(a,b) // not equal (a !== b)
 * lt(a,b) // less than (a < b)
 * lte(a,b) // less than or equal (a <= b)
 * gt(a,b) // greater than (a > b)
 * gte(a,b) // greater than or equal (a >= b)
 * and(a, b, ...) // all true
 * or(a, b, ...) // some true
 * xor(a, b, ...) // one true
 * not(a) // not (!a)
 * ```
 */
export const functions = {
  sizeRoll: sizeRollFn,
  sizeReach,
  lookup,
  ifelse,
  if: _if,
  eq: (a, b) => (a === b ? 1 : 0),
  ne: (a, b) => (a !== b ? 1 : 0),
  lt: (a, b) => (a < b ? 1 : 0),
  lte: (a, b) => (a <= b ? 1 : 0),
  gt: (a, b) => (a > b ? 1 : 0),
  gte: (a, b) => (a >= b ? 1 : 0),
  and: (...args) => (args.every((a) => !!a) ? 1 : 0),
  or: (...args) => (args.some((a) => !!a) ? 1 : 0),
  xor: (...args) => (args.filter((a) => !!a).length == 1 ? 1 : 0),
  not: (a) => !a,
};
