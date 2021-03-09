import { _rollInitiative, _getInitiativeFormula } from "./combat.js";
import "./misc/vision-permission.js";
import { ActorPF } from "./actor/entity.js";
import { addCombatTrackerContextOptions } from "./combat.js";
import { customRolls } from "./sidebar/chat-message.js";

const FormApplication_close = FormApplication.prototype.close;

export async function PatchCore() {
  // Patch getTemplate to prevent unwanted indentation in things things like <textarea> elements.
  async function PF1_getTemplate(path) {
    if (!Object.prototype.hasOwnProperty.call(_templateCache, path)) {
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
  ActorTokenHelpers.prototype.deleteEmbeddedEntity = async function (embeddedName, id, options = {}) {
    const item = this.items.get(id);

    const deleted = await ActorTokenHelpers_deleteEmbeddedEntity.call(this, embeddedName, id, options);

    // Remove token effects for deleted buff
    if (item) {
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
    const created = await ActorTokenHelpers_createEmbeddedEntity.call(this, embeddedName, data, options);
    if (embeddedName === "OwnedItem") {
      if (data.type === "buff" && getProperty(data, "data.active") === true) {
        this.toggleConditionStatusIcons();
      }
    }

    return created;
  };

  const ActorTokenHelpers_updateEmbeddedEntity = ActorTokenHelpers.prototype.updateEmbeddedEntity;
  ActorTokenHelpers.prototype.updateEmbeddedEntity = async function (embeddedName, data, options = {}) {
    const updates = await ActorTokenHelpers_updateEmbeddedEntity.call(this, embeddedName, data, options);
    if (embeddedName === "OwnedItem") {
      if (updates.type === "buff" && data["data.active"] !== undefined) {
        this.toggleConditionStatusIcons();
      }
    }

    return updates;
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
      if (["HEAL", "DAMAGE"].includes(type?.toUpperCase())) {
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

  await import("./low-light-vision.js");
}

import "./measure.js";
