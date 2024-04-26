/**
 * Level-up and class addition handler.
 */
export class LevelUpForm extends FormApplication {
  /**
   * @internal
   * @type {ActorPF}
   */
  actor;

  /**
   * Relevant token if any.
   *
   * @internal
   * @type {TokenDocument}
   */
  token;

  /**
   * Temporary clone of the actor for seeing the results of various modifications with.
   *
   * @internal
   * @type {ActorPF}
   */
  simulacra;

  /**
   * Temporary clone of the class to simulate changes.
   *
   * @type {pf1.documents.item.ItemClassPF}
   */
  mold;

  config = {
    health: { manual: null, type: null, value: 0 },
    fcb: { choice: "none", unavailable: false, available: true },
    visibility: null,
    feats: 0,
    abilityScore: {
      new: 0,
      used: 0,
      get available() {
        return this.new - this.used;
      },
    },
  };

  static ICONS = {
    fcb: {
      none: "",
      hp: "systems/pf1/icons/skills/green_19.jpg",
      skill: "systems/pf1/icons/items/inventory/dice.jpg",
      alt: "systems/pf1/icons/skills/affliction_22.jpg",
    },
    health: {
      auto: "",
      manual: "systems/pf1/icons/skills/green_19.jpg",
      roll: "systems/pf1/icons/items/inventory/dice.jpg",
    },
  };

  useBackgroundSkills = game.settings.get("pf1", "allowBackgroundSkills");

  /**
   * @internal
   * @param {Actor} actor
   * @param {Item} item
   * @param {object} options
   */
  constructor(actor, item = null, options = {}) {
    super(item, options);

    if (item?.type !== "class") throw new Error("Can not level-up non-class items.");

    this.actor = actor ?? item?.actor ?? options.actor;

    if (!this.actor) throw new Error("LevelUpForm needs an actor");

    this.token = this.actor?.token ?? options.token;

    delete this.options.actor;
    delete this.options.token;

    this.config.isMythic = item.subType === "mythic";

    this.config.level = {
      old: item.system.level,
      new: item.system.level + 1,
      levelUp: item.system.level > 0,
      hd: {
        old: this.actor.system.attributes.hd.total,
        new: null,
      },
    };

    const config = this.config;
    this.config.abilityScore.upgrades = Object.fromEntries(
      Object.entries(pf1.config.abilities).map(([key, label]) => [
        key,
        {
          ...this.actor.system.abilities[key],
          key,
          label,
          added: 0,
          bonus: 0,
          get isEnhanced() {
            return this.total !== this.base;
          },
          get isNull() {
            return this.base === null;
          },
          get isValid() {
            return !this.isNull;
          },
          get isAvailable() {
            return this.isValid && config.abilityScore.available > 0;
          },
          get isModified() {
            return this.added != 0;
          },
        },
      ])
    );

    // By default hide NPCs for GMs
    if (!this.actor.hasPlayerOwner) this.config.visibility = CONST.DICE_ROLL_MODES.PRIVATE;

    this._initData();
    this._initChoices();
  }

  /**
   * @type {pf1.documents.item.ItemClassPF}
   */
  get item() {
    return this.object;
  }

  set item(cls) {
    this.object = cls;
  }

  get id() {
    const parent = this.actor.uuid.replaceAll(".", "-");
    const tag = this.item.system.tag || pf1.utils.createTag(this.item.name);
    return `level-up-${parent}-class-${tag}`;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["pf1", "level-up"],
      template: "systems/pf1/templates/apps/level-up.hbs",
      scrollY: ["section"],
      width: 820,
      height: "auto",
      submitOnChange: true,
      submitOnClose: false,
      closeOnSubmit: false,
      resizable: true,
    });
  }

  get title() {
    if (this.isLevelUp)
      return game.i18n.format("PF1.LevelUp.Increase", { class: this.item.name }) + ` – ${this.actor.name}`;
    else return game.i18n.format("PF1.LevelUp.Add", { class: this.item.name }) + ` – ${this.actor.name}`;
  }

  get isLevelUp() {
    return this.item.system.level > 0;
  }

  get isNewClass() {
    return !this.isLevelUp;
  }

  /**
   * @param {Actor} actor - Owning actor
   * @param {Item} item - Class item
   * @param {object} [options={}] - Additional options
   * @param {TokenDocument} [options.token] - Associated token
   * @returns {Promise<Item|null|undefined>} - Updated class item if updated or null if process was cancelled. Undefined if this re-opened existing dialog.
   */
  static async increaseLevel(actor, item, { token } = {}) {
    const app = Object.values(actor.apps).find((o) => o instanceof LevelUpForm && o._element && o.item === item);

    if (app) app.render(true, { focus: true });
    else return new Promise((resolve) => new this(actor, item, { token, resolve }).render(true, { focus: true }));
  }

  /**
   * @param {Actor} actor - Owning actor
   * @param {object} itemData - Class item data
   * @param {object} [options={}] - Additional options
   * @param {TokenDocument} [options.token] - Associated token
   * @returns {Promise<Item|null>}
   */
  static async addClassWizard(actor, itemData, { token } = {}) {
    // Add class item
    const item = new Item.implementation(itemData, { parent: actor });
    // Alter initial data
    item.updateSource({ system: { hp: 0, level: 0 } });
    item.reset();

    // Add level up form for new class
    return new Promise((resolve) => new this(actor, item, { token, resolve }).render(true, { focus: true }));
  }

  _prepareAssociations() {
    if (this.config.associations) return;

    const newLevel = this.config.level.new;

    const assocs =
      this.item.system.links?.classAssociations
        ?.filter((a) => a.level === newLevel)
        ?.map((a) => ({ ...fromUuidSync(a.uuid || ""), uuid: a.uuid })) ?? [];

    this.config.associations = assocs;
  }

  async getData() {
    const hpOptions = game.settings.get("pf1", "healthConfig").getClassHD(this.item);

    const itemData = this.item.toObject();

    const fcb = this.config.fcb;
    fcb.hp = itemData.system.fc?.hp?.value || 0;
    fcb.skill = itemData.system.fc?.skill?.value || 0;
    fcb.alt = itemData.system.fc?.alt?.value || 0;

    const result = {
      ...this.config,
      item: itemData,
      document: this.item,
      actor: this.actor,
      config: pf1.config,
      labels: {
        fcb: {
          skl: "PF1.LevelUp.FC.Skill.Label",
          hp: "PF1.LevelUp.FC.HP.Label",
          none: "PF1.LevelUp.FC.None.Label",
          alt: "PF1.LevelUp.FC.Alt.Label",
        },
      },
      fcb,
      abilityScore: this.config.abilityScore,
      icons: this.constructor.ICONS,
      visibilityOptions: pf1.const.messageVisibility,
      useBackgroundSkills: this.useBackgroundSkills,
    };

    // Disallow self roll for non-GMs.
    if (!game.user.isGM) delete result.visibilityOptions.selfroll;

    result.health.rate = Math.round(hpOptions.rate * 100);

    const hd = this.config.level.hd.total;
    result.abilityScore.new = pf1.config.levelAbilityScores[hd] ?? 0;

    result.health.value = result.health.delta;
    switch (result.health.type) {
      case "manual":
        result.health.value += result.health.raw;
        break;
      case "auto":
        result.health.value = result.health.raw;
        break;
      case "roll":
        result.health.value = result.health.raw;
        break;
    }

    result.skills.delta.ranks = result.skills.delta.adv;

    // Apply FCB
    result.health.bonus = 0;
    switch (result.fcb.choice) {
      case "hp":
        result.health.value += 1;
        result.health.bonus += 1;
        break;
      case "skl":
        result.skills.delta.ranks += 1;
        break;
    }

    // Apply abl mod
    //result.health.value += result.health.ability.mod;

    // Next ability score
    result.abilityScore.next = this._getNextAbilityScoreLandmark();

    result.ready = this.isReady();

    return result;
  }

  /**
   * Determine if this level-up is finalized.
   *
   * @returns {boolean}
   */
  isReady() {
    return this.config.abilityScore.available == 0;
  }

  /**
   * Get level at which next ability score is gained.
   *
   * @internal
   * @returns {number|null}
   */
  _getNextAbilityScoreLandmark() {
    if (this.config.isMythic) return null;

    const hd = this.config.level.hd.total;

    const current = pf1.config.levelAbilityScores[hd] ?? 0;
    if (current > 0) return null;

    // Next ability score
    const gains = Object.entries(pf1.config.levelAbilityScores)
      .map(([level, gained]) => Number(level))
      .filter((level) => level > hd);

    return gains[0] ?? null;
  }

  /**
   * Default health selection if auto health is not used.
   *
   * @internal
   * @returns {string}
   */
  _getDefaultHealthOption() {
    if (this.item.subType === "mythic") return "static";
    if (this.config.health.auto) return "auto";
    if (this.config.health.maximized) return "max";
    return "roll";
  }

  /**
   * Default hit points.
   *
   * @internal
   * @returns {number}
   */
  _getDefaultHitPoints() {
    return Math.ceil(1 + (this.item.system.hd - 1) / 2);
  }

  _prepareHealthData() {
    const hpConf = game.settings.get("pf1", "healthConfig");
    const clsConf = hpConf.getClassHD(this.item);
    const { auto, rate } = clsConf;

    this.config.health.auto = auto;
    this.config.health.manual ??= this._getDefaultHitPoints();
    this.config.health.hitDie = this.item.system.hd || 8;

    let delta = 0;
    if (this.config.isMythic) {
      delta = this.item.system.hd;
    }
    // Calculate auto health
    else if (auto) {
      const round = { up: Math.ceil, nearest: Math.round, down: Math.floor }[hpConf.rounding];
      const dieHealth = 1 + (this.item.system.hd - 1) * rate;
      // Continuous
      if (hpConf.continuous) {
        const { new: newHD, old: oldHD } = this.config.level.hd;
        const newHP = newHD + round(newHD * dieHealth);
        const oldHP = oldHD + round(oldHD * dieHealth);
        delta = newHP - oldHP;
      }
      // Discrete
      else {
        delta = round(dieHealth);
      }
    }
    // Manual health
    else {
      delta += this.config.health.manual;
    }

    this.config.health.delta = delta;

    // Con mod
    const hpAbl = this.simulacra.system.attributes?.hpAbility;
    const hpMod = this.simulacra.system.abilities[hpAbl]?.mod ?? 0;
    this.config.health.ability = { key: hpAbl, mod: hpMod };
  }

  _initData() {
    this._prepareAssociations();

    const cfg = this.config;

    cfg.fcb.available = this.isFavouredClass();
    cfg.fcb.unavailable = !cfg.fcb.available;

    // Create temporary actor to get correct values for the new level
    if (!this.simulacra) {
      const actorData = this.actor.toObject();
      const id = this.item.id ?? "MOLD000000000000";
      // New items don't yet exist on actor, so we add simulation of one to the simulacra
      if (!this.item.id) {
        const itemData = this.item.toObject();
        itemData._id = id;
        actorData.items.push(itemData);
      }
      this.simulacra = new Actor.implementation(actorData);
      this.mold = this.simulacra.items.get(id);
    }

    // Determine differences between current and new level
    this.oldLevel ??= this.getLevelData(cfg.level.old);
    const newLevel = this.getLevelData(cfg.level.new);
    this.newLevel = newLevel;
    cfg.level.hd = {
      new: newLevel.hd,
      old: this.oldLevel.hd,
      total: newLevel.totalHD,
    };
    cfg.level.feats = newLevel.feats - this.oldLevel.feats;
    // Saves
    const oldSaves = this.actor.system.attributes?.savingThrows;
    if (oldSaves) {
      const newSaves = this.simulacra.system.attributes?.savingThrows;
      cfg.level.fort = newSaves.fort.total - oldSaves.fort.total;
      cfg.level.ref = newSaves.ref.total - oldSaves.ref.total;
      cfg.level.will = newSaves.will.total - oldSaves.will.total;
    }
    cfg.level.bab = this.simulacra.system.attributes?.bab?.total - this.actor.system.attributes?.bab?.total;

    cfg.health.raw = newLevel.hp - this.oldLevel.hp;

    cfg.skills = {
      new: newLevel.skills,
      old: this.oldLevel.skills,
    };

    cfg.skills.delta = {
      adv: cfg.skills.new.value - cfg.skills.old.value,
      bg: cfg.skills.new.bg - cfg.skills.old.bg,
    };
    cfg.level.skills = cfg.skills.delta.adv + cfg.skills.delta.bg;

    this._prepareHealthData();
  }

  getLevelData(level) {
    const tempActor = this.simulacra;
    const cls = this.mold;
    cls.updateSource({ "system.level": level });
    tempActor.reset();

    let rollData = {};

    const isMindless = tempActor.system.abilities?.int?.value === null;

    // Rank counting
    let advSkillRanks = 0;
    let bgSkillRanks = 0;

    const intMod = !isMindless ? tempActor.system.abilities?.int?.mod ?? 0 : 0;

    tempActor.itemTypes.class
      .filter((cls) => cls.subType !== "mythic")
      .forEach((cls) => {
        const hd = cls.hitDice;
        if (hd === 0) return;

        const perLevel = cls.system.skillsPerLevel || 0;

        if (perLevel > 0) advSkillRanks += Math.max(1, perLevel + intMod) * hd;

        // Background skills
        if (this.useBackgroundSkills && pf1.config.backgroundSkillClasses.includes(cls.subType)) {
          const bgranks = hd * pf1.config.backgroundSkillsPerLevel;
          if (bgranks > 0) bgSkillRanks += bgranks;
        }
      });

    if (tempActor.system.details?.bonusSkillRankFormula) {
      rollData = tempActor.getRollData();
      const roll = Roll.defaultImplementation.safeRoll(tempActor.system.details.bonusSkillRankFormula, rollData);
      if (roll.err) console.error(`An error occurred in the Bonus Skill Rank formula of actor ${tempActor.name}.`);
      advSkillRanks += roll.total || 0;
    }

    // Calculate from changes
    tempActor.changes
      .filter((o) => o.subTarget === "bonusSkillRanks")
      .forEach((o) => {
        if (!o.value) return;
        advSkillRanks += o.value;
      });

    const feats = tempActor.getFeatCount().max;

    return {
      skills: { value: advSkillRanks, bg: bgSkillRanks },
      feats,
      hd: cls.hitDice,
      totalHD: tempActor.system.attributes.hd.total,
      hp: tempActor.system.attributes.hp.max,
      bab: cls.system.babBase,
      fort: cls.system.savingThrows?.fort?.base || 0,
      ref: cls.system.savingThrows?.ref?.base || 0,
      will: cls.system.savingThrows?.will?.base || 0,
    };
  }

  /**
   * @returns {boolean} Whether this form's associated class is a favoured class.
   * @todo Add better logic for determining this <26-01-22, Furyspark>
   */
  isFavouredClass() {
    return this.item.subType === "base";
  }

  async _updateObject(event, formData) {
    const mhp = this.config.health.manual;

    foundry.utils.mergeObject(this.config, foundry.utils.expandObject(formData));

    if (mhp !== this.config.health.manual) {
      this._prepareHealthData();
      // Assume adjusting manual health means user wants to use it
      this.config.health.type = "manual";
    }

    return this.render();
  }

  /**
   * @override
   * @param {JQuery<HTMLElement>} html
   */
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".ability-scores .ability-score .operator").on("click", this._onClickAbilityScoreOperator.bind(this));

    // Allow opening class association items for inspection
    html.find(".item-list .item").on("click", this._openItemSheet.bind(this));

    // Save button
    html.find('button[data-action="commit"]').on("click", this._onCommit.bind(this));

    // Manual/raw button
    html.find('button[data-action="skip"]').on("click", this._onSkip.bind(this));
  }

  async _openItemSheet(event) {
    const el = event.currentTarget;
    const uuid = el.dataset.itemUuid;
    const item = await fromUuid(uuid);
    item.sheet.render(true, { focus: true });
  }

  _onClickAbilityScoreOperator(event) {
    event.preventDefault();

    const a = event.currentTarget;
    const operator = a.dataset.operator;
    const ablKey = a.closest(".ability-score").dataset.key;

    const add = this._adjustAbilityScore(ablKey, operator);

    const abls = this.config.abilityScore;
    const upgrades = abls.upgrades[ablKey];

    upgrades.value += add;
    upgrades.added += add;
    abls.used += add;

    this.simulacra.updateSource({ system: { abilities: { [ablKey]: { value: upgrades.value } } } });

    // Cross-pollinate new data
    mergeObject(upgrades, this.simulacra.system.abilities[ablKey]);
    this._initData();

    this.render();
  }

  _initChoices() {
    this._initFCBChoices();
    this._initHPChoices();
  }

  _initFCBChoices() {
    if (!this.config.fcb.available) return;

    // Pre-select highest FCB
    const { hp, skill, alt } = this.item.system.fc;
    const fcb = [
      { id: "hp", value: hp?.value || 0 },
      { id: "skill", value: skill?.value || 0 },
      { id: "alt", value: alt?.value || 0 },
    ].sort((a, b) => b.value - a.value);

    const highest = fcb[0];
    if (highest.value > 0) this.config.fcb.choice = highest.id;
  }

  _initHPChoices() {
    if (this.config.isMythic) return;

    const hpConf = game.settings.get("pf1", "healthConfig");
    const clsConf = hpConf.getClassHD(this.item);

    if (!clsConf.maximized) return;

    const maxHDlimit = hpConf.maximized;

    const maximized = this.actor.itemTypes.class.reduce((maximized, cls) => {
      if (!hpConf.getClassHD(this.item).maximized) return maximized;
      return maximized + cls.hitDice;
    }, 0);

    const maxLeft = hpConf.maximized - maximized;
    this.config.health.maximized = Math.max(0, maxLeft);

    // Maximize auto health, too.
    if (maxLeft > 0) this.config.health.delta = this.config.health.hitDie;

    this.config.health.type = this._getDefaultHealthOption();
  }

  /**
   * @param {string} key - Ability score key
   * @param {string} op - Operator clicked
   * @returns {number} - Actual ability score adjustment
   */
  _adjustAbilityScore(key, op = null) {
    switch (op) {
      case "add":
        return 1;
      default:
        return 0;
      case "subtract":
        return -1;
    }
  }

  /**
   * @internal
   * @override
   */
  async close(options) {
    this.resolve?.(null);
    return super.close(options);
  }

  /**
   * Get effective health roll formula.
   *
   * @internal
   * @param {string} type
   * @returns {string}
   */
  _getHealthFormula(type) {
    const dieSize = this.item.system.hd;
    switch (type) {
      case "static":
        return `${dieSize}`;
      default:
        return `1d${dieSize}`;
    }
  }

  /**
   * Spoof roll, for maximized, auto and manual health.
   *
   * @internal
   * @param {Roll} roll
   * @param {number} value
   * @returns {Roll}
   */
  _spoofHealthRoll(roll, value) {
    const data = roll.toJSON();
    data.total = value;
    data.terms[0].results[0].result = value;
    return Roll.defaultImplementation.fromData(data);
  }

  /**
   * Generate roll instance for the health gain.
   *
   * @internal
   * @param {string} type
   * @param {string} formula
   * @returns {Roll}
   */
  _getHealthRoll(type, formula) {
    const roll = Roll.defaultImplementation.safeRoll(formula);
    switch (type) {
      case "auto":
      case "max":
        return this._spoofHealthRoll(roll, this.config.health.delta);
      case "manual":
        return this._spoofHealthRoll(roll, this.config.health.manual);
      default:
        return roll;
    }
  }

  /**
   * Commit level-up
   *
   * @internal
   * @param {Event} event
   */
  async _onCommit(event) {
    this._disableSheet();

    const cfg = this.config;
    const itemData = this.item.toObject().system;
    const updateData = {};

    const newLevel = itemData.level + 1;
    const cardData = {
      level: {
        previous: itemData.level,
        new: newLevel,
      },
      newFeatures: this.config.associations,
      hp: {},
    };

    const formula = this._getHealthFormula(cfg.health.type);
    const roll = this._getHealthRoll(cfg.health.type, formula);

    const labels = {
      manual: "PF1.LevelUp.Chat.Health.Manual",
      roll: "PF1.LevelUp.Chat.Health.Manual",
      max: "PF1.LevelUp.Chat.Health.Auto",
      auto: "PF1.LevelUp.Chat.Health.Auto",
      static: "PF1.LevelUp.Chat.Health.Static",
    };

    cardData.hp = {
      label: labels[cfg.health.type],
      roll: roll,
      add: roll.toAnchor().outerHTML,
    };

    const hpValue = roll.total || 0;
    updateData.hp = (itemData.hp || 0) + hpValue;

    // Apply FCB
    if (cfg.fcb.choice in itemData.fc) {
      const key = cfg.fcb.choice;
      const value = itemData.fc?.[key]?.value ?? 0;
      foundry.utils.setProperty(updateData, `fc.${key}.value`, value);

      const fcKey = { hp: "HP", skill: "Skill", alt: "Alt" }[key];
      cardData.fc = { type: key, label: `PF1.FavouredClassBonus.${fcKey}` };
    }

    // Gather information
    const oldFeatCount = this.actor.getFeatCount();

    const itemUpdates = [],
      newItems = [];

    // Apply ability score changes
    const ablUpdate = this._updateAbilityScore();
    if (ablUpdate) {
      if (ablUpdate.update) itemUpdates.push(ablUpdate.itemData);
      else newItems.push(ablUpdate.itemData);

      cardData.ability = Object.entries(this.config.abilityScore.upgrades).reduce((rv, [key, { added }]) => {
        if (added == 0) return rv;
        rv[key] = added;
        return rv;
      }, {});
    }

    updateData.level = newLevel;
    let cls = this.item;
    // Update existing class item
    if (cls.actor && cls.id) {
      itemUpdates.unshift({ system: updateData, _id: cls.id });
    }
    // Create new class item
    else {
      cls.updateSource({ system: updateData });
      newItems.unshift(cls.toObject());
    }

    // Add items
    if (newItems.length) {
      await this.actor.createEmbeddedDocuments("Item", newItems, { render: itemUpdates.length == 0 });
    }

    if (itemUpdates.length) {
      const newItems = await this.actor.updateEmbeddedDocuments("Item", itemUpdates);
      cls = newItems.find((i) => i.type === "class");
      if (cls) this.item = cls;
    }

    // Prepare remaining chat card info

    // Add extra info (new feats, skill ranks, etc.)
    const ex = {};
    cardData.extra = ex;

    // Show new feat count
    const featCount = this.actor.getFeatCount();
    featCount.new = Math.max(0, featCount.max - oldFeatCount.max);
    ex.feats = featCount;
    ex.enabled = featCount.new > 0;

    // Create chat message
    await this.createChatMessage(cardData);

    // Resolve promise and close interface
    this.resolve?.(cls);
    this.close();
  }

  async _onSkip(event) {
    event.preventDefault();

    this._disableSheet();

    const updateData = { system: { level: this.config.level.new } };

    let cls = this.item;

    // Old class
    if (cls.id && cls.actor === this.actor) {
      await cls.update(updateData);
    }
    // New class item
    else {
      cls.updateSource(updateData);
      cls = await Item.implementation.create(cls.toObject(), { parent: this.actor });
    }

    // Open class sheet for manual adjustment
    cls.sheet.render(true, { focus: true });

    this.resolve?.(null);
    this.close();
  }

  // Disable all buttons and inputs and set progress indicator
  _disableSheet() {
    const html = this.element[0];
    const form = html.querySelector("form");
    form.style.cursor = "progress";
    form.querySelectorAll("button,input,select").forEach((button) => {
      button.disabled = true;
      button.style.cursor = "progress";
    });
  }

  _updateAbilityScore() {
    // No ability score upgrades this level
    if (!this.config.abilityScore.upgrades) return;

    const choices = Object.entries(this.config.abilityScore.upgrades).reduce((rv, [key, { added }]) => {
      if (added == 0) return rv;
      rv[key] = added;
      return rv;
    }, {});

    if (Object.keys(choices).length === 0) return;

    const result = { choices };

    const item = this.actor.itemTypes.feat.find((o) => o.getFlag("pf1", "levelUp") === true);

    // Add level up ability score feature if it doesn't exist yet
    if (!item) {
      let itemData = pf1.config.levelAbilityScoreFeature;
      itemData = foundry.utils.mergeObject(
        itemData,
        {
          name: game.i18n.localize(itemData.name),
          system: {
            description: {
              value: game.i18n.localize(itemData.system.description.value),
            },
            changes: Object.entries(choices).reduce((cur, [target, formula]) => {
              const change = foundry.utils.mergeObject(pf1.components.ItemChange.defaultData, {
                subTarget: target,
                formula: `${formula}`,
                modifier: "untypedPerm",
              });

              cur.push(change);
              return cur;
            }, []),
          },
          flags: {
            pf1: {
              levelUp: true,
            },
          },
        },
        { inplace: false }
      );

      return { itemData, update: false };
    }
    // If a level up ability score feature already exists, update it
    else {
      const changes = foundry.utils.deepClone(item.toObject().system.changes ?? []);
      for (const [target, formula] of Object.entries(choices)) {
        const change = changes.find((o) => o.subTarget === target);

        // Update previous change
        if (change) {
          const prevValue = parseInt(change.formula);
          if (!Number.isNaN(prevValue)) {
            const newValue = prevValue + formula;
            change.formula = `${newValue}`;
            continue;
          }
        }

        // Add new change
        changes.push(
          foundry.utils.mergeObject(pf1.components.ItemChange.defaultData, {
            subTarget: target,
            formula: `${formula}`,
            modifier: "untypedPerm",
          })
        );
      }

      return { itemData: { "system.changes": changes, _id: item.id }, update: true };
    }
  }

  async createChatMessage(cardData) {
    const templateData = {
      ...cardData,
      config: pf1.config,
      item: this.item,
      actor: this.actor,
    };

    const rolls = cardData.hp?.roll ? [cardData.hp.roll] : [];

    const messageData = {
      content: await renderTemplate("systems/pf1/templates/chat/level-up.hbs", templateData),
      type: CONST.CHAT_MESSAGE_TYPES.OOC,
      speaker: ChatMessage.getSpeaker({ actor: this.actor, token: this.token }),
      rolls,
      flags: {
        pf1: {
          subject: { class: "levelUp" },
        },
      },
    };

    let rollMode = this.config.visibility || game.settings.get("core", "rollMode");
    // Prevent self message from non-GMs.
    if (!game.user.isGM && rollMode === CONST.DICE_ROLL_MODES.SELF) rollMode = CONST.DICE_ROLL_MODES.PRIVATE;

    // ChatMessage.implementation.applyRollMode(messageData, rollMode); // Has no effect

    return ChatMessage.create(messageData, { rollMode });
  }
}
