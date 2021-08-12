import { _rollInitiative, _getInitiativeFormula } from "./combat.js";
import { hasTokenVision } from "./misc/vision-permission.js";
import { addCombatTrackerContextOptions } from "./combat.js";
import { customRolls } from "./sidebar/chat-message.js";
import { patchLowLightVision } from "./low-light-vision.js";
import { patchMeasureTools } from "./measure.js";
import { sortArrayByName } from "./lib.js";
import { parseRollStringVariable } from "./roll.js";

/**
 *
 */
export async function PatchCore() {
  // Patch getTemplate to prevent unwanted indentation in things things like <textarea> elements.
  /**
   * @param path
   */
  async function PF1_getTemplate(path) {
    if (!Object.prototype.hasOwnProperty.call(_templateCache, path) || CONFIG.debug.template) {
      await new Promise((resolve) => {
        game.socket.emit("template", path, (resp) => {
          const compiled = Handlebars.compile(resp.html, { preventIndent: true });
          Handlebars.registerPartial(path, compiled);
          _templateCache[path] = compiled;
          console.log(`Foundry VTT | Retrieved and compiled template ${path}`);
          resolve(compiled);
        });
      });
    }
    return _templateCache[path];
  }

  // Patch TokenHUD.getData to show resource bars even if their value is 0
  const TokenHUD_getData = TokenHUD.prototype.getData;
  TokenHUD.prototype.getData = function () {
    const data = TokenHUD_getData.call(this);
    const bar1 = this.object.document.getBarAttribute("bar1");
    const bar2 = this.object.document.getBarAttribute("bar2");
    return mergeObject(data, {
      displayBar1: bar1 != null && bar1.attribute != null && bar1.value != null,
      displayBar2: bar2 != null && bar2.attribute != null && bar2.value != null,
    });
  };

  // Token patch for shared vision
  const Token__isVisionSource = Token.prototype._isVisionSource;
  Token.prototype._isVisionSource = function () {
    if (!canvas.sight.tokenVision || !this.hasSight) return false;

    // Only display hidden tokens for the GM
    const isGM = game.user.isGM;
    if (this.data.hidden && !isGM) return false;

    // Always display controlled tokens which have vision
    if (this._controlled) return true;

    // Otherwise vision is ignored for GM users
    if (isGM) return false;

    // If a non-GM user controls no other tokens with sight, display sight anyways
    const canObserve = this.actor && hasTokenVision(this);
    if (!canObserve) return false;
    const others = this.layer.controlled.filter((t) => !t.data.hidden && t.hasSight);
    return !others.length || game.settings.get("pf1", "sharedVisionMode") === "1";
  };

  // Token#observer patch to make use of vision permission settings
  Object.defineProperty(Token.prototype, "observer", {
    get() {
      return game.user.isGM || hasTokenVision(this);
    },
  });

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
      let result = origFunc.call(this);
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
      let actor = cMsg.getSpeakerActor(speaker);
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

  // Patch, patch, patch
  Combat.prototype._getInitiativeFormula = _getInitiativeFormula;
  Combat.prototype.rollInitiative = _rollInitiative;
  window.getTemplate = PF1_getTemplate;

  // Apply low light vision patches
  patchLowLightVision();

  // Apply measurement patches
  patchMeasureTools();

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

  // Patch ParentheticalTerm
  ParentheticalTerm.CLOSE_REGEXP = new RegExp(`\\)${RollTerm.FLAVOR_REGEXP_STRING}?`, "g");

  // Add secondary indexing to compendium collections
  {
    const origFunc = CompendiumCollection.prototype.getIndex;
    CompendiumCollection.prototype.getIndex = async function ({ fields } = {}) {
      let index = await origFunc.call(this, { fields });
      this.fuzzyIndex = sortArrayByName([...index]);
      return this.index;
    };
  }

  // Entity link attribute stuffing
  {
    const origFunc = TextEditor._createContentLink;
    TextEditor._createContentLink = function (match, type, target, name) {
      let a = origFunc.call(this, match, type, target, name);
      if (name?.indexOf("::") > -1) {
        let args = name.split("::"),
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
}
