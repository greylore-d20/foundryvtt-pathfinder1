import { convertDistance, calculateRange, simplifyFormula } from "../lib.js";
import { RollPF } from "../roll.js";

export const registerHandlebarsHelpers = function () {
  /**
   * Render a MCE editor container with an optional toggle button
   */
  Handlebars.registerHelper("roll-editor", function (options) {
    const action = options.data.root.action;
    const item = options.data.root.item;
    const actor = options.data.root.actor;
    let rollData;
    if (action) rollData = action.getRollData();
    if (item && !rollData) rollData = item.getRollData();
    if (actor && !rollData) rollData = actor.getRollData();
    if (!rollData) rollData = {};

    // Create editor
    const target = options.hash["target"];
    if (!target) throw new Error("You must define the name of a target field.");

    // Enrich the content
    const owner = Boolean(options.hash["owner"]);
    const content = TextEditor.enrichHTML(options.hash["content"] || "", {
      secrets: owner,
      documents: true,
      rollData: rollData,
    });

    // Construct the HTML
    const editor = $(`<div class="editor"><div class="editor-content" data-edit="${target}">${content}</div></div>`);

    // Append edit button
    const button = Boolean(options.hash["button"]);
    const editable = Boolean(options.hash["editable"]);
    if (button && editable) editor.append($('<a class="editor-edit"><i class="fas fa-edit"></i></a>'));
    return new Handlebars.SafeString(editor[0].outerHTML);
  });

  Handlebars.registerHelper("convertDistance", (value) => (Number.isFinite(value) ? convertDistance(value)[0] : value));
  Handlebars.registerHelper("distanceUnit", (type) => convertDistance(0, type)[1]);

  Handlebars.registerHelper("itemRange", (item, rollData) => {
    if (!item.document?.firstAction?.hasRange) return null;
    const action = item.document.firstAction;

    const range = action.data.range.value;
    const rangeType = action.data.range.units;

    if (rangeType == null) return null;

    const ft = calculateRange(range, rangeType, rollData);
    if (ft && typeof ft !== "string") {
      const rv = convertDistance(range);
      return `${ft} ${rv[1]}`;
    } else {
      return "" + (ft ?? "");
    }
  });

  /**
   *
   * @param action
   * @param rollData
   * @param options
   */
  function actionDamage(action, rollData, options) {
    if (!action.hasDamage) return null;

    const actor = action.actor,
      item = action.parent,
      actorData = actor?.data.data,
      actionData = action.data;

    const rv = [];

    const handleFormula = (formula, change) => {
      // Ensure @item.level and similar gets parsed correctly
      const rd = change?.parent?.getRollData() ?? rollData;
      const roll = RollPF.safeRoll(formula, rd);
      if (roll.total !== 0) {
        const newformula = simplifyFormula(roll.formula);
        rv.push(newformula);
      }
    };

    const handleParts = (parts) => parts.forEach(([formula, _]) => handleFormula(formula));

    // Normal damage parts
    handleParts(actionData.damage.parts);

    // Include ability score only if the string isn't too long yet
    const dmgAbl = actionData.ability.damage;
    const dmgAblMod = Math.floor((actorData?.abilities[dmgAbl]?.mod ?? 0) * (actionData.ability.damageMult || 1));
    if (dmgAblMod != 0) rv.push(dmgAblMod);

    // Include damage parts that don't happen on crits
    handleParts(actionData.damage.nonCritParts);

    // Include general sources. Item enhancement bonus is among these.
    item.getAllDamageSources(action.id)?.forEach((s) => handleFormula(s.formula, s));

    if (rv.length === 0) rv.push("NaN"); // Something probably went wrong

    return rv
      .join("+")
      .replace(/\s+/g, "") // remove whitespaces
      .replace(/\+-/, "-") // simplify math logic pt.1
      .replace(/--/g, "+") // simplify math logic pt.2
      .replace(/\+\++/, "+"); // simplify math logic pt.3
  }

  Handlebars.registerHelper("actionDamage", actionDamage);

  Handlebars.registerHelper("damageTypes", (typeInfo) => {
    const rv = [];
    const { custom, values } = typeInfo;
    if (custom) rv.push(custom);
    values.forEach((dtId) => rv.push(game.i18n.localize(game.pf1.damageTypes.get(dtId)?.name ?? "PF1.Undefined")));
    return rv.join(", ");
  });

  Handlebars.registerHelper("itemDamage", (item, rollData) => {
    console.warn("{{itemDamage}} handlebars helper is deprecated, use {{actionDamage}} instead");
    const action = item.document?.firstAction;
    return actionDamage(action, rollData);
  });

  Handlebars.registerHelper("itemAttacks", (item) => {
    const attacks = item.document.attackArray;
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
    const noteObjs = actor.getContextNotes(context);
    return actor.formatContextNotes(noteObjs, rollData, { roll: false });
  });

  Handlebars.registerHelper("enrich", (content, options) => {
    const owner = Boolean(options.hash["owner"]);
    const rollData = options.hash["rollData"];
    return new Handlebars.SafeString(TextEditor.enrichHTML(content, { secrets: owner, rollData }));
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
};
