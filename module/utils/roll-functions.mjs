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
 * @returns {Die[]|NumericTerm[]} The resulting die roll.
 */
export function sizeRoll(origCount, origSides, targetSize = "M", initialSize = "M") {
  // Return NaN from invalid input
  if (!Number.isFinite(origCount) || !Number.isFinite(origSides)) {
    return [new NumericTerm({ number: NaN })];
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
    if (origCount === 1 && origSides === 1) return [new NumericTerm({ number: 1 })];
    return [new Die({ number: origCount, faces: origSides })];
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
    ui.notifications.warn(game.i18n.format("PF1.WarningNoSizeDie", { fallback: currentDie, formula }));
  }

  const [number, faces] = formula.split("d").map((n) => parseInt(n));
  if (!faces || (number === 1 && faces === 1)) return [new NumericTerm({ number: number })];
  return [new Die({ number: number, faces: faces })];
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

  return [
    new NumericTerm({
      number: pf1.documents.actor.ActorPF.getReach(size, stature)[reach ? "reach" : "melee"],
    }),
  ];
};
