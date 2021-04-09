import { _rollInitiative, _getInitiativeFormula } from "./combat.js";
import { hasTokenVision } from "./misc/vision-permission.js";
import { ActorPF } from "./actor/entity.js";
import { addCombatTrackerContextOptions } from "./combat.js";
import { customRolls } from "./sidebar/chat-message.js";
import { patchLowLightVision } from "./low-light-vision.js";
import { patchMeasureTools } from "./measure.js";

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
    const bar1 = this.object.getBarAttribute("bar1");
    const bar2 = this.object.getBarAttribute("bar2");
    return mergeObject(data, {
      displayBar1: bar1 != null && bar1.attribute != null && bar1.value != null,
      displayBar2: bar2 != null && bar2.attribute != null && bar2.value != null,
    });
  };

  // Patch ActorTokenHelpers.update
  const ActorTokenHelpers_update = ActorTokenHelpers.prototype.update;
  ActorTokenHelpers.prototype.update = async function (data, options = {}) {
    // Avoid regular update flow for explicitly non-recursive update calls
    if (getProperty(options, "recursive") === false) {
      return ActorTokenHelpers_update.call(this, data, options);
    }

    const diff = await ActorPF.prototype.update.call(
      this,
      data,
      mergeObject(options, { recursive: true, skipUpdate: true })
    );
    if (Object.keys(diff).length) {
      await ActorTokenHelpers_update.call(this, diff, mergeObject(options, { recursive: true }));
      await this.toggleConditionStatusIcons();
      await this.refreshItems();
    }
    return diff;
  };
  // Patch ActorTokenHelpers.deleteEmbeddedEntity
  const ActorTokenHelpers_deleteEmbeddedEntity = ActorTokenHelpers.prototype.deleteEmbeddedEntity;
  ActorTokenHelpers.prototype.deleteEmbeddedEntity = async function (embeddedName, data, options = {}) {
    data = data instanceof Array ? data : [data];
    const ids = data.map((o) => {
      if (typeof o === "string") return o;
      return o._id;
    });
    const items = this.items.filter((o) => {
      return ids.includes(o.id);
    });

    // Remove class associations
    for (let item of items) {
      if (item.data.type === "class") {
        await item._onLevelChange(getProperty(item.data, "data.level"), 0);
      }
    }

    // Delete item
    const deleted = await ActorTokenHelpers_deleteEmbeddedEntity.call(this, embeddedName, data, options);

    // Remove token effects for deleted buff
    for (let item of items) {
      let promises = [];
      if (item.type === "buff" && item.data.data.active) {
        const isLinkedToken = getProperty(this.data, "token.actorLink");
        const tokens = isLinkedToken ? this.getActiveTokens() : [this.token].filter((o) => o != null);
        for (const token of tokens) {
          promises.push(token.toggleEffect(item.data.img, { active: false }));
        }
      }
      await Promise.all(promises);
    }

    return deleted;
  };

  const ActorTokenHelpers_createEmbeddedEntity = ActorTokenHelpers.prototype.createEmbeddedEntity;
  ActorTokenHelpers.prototype.createEmbeddedEntity = async function (embeddedName, data, options = {}) {
    let created = await ActorTokenHelpers_createEmbeddedEntity.call(this, embeddedName, data, options);
    created = created instanceof Array ? created : [created];

    if (embeddedName === "OwnedItem") {
      for (let i of created) {
        const item = this.items.get(i._id);

        // Show new buff icon
        if (item.data.type === "buff" && getProperty(item.data, "data.active") === true) {
          await this.toggleConditionStatusIcons();
        }

        // Add class features
        if (item.data.type === "class") {
          await item._onLevelChange(0, item.data.data.level);
        }
      }
    }

    return created;
  };

  const ActorTokenHelpers_updateEmbeddedEntity = ActorTokenHelpers.prototype.updateEmbeddedEntity;
  ActorTokenHelpers.prototype.updateEmbeddedEntity = async function (embeddedName, data, options = {}) {
    data = data instanceof Array ? data : [data];
    const prevData = data.reduce((cur, o) => {
      const obj = duplicate(this.items.get(o._id));
      cur.set(o._id, obj);
      return cur;
    }, new Map());
    let updates = await ActorTokenHelpers_updateEmbeddedEntity.call(this, embeddedName, data, options);
    updates = updates instanceof Array ? updates : [updates];

    if (embeddedName === "OwnedItem") {
      for (let i of updates) {
        const item = this.items.get(i._id);
        const prev = prevData.get(i._id);
        const d = data.find((o) => o._id === i._id);

        // Show updated buff icon
        if (item.data.type === "buff" && d["data.active"] !== undefined) {
          await this.toggleConditionStatusIcons();
        }

        // Add or remove class features
        if (item.data.type === "class") {
          const prevLevel = getProperty(prev, "data.level");
          const newLevel = getProperty(item.data, "data.level");
          if (prevLevel !== newLevel) {
            await item._onLevelChange(prevLevel, newLevel);
          }
        }
      }
    }

    return updates;
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

  // Workaround for unlinked token in first initiative on reload problem. No core issue number at the moment.
  if (Actor.config.collection && Object.keys(Actor.collection.tokens).length > 0) {
    Object.keys(Actor.collection.tokens).forEach((tokenId) => {
      let actor = Actor.collection.tokens[tokenId];
      for (let m of ["update", "createEmbeddedEntity", "updateEmbeddedEntity", "deleteEmbeddedEntity"]) {
        actor[m] = ActorTokenHelpers.prototype[m].bind(actor);
      }
    });
  }

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
}
