import { createInlineRollString } from "../chat.js";
import { RollPF } from "../roll.js";

export class LevelUpForm extends DocumentSheet {
  constructor(...args) {
    super(...args);

    /**
     * Tracks whether this form has already been submitted.
     */
    this._submitted = false;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pf1", "level-up"],
      template: "systems/pf1/templates/apps/level-up.hbs",
      width: 500,
      closeOnSubmit: true,
    });
  }

  get title() {
    return game.i18n.format("PF1.LevelUpForm_Title", { className: this.object.name });
  }

  /** @type {Actor} */
  get actor() {
    return this.object.actor;
  }

  static async addClassWizard(actor, rawData) {
    // Alter initial data
    setProperty(rawData, "data.hp", 0);
    setProperty(rawData, "data.level", 0);

    // Add class item
    let itemData = await actor.createEmbeddedDocuments("Item", [rawData]);
    itemData = itemData instanceof Array ? itemData : [itemData];
    const item = actor.items.get(itemData[0].id);
    if (!item) {
      throw new Error("No class was created at class initialization wizard");
    }

    // Add level up form for new class
    return new Promise((resolve) => {
      const _app = new LevelUpForm(item).render(true);
      Hooks.on("closeLevelUpForm", function _onClose(app) {
        if (app === _app) {
          if (getProperty(item.data, "data.level") === 0) {
            actor.deleteEmbeddedDocuments("Item", [item.id]);
          }
          Hooks.off("closeLevelUpForm", _onClose);
          resolve();
        }
      });
    });
  }

  getData() {
    const result = {};

    result.data = this.object.data.toObject();
    result.actor = this.actor.data.toObject();

    // Add health data
    const hpSettings = game.settings.get("pf1", "healthConfig");
    const hpOptions = this.actor.data.type === "character" ? hpSettings.hitdice.PC : hpSettings.hitdice.NPC;
    result.health = {
      autoHP: hpOptions.auto === true,
      manualValue: Math.ceil(1 + (result.data.data.hd - 1) / 2),
    };

    // Add favored class data
    result.fc = {
      allowed: result.data.data.classType === "base",
      types: [
        { key: "none", label: game.i18n.localize("PF1.None"), checked: true },
        { key: "hp", label: game.i18n.localize("PF1.FavouredClassBonus.HP") },
        { key: "skill", label: game.i18n.localize("PF1.FavouredClassBonus.Skill") },
        { key: "alt", label: game.i18n.localize("PF1.FavouredClassBonus.Alt") },
      ],
    };

    result.uuid = `${result.actor._id}.${result.data._id}`;

    return result;
  }

  async _updateObject(event, formData) {
    const item = this.object;
    const updateData = {};
    const chatData = {};

    // Add health part
    if (formData["health.manual_value"]) {
      const hp = parseInt(formData["health.manual_value"]);
      chatData.hp = {
        label: "PF1.LevelUp.Chat.Health.Manual",
        add: hp,
        roll: RollPF.safeRoll(`${hp}`),
      };
      if (!Number.isNaN(hp)) {
        updateData["data.hp"] = item.data.data.hp + hp;
      }
    } else if (formData["health.roll"]) {
      // Roll for health
      const formula = `1d${item.data.data.hd}`;
      const roll = RollPF.safeRoll(formula);
      chatData.hp = {
        label: "PF1.LevelUp.Chat.Health.Roll",
        add: createInlineRollString(roll),
        roll: roll,
      };
      if (!Number.isNaN(roll.total)) {
        updateData["data.hp"] = item.data.data.hp + roll.total;
      }
    }

    // Add favored class part
    if (formData["fc.type"] && formData["fc.type"] !== "none") {
      const key = `data.fc.${formData["fc.type"]}.value`;
      updateData[key] = getProperty(item.data, key) + 1;

      const fcKey = { hp: "HP", skill: "Skill", alt: "Alt" }[formData["fc.type"]];
      chatData.fc = {
        type: formData["fc.type"],
        label: `PF1.FavouredClassBonus.${fcKey}`,
      };
    }

    // Add level
    chatData.level = {
      previous: item.data.data.level,
      new: item.data.data.level + 1,
    };

    // Update class
    updateData["data.level"] = chatData.level.new;
    const lup = new Promise((resolve) => {
      Hooks.on(
        "pf1.classLevelChange",
        function _waiter(actor, item) {
          if (item.id === this.object.id) {
            Hooks.off("pf1.classLevelChange", _waiter);
            resolve();
          }
        }.bind(this)
      );
    });
    const up = this.object.update(updateData);
    await Promise.allSettled([up, lup]);

    // Add new class features to chat data
    {
      const classAssociations = getProperty(this.object.data, "flags.pf1.links.classAssociations") || {};
      const newAssociations = Object.entries(classAssociations).filter((o) => {
        return o[1] === chatData.level.new;
      });
      chatData.newFeatures = [];
      for (const co of newAssociations) {
        const item = this.actor.items.get(co[0]);
        if (item) chatData.newFeatures.push(item.toObject());
      }
    }

    // Add extra info (new feats, skill ranks, etc.)
    {
      const ex = {};
      chatData.extra = ex;

      // Show new feat count
      const featCount = this.actor.getFeatCount();
      featCount.new = Math.max(0, featCount.max - featCount.value);
      ex.feats = featCount;
      if (featCount.new > 0) {
        ex.enabled = true;
        if (featCount.new === 1) featCount.label = game.i18n.localize("PF1.LevelUp.Chat.Extra.NewFeat");
        else featCount.label = game.i18n.format("PF1.LevelUp.Chat.Extra.NewFeats", { newValue: featCount.new });
      }

      // Show new ability score
      const hd = this.actor.data.data.attributes.hd.total;
      if (typeof hd === "number" && hd % 4 === 0) {
        ex.enabled = true;
        ex.newAbilityScore = {
          label: game.i18n.localize("PF1.LevelUp.Chat.Extra.NewAbilityScore"),
        };
      }
    }

    // Create chat message
    return this.createChatMessage(chatData);
  }

  async createChatMessage(formData) {
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });

    const templateData = {
      formData,
      config: CONFIG.PF1,
      item: this.object.data.toObject(),
      actor: this.actor.data.toObject(),
    };

    return ChatMessage.create({
      content: await renderTemplate("systems/pf1/templates/chat/level-up.hbs", templateData),
      user: game.user.id,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      speaker,
      roll: formData.hp?.roll ?? RollPF.safeRoll("0"),
    });
  }

  activateListeners(html) {
    html.find(`.switch-check[name="health.roll"]`).change(this._switchHealthRoll.bind(this));

    html.find('button[name="submit"]').click(this._onSubmit.bind(this));
  }

  _onSubmit(event, ...args) {
    event.preventDefault();
    if (this._submitted) return;

    this._submitted = true;
    super._onSubmit(event, ...args);
  }

  _switchHealthRoll(event) {
    const checked = $(event.currentTarget).prop("checked");
    const targetElem = this.element.find(`input[type="text"][name="health.manual_value"]`);

    targetElem.attr("disabled", checked);
  }
}
