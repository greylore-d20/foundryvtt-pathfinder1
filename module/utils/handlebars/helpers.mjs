import { convertDistance, calculateRange } from "../lib.mjs";
import { RollPF } from "../../dice/roll.mjs";

/**
 * @internal
 */
export const registerHandlebarsHelpers = function () {
  Handlebars.registerHelper("convertDistance", (value) => (Number.isFinite(value) ? convertDistance(value)[0] : value));
  Handlebars.registerHelper("distanceUnit", (type) => {
    foundry.utils.logCompatibilityWarning(`distanceUnit HBS helper is deprecated with no replacement.`, {
      since: "PF1 v10",
      until: "PF1 v11",
    });
    const u = convertDistance(0, type)[1];
    return pf1.config.measureUnitsShort[u] || u;
  });

  Handlebars.registerHelper("actionRange", (action, rollData) => {
    if (!action?.hasRange) return null;

    const range = action.data.range.value;
    const rangeType = action.data.range.units;

    if (rangeType == null) return null;

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

  Handlebars.registerHelper("damageTypes", (typeInfo) => {
    foundry.utils.logCompatibilityWarning(`damageTypes HBS helper is deprecated with no replacement.`, {
      since: "PF1 v10",
      until: "PF1 v11",
    });
    const rv = [];
    const { custom, values } = typeInfo;
    if (custom) rv.push(custom);
    values.forEach((dtId) => rv.push(game.i18n.localize(pf1.registry.damageTypes.get(dtId)?.name ?? "PF1.Undefined")));
    return rv.join(", ");
  });

  Handlebars.registerHelper("actionAttacks", (action) => {
    foundry.utils.logCompatibilityWarning(`actionAttacks HBS helper is deprecated with no replacement.`, {
      since: "PF1 v10",
      until: "PF1 v11",
    });

    const attacks = action.getAttacks({ full: true, bonuses: true, conditionals: true }).map((atk) => atk.attackBonus);
    const highest = Math.max(...attacks); // Highest bonus, with assumption the first might not be that.
    return `${attacks.length} (${highest < 0 ? highest : `+${highest}`}${attacks.length > 1 ? "/…" : ""})`;
  });

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
  Handlebars.registerHelper("numberFormatAlt", (number, { hash } = {}) =>
    pf1.utils.limitPrecision(number, hash.decimals)
  );
};
