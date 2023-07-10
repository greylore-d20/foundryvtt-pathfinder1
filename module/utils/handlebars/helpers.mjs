import { convertDistance, calculateRange } from "../lib.mjs";
import { RollPF } from "../../dice/roll.mjs";

/**
 * @internal
 */
export const registerHandlebarsHelpers = function () {
  Handlebars.registerHelper("convertDistance", (value) => (Number.isFinite(value) ? convertDistance(value)[0] : value));
  Handlebars.registerHelper("distanceUnit", (type) => convertDistance(0, type)[1]);

  Handlebars.registerHelper("actionRange", (action, rollData) => {
    if (!action?.hasRange) return null;

    const range = action.data.range.value;
    const rangeType = action.data.range.units;

    if (rangeType == null) return null;

    const [rng, unit] = calculateRange(range, rangeType, rollData);
    return `${rng} ${unit}`;
  });

  /**
   *
   * @param {ItemAction} action
   * @param {object} rollData
   * @param {object} [options]
   */
  function actionDamage(action, rollData, options) {
    if (!action.hasDamage) return null;

    const actor = action.actor,
      item = action.item,
      actorData = actor?.system,
      actionData = action.data,
      combine = options.hash.combine ?? true;

    const parts = [];

    const handleFormula = (formula, change) => {
      try {
        switch (typeof formula) {
          case "string": {
            // Ensure @item.level and similar gets parsed correctly
            const rd = formula.indexOf("@") >= 0 ? change?.parent?.getRollData() ?? rollData : {};
            if (formula != 0) {
              const newformula = pf1.utils.formula.simplify(formula, rd);
              if (newformula != 0) parts.push(newformula);
            }
            break;
          }
          case "number":
            if (formula != 0) parts.push(`${formula}`);
            break;
        }
      } catch (err) {
        console.error(`Formula parsing error with "${formula}"`, err);
        parts.push("NaN");
      }
    };

    const handleParts = (parts) => parts.forEach(({ formula }) => handleFormula(formula));

    // Normal damage parts
    handleParts(actionData.damage.parts);

    const isNatural = action.item.subType === "natural";

    // Include ability score only if the string isn't too long yet
    const dmgAbl = actionData.ability.damage;
    const dmgAblBaseMod = actorData?.abilities[dmgAbl]?.mod ?? 0;
    let dmgMult = actionData.ability.damageMult || 1;
    if (isNatural && !(actionData.naturalAttack?.primaryAttack ?? true)) {
      dmgMult = actionData.naturalAttack?.secondary?.damageMult ?? 0.5;
    }
    const dmgAblMod = Math.floor(dmgAblBaseMod * dmgMult);
    if (dmgAblMod != 0) parts.push(dmgAblMod);

    // Include damage parts that don't happen on crits
    handleParts(actionData.damage.nonCritParts);

    // Include general sources. Item enhancement bonus is among these.
    action.allDamageSources.forEach((s) => handleFormula(s.formula, s));

    if (parts.length === 0) parts.push("NaN"); // Something probably went wrong

    const semiFinal = pf1.utils.formula.compress(parts.join("+"));
    if (semiFinal === "NaN") return semiFinal;
    if (!combine) return semiFinal;
    // Simplification turns 1d12+1d8+6-8+3-2 into 1d12+1d8-1
    const final = pf1.utils.formula.simplify(semiFinal, undefined);
    return pf1.utils.formula.compress(final);
  }

  Handlebars.registerHelper("actionDamage", actionDamage);

  Handlebars.registerHelper("damageTypes", (typeInfo) => {
    foundry.utils.logCompatibilityWarning(`damageTypes HBS helper is deprecated with no replacement.`, {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });
    const rv = [];
    const { custom, values } = typeInfo;
    if (custom) rv.push(custom);
    values.forEach((dtId) => rv.push(game.i18n.localize(pf1.registry.damageTypes.get(dtId)?.name ?? "PF1.Undefined")));
    return rv.join(", ");
  });

  Handlebars.registerHelper("actionAttacks", (action) => {
    foundry.utils.logCompatibilityWarning(`actionAttacks HBS helper is deprecated with no replacement.`, {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
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

  Handlebars.registerHelper("arrayHas", (options) => {
    const array = options.hash["array"];
    const value = options.hash["value"];
    return array.includes(value);
  });

  // Alt numberFormat helper
  Handlebars.registerHelper("numberFormatAlt", (number, { hash } = {}) => {
    const { decimals } = hash;
    if (decimals !== undefined) {
      // Show up to X decimals but don't insist on it
      const mult = Math.pow(10, decimals);
      return Math.floor(number * mult) / mult;
    }
  });
};
