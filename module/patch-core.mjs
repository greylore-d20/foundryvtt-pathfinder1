import { customRolls } from "./documents/chat-message.mjs";
import { sortArrayByName } from "./utils/lib.mjs";
import { parseRollStringVariable } from "./dice/roll.mjs";
import { RollPF } from "./dice/roll.mjs";
import { patchCore as patchLowLightVision } from "./canvas/low-light-vision.mjs";

/**
 *
 */
// Add inline support for extra /commands
{
  const origParse = ChatLog.parse;
  ChatLog.parse = function (message) {
    const match = message.match(/^\/(\w+)(?: +([^#]+))(?:#(.+))?/),
      type = match?.[1];
    if (["HEAL", "H", "DAMAGE", "D"].includes(type?.toUpperCase())) {
      match[2] = match[0].slice(1);
      return ["custom", match];
    } else return origParse.call(this, message);
  };

  const origClick = TextEditor._onClickInlineRoll;
  TextEditor._onClickInlineRoll = function (event) {
    event.preventDefault();
    const a = event.currentTarget;
    if (!a.classList.contains("custom")) return origClick.call(this, event);

    const chatMessage = `/${a.dataset.formula}`;
    const cMsg = CONFIG.ChatMessage.documentClass;
    const speaker = cMsg.getSpeaker();
    const actor = cMsg.getSpeakerActor(speaker);
    let rollData = actor ? actor.getRollData() : {};

    const sheet = a.closest(".sheet");
    if (sheet) {
      const app = ui.windows[sheet.dataset.appid];
      if (["Actor", "Item"].includes(app?.document.documentName)) rollData = app.object.getRollData();
    }
    return customRolls(chatMessage, speaker, rollData);
  };

  // Fix for race condition
  if ($._data($("body").get(0), "events")?.click?.find((o) => o.selector === "a.inline-roll")) {
    $("body").off("click", "a.inline-roll", origClick);
    $("body").on("click", "a.inline-roll", TextEditor._onClickInlineRoll);
  }
}

// Change tooltip showing on alt
{
  const fn = KeyboardManager.prototype._onAlt;
  KeyboardManager.prototype._onAlt = function (event, up, modifiers) {
    if (!pf1.tooltip) return;
    if (!up) pf1.tooltip.lock.new = true;
    fn.call(this, event, up, modifiers);
    if (!up) pf1.tooltip.lock.new = false;
  };
}

// Patch StringTerm
StringTerm.prototype.evaluate = function (options = {}) {
  const result = parseRollStringVariable(this.term);
  if (typeof result === "string") {
    const src = `with (sandbox) { return ${this.term}; }`;
    try {
      const evalFn = new Function("sandbox", src);
      this._total = evalFn(RollPF.MATH_PROXY);
    } catch (err) {
      err.message = `Failed to evaluate: '${this.term}'\n${err.message}`;
      throw err;
    }
  } else {
    this._total = result;
  }
};

// Patch NumericTerm
NumericTerm.prototype.getTooltipData = function () {
  return {
    formula: this.expression,
    total: this.total,
    flavor: this.flavor,
  };
};

// Patch ParentheticalTerm and allowed operators
ParentheticalTerm.CLOSE_REGEXP = new RegExp(`\\)${RollTerm.FLAVOR_REGEXP_STRING}?`, "g");
OperatorTerm.REGEXP = /(?:&&|\|\||\*\*|\+|-|\*|\/|\\%|\||:|\?)|(?<![a-z])[!=<>]+/g;
OperatorTerm.OPERATORS.push("\\%", "!", "?", ":", "=", "<", ">", "==", "===", "<=", ">=", "??", "||", "&&", "**");

// Add secondary indexing to compendium collections
{
  const origFunc = CompendiumCollection.prototype.getIndex;
  CompendiumCollection.prototype.getIndex = async function ({ fields } = {}) {
    const index = await origFunc.call(this, { fields });
    this.fuzzyIndex = sortArrayByName([...index]);
    return this.index;
  };
}

// Document link attribute stuffing
{
  const origFunc = TextEditor._createContentLink;
  TextEditor._createContentLink = function (match, { async = false, relativeTo } = {}) {
    const [type, target, hash, name] = match.slice(1, 5);
    const a = origFunc.call(this, match, { async, relativeTo });
    if (name?.indexOf("::") > -1) {
      const args = name.split("::"),
        label = args.pop();
      if (args.length) {
        args.forEach((o) => {
          let [key, value] = o.split(/(?<!\\):/);
          if (!(key && value)) {
            value = key;
            key = "extra";
          }
          switch (key) {
            case "icon":
              a.firstChild.className = "fas fa-" + value;
              break;
            case "class":
              a.classList.add(...value.split(" "));
              break;
            default:
              a.setAttribute("data-" + key, value);
          }
        });
        a.lastChild.textContent = label;
      }
    }
    return a;
  };
}

// Remove warnings for conflicting uneditable system bindings
{
  const origFunc = KeybindingsConfig.prototype._detectConflictingActions;
  KeybindingsConfig.prototype._detectConflictingActions = function (actionId, action, binding) {
    // Uneditable System bindings are never wrong, they can never conflict with something
    if (actionId.startsWith("pf1.") && action.uneditable.includes(binding)) return [];

    return origFunc.call(this, actionId, action, binding);
  };
}

{
  const origFunc = Combatant.prototype.updateResource;
  Combatant.prototype.updateResource = function () {
    if (!this.actor) return (this.resource = null);
    return (this.resource = foundry.utils.getProperty(this.actor.system, this.parent.settings.resource) ?? null);
  };
}

// Patch the `fromData` method used by Foundry to allow rolls from builds with a renamed roll class
// to still be created from JSON for tooltips etc.
// Introduced in v0.81.1 for Foundry v9.269
{
  const origFunc = Roll.fromData;
  Roll.fromData = function (data, ...args) {
    if (data.class === "RollPF$1") data.class = "RollPF";
    return origFunc.call(this, data, ...args);
  };
}

// Call patch functions
patchLowLightVision();
