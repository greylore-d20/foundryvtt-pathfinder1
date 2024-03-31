import { RollPF } from "module/dice/roll.mjs";

export class LevelUpForm extends FormApplication {
  constructor(item, options = {}) {
    super(item, options);

    /** @type {ActorPF} */
    this.actor = item.actor ?? options.actor;

    if (!this.actor) throw new Error("LevelUpForm needs an actor");

    /**
     * Relevant token if any.
     */
    this.token = options.token;

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
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["pf1", "level-up"],
      template: "systems/pf1/templates/apps/level-up.hbs",
      width: 620,
      height: 420,
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
    return game.i18n.format("PF1.LevelUp.Title", { className: this.object.name });
  }

  static async addClassWizard(actor, rawData) {
    // Alter initial data
    foundry.utils.setProperty(rawData, "system.hp", 0);
    foundry.utils.setProperty(rawData, "system.level", 0);

    // Add class item
    const item = new Item.implementation(rawData);
    item.reset();

    // Add level up form for new class
    return new Promise((resolve) => new LevelUpForm(item, { actor, resolve }).render(true));
  }

  getData() {
    const result = {};

    result.data = this.object.toObject();
    result.actor = this.actor.toObject();
    result.config = pf1.config;

    // Add sections
    result.section = this.currentSection;
    result.sections = this._sections;

    // Add summary data
    result.summary = this.getSummaryData();

    result.uuid = this.object.uuid;

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
    const hpOptions = game.settings.get("pf1", "healthConfig").getClassHD(this.object);

    if (hpOptions.auto !== true) {
      result.push({
        name: "health",
        label: "PF1.LevelUp.Health.Label",
        choice: null,
        manualValue: Math.ceil(1 + (this.object.system.hd - 1) / 2),
        items: [
          {
            img: "systems/pf1/icons/items/inventory/dice.jpg",
            name: game.i18n.localize("PF1.LevelUp.Health.Roll.Label"),
            id: "roll",
            type: "html",
            target: "systems/pf1/templates/apps/level-up/health_roll.hbs",
          },
          {
            img: "systems/pf1/icons/skills/green_19.jpg",
            name: game.i18n.localize("PF1.LevelUp.Health.Manual.Label"),
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
    const newAbilityScores = pf1.config.levelAbilityScores[newHD];
    if (newAbilityScores > 0) {
      result.push({
        name: "ability",
        label: "PF1.LevelUp.AbilityScore.Label",
        template: "systems/pf1/templates/apps/level-up/ability-score.hbs",
        choice: null,
        abilities: Object.keys(pf1.config.abilities).reduce((cur, o) => {
          cur[o] = {
            value: this.actor.system.abilities[o].total,
            name: pf1.config.abilities[o],
            added: 0,
            isEnhanced: this.actor.system.abilities[o].total !== this.actor.system.abilities[o].base,
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
   * @todo Add better logic for determining this <26-01-22, Furyspark>
   */
  isFavouredClass() {
    return this.object.system.subType === "base";
  }

  async _updateObject(event, formData) {
    const parsedData = {
      item: { system: {} },
      chatData: {},
      newItems: [],
      summary: {},
      callbacks: [],
    };

    for (const section of this._sections) {
      this._parseSection(section, parsedData);
    }

    const itemData = parsedData.item ?? {},
      chatData = parsedData.chatData,
      newItems = [],
      callbacks = parsedData.callbacks;

    for (const item of parsedData.newItems) {
      const prevItem = newItems.find((o) => o._id === item._id);
      if (prevItem != null) foundry.utils.mergeObject(prevItem, item);
      else newItems.push(item);
    }

    // Add level
    chatData.level = {
      previous: this.object.system.level,
      new: this.object.system.level + 1,
    };

    // Update class
    itemData.system.level = chatData.level.new;
    const levelingClass = this.object;
    if (this.object.actor) {
      await levelingClass.update(itemData, { render: newItems.length == 0 });
    } else {
      levelingClass.updateSource(itemData);
      newItems.unshift(levelingClass.toObject());
    }

    const oldFeatCount = this.actor.getFeatCount();

    // Add items
    if (newItems.length) {
      await this.actor.createEmbeddedDocuments("Item", newItems);
    }

    // Run callbacks
    for (const cb of callbacks) {
      await cb.call(this);
    }

    // Add new class features to chat data
    {
      const classAssociations = this.object.getFlag("pf1", "links")?.classAssociations || {};
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
      featCount.new = Math.max(0, featCount.max - oldFeatCount.max);
      ex.feats = featCount;
      ex.enabled = featCount.new > 0;

      // Show new ability score
      const hd = this.actor.system.attributes.hd.total;
      if (pf1.config.levelAbilityScores[hd] > 0) {
        ex.enabled = true;
        ex.newAbilityScore = {
          label: game.i18n.localize("PF1.LevelUp.Chat.Extra.NewAbilityScore"),
        };
      }
    }

    this.resolve?.(this.object);

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
   * @param {object} section The given section.
   * @param {LevelUp_UpdateData} [result] Update data object to complement
   * @returns {LevelUp_UpdateData} Update data
   */
  _parseSection(section, result) {
    result ??= {
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
      result.item["system.hp"] = this.object.system.hp + hpValue;
      result.chatData.hp = {
        label: "PF1.LevelUp.Chat.Health.Manual",
        add: hpValue,
        roll: RollPF.safeRoll(`${hpValue}`),
      };
      result.summary.hp = hpValue;
    }
    // Roll health
    else if (section.choice === "roll") {
      const formula = `1d${this.object.system.hd}`;
      const roll = RollPF.safeRoll(formula);
      result.chatData.hp = {
        label: "PF1.LevelUp.Chat.Health.Roll",
        add: roll.toAnchor().outerHTML,
        roll,
      };
      if (!Number.isNaN(roll.total)) {
        result.item["system.hp"] = this.object.system.hp + roll.total;
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
      const key = `system.fc.${section.choice}.value`;
      result.item[key] = foundry.utils.getProperty(this.object, key) + 1;

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
      const newItem = foundry.utils.mergeObject(
        pf1.config.levelAbilityScoreFeature,
        {
          flags: {
            pf1: {
              levelUp: true,
            },
          },
        },
        { inplace: false }
      );

      newItem.name = game.i18n.localize(newItem.name);
      newItem.system.description.value = game.i18n.localize(newItem.system.description.value);

      // Add changes
      foundry.utils.setProperty(
        newItem,
        "system.changes",
        Object.entries(added).reduce((cur, o) => {
          const change = foundry.utils.mergeObject(pf1.components.ItemChange.defaultData, {
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
        const changes = foundry.utils.deepClone(item.system.changes ?? []);
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
            foundry.utils.mergeObject(pf1.components.ItemChange.defaultData, {
              subTarget: key,
              formula: `${value}`,
              modifier: "untypedPerm",
            })
          );
        }

        await item.update({
          "system.changes": changes,
        });
      };

      result.callbacks.push(cb);
    }

    return result;
  }

  async createChatMessage(formData) {
    const templateData = {
      formData,
      config: pf1.config,
      item: this.object.toObject(),
      actor: this.actor.toObject(),
    };

    const messageData = {
      content: await renderTemplate("systems/pf1/templates/chat/level-up.hbs", templateData),
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      speaker: ChatMessage.getSpeaker({ actor: this.actor, token: this.token }),
      rolls: [formData.hp?.roll ?? RollPF.safeRoll("0")],
      flags: {
        pf1: {
          subject: { class: "levelUp" },
        },
      },
    };

    ChatMessage.implementation.applyRollMode(messageData, game.settings.get("core", "rollMode"));

    return ChatMessage.create(messageData);
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
    foundry.utils.setProperty(this.currentSection, "choice", a.dataset.id);
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
    switch (a.dataset.dtype) {
      case "Number":
        value = parseFloat(value);
        break;
      case "Boolean":
        value = ["true", "1"].includes(value);
        break;
    }

    // Change section choice
    foundry.utils.setProperty(section, key, value);
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

  /**
   * @param {Event} event
   * @param  {...any} args
   */
  _onSubmit(event, ...args) {
    // Disable all buttons and set progress indicator
    const html = this.element[0];
    const form = html.querySelector("form");
    form.style.cursor = "progress";
    form.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
      button.style.cursor = "progress";
    });

    event.preventDefault();
    if (this._submitted) return;

    this._submitted = true;
    super._onSubmit(event, ...args);
  }
}
