import { convertDistance } from "../lib.js";

export const registerHandlebarsHelpers = function () {
  Handlebars.registerHelper("concat", (a, b) => {
    if (typeof a === "number") a = a.toString();
    if (typeof b === "number") b = b.toString();
    return a + b;
  });

  /**
   * Render a MCE editor container with an optional toggle button
   */
  Handlebars.registerHelper("roll-editor", function (options) {
    const item = getProperty(options, "data.root.item");
    const actor = getProperty(options, "data.root.actor");
    const rollData = item != null ? item.getRollData() : actor != null ? actor.getRollData() : {};

    // Create editor
    const target = options.hash["target"];
    if (!target) throw new Error("You must define the name of a target field.");

    // Enrich the content
    const owner = Boolean(options.hash["owner"]);
    const content = TextEditor.enrichHTML(options.hash["content"] || "", {
      secrets: owner,
      entities: true,
      rollData: rollData,
    });

    // Construct the HTML
    let editor = $(`<div class="editor"><div class="editor-content" data-edit="${target}">${content}</div></div>`);

    // Append edit button
    const button = Boolean(options.hash["button"]);
    const editable = Boolean(options.hash["editable"]);
    if (button && editable) editor.append($('<a class="editor-edit"><i class="fas fa-edit"></i></a>'));
    return new Handlebars.SafeString(editor[0].outerHTML);
  });

  Handlebars.registerHelper("convertDistance", (value) => (Number.isFinite(value) ? convertDistance(value)[0] : value));

  Handlebars.registerHelper("itemRange", (item, rollData) => {
    // ItemPF.range is not accessible here and is thus largely duplicated here

    let range = getProperty(item, "data.range.value");
    const rangeType = getProperty(item, "data.range.units");

    if (rangeType == null) return null;

    const toFeet = () => {
      let feet;
      switch (rangeType) {
        case "melee":
        case "touch":
          return getProperty(rollData, "range.melee") || 0;
        case "reach":
          return getProperty(rollData, "range.reach") || 0;
        case "close":
          feet = RollPF.safeRoll("25 + floor(@cl / 2) * 5", rollData);
          break;
        case "medium":
          feet = RollPF.safeRoll("100 + @cl * 10", rollData);
          break;
        case "long":
          feet = RollPF.safeRoll("400 + @cl * 40", rollData);
          break;
        case "mi":
          return range * 5280; // TODO: Should remain as miles for shortness
        case "ft":
          feet = RollPF.safeRoll(range, rollData);
          break;
        default:
          return range;
      }
      if (feet.err) {
        console.log(feet.err, item);
        return "[x]";
      }
      return feet.total;
    };

    const ft = toFeet();
    if (ft && typeof ft !== "string") {
      const rv = convertDistance(ft);
      return `${rv[0]} ${rv[1]}`;
    } else {
      return "" + (ft ?? "");
    }
  });

  Handlebars.registerHelper("itemDamage", (item, rollData) => {
    if (!item.hasDamage) return null; // It was a mistake to call this

    const actorData = item.document.parentActor.data.data,
      itemData = item.data;

    const rv = [];

    const reduceFormula = (formula) => {
      const roll = RollPF.safeRoll(formula, rollData);
      formula = roll.formula.replace(/\[[^\]]+\]/g, ""); // remove flairs
      return [roll, formula];
    };

    const handleParts = (parts) => {
      for (let [formula, _] of parts) {
        const [roll, newformula] = reduceFormula(formula);
        if (roll.total == 0) continue;
        rv.push(newformula);
      }
    };

    // Normal damage parts
    handleParts(itemData.damage.parts);

    // Include ability score only if the string isn't too long yet
    const dmgAbl = itemData.ability.damage;
    const dmgAblMod = Math.floor((actorData.abilities[dmgAbl]?.mod ?? 0) * (itemData.ability.damageMult || 1));
    if (dmgAblMod != 0) rv.push(dmgAblMod);

    // Include enhancement bonus
    const enhBonus = item.data.enh ?? 0;
    if (enhBonus != 0) rv.push(enhBonus);

    // Include damage parts that don't happen on crits
    handleParts(itemData.damage.nonCritParts);

    // Include conditional damage that is enabled by default
    itemData.conditionals
      .filter((c) => c.default)
      .reduce((all, m) => {
        all.push(...m.modifiers.filter((m) => m.target === "damage" && m.subTarget === "allDamage"));
        return all;
      }, [])
      .forEach((m) => {
        const [roll, formula] = reduceFormula(m.formula);
        if (roll.total == 0) return;
        rv.push(formula);
      });

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

  // Fetches ability mod value based on ability key.
  // Avoids contaminating rollData or item data with excess strings.
  Handlebars.registerHelper("abilityMod", (abl, rollData, multiplier) => {
    if (multiplier == null) multiplier = 1;
    return Math.floor(getProperty(rollData, `abilities.${abl}.mod`) * multiplier);
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
};
