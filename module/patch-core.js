import { addCombatTrackerContextOptions } from "./combat.js";
import { customRolls } from "./sidebar/chat-message.js";
import { sortArrayByName } from "./lib.js";
import { parseRollStringVariable } from "./roll.js";

/**
 *
 */
export async function PatchCore() {
  // Add Vision Permission sheet to ActorDirectory context options
  const ActorDirectory__getEntryContextOptions = ActorDirectory.prototype._getEntryContextOptions;
  ActorDirectory.prototype._getEntryContextOptions = function () {
    return ActorDirectory__getEntryContextOptions.call(this).concat([
      {
        name: "PF1.Vision",
        icon: '<i class="fas fa-eye"></i>',
        condition: (li) => {
          return game.user.isGM;
        },
        callback: (li) => {
          const entity = this.constructor.collection.get(li.data("entityId"));
          if (entity) {
            const sheet = entity.visionPermissionSheet;
            if (sheet.rendered) {
              if (sheet._minimized) sheet.maximize();
              else sheet.close();
            } else sheet.render(true);
          }
        },
      },
    ]);
  };

  // Add combat tracker context menu options
  {
    const origFunc = CombatTracker.prototype._getEntryContextOptions;
    CombatTracker.prototype._getEntryContextOptions = function () {
      const result = origFunc.call(this);
      addCombatTrackerContextOptions.call(this, result);
      return result;
    };
  }

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
      const cMsg = CONFIG.ChatMessage.entityClass;
      const speaker = cMsg.getSpeaker();
      const actor = cMsg.getSpeakerActor(speaker);
      let rollData = actor ? actor.getRollData() : {};

      const sheet = a.closest(".sheet");
      if (sheet) {
        const app = ui.windows[sheet.dataset.appid];
        if (["Actor", "Item"].includes(app?.object?.entity)) rollData = app.object.getRollData();
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
      if (!up) game.pf1.tooltip.lock.new = true;
      fn.call(this, event, up, modifiers);
      if (!up) game.pf1.tooltip.lock.new = false;
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

  // Entity link attribute stuffing
  {
    const origFunc = TextEditor._createContentLink;
    TextEditor._createContentLink = function (match, type, target, name) {
      const a = origFunc.call(this, match, type, target, name);
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

  // Todo: Declare this in TokenDocumentPF when/ if TokenDocument.getData calls the constructor's method
  {
    const origFunc = TokenDocument.getTrackedAttributes;
    TokenDocument.getTrackedAttributes = function (data, _path = []) {
      const attr = origFunc.call(this, data, _path);
      if (_path.length === 0) attr.value.push(["attributes", "hp", "temp"], ["attributes", "hp", "nonlethal"]);
      return attr;
    };
  }
}
