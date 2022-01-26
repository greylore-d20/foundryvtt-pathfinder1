import { createInlineRollString } from "../chat.js";
import { RollPF } from "../roll.js";

export class LevelUpForm extends FormApplication {
  constructor(...args) {
    super(...args);

    /**
     * Tracks whether this form has already been submitted.
     */
    this._submitted = false;

    /**
     * Tracks the currently viewed section.
     */
    this._section = 0;

    /**
     * Tracks section data.
     */
    this._sections = this._addSections();
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pf1", "level-up"],
      template: "systems/pf1/templates/apps/level-up.hbs",
      width: 720,
      height: 480,
      closeOnSubmit: true,
    });
  }

  get section() {
    return this._section;
  }
  get currentSection() {
    return this._sections[this.section];
  }

  setSection(idx) {
    this._section = idx;

    // Disable all sections
    this.element.find(".section[data-section]").removeClass("active");

    // Enable the new section
    this.element.find(`.section[data-section-index="${idx}"]`).addClass("active");

    this._updateNavButtons();
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

    // Add sections
    result.sections = this._sections;

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

  _addSections() {
    const result = [];

    // Add health section
    const hpSettings = game.settings.get("pf1", "healthConfig");
    const hpOptions = this.actor.data.type === "character" ? hpSettings.hitdice.PC : hpSettings.hitdice.NPC;
    if (hpOptions.auto !== true) {
      result.push({
        name: "health",
        label: "PF1.LevelUpForm_Health",
        choice: {
          id: null,
          manualValue: Math.ceil(1 + (this.object.data.data.hd - 1) / 2),
        },
        items: [
          {
            img: "systems/pf1/icons/items/inventory/dice.jpg",
            name: game.i18n.localize("PF1.LevelUpForm_Health_Roll"),
            id: "roll",
            type: "html",
            target: "systems/pf1/templates/apps/level-up/health_roll.hbs",
          },
          {
            img: "systems/pf1/icons/skills/green_19.jpg",
            name: game.i18n.localize("PF1.LevelUpForm_Health_Manual"),
            id: "manual",
            type: "html",
            target: "systems/pf1/templates/apps/level-up/health_manual.hbs",
          },
        ],
      });
    }

    // Add favoured class bonus
    if (this.isFavouredClass()) {
      result.push({
        name: "fc",
        label: "PF1.LevelUp.FC.Label",
        choice: {
          id: null,
        },
        items: [
          {
            name: game.i18n.localize("PF1.None"),
            id: "none",
          },
          {
            img: "systems/pf1/icons/skills/green_19.jpg",
            name: game.i18n.localize("PF1.FavouredClassBonus.HP"),
            id: "hp",
            type: "html",
            target: "systems/pf1/templates/apps/level-up/fc_hp.hbs",
          },
          {
            img: "systems/pf1/icons/items/inventory/dice.jpg",
            name: game.i18n.localize("PF1.FavouredClassBonus.Skill"),
            id: "skill",
            type: "html",
            target: "systems/pf1/templates/apps/level-up/fc_skill.hbs",
          },
          {
            img: "systems/pf1/icons/skills/affliction_22.jpg",
            name: game.i18n.localize("PF1.FavouredClassBonus.Alt"),
            id: "alt",
            type: "html",
            target: "systems/pf1/templates/apps/level-up/fc_alt.hbs",
          },
        ],
      });
    }

    return result;
  }

  /**
   * @returns {boolean} Whether this form's associated class is a favoured class.
   * @// TODO: Add better logic for determining this <26-01-22, Furyspark> //
   */
  isFavouredClass() {
    return this.object.data.data.classType === "base";
  }

  async _updateObject(event, formData) {
    const itemData = {};
    const actorData = {};
    const chatData = {};
    const newItems = [];

    for (const section of this._sections) {
      const data = this._parseSection(section);
      mergeObject(itemData, data.item);
      mergeObject(actorData, data.actor);
      mergeObject(chatData, data.chatData);
      for (const item of data.newItems) {
        const prevItem = newItems.find((o) => o._id === item._id);
        if (prevItem != null) mergeObject(prevItem, item);
        else newItems.push(item);
      }
    }

    // Add level
    chatData.level = {
      previous: this.object.data.data.level,
      new: this.object.data.data.level + 1,
    };

    // Update class
    itemData["data.level"] = chatData.level.new;
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
    const up = this.object.update(itemData);
    await Promise.allSettled([up, lup]);

    // Update actor
    if (Object.keys(actorData).length) {
      await this.actor.update(actorData);
    }
    // Add items
    if (newItems.length > 0) {
      await this.actor.createEmbeddedDocuments("Item", newItems);
    }

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

  /**
   * @typedef {object} LevelUp_UpdateData
   * @property {object} item - The update data for the leveling class item.
   * @property {object} actor - The update data for the associated actor.
   * @property {object} chatData - Data to add for the level up's chat card.
   * @property {object[]} newItems - Items to add due to this update.
   */
  /**
   * Parses a section, and sets updateData as appropriate for a submit.
   *
   * @param {object} section - The given section.
   * @returns {LevelUp_UpdateData}
   */
  _parseSection(section) {
    const result = {
      item: {},
      actor: {},
      chatData: {},
      newItems: [],
    };

    const fn = this[`_parseSection_${section.name}`];
    if (fn instanceof Function) return fn.call(this, section, result);

    return result;
  }

  _parseSection_health(section, result) {
    // Manual health
    if (section.choice.id === "manual") {
      const hpValue = section.choice.manualValue;
      result.item["data.hp"] = this.object.data.data.hp + hpValue;
      result.chatData.hp = {
        label: "PF1.LevelUp.Chat.Health.Manual",
        add: hpValue,
        roll: RollPF.safeRoll(`${hpValue}`),
      };
    }
    // Roll health
    else if (section.choice.id === "roll") {
      const formula = `1d${this.object.data.data.hd}`;
      const roll = RollPF.safeRoll(formula);
      result.chatData.hp = {
        label: "PF1.LevelUp.Chat.Health.Roll",
        add: createInlineRollString(roll),
        roll: roll,
      };
      if (!Number.isNaN(roll.total)) {
        result.item["data.hp"] = this.object.data.data.hp + roll.total;
      }
    }

    return result;
  }

  _parseSection_fc(section, result) {
    const id = section.choice.id;
    if (["hp", "skill", "alt"].includes(id)) {
      const key = `data.fc.${section.choice.id}.value`;
      result.item[key] = getProperty(this.object.data, key) + 1;

      const fcKey = { hp: "HP", skill: "Skill", alt: "Alt" }[id];
      result.chatData.fc = {
        type: id,
        label: `PF1.FavouredClassBonus.${fcKey}`,
      };
    }

    return result;
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
    html.find(".list-selector .item").on("click", this._onClickListItem.bind(this));

    html.find(`button[data-type="previous"]`).on("click", this._onPreviousSection.bind(this));
    html.find(`button[data-type="next"]`).on("click", this._onNextSection.bind(this));
    html.find('button[name="submit"]').on("click", this._onSubmit.bind(this));
  }

  activateContentListeners(html) {
    html.find("input.section-choice").on("change", this._onChangeSectionChoice.bind(this));
  }

  _onPreviousSection(event) {
    event.preventDefault();

    this.setSection(this.section - 1);
  }

  _onNextSection(event) {
    event.preventDefault();

    this.setSection(this.section + 1);
  }

  _onClickListItem(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const list = a.closest(".list-selector");

    // Return if item already selected
    if (a.classList.contains("active")) return;

    // Make item visibly active
    list.querySelectorAll(".item").forEach((elem) => {
      elem.classList.remove("active");
    });
    a.classList.add("active");

    // Remove previous content
    const contentId = list.dataset.content;
    const contentElem = this.element.find(`.${contentId}-body`);
    contentElem.empty();

    // Replace content
    const section = this._sections[list.closest(".section").dataset.sectionIndex];
    const sectionItem = section.items.find((o) => o.id === a.dataset.id);
    this._renderContent(sectionItem).then((html) => {
      contentElem.append(html);
      this.activateContentListeners(contentElem);
    });

    // Update form buttons
    this.currentSection.choice.id = a.dataset.id;
    this._updateNavButtons();
  }

  async _renderContent(item) {
    switch (item.type) {
      case "html":
        return renderTemplate(item.target, this.getHTMLData());
    }

    return "";
  }

  _onChangeSectionChoice(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const [sectionName, key] = a.name.split(":");
    const section = this._sections.find((o) => o.name === sectionName);

    if (!section) return;

    // Get value
    let value = a.value;
    switch (a.dataset.dtype.toLowerCase()) {
      case "number":
        value = parseFloat(value);
        break;
      case "boolean":
        value = ["true", "1"].includes(value);
        break;
    }

    // Change section choice
    setProperty(section.choice, key, value);
  }

  _updateNavButtons() {
    const formDiv = this.element.find(".nav-buttons");

    const buttons = {
      previous: formDiv.find(`button[data-type="previous"]`),
      next: formDiv.find(`button[data-type="next"]`),
      submit: formDiv.find(`button[type="submit"]`),
    };
    if (this._section > 0) {
      buttons.previous.prop("disabled", false);
    } else {
      buttons.previous.prop("disabled", true);
    }

    if (this.section < this._sections.length - 1 && this.currentSection.choice?.id != null) {
      buttons.next.prop("disabled", false);
    } else {
      buttons.next.prop("disabled", true);
    }

    if (this.section === this._sections.length - 1 && this.currentSection.choice?.id != null) {
      buttons.submit.prop("disabled", false);
    } else {
      buttons.submit.prop("disabled", true);
    }
  }

  getHTMLData() {
    return {
      actor: this.actor.data.toObject(),
      item: this.object.data.toObject(),
      rollData: this.object.getRollData(),
      appData: this.getData(),
      section: this.currentSection,
    };
  }

  _onSubmit(event, ...args) {
    event.preventDefault();
    if (this._submitted) return;

    this._submitted = true;
    super._onSubmit(event, ...args);
  }
}
