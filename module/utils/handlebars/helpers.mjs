import { convertDistance, calculateRange, fractionalToString } from "@utils";

/**
 * @internal
 */
export const registerHandlebarsHelpers = function () {
  Handlebars.registerHelper("convertDistance", (value, type) =>
    Number.isFinite(value) ? convertDistance(value, typeof type === "string" ? type : undefined)[0] : value
  );

  Handlebars.registerHelper("actionRange", (action, rollData) => {
    if (!action?.hasRange) return null;

    const range = action.data.range.value;
    const rangeType = action.data.range.units;

    if (!rangeType) return null;
    if (rangeType === "spec") return null; // Special is its own thing

    const [rng, unit] = calculateRange(range, rangeType, rollData);
    return `${rng} ${unit}`;
  });

  /**
   * @param {ItemAction} action
   * @param {object} [_rollData] - Deprecated
   * @param {object} [options]
   */
  function actionDamage(action, _rollData, options) {
    if (!action.hasDamage) return null;
    return pf1.utils.formula.actionDamage(action, { simplify: options?.hash?.combine ?? true });
  }

  Handlebars.registerHelper("actionDamage", actionDamage);

  /**
   * Fetches ability mod value based on ability key.
   * Avoids contaminating rollData or item data with excess strings.
   *
   * @deprecated Remove for v10
   */
  Handlebars.registerHelper("abilityMod", (abl, rollData, multiplier) => {
    return Math.floor(rollData.abilities[abl]?.mod * multiplier ?? 1);
  });

  Handlebars.registerHelper("json-string", (obj) => {
    return new Handlebars.SafeString(escape(JSON.stringify(obj)));
  });

  // Alt numberFormat helper
  Handlebars.registerHelper("numberFormatAlt", (number, { hash } = {}) => {
    if (hash.fraction) return fractionalToString(number);
    else return pf1.utils.limitPrecision(number, hash.decimals);
  });

  Handlebars.registerHelper("isNumber", (number) => {
    return Number.isFinite(number);
  });
};
