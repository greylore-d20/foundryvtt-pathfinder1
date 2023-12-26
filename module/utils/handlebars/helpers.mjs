import { convertDistance, calculateRange } from "../lib.mjs";
import { RollPF } from "../../dice/roll.mjs";

export const registerHandlebarsHelpers = function () {
  Handlebars.registerHelper("convertDistance", (value) => (Number.isFinite(value) ? convertDistance(value)[0] : value));
  Handlebars.registerHelper("distanceUnit", (type) => convertDistance(0, type)[1]);

  Handlebars.registerHelper("itemRange", (item, rollData) => {
    foundry.utils.logCompatibilityWarning("{{itemRange}} helper is deprecated, please use {{actionRange}} instead.", {
      since: "PF1 v9",
      until: "PF1 v10",
    });

    if (!item.document?.firstAction?.hasRange) return null;
    const action = item.document.firstAction;

    const range = action.data.range.value;
    const rangeType = action.data.range.units;

    if (rangeType == null) return null;

    const [rng, unit] = calculateRange(range, rangeType, rollData);
    return `${rng} ${unit}`;
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

    // Include ability score only if the string isn't too long yet
    const dmgAbl = actionData.ability.damage;
    const dmgAblMod = Math.floor((actorData?.abilities[dmgAbl]?.mod ?? 0) * (actionData.ability.damageMult || 1));
    if (dmgAblMod != 0) parts.push(dmgAblMod);

    // Include damage parts that don't happen on crits
    handleParts(actionData.damage.nonCritParts);

    // Include general sources. Item enhancement bonus is among these.
    action.allDamageSources.forEach((s) => {
      if (s.operator === "script") return;
      handleFormula(s.formula, s);
    });

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
    const rv = [];
    const { custom, values } = typeInfo;
    if (custom) rv.push(custom);
    values.forEach((dtId) => rv.push(game.i18n.localize(pf1.registry.damageTypes.get(dtId)?.name ?? "PF1.Undefined")));
    return rv.join(", ");
  });

  Handlebars.registerHelper("itemDamage", (item, rollData) => {
    console.warn("{{itemDamage}} handlebars helper is deprecated, use {{actionDamage}} instead");
    const action = item.document?.firstAction;
    return actionDamage(action, rollData);
  });

  Handlebars.registerHelper("itemAttacks", (item) => {
    foundry.utils.logCompatibilityWarning(
      "{{itemAttacks}} helper is deprecated, please use {{actionAttacks}} instead.",
      {
        since: "PF1 v9",
        until: "PF1 v10",
      }
    );

    const attacks = item.document.attackArray;
    const highest = Math.max(...attacks); // Highest bonus, with assumption the first might not be that.
    return `${attacks.length} (${highest < 0 ? highest : `+${highest}`}${attacks.length > 1 ? "/…" : ""})`;
  });

  Handlebars.registerHelper("actionAttacks", (action) => {
    const attacks = action.item.getAttackArray(action.id);
    const highest = Math.max(...attacks); // Highest bonus, with assumption the first might not be that.
    return `${attacks.length} (${highest < 0 ? highest : `+${highest}`}${attacks.length > 1 ? "/…" : ""})`;
  });

  /**
   * Returns true if there are conditionals disabled by default.
   */
  Handlebars.registerHelper("optionalConditionals", (item) => {
    return item.firstAction?.data.conditionals.find((c) => !c.default);
  });

  // Fetches ability mod value based on ability key.
  // Avoids contaminating rollData or item data with excess strings.
  Handlebars.registerHelper("abilityMod", (abl, rollData, multiplier) => {
    return Math.floor(rollData.abilities[abl]?.mod * multiplier ?? 1);
  });

  Handlebars.registerHelper("hasContextNotes", (actor, context) => {
    return !!actor.getContextNotes(context).find((n) => n.notes.length);
  });

  Handlebars.registerHelper("contextNotes", (actor, context, options) => {
    const rollData = options.data.root.rollData;
    const roll = options.hash["roll"] ?? false;
    const noteObjs = actor.getContextNotes(context);
    return actor.formatContextNotes(noteObjs, rollData, { roll });
  });

  Handlebars.registerHelper("enrich", (content, options) => {
    const owner = Boolean(options.hash["owner"]);
    const rollData = options.hash["rollData"];
    return new Handlebars.SafeString(TextEditor.enrichHTML(content, { secrets: owner, rollData, async: false }));
  });

  Handlebars.registerHelper("json-string", (obj) => {
    return new Handlebars.SafeString(escape(JSON.stringify(obj)));
  });

  Handlebars.registerHelper("halfNumber", (value) => {
    value = typeof value === "number" ? value : parseFloat(value);
    return new Handlebars.SafeString(Math.floor(value / 2).toString());
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
