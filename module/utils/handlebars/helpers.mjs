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

    const range = action.range.value;
    const rangeType = action.range.units;

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

  Handlebars.registerHelper("sortedDamageTypes", (/** @type {ChatAttack} */ attack, isCritical) => {
    const typesTotals = {};
    const processTypes = (types, damage, isCustom = false) => {
      for (let type of types) {
        type = type.trim();
        if (!type) continue;
        let value = typesTotals.get(type);
        if (!value) {
          value = { total: 0, type, isCustom };
          typesTotals.set(type, value);
        }
        value.total += damage.total;
      }
    };

    for (const damage of attack.damage.rolls) {
      if (damage.total == 0) continue;
      const typeInfo = damage.options.damageType;
      console.log(typeInfo);
      processTypes(typeInfo.custom?.split(";") ?? [], damage, true);
      processTypes(typeInfo.values ?? [], damage);
    }

    return typesTotals.contents.sort((a, b) => b.total - a.total);
  });

  /**
   * Alt numberFormat helper to provide non-fixed point decimals and pretty fractionals
   *
   * @example
   * ```hbs
   * {{numberFormatAlt 5.52 decimals=1}} -> 5.5
   * {{numberFormatAlt 5.5 fraction=true}} -> 5 1/2
   * ```
   */
  Handlebars.registerHelper("numberFormatAlt", (number, { hash } = {}) => {
    if (hash.fraction) return fractionalToString(number);
    else return pf1.utils.limitPrecision(number, hash.decimals);
  });
};
