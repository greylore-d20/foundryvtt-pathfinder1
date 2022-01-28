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

    // Add summary section at the end
    this._sections.push(this._addSummarySection());
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

    return this._render();
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
    result.config = CONFIG.PF1;

    // Add sections
    result.section = this.currentSection;
    result.sections = this._sections;

    // Add summary data
    result.summary = this.getSummaryData();

    result.uuid = `${result.actor._id}.${result.data._id}`;

    return result;
  }

  getSummaryData() {
    const result = {};

    for (const section of this._sections) {
      if (section.name === "summary") continue;
      const { summary } = this._parseSection(section);
      result[section.name] = summary;
    }

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
        choice: null,
        manualValue: Math.ceil(1 + (this.object.data.data.hd - 1) / 2),
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
        choice: null,
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

    // Add ability score
    const newHD = this.actor.getRollData().attributes.hd.total + 1;
    const newAbilityScores = CONFIG.PF1.levelAbilityScores[newHD];
    if (typeof newAbilityScores === "number" && newAbilityScores > 0) {
      result.push({
        name: "ability",
        label: "PF1.LevelUp.AbilityScore.Label",
        template: "systems/pf1/templates/apps/level-up/ability-score.hbs",
        choice: null,
        abilities: Object.keys(CONFIG.PF1.abilities).reduce((cur, o) => {
          cur[o] = {
            value: this.actor.data.data.abilities[o].total,
            name: CONFIG.PF1.abilities[o],
            added: 0,
            isEnhanced: this.actor.data.data.abilities[o].total !== this.actor.data.data.abilities[o].base,
          };
          return cur;
        }, {}),
        value: newAbilityScores,
      });
    }

    return result;
  }

  _addSummarySection() {
    return {
      name: "summary",
      label: "PF1.LevelUp.Summary.Label",
      template: "systems/pf1/templates/apps/level-up/summary.hbs",
    };
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
    const chatData = {
      config: CONFIG.PF1,
    };
    const newItems = [];
    const callbacks = [];

    for (const section of this._sections) {
      const data = this._parseSection(section);
      mergeObject(itemData, data.item);
      mergeObject(actorData, data.actor);
      mergeObject(chatData, data.chatData);
      callbacks.push(...data.callbacks);
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
    // Run callbacks
    for (const cb of callbacks) {
      await cb.call(this);
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
   * @property {object[]} summary - Data for the summary to show.
   * @property {Function[]} callbacks - Asynchronous callbacks to call upon submit.
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
      summary: {},
      callbacks: [],
    };

    const fn = this[`_parseSection_${section.name}`];
    if (fn instanceof Function) return fn.call(this, section, result);

    return result;
  }

  _parseSection_health(section, result) {
    result.summary = {
      label: "PF1.LevelUp.Chat.Health.Header",
      template: "systems/pf1/templates/apps/level-up/summary/health.hbs",
      type: section.choice,
    };

    // Manual health
    if (section.choice === "manual") {
      const hpValue = section.manualValue;
      result.item["data.hp"] = this.object.data.data.hp + hpValue;
      result.chatData.hp = {
        label: "PF1.LevelUp.Chat.Health.Manual",
        add: hpValue,
        roll: RollPF.safeRoll(`${hpValue}`),
      };
      result.summary.hp = hpValue;
    }
    // Roll health
    else if (section.choice === "roll") {
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
    result.summary = {
      label: "PF1.LevelUp.Chat.FC.Header",
      template: "systems/pf1/templates/apps/level-up/summary/fc.hbs",
      id: section.choice,
    };

    const id = section.choice;
    if (["hp", "skill", "alt"].includes(id)) {
      const key = `data.fc.${section.choice}.value`;
      result.item[key] = getProperty(this.object.data, key) + 1;

      const fcKey = { hp: "HP", skill: "Skill", alt: "Alt" }[id];
      result.chatData.fc = {
        type: id,
        label: `PF1.FavouredClassBonus.${fcKey}`,
      };

      result.summary.desc = `PF1.LevelUp.FC.${fcKey}.Desc`;
    }

    return result;
  }

  _parseSection_ability(section, result) {
    const added = Object.entries(section.abilities).reduce((cur, o) => {
      if (!(o[1].added > 0)) return cur;
      cur[o[0]] = o[1].added;
      return cur;
    }, {});

    // Add summary data
    result.summary = {
      label: "PF1.LevelUp.AbilityScore.Label",
      template: "systems/pf1/templates/apps/level-up/summary/ability-score.hbs",
      choices: added,
    };

    // Add chat data
    if (Object.keys(added).length) {
      result.chatData.ability = {
        choices: added,
      };
    }

    const item = this.actor.items.find((o) => o.getFlag("pf1", "levelUp") === true);
    // Add level up ability score feature if it doesn't exist yet
    if (!item) {
      const newItem = mergeObject(
        CONFIG.PF1.levelAbilityScoreFeature,
        {
          flags: {
            pf1: {
              levelUp: true,
            },
          },
        },
        { inplace: false }
      );

      // Translate name and description
      newItem.name = game.i18n.localize(newItem.name);
      setProperty(
        newItem,
        "data.description.value",
        game.i18n.localize(getProperty(newItem, "data.description.value") ?? "")
      );

      // Add changes
      setProperty(
        newItem,
        "data.changes",
        Object.entries(added).reduce((cur, o) => {
          const change = mergeObject(game.pf1.documentComponents.ItemChange.defaultData, {
            formula: `${o[1]}`,
            subTarget: o[0],
            modifier: "untypedPerm",
          });

          cur.push(change);
          return cur;
        }, [])
      );

      result.newItems.push(newItem);
    }
    // If a level up ability score feature already exists, update it
    else {
      const cb = async function () {
        const changes = duplicate(item.data.data.changes ?? []);
        for (const [key, value] of Object.entries(added)) {
          const change = changes.find((o) => o.subTarget === key);

          // Update previous change
          if (change != null) {
            const prevValue = parseInt(change.formula);
            if (!Number.isNaN(prevValue)) {
              const newValue = prevValue + value;
              change.formula = `${newValue}`;
              continue;
            }
          }

          // Add new change
          changes.push(
            mergeObject(game.pf1.documentComponents.ItemChange.defaultData, {
              subTarget: key,
              formula: `${value}`,
              modifier: "untypedPerm",
            })
          );
        }

        await item.update({
          "data.changes": changes,
        });
      };

      result.callbacks.push(cb);
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
    html.find("input.section-choice").on("change", this._onChangeSectionChoice.bind(this));

    html.find(".ability-scores .ability-score .operator").on("click", this._onClickAbilityScoreOperator.bind(this));

    html.find(`button[data-type="previous"]`).on("click", this._onPreviousSection.bind(this));
    html.find(`button[data-type="next"]`).on("click", this._onNextSection.bind(this));
    html.find('button[name="submit"]').on("click", this._onSubmit.bind(this));
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

    // Return if item already selected
    if (a.classList.contains("active")) return;

    this.currentSection.currentItem = this.currentSection.items.find((o) => o.id === a.dataset.id);
    setProperty(this.currentSection, "choice", a.dataset.id);
    return this._render();
  }

  async _render(...args) {
    await super._render(...args);
    this._updateNavButtons();
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
    setProperty(section, key, value);
  }

  _onClickAbilityScoreOperator(event) {
    event.preventDefault();

    const a = event.currentTarget;
    const operator = a.dataset.operator;
    const ablKey = a.closest(".ability-score").dataset.key;
    const section = this.currentSection;
    const add = operator === "add" ? 1 : operator === "subtract" ? -1 : 0;

    section.abilities[ablKey].value += add;
    section.abilities[ablKey].added += add;
    section.value -= add;

    section.choice = section.value === 0 ? true : null;

    this._render();
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

    const hasMadeChoice = !!this.currentSection.choice;
    if (this.section < this._sections.length - 1 && hasMadeChoice) {
      buttons.next.prop("disabled", false);
    } else {
      buttons.next.prop("disabled", true);
    }

    if (this.section === this._sections.length - 1) {
      buttons.submit.prop("disabled", false);
    } else {
      buttons.submit.prop("disabled", true);
    }
  }

  _onSubmit(event, ...args) {
    event.preventDefault();
    if (this._submitted) return;

    this._submitted = true;
    super._onSubmit(event, ...args);
  }
}
