import { createInlineRollString } from "../chat.js";

export class LevelUpForm extends BaseEntitySheet {
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

  get actor() {
    return this.object.actor;
  }

  getData() {
    const result = {};

    result.data = duplicate(this.object.data);
    result.actor = duplicate(this.actor.data);

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
      let hp = parseInt(formData["health.manual_value"]);
      chatData.hp = {
        label: "PF1.LevelUp.Chat.Health.Manual",
        add: hp,
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
    await this.object.update(updateData);

    // Create chat message
    return this.createChatMessage(chatData);
  }

  async createChatMessage(formData) {
    const chatMessageClass = CONFIG.ChatMessage.entityClass;
    const speaker = chatMessageClass.getSpeaker({ actor: this.actor });

    const templateData = {
      formData,
      config: CONFIG.PF1,
      item: duplicate(this.object.data),
      actor: duplicate(this.actor.data),
    };

    await chatMessageClass.create({
      content: await renderTemplate("systems/pf1/templates/chat/level-up.hbs", templateData),
      speaker: speaker,
      user: game.user._id,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    });
  }

  activateListeners(html) {
    html.find(`.switch-check[name="health.roll"]`).change(this._switchHealthRoll.bind(this));

    html.find('button[name="submit"]').click(this._onSubmit.bind(this));
  }

  _switchHealthRoll(event) {
    const checked = $(event.currentTarget).prop("checked");
    const targetElem = this.element.find(`input[type="text"][name="health.manual_value"]`);

    targetElem.attr("disabled", checked);
  }
}
