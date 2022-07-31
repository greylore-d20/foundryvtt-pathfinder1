import { calculateRange, convertDistance } from "../../lib.js";
import { getHighestChanges } from "../../actor/apply-changes.js";
import { RollPF } from "../../roll.js";
import { keepUpdateArray, createTag } from "../../lib.js";

export class ItemAction {
  constructor(data, parent) {
    this.data = data;
    /** @type {import("../entity.js").ItemPF} */
    this.parent = parent;
    this.apps = {};
    this.sheet = null;

    this.prepareData();
  }

  /**
   * Creates an action.
   *
   * @param {object[]} data - Data to initialize the action(s) with.
   * @param {object} context - An object containing context information.
   * @param {ItemPF} [context.parent] - The parent entity to create the action within.
   * @returns The resulting actions, or an empty array if nothing was created.
   */
  static async create(data, context = {}) {
    const { parent } = context;

    if (parent instanceof game.pf1.documents.ItemPF) {
      // Prepare data
      data = data.map((dataObj) => mergeObject(this.defaultData, dataObj));
      const newActionData = deepClone(parent.system.actions || []);
      newActionData.push(...data);

      // Update parent
      await parent.update({ "system.actions": newActionData });

      // Return results
      return data.map((o) => parent.actions.get(o._id));
    }

    return [];
  }

  static get defaultDamageType() {
    return {
      values: [],
      custom: "",
    };
  }

  get item() {
    return this.parent;
  }
  get actor() {
    return this.parent.parentActor;
  }

  get id() {
    return this.data._id;
  }
  get img() {
    return this.data.img;
  }
  get name() {
    return this.data.name;
  }
  get tag() {
    return this.data.tag || createTag(this.name);
  }

  get hasAction() {
    return !!this.data.actionType;
  }
  get hasAttack() {
    return ["mwak", "rwak", "msak", "rsak", "mcman", "rcman"].includes(this.data.actionType);
  }

  get hasMultiAttack() {
    return (
      this.hasAttack &&
      ((this.data.attackParts != null && this.data.attackParts.length > 0) ||
        this.data.formulaicAttacks?.count?.value > 0)
    );
  }

  get autoDeductCharges() {
    return this.isCharged && this.data.uses.autoDeductCharges === true;
  }

  get isCharged() {
    return this.item.isCharged;
  }

  get chargeCost() {
    const formula = this.data.uses.autoDeductChargesCost;
    if (!(typeof formula === "string" && formula.length > 0)) return 1;
    const cost = RollPF.safeRoll(formula, this.getRollData()).total;
    return this.item.isSingleUse ? Math.max(-1, Math.min(1, cost)) : cost;
  }

  // Returns range (in system configured units)
  get range() {
    const range = this.data.range.value;
    const rangeType = this.data.range.units;

    if (rangeType == null) return null;

    return calculateRange(range, rangeType, this.getRollData());
  }

  get minRange() {
    const rng = this.data.range;
    if (rng.minUnits !== "" && rng.minValue !== null) {
      const rollData = this.getRollData();
      const formula = { melee: "@range.melee", reach: "@range.reach" }[rng.minUnits] ?? (rng.minValue || "0");
      return convertDistance(RollPF.safeRoll(formula, rollData).total)[0];
    }
    return 0;
  }

  get maxRange() {
    return this.data.range.maxIncrements * this.range;
  }

  get hasTemplate() {
    const v = this.data.measureTemplate.type;
    const s = this.data.measureTemplate.size;
    return (
      typeof v === "string" && v !== "" && ((typeof s === "string" && s.length > 0) || (typeof s === "number" && s > 0))
    );
  }

  /**
   * Does the action implement a damage roll as part of its usage
   *
   * @type {boolean}
   */
  get hasDamage() {
    return !!this.data.damage.parts?.length;
  }

  /**
   * Does the item have range defined.
   *
   * @type {boolean}
   */
  get hasRange() {
    return this.data.range?.units != null;
  }

  /* -------------------------------------------- */

  /**
   * Does the item provide an amount of healing instead of conventional damage?
   *
   * @returns {boolean}
   */
  get isHealing() {
    return this.data.actionType === "heal" && this.data.damage.parts.length;
  }

  get hasEffect() {
    return this.hasDamage || (this.data.effectNotes != null && this.data.effectNotes.length > 0);
  }

  /**
   * Does the Item implement a saving throw as part of its usage
   *
   * @type {boolean}
   */
  get hasSave() {
    return typeof this.data.save?.type === "string" && this.data.save?.type.length > 0;
  }

  /**
   * @param {object} [rollData] - Data to pass to the roll. If none is given, get new roll data.
   * @returns {number} The Difficulty Class for this action.
   */
  getDC(rollData = null) {
    // No actor? No DC!
    if (!this.actor) return 0;

    rollData = rollData ?? this.getRollData();
    let result = 10;

    // Get conditional save DC bonus
    const dcBonus = rollData["dcBonus"] ?? 0;

    if (this.item.type === "spell") {
      const spellbook = this.item.spellbook;
      if (spellbook) {
        let formula = spellbook.baseDCFormula;

        const data = rollData.action;
        if (data.save.dc.length > 0) formula += ` + ${data.save.dc}`;

        return RollPF.safeRoll(formula, rollData).total + dcBonus;
      }
    } else {
      const dcFormula = this.data.save.dc.toString() || "0";
      result = RollPF.safeRoll(dcFormula, rollData).total + dcBonus;
      return result;
    }
    return result;
  }

  get hasSound() {
    return !!this.data.soundEffect;
  }

  get enhancementBonus() {
    return this.data.enh?.value ?? this.item.system.enh;
  }

  getRollData() {
    const result = this.item.getRollData();
    result.action = deepClone(this.data);

    result.dc = this.hasSave ? this.getDC(result) : 0;

    return result;
  }

  static get defaultData() {
    return {
      _id: randomID(16),
      name: game.i18n.localize("PF1.Action"),
      img: "systems/pf1/icons/skills/gray_04.jpg",
      description: "",
      tag: "",
      activation: {
        cost: 1,
        type: "",
      },
      unchainedAction: {
        activation: {
          cost: 1,
          type: "",
        },
      },
      duration: {
        value: null,
        units: "",
      },
      target: {
        value: "",
      },
      range: {
        value: null,
        units: "",
        maxIncrements: 1,
        minValue: null,
        minUnits: "",
      },
      uses: {
        autoDeductCharges: true,
        autoDeductChargesCost: "1",
      },
      measureTemplate: {
        type: "",
        size: "",
        overrideColor: false,
        customColor: "",
        overrideTexture: false,
        customTexture: "",
      },
      attackName: "",
      actionType: null,
      attackBonus: "",
      critConfirmBonus: "",
      damage: {
        parts: [],
        critParts: [],
        nonCritParts: [],
      },
      attackParts: [],
      formulaicAttacks: {
        count: { formula: "" },
        bonus: { formula: "" },
        label: null,
      },
      formula: "",
      ability: {
        attack: null,
        damage: null,
        damageMult: 1,
        critRange: 20,
        critMult: 2,
      },
      save: {
        dc: "",
        type: "",
        description: "",
      },
      effectNotes: [],
      attackNotes: [],
      soundEffect: "",
      powerAttack: {
        multiplier: "",
        damageBonus: 2,
        critMultiplier: 1,
      },
      naturalAttack: {
        secondary: {
          attackBonus: "-5",
          damageMult: 0.5,
        },
      },
      nonlethal: false,
      usesAmmo: false,
      spellEffect: "",
      spellArea: "",
      conditionals: [],
      enh: {
        value: null,
      },
    };
  }

  prepareData() {
    this.labels = {};

    // Parse formulaic attacks
    if (this.hasAttack) {
      this.parseFormulaicAttacks({ formula: getProperty(this.data, "data.formulaicAttacks.count.formula") });
    }

    // Update conditionals
    if (this.data.conditionals instanceof Array) {
      this.conditionals = this._prepareConditionals(this.data.conditionals);
    }
  }

  _prepareConditionals(conditionals) {
    const prior = this.conditionals;
    const collection = new Collection();
    for (const o of conditionals) {
      let conditional = null;
      if (prior && prior.has(o._id)) {
        conditional = prior.get(o._id);
        conditional.data = o;
        conditional.prepareData();
      } else conditional = new game.pf1.documentComponents.ItemConditional(o, this);
      collection.set(o._id || conditional.data._id, conditional);
    }
    return collection;
  }

  async delete() {
    const actions = deepClone(this.item.system.actions);
    const idx = this.item.system.actions.indexOf(this.data);
    actions.splice(idx, 1);

    // Close applications
    const promises = [];
    for (const app of Object.values(this.apps)) {
      promises.push(app.close());
    }
    await Promise.all(promises);

    // Delete action
    return this.item.update({ "system.actions": actions });
  }

  async update(updateData, options = {}) {
    const idx = this.item.system.actions.indexOf(this.data);
    const prevData = deepClone(this.data);
    const newUpdateData = flattenObject(mergeObject(prevData, expandObject(updateData)));

    // Make sure this action has a name, even if it's removed
    if (!newUpdateData["name"]) newUpdateData["name"] = this.name;

    // Make sure stuff remains an array
    {
      const keepPaths = [
        "attackParts",
        "damage.parts",
        "damage.critParts",
        "damage.nonCritParts",
        "attackNotes",
        "effectNotes",
        "conditionals",
      ];

      for (const path of keepPaths) {
        keepUpdateArray(this.data, newUpdateData, path);
      }
    }

    await this.item.update({ [`system.actions.${idx}`]: expandObject(newUpdateData) });
    await this.sheet?.render();
  }

  /* -------------------------------------------- */
  /*  Chat Data Generation												*/
  /* -------------------------------------------- */

  /**
   * Generates {@link ChatData} for this action's parent item, but with this action's data,
   * regardless of whether it is the first action or not.
   *
   * @see {@link ItemPF#getChatData}
   * @param {EnrichmentOptions} [htmlOptions] - Options passed to {@link ItemPF#getChatData} affecting text enrichment
   * @param {object} [chatDataOptions] - Options passed to {@link ItemPF#getChatData} affecting the chat data
   * @returns {import("../entity.js").ChatData} Chat data for this action's parent and this action
   */
  getChatData(htmlOptions = {}, chatDataOptions = {}) {
    return this.parent.getChatData(htmlOptions, { ...chatDataOptions, actionId: this.id });
  }

  /**
   * Returns labels related to this particular action
   *
   * @param {object} [options]
   * @param {object} [options.rollData] - Pre-determined roll data. If not provided, finds the action's own roll data.
   * @returns {Record<string, string>} This action's labels
   */
  getLabels(options = {}) {
    const actionData = this.data;
    const labels = {};
    const rollData = options.rollData ?? this.getRollData();

    // Activation method
    if (actionData.activation) {
      const activationTypes = game.settings.get("pf1", "unchainedActionEconomy")
        ? CONFIG.PF1.abilityActivationTypes_unchained
        : CONFIG.PF1.abilityActivationTypes;
      const activationTypesPlural = game.settings.get("pf1", "unchainedActionEconomy")
        ? CONFIG.PF1.abilityActivationTypesPlurals_unchained
        : CONFIG.PF1.abilityActivationTypesPlurals;

      const activation = game.settings.get("pf1", "unchainedActionEconomy")
        ? actionData.unchainedAction.activation || {}
        : actionData.activation || {};
      if (activation && activation.cost > 1 && activationTypesPlural[activation.type] != null) {
        labels.activation = [activation.cost.toString(), activationTypesPlural[activation.type]].filterJoin(" ");
      } else if (activation) {
        labels.activation = [
          ["minute", "hour", "action"].includes(activation.type) && activation.cost ? activation.cost.toString() : "",
          activationTypes[activation.type],
        ].filterJoin(" ");
      }
    }

    // Difficulty Class
    if (this.hasSave) {
      labels.save = `DC ${this.getDC()}`;
    }

    return labels;
  }

  // -----------------------------------------------------------------------

  parseFormulaicAttacks({ formula = null } = {}) {
    if (!this.actor) return;

    const exAtkCountFormula = formula ?? (this.data.formulaicAttacks?.count?.formula || "");
    let extraAttacks = 0,
      xaroll;
    const rollData = this.getRollData();
    if (exAtkCountFormula.length > 0) {
      xaroll = RollPF.safeRoll(exAtkCountFormula, rollData);
      extraAttacks = Math.min(50, Math.max(0, xaroll.total)); // Arbitrarily clamp attacks
    }
    if (xaroll?.err) {
      const msg = game.i18n.localize("PF1.ErrorItemFormula").format(this.name, this.actor?.name);
      console.warn(msg, xaroll.err, exAtkCountFormula);
      ui.notifications.warn(msg);
    }

    // Test bonus attack formula
    const exAtkBonusFormula = this.data.formulaicAttacks?.bonus || "";
    try {
      if (exAtkBonusFormula.length > 0) {
        rollData["attackCount"] = 1;
        RollPF.safeRoll(exAtkBonusFormula, rollData);
      }
    } catch (err) {
      const msg = game.i18n.localize("PF1.ErrorItemFormula").format(this.name, this.actor?.name);
      console.warn(msg, err, exAtkBonusFormula);
      ui.notifications.warn(msg);
    }

    // Update item
    setProperty(this.data, "formulaicAttacks.count.value", extraAttacks);

    return extraAttacks;
  }

  /**
   * Place an attack roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.d20Roll logic for the core implementation
   *
   * @param root0
   * @param root0.data
   * @param root0.extraParts
   * @param root0.bonus
   * @param root0.primaryAttack
   */
  async rollAttack({ data = null, extraParts = [], bonus = null, primaryAttack = true } = {}) {
    const rollData = data ?? this.getRollData();
    const itemData = rollData.item;
    const actionData = rollData.action;

    rollData.item.primaryAttack = primaryAttack;

    const isRanged = ["rwak", "rsak", "rcman"].includes(itemData.actionType);
    const isCMB = ["mcman", "rcman"].includes(itemData.actionType);

    // Determine size bonus
    rollData.sizeBonus = !isCMB
      ? CONFIG.PF1.sizeMods[rollData.traits.size]
      : CONFIG.PF1.sizeSpecialMods[rollData.traits.size];

    // Add misc bonuses/penalties
    rollData.item.proficiencyPenalty = -4;

    // Determine ability score modifier
    const abl = actionData.ability.attack;

    // Define Roll parts
    let parts = [];

    this.actor.sourceDetails["system.attributes.attack.shared"]
      ?.reverse()
      .forEach((s) => parts.push(`${s.value}[${s.name}]`));

    // CMB specific modifiers
    if (isCMB) {
      this.actor.sourceDetails["system.attributes.cmb.bonus"]
        ?.reverse()
        .forEach((s) => parts.push(`${s.value}[${s.name}]`));
    }

    // Add size bonus
    if (rollData.sizeBonus !== 0) parts.push(`@sizeBonus[${game.i18n.localize("PF1.Size")}]`);

    // Add ability modifier
    if (abl != "" && rollData.abilities[abl] != null && rollData.abilities[abl].mod !== 0) {
      parts.push(`@abilities.${abl}.mod[${CONFIG.PF1.abilities[abl]}]`);
    }
    // Add bonus parts
    parts = parts.concat(extraParts);
    // Add attack bonus
    if (typeof actionData.attackBonus === "string" && !["", "0"].includes(actionData.attackBonus)) {
      parts.push(actionData.attackBonus);
    }
    // Backwards compatibility
    else if (typeof actionData.attackBonus === "number") {
      rollData.item.attackBonus = actionData.attackBonus;
      parts.push(`@item.attackBonus[${game.i18n.localize("PF1.AttackRollBonus")}]`);
    }

    // Add change bonus
    const changes = this.item.getContextChanges(isRanged ? "rattack" : "mattack");
    // Add masterwork bonus to changes (if applicable)
    if (["mwak", "rwak", "mcman", "rcman"].includes(this.data.actionType) && this.item.system.masterwork) {
      changes.push(
        new game.pf1.documentComponents.ItemChange({
          formula: "1",
          operator: "add",
          subTarget: "attack",
          modifier: "enh",
          value: 1,
          flavor: game.i18n.localize("PF1.EnhancementBonus"),
        })
      );
    }
    // Add enhancement bonus to changes
    if (this.enhancementBonus) {
      changes.push(
        new game.pf1.documentComponents.ItemChange({
          formula: this.enhancementBonus.toString(),
          operator: "add",
          subTarget: "attack",
          modifier: "enh",
          value: this.enhancementBonus,
          flavor: game.i18n.localize("PF1.EnhancementBonus"),
        })
      );
    }
    let changeBonus = [];
    // Get attack bonus
    changeBonus = getHighestChanges(
      changes.filter((c) => {
        c.applyChange(this.actor);
        return !["set", "="].includes(c.operator);
      }),
      { ignoreTarget: true }
    ).reduce((cur, c) => {
      cur.push({
        value: c.value,
        source: c.flavor,
      });
      return cur;
    }, []);
    for (const c of changeBonus) {
      parts.push(`${c.value}[${RollPF.cleanFlavor(c.source)}]`);
    }

    // Add proficiency penalty
    if (this.item.system.type === "attack" && !itemData.proficient) {
      parts.push(`@item.proficiencyPenalty[${game.i18n.localize("PF1.ProficiencyPenalty")}]`);
    }
    // Add secondary natural attack penalty
    if (this.item.system.attackType === "natural" && primaryAttack === false) {
      const penalty = -5;
      parts.push(`${penalty}[${game.i18n.localize("PF1.SecondaryAttack")}]`);
    }
    // Add bonus
    if (bonus) {
      rollData.bonus = RollPF.safeRoll(bonus, rollData).total;
      parts.push(`@bonus[${game.i18n.localize("PF1.SituationalBonus")}]`);
    }

    const roll = await RollPF.create(
      [rollData.d20 || "1d20", ...parts.filter((p) => !!p)].join("+"),
      rollData
    ).evaluate({ async: true });
    return roll;
  }

  /* -------------------------------------------- */

  /**
   * Only roll the item's effect.
   *
   * @param root0
   * @param root0.critical
   * @param root0.primaryAttack
   */
  rollEffect({ critical = false, primaryAttack = true } = {}) {
    const rollData = this.getRollData();

    if (!this.hasEffect) {
      throw new Error("You may not make an Effect Roll with this Item.");
    }

    // Determine critical multiplier
    rollData.critMult = 1;
    if (critical) rollData.critMult = this.data.ability.critMult;
    // Determine ability multiplier
    if (this.data.ability.damageMult != null) rollData.ablMult = this.data.ability.damageMult;

    // Create effect string
    const effectNotes = this.parent.getContextNotes("attacks.effect").reduce((cur, o) => {
      o.notes
        .reduce((cur2, n) => {
          cur2.push(...n.split(/[\n\r]+/));
          return cur2;
        }, [])
        .forEach((n) => {
          cur.push(n);
        });
      return cur;
    }, []);
    effectNotes.push(...this.data.effectNotes);
    let effectContent = "";
    for (const fx of effectNotes) {
      if (fx.length > 0) {
        effectContent += `<span class="tag">${fx}</span>`;
      }
    }

    if (effectContent.length === 0) return "";

    const inner = TextEditor.enrichHTML(effectContent, { rollData: rollData });
    return `<div class="flexcol property-group"><label>${game.i18n.localize(
      "PF1.EffectNotes"
    )}</label><div class="flexrow tag-list">${inner}</div></div>`;
  }

  /**
   * Place an attack roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.d20Roll logic for the core implementation
   *
   * @param options
   */
  async rollFormula(options = {}) {
    const itemData = this.data;
    if (!itemData.formula) {
      throw new Error(game.i18n.localize("PF1.ErrorNoFormula").format(this.name));
    }

    // Define Roll Data
    const rollData = this.parent.getRollData();
    rollData.item = itemData;
    const title = `${this.name} - ${game.i18n.localize("PF1.OtherFormula")}`;

    const roll = await RollPF.create(itemData.formula, rollData).evaluate({ async: true });
    return roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.parent }),
      flavor: itemData.chatFlavor || title,
      rollMode: game.settings.get("core", "rollMode"),
    });
  }

  /**
   * Place a damage roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.damageRoll logic for the core implementation
   *
   * @param root0
   * @param root0.data
   * @param root0.critical
   * @param root0.extraParts
   * @param root0.conditionalParts
   * @param root0.primaryAttack
   */
  async rollDamage({
    data = null,
    critical = false,
    extraParts = [],
    conditionalParts = {},
    primaryAttack = true,
  } = {}) {
    const rollData = data ?? this.getRollData();

    if (!this.hasDamage) {
      throw new Error("You may not make a Damage Roll with this Action.");
    }

    // Determine critical multiplier
    rollData.critMult = 1;
    if (critical) rollData.critMult = this.data.ability.critMult;
    // Determine ability multiplier
    if (rollData.ablMult == null) rollData.ablMult = rollData.action?.ability.damageMult;

    // Define Roll parts
    let parts = this.data.damage.parts.map((p) => {
      return { base: p[0], extra: [], damageType: p[1], type: "normal" };
    });
    // Add conditionals damage
    conditionalParts["damage.normal"]?.forEach((p) => {
      const [base, damageType, isExtra] = p;
      isExtra ? parts[0].extra.push(base) : parts.push({ base, extra: [], damageType, type: "normal" });
    });
    // Add critical damage parts
    if (critical === true) {
      if (getProperty(this.data, "damage.critParts") != null) {
        parts = parts.concat(
          this.data.damage.critParts.map((p) => {
            return { base: p[0], extra: [], damageType: p[1], type: "crit" };
          })
        );
      }
      // Add conditional critical damage parts
      conditionalParts["damage.crit"]?.forEach((p) => {
        const [base, damageType, isExtra] = p;
        isExtra ? parts[0].extra.push(base) : parts.push({ base, extra: [], damageType, type: "crit" });
      });
    }
    // Add non-critical damage parts
    if (critical === false) {
      if (getProperty(this.data, "damage.nonCritParts") != null) {
        parts = parts.concat(
          this.data.damage.nonCritParts.map((p) => {
            return { base: p[0], extra: [], damageType: p[1], type: "nonCrit" };
          })
        );
      }
      // Add conditional non-critical damage parts
      conditionalParts["damage.nonCrit"]?.forEach((p) => {
        const [base, damageType, isExtra] = p;
        isExtra ? parts[0].extra.push(base) : parts.push({ base, extra: [], damageType, type: "nonCrit" });
      });
    }

    if (!this.isHealing) {
      // Gather changes
      const isSpell = ["msak", "rsak", "spellsave"].includes(this.data.actionType);
      const isWeapon = ["mwak", "rwak"].includes(this.data.actionType);
      const changes = this.item.getContextChanges(isSpell ? "sdamage" : isWeapon ? "wdamage" : "damage");

      // Add enhancement bonus to changes
      if (this.enhancementBonus) {
        changes.push(
          new game.pf1.documentComponents.ItemChange({
            formula: this.enhancementBonus.toString(),
            operator: "add",
            subTarget: "damage",
            modifier: "enh",
            value: this.enhancementBonus,
            flavor: game.i18n.localize("PF1.EnhancementBonus"),
          })
        );
      }

      // Get damage bonus
      getHighestChanges(
        changes.filter((c) => {
          c.applyChange(this.actor);
          return !["set", "="].includes(c.operator);
        }),
        { ignoreTarget: true }
      ).forEach((c) => {
        let value = c.value;
        // Put in parenthesis if there's a chance it is more complex
        if (/[\s+-?:]/.test(value)) value = `(${value})`;
        parts[0].extra.push(`${value}[${c.flavor}]`);
      });

      // Add broken penalty
      if (this.item.system.broken) {
        const label = game.i18n.localize("PF1.Broken");
        parts[0].extra.push(`-2[${label}]`);
      }
    }

    // Determine ability score modifier
    const abl = this.data.ability.damage;
    if (typeof abl === "string" && abl !== "") {
      // Determine ability score bonus
      rollData.ablDamage = Math.floor(rollData.abilities[abl].mod * rollData.ablMult);
      if (rollData.abilities[abl].mod < 0) rollData.ablDamage = rollData.abilities[abl].mod;

      // Determine ability score label
      const ablLabel = CONFIG.PF1.abilities[abl];

      // Add ability score
      parts[0].extra.push(`@ablDamage[${ablLabel}]`);
    }

    // Create roll
    const rolls = [];
    for (let a = 0; a < parts.length; a++) {
      const part = parts[a];
      let rollParts = [];
      if (a === 0) rollParts = [...part.extra, ...extraParts];
      const formula = [part.base, ...rollParts].join(" + ");
      // Skip empty formulas instead of erroring on them
      if (formula.length == 0) continue;
      try {
        const roll = {
          roll: await RollPF.create(formula, rollData).evaluate({ async: true }),
          damageType: part.damageType,
          type: part.type,
        };
        // Remove all negative damage results on critical damage
        if (critical) {
          const parts = [];
          roll.roll.terms.forEach((t, i, arr) => {
            const prior = arr[i - 1];
            const isPriorNegativeOperator = prior instanceof OperatorTerm && prior.operator === "-";

            if (t instanceof NumericTerm) {
              const isNegative =
                (t.number <= 0 && !isPriorNegativeOperator) || (t.number >= 0 && isPriorNegativeOperator);
              if (isNegative) {
                if (prior instanceof OperatorTerm) parts.pop();
              } else {
                if (t.flavor) parts.push(`${t.number}[${t.flavor}]`);
                else parts.push(`${t.number}`);
              }
            } else parts.push(t.formula);
          });
          roll.roll = await RollPF.create(parts.join(" "), rollData).evaluate({ async: true });
        }

        // Add to result
        rolls.push(roll);
      } catch (err) {
        console.error("Error with damage formula:", formula, this);
        throw err;
      }
    }

    return rolls;
  }

  /**
   * Generates a list of targets this modifier can have.
   *
   * @param {ItemPF} item - The item for which the modifier is to be created.
   * @returns {Object<string, string>} A list of targets
   */
  getConditionalTargets() {
    const result = {};
    if (this.hasAttack) result["attack"] = game.i18n.localize(CONFIG.PF1.conditionalTargets.attack._label);
    if (this.hasDamage) result["damage"] = game.i18n.localize(CONFIG.PF1.conditionalTargets.damage._label);
    result["size"] = game.i18n.localize(CONFIG.PF1.conditionalTargets.size._label);
    if (this.item.type === "spell" || this.hasSave)
      result["effect"] = game.i18n.localize(CONFIG.PF1.conditionalTargets.effect._label);
    // Only add Misc target if subTargets are available
    if (Object.keys(this.getConditionalSubTargets("misc")).length > 0) {
      result["misc"] = game.i18n.localize(CONFIG.PF1.conditionalTargets.misc._label);
    }
    return result;
  }

  /**
   * Generates lists of conditional subtargets this attack can have.
   *
   * @param {string} target - The target key, as defined in CONFIG.PF1.conditionTargets.
   * @returns {Object<string, string>} A list of conditionals
   */
  getConditionalSubTargets(target) {
    const result = {};
    // Add static targets
    if (hasProperty(CONFIG.PF1.conditionalTargets, target)) {
      for (const [k, v] of Object.entries(CONFIG.PF1.conditionalTargets[target])) {
        if (!k.startsWith("_") && !k.startsWith("~")) result[k] = v;
      }
    }
    // Add subtargets depending on attacks
    if (["attack", "damage"].includes(target)) {
      // Add specific attacks
      if (this.hasAttack) {
        result["attack_0"] = `${game.i18n.localize("PF1.Attack")} 1`;
      } else {
        delete result["rapidShotDamage"];
      }
      if (this.hasMultiAttack) {
        for (const [k, v] of Object.entries(this.data.attackParts)) {
          result[`attack_${Number(k) + 1}`] = v[1];
        }
      }
    }
    // Add subtargets affecting effects
    if (target === "effect") {
      if (this.hasSave) result["dc"] = game.i18n.localize("PF1.DC");
    }
    // Add misc subtargets
    if (target === "misc") {
      // Add charges subTarget with specific label
      if (this.isCharged && this.type !== "spell") result["charges"] = game.i18n.localize("PF1.ChargeCost");
    }
    return result;
  }

  /* Generates lists of conditional modifier bonus types applicable to a formula.
   * @param {string} target - The target key as defined in CONFIG.PF1.conditionTargets.
   * @returns {Object.<string, string>} A list of bonus types.
   * */
  getConditionalModifierTypes(target) {
    const result = {};
    if (target === "attack" || target === "damage") {
      // Add bonusModifiers from CONFIG.PF1.bonusModifiers
      for (const [k, v] of Object.entries(CONFIG.PF1.bonusModifiers)) {
        result[k] = v;
      }
    }
    if (target === "damage") {
      for (const [k, v] of Object.entries(CONFIG.PF1.damageTypes)) {
        result[k] = v;
      }
    }
    return result;
  }

  /* Generates a list of critical applications for a given formula target.
   * @param {string} target - The target key as defined in CONFIG.PF1.conditionalTargets.
   * @returns {Object.<string, string>} A list of critical applications.
   * */
  getConditionalCritical(target) {
    let result = {};
    // Attack bonuses can only apply as critical confirm bonus
    if (target === "attack") {
      result = { ...result, normal: "PF1.Normal", crit: "PF1.CriticalConfirmBonus" };
    }
    // Damage bonuses can be multiplied or not
    if (target === "damage") {
      result = { ...result, normal: "PF1.Normal" };
      if (this.hasAttack) {
        result = { ...result, crit: "PF1.CritDamageBonusFormula", nonCrit: "PF1.NonCritDamageBonusFormula" };
      }
    }
    return result;
  }

  /**
   * @param {object} options - See ItemPF#useAttack.
   * @returns {Promise<void>}
   */
  async use(options = {}) {
    options.actionID = this.id;

    return this.item.useAttack(options);
  }
}
