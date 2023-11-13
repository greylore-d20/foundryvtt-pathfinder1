/**
 * Returns the result of a roll of die, which changes based on different sizes.
 *
 * @param {number} origCount - The original number of die to roll.
 * @param {number} origSides - The original number of sides per die to roll.
 * @param {string|number} [targetSize="M"] - The target size to change the die to.
 *   Can be a string of values "F", "D", "T", "S", "M", "L", "H", "G" or "C" for the different sizes.
 *   Can also be a number in the range of 0 to 8, where 4 is Medium.
 * @param {string|number} [initialSize="M"] - The initial size of the creature. See targetSize above.
 * @returns {number} The result of the new roll.
 */
export const sizeRoll = function (origCount, origSides, targetSize = "M", initialSize = "M") {
  const _getSizeIndex = function (size) {
    if (typeof size === "string") return Object.values(pf1.config.sizeChart).indexOf(size.toUpperCase());
    return size;
  };
  targetSize = _getSizeIndex(targetSize);
  initialSize = _getSizeIndex(initialSize);
  let skipWarning = false;

  // D10 special rule: https://paizo.com/paizo/faq/v5748nruor1fm#v5748eaic9t3f
  if (origCount > 1 && origSides === 10 && (origCount % 2 === 0 || origCount === 3)) {
    skipWarning = true;
    const d10Arr = [
      { orig: [2, 10], larger: [4, 8], smaller: [2, 8] },
      { orig: [3, 10], larger: [6, 8], smaller: [3, 8] },
      { orig: [4, 10], larger: [8, 8], smaller: [4, 8] },
      { orig: [6, 10], larger: [12, 8], smaller: [6, 8] },
      { orig: [8, 10], larger: [16, 8], smaller: [8, 8] },
    ];
    for (const v of d10Arr) {
      if (v.orig[0] === origCount && v.orig[1] === origSides) {
        if (targetSize < initialSize) {
          initialSize--;
          origCount = v.smaller[0];
          origSides = v.smaller[1];
        } else if (targetSize > initialSize) {
          initialSize++;
          origCount = v.larger[0];
          origSides = v.larger[1];
        }
      }
    }
  }

  // Get initial die type
  const mediumDie = `${origCount}d${origSides}`;
  const mediumDieMax = origCount * origSides;
  let c = duplicate(pf1.config.sizeDie);
  {
    if (c.indexOf(mediumDie) === -1) {
      c = c.map((d) => {
        if (d.match(/^([0-9]+)d([0-9]+)$/)) {
          const dieCount = parseInt(RegExp.$1);
          const dieSides = parseInt(RegExp.$2);
          const dieMaxValue = dieCount * dieSides;

          if (dieMaxValue === mediumDieMax) return mediumDie;
        }

        return d;
      });
    }
  }

  // Pick an index from the chart
  let index = c.indexOf(mediumDie),
    formula = mediumDie;
  if (index >= 0) {
    const d6Index = c.indexOf("1d6");
    let d8Index = c.indexOf("1d8");
    if (d8Index === -1) d8Index = c.indexOf("2d4");
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

    index = Math.clamped(index, 0, c.length - 1);
    formula = c[index];
  }

  if (index === -1 && !skipWarning) {
    ui.notifications.warn(game.i18n.localize("PF1.WarningNoSizeDie", { baseline: mediumDie, fallback: formula }));
  }

  const result = formula.split("d");
  if (result.length === 1) {
    return [new NumericTerm({ number: parseInt(result[0]) })];
  }
  return [new Die({ number: parseInt(result[0]), faces: parseInt(result[1]) })];
};

export const sizeReach = function (size = "M", reach = false, stature = "tall") {
  if (typeof size === "number") size = Object.values(pf1.config.sizeChart)[size];
  size = Object.entries(pf1.config.sizeChart).find((o) => o[1] === size)[0];

  return [
    new NumericTerm({
      number: pf1.documents.actor.ActorPF.getReach(size, stature)[reach ? "reach" : "melee"],
    }),
  ];
};
