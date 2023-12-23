import { calculateRange, convertDistance } from "../utils/lib.mjs";
import { getHighestChanges } from "../documents/actor/utils/apply-changes.mjs";
import { RollPF } from "../dice/roll.mjs";
import { keepUpdateArray, createTag } from "../utils/lib.mjs";
import { DamageRoll } from "../dice/damage-roll.mjs";
import { D20RollPF } from "../dice/d20roll.mjs";
import { getDistanceSystem } from "@utils";

export class ItemAction {
  /**
   * @internal
   * @type {pf1.applications.component.ItemActionSheet}
   */
  _sheet = null;
  /** @type {pf1.documents.item.ItemPF} */
  parent = null;
  apps = {};

  constructor(data, parent) {
    this.data = foundry.utils.mergeObject(ItemAction.defaultData, data);

    this.parent = parent;

    this.prepareData();
  }

  get normalMaterial() {
    return this.data.material?.normal || this.item.system.material?.normal || "";
  }

  get addonMaterial() {
    return (this.data.material?.addon || this.item.system.material?.addon || []).filter((o) => o ?? false);
  }

  /**
   * The action's alignment attributes, or `null` if the action has no alignment attributes
   *
   * @type {string|null}
   */
  get alignments() {
    return this.data.alignments ?? null;
  }

  get description() {
    return this.data.description;
  }

  /**
   * Returns whether this action is a combat maneuver
   *
   * @type {boolean}
   */
  get isCombatManeuver() {
    return ["mcman", "rcman"].includes(this.data.actionType);
  }

  /*
   * General activation accessor that removes determining which action economy is in use.
   */
  get activation() {
    return (
      (game.settings.get("pf1", "unchainedActionEconomy") ? this.data.activation.unchained : this.data.activation) ?? {}
    );
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

    if (parent instanceof pf1.documents.item.ItemPF) {
      // Prepare data
      data = data.map((dataObj) => foundry.utils.mergeObject(this.defaultData, dataObj));
      const newActionData = foundry.utils.deepClone(parent.system.actions || []);
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
    return this.parent.actor;
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
    return ["mwak", "rwak", "twak", "msak", "rsak", "mcman", "rcman"].includes(this.data.actionType);
  }

  get hasMultiAttack() {
    return (
      this.hasAttack &&
      ((this.data.attackParts != null && this.data.attackParts.length > 0) ||
        this.data.formulaicAttacks?.count?.value > 0)
    );
  }

  get autoDeductCharges() {
    return this.getChargeCost() > 0;
  }

  get isCharged() {
    return this.item.isCharged;
  }

  get isSelfCharged() {
    return ["single", "day", "week", "charges"].includes(this.data.uses.self?.per);
  }

  /**
   * @param {object} [options] - Additional options to configure behavior.
   * @param {object} [options.rollData=null] - Pre-determined roll data to pass for determining the charge cost.
   * @returns {number} Cost in charges for this action.
   */
  getChargeCost({ rollData = null } = {}) {
    if (!this.isCharged) return 0;

    const isSpell = this.item.type === "spell";
    const isSpellpointSpell = isSpell && this.item.useSpellPoints();

    let formula = !isSpellpointSpell ? this.data.uses.autoDeductChargesCost : this.data.uses.spellPointCost;
    if (!formula) {
      formula = this.item.getDefaultChargeFormula();
    } else if (typeof formula !== "string") {
      console.warn(this.item.name, "action", this.name, "has invalid charge formula:", formula, this);
      formula = this.item.getDefaultChargeFormula();
    }

    rollData ??= this.getRollData();
    const cost = RollPF.safeRoll(formula, rollData).total;
    return this.item.isSingleUse ? Math.clamped(cost, -1, 1) : cost;
  }

  /**
   * @type {number} The action's first increment range (in system configured units)
   */
  get range() {
    return this.getRange({ type: "single" });
  }

  /**
   * @type {number} The action's minimum range.
   */
  get minRange() {
    return this.getRange({ type: "min" });
  }

  /**
   * @type {number} The action's maximum range (range multiplied by range increments).
   */
  get maxRange() {
    return this.getRange({ type: "max" });
  }

  /**
   * @param {object} [options] - Additional options to configure behavior.
   * @param {string} [options.type="single"] - What type of range to query. Either "single" (for a single range increment), "max" or "min".
   * @param {object} [options.rollData=null] - Specific roll data to pass.
   * @returns {number|null} The given range, in system configured units, or `null` if no range is applicable.
   */
  getRange({ type = "single", rollData = null } = {}) {
    const baseRange = this.data.range.units;
    const range = type === "min" ? this.data.range.minValue : this.data.range.value;
    let rangeType = type === "min" ? this.data.range.minUnits : baseRange;

    // Special case of ignoring min range for invalid range types
    if (type === "min" && !["reach", "ft", "mi", "seeText"].includes(baseRange)) return 0;

    if (!rangeType) {
      if (type === "min") {
        // Downgrade range to melee when getting minimum range of reach weapons and no explicit minimum range is defined
        if (baseRange === "reach") rangeType = "melee";
        else return 0;
      } else return null;
    }

    rollData ??= this.getRollData();
    const singleIncrementRange = calculateRange(range, rangeType, rollData)[0];

    if (["single", "min"].includes(type)) return singleIncrementRange;
    return singleIncrementRange * this.data.range.maxIncrements;
  }

  /** @type {boolean} - Has measured template */
  get hasTemplate() {
    const { type, size } = this.data.measureTemplate;
    return !!type && !!size;
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
   * Effective critical range when accounting for broken status and action type.
   *
   * @type {number}
   */
  get critRange() {
    if (this.item.isBroken || this.isCombatManeuver) return 20;
    return this.data.ability?.critRange || 20;
  }

  /**
   * Get power attack, deadly aim or piranha strike multiplier.
   *
   * @param {object} [options] - Additional options
   * @param {object} [options.rollData=null] - Roll data instance
   * @returns {number} - Effective multiplier
   */
  getPowerAttackMult({ rollData = null } = {}) {
    rollData ??= this.getRollData();

    const held = rollData.item?.held || "1h";

    let mult = rollData.action?.powerAttack?.multiplier;
    // Use defined override
    if (mult) return mult;

    // Determine default based on attack type and held option
    mult = 1;
    if (this.item.subType === "natural") {
      // Primary
      if (rollData.action.naturalAttack?.primaryAttack) {
        // Primary attack gets +50% damage like with two-handing if ability score multiplier is 1.5x or higher
        if (rollData.action.ability?.damageMult >= 1.5) {
          mult = 1.5;
        }
      }
      // Secondary
      else {
        mult = 0.5;
      }
    } else {
      if (held === "2h") mult = 1.5;
      else if (held === "oh") mult = 0.5;
    }

    return mult;
  }

  /**
   * Does the item have range defined.
   *
   * @type {boolean}
   */
  get hasRange() {
    const units = this.data.range?.units;
    if (units === "none") return false;
    return !!units;
  }

  /* -------------------------------------------- */

  /**
   * Does the item provide an amount of healing instead of conventional damage?
   *
   * @returns {boolean}
   */
  get isHealing() {
    return this.data.actionType === "heal" && this.hasDamage;
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
    return !!this.data.save?.type;
  }

  /**
   * @param {object} [rollData] - Data to pass to the roll. If none is given, get new roll data.
   * @returns {number} The Difficulty Class for this action.
   */
  getDC(rollData = null) {
    rollData ??= this.getRollData();
    let result = 10;

    // Get conditional save DC bonus
    const dcBonus = rollData.dcBonus ?? 0;

    if (this.item.type === "spell") {
      const spellbook = this.item.spellbook;
      if (spellbook) {
        let formula = spellbook.baseDCFormula;

        const data = rollData.action;
        if (data.save.dc.length > 0) formula += ` + ${data.save.dc}`;

        return RollPF.safeRoll(formula, rollData).total + dcBonus;
      } else {
        // Assume standard base formula for spells with minimum required abilty score
        const level = this.item?.system.level ?? 1;
        const minAbl = Math.floor(level / 2);
        return 10 + level + minAbl + dcBonus;
      }
    } else {
      const dcFormula = this.data.save.dc.toString() || "0";
      result = RollPF.safeRoll(dcFormula, rollData).total + dcBonus;
      return result;
    }
  }

  get hasSound() {
    return !!this.data.soundEffect;
  }

  get enhancementBonus() {
    return this.data.enh?.value ?? this.item.system.enh;
  }

  get isRanged() {
    return ["rwak", "twak", "rsak", "rcman"].includes(this.data.actionType);
  }

  /**
   * An array of changes affecting this action's damage
   *
   * @type {ItemChange[]}
   */
  get damageSources() {
    // Build damage context
    const contexts = [pf1.const.actionTypeToContext[this.data.actionType] ?? "damage"];
    if (this.isRanged) contexts.push("rdamage");
    else contexts.push("mdamage");
    if (this.item.subType === "natural") contexts.push("ndamage");

    const changes = this.item.getContextChanges(contexts);
    if (changes.length == 0) return [];
    return getHighestChanges(changes, { ignoreTarget: true });
  }

  /**
   * @type {ItemChange[]} All relevant Changes for this action's damage.
   */
  get allDamageSources() {
    const conds = this.data.conditionals
      .filter((c) => c.default)
      .filter((c) => c.modifiers.find((m) => m.target === "damage"));
    const rollData = this.getRollData();

    if (!rollData) return [];

    const mods = Object.keys(pf1.config.bonusModifiers);

    // Turn relevant conditionals into structure accepted by getHighestChanges
    const fakeCondChanges = [];
    for (const c of conds) {
      for (const m of c.modifiers) {
        if (m.target !== "damage") continue;
        const roll = RollPF.safeRoll(m.formula, rollData);
        if (roll.err) continue;
        const isModifier = mods.includes(m.type);
        fakeCondChanges.push({
          flavor: c.name,
          value: roll.total,
          modifier: isModifier ? m.type : "untyped", // Turn unrecognized types to untyped
          type: isModifier ? undefined : m.type, // Preserve damage type if present
          formula: m.formula,
        });
      }
    }

    const allChanges = [...this.damageSources, ...fakeCondChanges];

    // Add enhancement bonus
    const enh = this.enhancementBonus;
    if (enh) {
      allChanges.push({
        flavor: game.i18n.localize("PF1.EnhancementBonus"),
        value: enh,
        modifier: "enh",
        formula: enh.toString(),
      });
    }

    // Add special cases specific to the item
    // Broken
    if (this.item.isBroken) {
      allChanges.push({
        flavor: game.i18n.localize("PF1.Broken"),
        value: -2,
        modifier: "untyped",
        formula: "-2",
      });
    }

    return getHighestChanges(allChanges, { ignoreTarget: true });
  }

  getRollData() {
    const result = this.item.getRollData();

    result.action = foundry.utils.deepClone(this.data);
    result.dc = this.hasSave ? this.getDC(result) : 0;

    if (Hooks.events["pf1GetRollData"]?.length > 0) Hooks.callAll("pf1GetRollData", this, result);

    return result;
  }

  static get defaultData() {
    return {
      _id: foundry.utils.randomID(16),
      name: game.i18n.localize("PF1.Action"),
      img: "systems/pf1/icons/skills/gray_04.jpg",
      description: "",
      tag: "",
      activation: {
        cost: 1,
        type: "nonaction",
        unchained: {
          cost: 1,
          type: "nonaction",
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
        autoDeductChargesCost: "",
        self: {
          value: 0,
          maxFormula: "",
          per: "",
        },
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
        attack: "",
        damage: "",
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
        multiplier: null,
        damageBonus: 2,
        critMultiplier: 1,
      },
      naturalAttack: {
        primaryAttack: true,
        secondary: {
          attackBonus: "-5",
          damageMult: 0.5,
        },
      },
      held: "",
      nonlethal: false,
      touch: false,
      ammoType: "",
      spellEffect: "",
      area: "",
      conditionals: [],
      enh: {
        value: null,
      },
      material: {
        normal: "",
        addon: "",
      },
      alignments: {
        lawful: null,
        chaotic: null,
        good: null,
        evil: null,
      },
    };
  }

  prepareData() {
    const rollData = this.getRollData();
    // Parse formulaic attacks
    if (this.hasAttack) {
      this.parseFormulaicAttacks({ rollData });
    }

    // Update conditionals
    if (this.data.conditionals instanceof Array) {
      this.conditionals = this._prepareConditionals(this.data.conditionals);
    }

    // Prepare max personal charges
    if (this.data.uses.self?.per) {
      const maxFormula = this.data.uses.self.per === "single" ? "1" : this.data.uses.self.maxFormula;
      const maxUses = RollPF.safeTotal(maxFormula, rollData);
      foundry.utils.setProperty(this.data, "uses.self.max", maxUses);
    }

    // Remove enhancement bonus override, if wrong type
    if (this.data.enh?.value != null && !["weapon", "attack"].includes(this.item.type)) {
      foundry.utils.setProperty(this.data, "enh.value", null);
    }

    // Initialize default damageMult if missing
    if (this.data.ability?.damageMult === undefined) {
      foundry.utils.setProperty(this.data, "ability.damageMult", 1);
    }
    if (this.data.naturalAttack?.secondary?.damageMult === undefined) {
      foundry.utils.setProperty(this.data, "naturalAttack.secondary.damageMult", 0.5);
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
      } else conditional = new pf1.components.ItemConditional(o, this);
      collection.set(o._id || conditional.data._id, conditional);
    }
    return collection;
  }

  async delete() {
    const actions = foundry.utils.deepClone(this.item.system.actions);
    actions.findSplice((a) => a._id == this.id);

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
    const idx = this.item.system.actions.findIndex((action) => action._id === this.id);
    if (idx < 0) throw new Error(`Action ${this.id} not found on item.`);
    const prevData = foundry.utils.deepClone(this.data);
    const newUpdateData = foundry.utils.mergeObject(prevData, foundry.utils.expandObject(updateData));

    // Make sure this action has a name, even if it's removed
    newUpdateData["name"] ||= this.name;

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

    await this.item.update({ "system.actions": { [idx]: newUpdateData } });
  }

  /* -------------------------------------------- */
  /*  Chat Data Generation												*/
  /* -------------------------------------------- */

  /**
   * Generates {@link ChatData} for this action's parent item, but with this action's data,
   * regardless of whether it is the first action or not.
   *
   * @see {@link ItemPF#getChatData}
   * @param {object} [chatDataOptions] - Options passed to {@link ItemPF#getChatData} affecting the chat data
   * @returns {Promise<import("../documents/item/item-pf.mjs").ChatData>} Chat data for this action's parent and this action
   */
  async getChatData(chatDataOptions = {}) {
    return this.item.getChatData({ ...chatDataOptions, actionId: this.id });
  }

  /**
   * Returns labels related to this particular action
   *
   * @param {object} [options]
   * @param {object} [options.rollData] - Pre-determined roll data. If not provided, finds the action's own roll data.
   * @returns {Record<string, string>} This action's labels
   */
  getLabels({ rollData } = {}) {
    const actionData = this.data;
    const labels = {};
    rollData ??= this.getRollData();

    // Activation method
    if (actionData.activation) {
      const activation = this.activation;
      if (activation) {
        const isUnchainedActionEconomy = game.settings.get("pf1", "unchainedActionEconomy");
        const activationTypes = isUnchainedActionEconomy
          ? pf1.config.abilityActivationTypes_unchained
          : pf1.config.abilityActivationTypes;
        const activationTypesPlural = isUnchainedActionEconomy
          ? pf1.config.abilityActivationTypesPlurals_unchained
          : pf1.config.abilityActivationTypesPlurals;

        const activationType = activation.type || "nonaction";
        if (activation.cost > 1 && !!activationTypesPlural[activationType]) {
          labels.activation = [activation.cost.toString(), activationTypesPlural[activationType]].filterJoin(" ");
        } else {
          labels.activation = [
            ["minute", "hour", "action"].includes(activationType) && activation.cost ? activation.cost.toString() : "",
            activationTypes[activationType],
          ].filterJoin(" ");
        }
      }
    }

    // Difficulty Class
    if (this.hasSave) {
      const totalDC = rollData.dc + (rollData.dcBonus ?? 0);
      labels.save = game.i18n.format("PF1.DCThreshold", { threshold: totalDC });
    }

    if (this.hasRange) {
      const sourceUnits = actionData.range.units;
      const rangeLabel = pf1.config.distanceUnits[sourceUnits];
      if (["personal", "touch", "melee", "reach"].includes(sourceUnits)) {
        labels.range = rangeLabel;
      } else {
        const range = this.getRange({ type: "single", rollData });
        if (range > 0) {
          const usystem = getDistanceSystem();
          const rangeUnit = usystem === "metric" ? "m" : "ft";
          labels.range = `${range} ${rangeUnit}`;
        }
        if (["close", "medium", "long"].includes(sourceUnits)) {
          labels.range += ` (${rangeLabel})`;
        }
      }
    }

    return labels;
  }

  // -----------------------------------------------------------------------

  parseFormulaicAttacks({ formula = null, rollData } = {}) {
    if (!this.actor) return;

    const exAtkCountFormula = formula || this.data.formulaicAttacks?.count?.formula || "0";
    let extraAttacks = 0,
      xaroll;
    rollData ??= this.getRollData();
    if (exAtkCountFormula.length > 0) {
      xaroll = RollPF.safeRoll(exAtkCountFormula, rollData);
      extraAttacks = Math.clamped(xaroll.total, 0, 50); // Arbitrarily clamp attacks
    }
    if (xaroll?.err) {
      const msg = game.i18n.format("PF1.ErrorActionFormula", {
        action: this.name,
        item: this.item?.name,
        actor: this.actor?.name,
      });
      console.warn(msg, xaroll.err, exAtkCountFormula, this);
      ui.notifications.warn(msg, { console: false });
    }

    // Test bonus attack formula
    const exAtkBonusFormula = this.data.formulaicAttacks?.bonus?.formula || "0";
    try {
      if (exAtkBonusFormula.length > 0 && exAtkBonusFormula != 0) {
        rollData.attackCount = 1;
        RollPF.safeRoll(exAtkBonusFormula, rollData);
        delete rollData.attackCount;
      }
    } catch (err) {
      const msg = game.i18n.format("PF1.ErrorActionFormula", {
        action: this.name,
        item: this.item?.name,
        actor: this.actor?.name,
      });
      console.error(msg, err, exAtkBonusFormula, this);
      ui.notifications.error(msg, { console: false });
    }

    // Update item
    foundry.utils.setProperty(this.data, "formulaicAttacks.count.value", extraAttacks);

    return extraAttacks;
  }

  /**
   * Get all appropriate context changes for attack rolls.
   *
   * @see {@link ItemPF.getContextChanges}
   */
  get attackSources() {
    const contexts = ["~attackCore"];
    if (this.isCombatManeuver) contexts.push("cmb");
    if (this.isRanged) contexts.push("rattack");
    else contexts.push("mattack");
    if (this.item.subType === "natural") contexts.push("nattack");
    if (this.data.actionType === "twak") contexts.push("tattack");
    return this.item.getContextChanges(contexts);
  }

  /**
   * Place an attack roll using an item (weapon, feat, spell, or equipment)
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

    const isRanged = this.isRanged;
    const isCMB = this.isCombatManeuver;

    const size = rollData.traits?.size ?? "med";

    // Determine size bonus
    rollData.sizeBonus = !isCMB ? pf1.config.sizeMods[size] : pf1.config.sizeSpecialMods[size];

    // Add misc bonuses/penalties
    rollData.item.proficiencyPenalty = -4;

    // Determine ability score modifier
    const abl = actionData.ability.attack;

    // Define Roll parts
    const parts = [];

    // Add size bonus
    if (rollData.sizeBonus !== 0) parts.push(`@sizeBonus[${game.i18n.localize("PF1.Size")}]`);

    const ability = rollData.abilities?.[abl];
    // Add ability modifier
    if (ability?.mod !== 0) {
      parts.push(`@abilities.${abl}.mod[${pf1.config.abilities[abl]}]`);
    }

    // Add change bonus
    const changes = this.attackSources;

    // Get attack bonus
    getHighestChanges(
      changes.filter((c) => {
        c.applyChange(this.actor);
        return c.operator !== "set";
      }),
      { ignoreTarget: true }
    )
      .filter((c) => c.value != 0)
      .reduce((cur, c) => {
        cur.push({
          value: c.value,
          source: c.flavor,
        });
        return cur;
      }, [])
      .forEach((c) => {
        parts.push(`${c.value}[${RollPF.cleanFlavor(c.source)}]`);
      });

    // Add bonus parts
    parts.push(...extraParts);
    // Add attack bonus
    if (typeof actionData.attackBonus === "string" && !["", "0"].includes(actionData.attackBonus)) {
      parts.push(actionData.attackBonus);
    }
    // Backwards compatibility
    else if (typeof actionData.attackBonus === "number") {
      rollData.item.attackBonus = actionData.attackBonus;
      parts.push(`@item.attackBonus[${game.i18n.localize("PF1.AttackRollBonus")}]`);
    }

    // Add masterwork bonus to changes (if applicable)
    if (["mwak", "rwak", "twak", "mcman", "rcman"].includes(this.data.actionType) && this.item.system.masterwork) {
      changes.push(
        new pf1.components.ItemChange({
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
        new pf1.components.ItemChange({
          formula: this.enhancementBonus.toString(),
          operator: "add",
          subTarget: "attack",
          modifier: "enh",
          value: this.enhancementBonus,
          flavor: game.i18n.localize("PF1.EnhancementBonus"),
        })
      );
    }

    // Add proficiency penalty
    try {
      if (!this.item.getProficiency(true)) {
        parts.push(`@item.proficiencyPenalty[${game.i18n.localize("PF1.ProficiencyPenalty")}]`);
      }
    } catch (error) {
      // Ignore proficiency incompatibility.
    }

    // Add secondary natural attack penalty
    if (this.item.system.subType === "natural" && primaryAttack === false) {
      const penalty = -5;
      parts.push(`${penalty}[${game.i18n.localize("PF1.SecondaryAttack")}]`);
    }
    // Add bonus
    if (bonus) {
      rollData.bonus = RollPF.safeRoll(bonus, rollData).total;
      parts.push(`@bonus[${game.i18n.localize("PF1.SituationalBonus")}]`);
    }

    const roll = await new pf1.dice.D20RollPF(
      [rollData.d20 || "1d20", ...parts.filter((p) => !!p)].join("+"),
      rollData,
      {
        critical: this.critRange,
      }
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

    const inner = TextEditor.enrichHTML(effectContent, { rollData: rollData, relativeTo: this.actor });
    return `<div class="flexcol property-group"><label>${game.i18n.localize(
      "PF1.EffectNotes"
    )}</label><div class="flexrow tag-list">${inner}</div></div>`;
  }

  /**
   * Roll damage for an action.
   *
   * @param {object} [options] - Options configuring the damage roll
   * @param {object | null} [options.data=null] - rollData to be used
   * @param {boolean} [options.critical=false] - Whether to roll critical damage
   * @param {string[]} [options.extraParts] - Additional strings added to the roll formula
   * @param {object} [options.conditionalParts=[]] - Conditional data sets
   * @param {boolean} [options.primaryAttack] - Whether this is the primary attack
   * @returns {Promise<DamageRoll[]>} Created damage rolls, one roll per damage part
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
    const parts =
      this.data.damage.parts?.map((damage) => {
        return { base: damage.formula, extra: [], damageType: damage.type, type: "normal" };
      }) ?? [];
    // Add conditionals damage
    conditionalParts["damage.normal"]?.forEach((p) => {
      const [base, damageType, isExtra] = p;
      isExtra ? parts[0].extra.push(base) : parts.push({ base, extra: [], damageType, type: "normal" });
    });
    // Add critical damage parts
    if (critical === true) {
      const critParts = this.data.damage?.critParts;
      if (critParts) {
        parts.push(
          ...critParts.map((damage) => {
            return { base: damage.formula, extra: [], damageType: damage.type, type: "crit" };
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
      const nonCritParts = this.data.damage?.nonCritParts;
      if (nonCritParts) {
        parts.push(
          ...nonCritParts.map((damage) => {
            return { base: damage.formula, extra: [], damageType: damage.type, type: "nonCrit" };
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
      const changes = this.damageSources;

      // Add enhancement bonus to changes
      if (this.enhancementBonus) {
        changes.push(
          new pf1.components.ItemChange({
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
          return c.operator !== "set";
        }),
        { ignoreTarget: true }
      ).forEach((c) => {
        let value = c.value;
        // Put in parenthesis if there's a chance it is more complex
        if (/[\s+-?:]/.test(value)) value = `(${value})`;
        parts[0].extra.push(`${value}[${c.flavor}]`);
      });

      // Add broken penalty
      if (this.item.isBroken) {
        const label = game.i18n.localize("PF1.Broken");
        parts[0].extra.push(`-2[${label}]`);
      }
    }

    // Determine ability score modifier
    const abl = this.data.ability.damage;
    const ability = rollData.abilities?.[abl];
    if (ability) {
      // Determine ability score bonus
      rollData.ablDamage = Math.floor(ability.mod * rollData.ablMult);
      if (ability.mod < 0) rollData.ablDamage = ability.mod;

      // Determine ability score label
      const ablLabel = pf1.config.abilities[abl];

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
        const roll = await new DamageRoll(formula, rollData, {
          damageType: part.damageType,
          type: part.type,
        }).evaluate({
          async: true,
        });
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
    if (this.hasAttack) result["attack"] = game.i18n.localize(pf1.config.conditionalTargets.attack._label);
    if (this.hasDamage) result["damage"] = game.i18n.localize(pf1.config.conditionalTargets.damage._label);
    result["size"] = game.i18n.localize(pf1.config.conditionalTargets.size._label);
    if (this.item.type === "spell" || this.hasSave)
      result["effect"] = game.i18n.localize(pf1.config.conditionalTargets.effect._label);
    // Only add Misc target if subTargets are available
    if (Object.keys(this.getConditionalSubTargets("misc")).length > 0) {
      result["misc"] = game.i18n.localize(pf1.config.conditionalTargets.misc._label);
    }
    return result;
  }

  /**
   * Generates lists of conditional subtargets this attack can have.
   *
   * @param {string} target - The target key, as defined in PF1.conditionTargets.
   * @returns {Object<string, string>} A list of conditionals
   */
  getConditionalSubTargets(target) {
    const result = {};
    // Add static targets
    if (foundry.utils.hasProperty(pf1.config.conditionalTargets, target)) {
      for (const [k, v] of Object.entries(pf1.config.conditionalTargets[target])) {
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
   * @param {string} target - The target key as defined in PF1.conditionTargets.
   * @returns {Object.<string, string>} A list of bonus types.
   * */
  getConditionalModifierTypes(target) {
    const result = {};
    if (target === "attack" || target === "damage") {
      // Add bonusModifiers from PF1.bonusModifiers
      for (const [k, v] of Object.entries(pf1.config.bonusModifiers)) {
        result[k] = v;
      }
    }
    if (target === "damage") {
      for (const damageType of pf1.registry.damageTypes) {
        result[damageType.id] = damageType.name;
      }
    }
    return result;
  }

  /* Generates a list of critical applications for a given formula target.
   * @param {string} target - The target key as defined in PF1.conditionalTargets.
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
        result = { ...result, crit: "PF1.OnCritBonusFormula", nonCrit: "PF1.NonMultBonusFormula" };
      }
    }
    return result;
  }

  /**
   * @param {object} options - See ItemPF#useAttack.
   * @returns {Promise<void>}
   */
  async use(options = {}) {
    options.actionId = this.id;

    return this.item.use(options);
  }

  /**
   * Effective ammo type.
   *
   * @type {string|null} - Ammo type string or null if this doesn't use ammo.
   */
  get ammoType() {
    const type = this.data.ammoType;
    if (type === "none") return null;
    return type || this.item.system.ammo?.type || null;
  }

  /**
   * @type {pf1.applications.component.ItemActionSheet} - Returns current sheet for this action or creates one if it doesn't exist.
   */
  get sheet() {
    if (!this._sheet) {
      this._sheet = new pf1.applications.component.ItemActionSheet(this);
    }
    return this._sheet;
  }

  /**
   * Render all connected application instances.
   *
   * @param {boolean} [force=false] - Force rendering
   * @param {object} [context={}] - Optional context
   */
  render(force = false, context = {}) {
    Object.values(this.apps).forEach((app) => app.render(force, context));
  }
}
