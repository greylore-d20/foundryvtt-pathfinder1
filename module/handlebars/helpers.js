import { convertDistance, calculateRange, simplifyFormula } from "../lib.js";

export const registerHandlebarsHelpers = function () {
  Handlebars.registerHelper("concat", (...args) => {
    return args.slice(0, args.length - 1).join("");
  });

  /**
   * Render a MCE editor container with an optional toggle button
   */
  Handlebars.registerHelper("roll-editor", function (options) {
    const item = options.data.root.item;
    const actor = options.data.root.actor;
    const rollData = item != null ? item.getRollData() : actor != null ? actor.getRollData() : {};

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
    // ItemPF.range is not accessible here and is thus largely duplicated here

    const range = item.data.range.value;
    const rangeType = item.data.range.units;

    if (rangeType == null) return null;

    const ft = calculateRange(range, rangeType, rollData);
    if (ft && typeof ft !== "string") {
      const rv = convertDistance(range);
      return `${ft} ${rv[1]}`;
    } else {
      return "" + (ft ?? "");
    }
  });

  Handlebars.registerHelper("itemDamage", (item, rollData) => {
    if (!item.hasDamage) return null; // It was a mistake to call this

    const actorData = item.document.parentActor.data.data,
      itemData = item.data;

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
    handleParts(itemData.damage.parts);

    // Include ability score only if the string isn't too long yet
    const dmgAbl = itemData.ability.damage;
    const dmgAblMod = Math.floor((actorData.abilities[dmgAbl]?.mod ?? 0) * (itemData.ability.damageMult || 1));
    if (dmgAblMod != 0) rv.push(dmgAblMod);

    // Include damage parts that don't happen on crits
    handleParts(itemData.damage.nonCritParts);

    // Include general sources. Item enhancement bonus is among these.
    item.document.allDamageSources?.forEach((s) => handleFormula(s.formula, s));

    if (rv.length === 0) rv.push("NaN"); // Something probably went wrong

    return rv
      .join("+")
      .replace(/\s+/g, "") // remove whitespaces
      .replace(/\+-/, "-") // simplify math logic pt.1
      .replace(/--/g, "+") // simplify math logic pt.2
      .replace(/\+\++/, "+"); // simplify math logic pt.3
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
    return item.data.conditionals.find((c) => !c.default);
  });

  // Fetches ability mod value based on ability key.
  // Avoids contaminating rollData or item data with excess strings.
  Handlebars.registerHelper("abilityMod", (abl, rollData, multiplier) => {
    return Math.floor(rollData.abilities[abl]?.mod * multiplier ?? 1);
  });

  // Shorten string with ellipsis
  // Favor cutting off near specific symbol within margin of error
  Handlebars.registerHelper("ellipsis", (value, desiredLength, searchStartOffset = -4, searchEndOffset = 2) => {
    const delimiters = /(\s|\+|,)/g;
    // Process only if it's too long
    if (value?.length > desiredLength + searchEndOffset) {
      let cut = 0;

      const end = Math.min(value.length - 1, desiredLength + searchEndOffset),
        start = Math.max(0, desiredLength + searchStartOffset);

      // Find nice cutting position
      for (let i = end; i > start; i--) {
        if (value[i].match(delimiters)?.length > 0) {
          cut = i + 1;
          break;
        }
      }
      if (cut == 0) cut = desiredLength; // No better position found, just cut it.

      return value.substring(0, cut) + "…";
    }
    return value;
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
};
