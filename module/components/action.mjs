import { calculateRange } from "@utils";
import { getHighestChanges } from "@actor/utils/apply-changes.mjs";
import { RollPF } from "../dice/roll.mjs";
import { DamageRoll } from "../dice/damage-roll.mjs";

/**
 * Action pseudo-document
 */
export class ItemAction extends foundry.abstract.DataModel {
  /**
   * @internal
   * @type {pf1.applications.component.ItemActionSheet}
   */
  _sheet = null;
  /** @type {Record<number,Application>} */
  apps = {};

  static FALLBACK_IMAGE = "systems/pf1/icons/skills/gray_04.jpg";

  constructor(data, options) {
    if (options instanceof Item) {
      foundry.utils.logCompatibilityWarning(
        "ItemAction constructor's second parameter as parent is deprecated. Please wrap it in options object like with datamodels.",
        {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        }
      );
      options = { parent: options };
    }

    super(data, options);
  }

  /**
   * @override
   * @protected
   * @param {object} options - Constructor options
   */
  _initialize(options = {}) {
    super._initialize(options);

    this.prepareData();
  }

  _configure(options) {
    super._configure(options);

    Object.defineProperty(this, "_conditionals", {
      value: new Collection(),
      writable: false,
      enumerable: false,
    });
  }

  static defineSchema() {
    const fields = foundry.data.fields;
    const mustFill = { required: true, blank: false, nullable: false };
    const blankToNull = { nullable: true, blank: false };
    return {
      _id: new fields.StringField({ ...mustFill, initial: () => foundry.utils.randomID(16), readonly: true }),
      name: new fields.StringField({ ...mustFill, initial: () => game.i18n.localize("PF1.Action") }),
      img: new fields.FilePathField({ categories: ["IMAGE"], initial: null, blank: false }),
      description: new fields.HTMLField(),
      tag: new fields.StringField({ blank: false, nullable: true }), // TODO: slug field
      activation: new fields.SchemaField({
        cost: new fields.NumberField({ initial: 1, nullable: true }),
        type: new fields.StringField({ initial: "nonaction" }), // pf1.config.abilityActivationTypes
        unchained: new fields.SchemaField({
          cost: new fields.NumberField({ initial: 1, nullable: true }),
          type: new fields.StringField({ initial: "nonaction" }), // pf1.config.abilityActivationTypes_unchained
        }),
      }),
      duration: new fields.SchemaField({
        value: new fields.StringField(),
        units: new fields.StringField(),
        dismiss: new fields.BooleanField({ initial: false }),
      }),
      // Refactor into just .target string?
      target: new fields.SchemaField({
        value: new fields.StringField(),
      }),
      range: new fields.SchemaField({
        value: new fields.StringField({ ...blankToNull }),
        units: new fields.StringField({ ...blankToNull }),
        maxIncrements: new fields.NumberField({ integer: true, nullable: false, initial: 1 }),
        minValue: new fields.StringField({ ...blankToNull }),
        minUnits: new fields.StringField({ ...blankToNull }),
      }),
      uses: new fields.SchemaField({
        autoDeductChargesCost: new fields.StringField(),
        perAttack: new fields.BooleanField({ initial: false }),
        self: new fields.SchemaField({
          value: new fields.NumberField({ integer: true, min: 0, nullable: false, initial: 0 }),
          maxFormula: new fields.StringField(),
          per: new fields.StringField(),
        }),
      }),
      measureTemplate: new fields.SchemaField({
        type: new fields.StringField(),
        size: new fields.StringField(), // Formula field
        color: new fields.ColorField(),
        texture: new fields.FilePathField({ categories: ["IMAGE", "VIDEO"], initial: null, blank: false }),
      }),
      bab: new fields.StringField(), // Formula
      attackName: new fields.StringField(),
      actionType: new fields.StringField({ initial: "other" }), // pf1.config.itemActionTypes
      attackBonus: new fields.StringField(), // Formula
      critConfirmBonus: new fields.StringField(), // Formula,
      damage: new fields.SchemaField({
        parts: new fields.ArrayField(new fields.ObjectField()),
        critParts: new fields.ArrayField(new fields.ObjectField()),
        nonCritParts: new fields.ArrayField(new fields.ObjectField()),
      }),
      extraAttacks: new fields.SchemaField({
        type: new fields.StringField(), // pf1.config.extraAttacks
        manual: new fields.ArrayField(new fields.ObjectField()), // TODO
        formula: new fields.SchemaField({
          count: new fields.StringField(), // Formula
          bonus: new fields.StringField(), // Formula
          label: new fields.StringField(),
        }),
      }),
      ability: new fields.SchemaField({
        attack: new fields.StringField(), // ability key
        damage: new fields.StringField(), // ability key
        max: new fields.NumberField({ integer: true, nullable: true }),
        damageMult: new fields.NumberField({ initial: null }),
        critRange: new fields.NumberField({ initial: 20, nullable: true }), // null => 0
        critMult: new fields.NumberField({ initial: 2, nullable: true }), // null => 1
      }),
      save: new fields.SchemaField({
        dc: new fields.StringField(), // Formula,
        type: new fields.StringField(), // pf1.config.savingThrows
        description: new fields.StringField(),
        harmless: new fields.BooleanField({ initial: false }),
      }),
      notes: new fields.SchemaField({
        effect: new fields.ArrayField(new fields.StringField()),
        footer: new fields.ArrayField(new fields.StringField()),
      }),
      soundEffect: new fields.StringField(),
      powerAttack: new fields.SchemaField({
        multiplier: new fields.NumberField({ min: 0, initial: null, nullable: true }),
        damageBonus: new fields.NumberField({ min: 0, initial: 2, integer: true }),
        critMultiplier: new fields.NumberField({ min: 1, initial: 1, integer: true }),
      }),
      naturalAttack: new fields.SchemaField({
        primary: new fields.BooleanField({ initial: true }),
        secondary: new fields.SchemaField({
          attackBonus: new fields.StringField(), // Formula,
          damageMult: new fields.NumberField({ initial: 0.5 }),
        }),
      }),
      held: new fields.StringField(), // pf1.config.abilityDamageHeldMultipliers
      nonlethal: new fields.BooleanField({ initial: false }),
      splash: new fields.BooleanField({ initial: false }),
      touch: new fields.BooleanField({ initial: false }),
      ammo: new fields.SchemaField({
        type: new fields.StringField(), // pf1.config.ammoTypes
        cost: new fields.NumberField({ integer: true, min: 0, initial: 1 }),
      }),
      effect: new fields.StringField(),
      area: new fields.StringField(),
      conditionals: new fields.ArrayField(new fields.ObjectField()), // TODO
      enh: new fields.SchemaField({
        value: new fields.NumberField({ integer: true, min: 0, initial: null, nullable: true }),
      }),
      material: new fields.SchemaField({
        normal: new fields.SchemaField({
          value: new fields.StringField(),
          custom: new fields.BooleanField({ initial: false }),
        }),
        addon: new fields.SetField(new fields.StringField({ nullable: false, blank: false })),
      }),
      // Trinary alignments to allow inheriting from item and to explicitly disabling alignments
      alignments: new fields.SchemaField({
        lawful: new fields.BooleanField({ nullable: true, initial: null }),
        chaotic: new fields.BooleanField({ nullable: true, initial: null }),
        good: new fields.BooleanField({ nullable: true, initial: null }),
        evil: new fields.BooleanField({ nullable: true, initial: null }),
      }),
    };
  }

  static migrateData(data) {
    if (typeof data !== "object") return;

    // Added with v?
    // .unchainedAction.activation to .activation.unchained
    if (data.unchainedAction?.activation) {
      data.activation ??= {};
      data.activation.unchained = data.unchainedAction.activation;
    }

    if (data.enh !== undefined) {
      if (typeof data.enh !== "object") {
        data.enh = { value: data.enh ?? null };
      }
      // Set to null if disabled.
      if (data.enh.override === false) {
        data.enh.value = null;
      }
      // Reset odd values to null, too.
      else if (data.enh.value !== null && typeof data.enh.value !== "number") {
        data.enh.value = null;
      }
    }

    if (data.uses?.autoDeductCharges === false) {
      data.uses.autoDeductChargesCost = "0";
    } else if (data.uses?.autoDeductCharges === true) {
      data.uses.autoDeductChargesCost = "1";
    }

    // Added with v9
    if (data.damage) {
      for (const part of ["parts", "critParts", "nonCritParts"]) {
        const category = data.damage[part];
        if (!category || category.length == 0) continue;

        category.forEach((damage, index) => {
          if (Array.isArray(damage)) {
            const [formula, type] = damage;
            category[index] = { formula, type };
          }
        });
      }
    }

    // Added with v10
    data.actionType ||= "other";
    data.area ||= data.spellArea;

    // Migrate unlimited to empty selection, as the two are identical in meaning
    if (data.uses?.self?.per === "unlimited") {
      delete data.uses.self.per;
    }

    const mt = data.measureTemplate;
    if (mt) {
      mt.color ||= mt.customColor;
      mt.texture ||= mt.customTexture;
    }

    // Added with v11
    if (data.range?.maxIncrements === null || data.range?.maxIncrements < 1) data.range.maxIncrements = 1;
    if (data.spellEffect && !data.effect) data.effect = data.spellEffect;
    if (data.naturalAttack?.primaryAttack !== undefined && data.naturalAttack?.primary === undefined) {
      data.naturalAttack.primary = data.naturalAttack?.primaryAttack;
    }
    data.notes ??= {};
    if (data.effectNotes && !data.notes.effect) data.notes.effect = data.effectNotes;
    if (data.attackNotes && !data.notes.footer) data.notes.footer = data.attackNotes;

    if (data.range?.units === "none") delete data.range.units;

    //if (data.ability?.critMult === null) data.ability.critMult = 1;
    //if (data.ability?.critRange === null) data.ability.critRange = 0;
  }

  static get defaultData() {
    foundry.utils.logCompatibilityWarning("ItemAction.defaultData has been deprecated with no replacement.", {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });

    return new this().toObject(undefined, false);
  }

  /**
   * @deprecated
   * @returns {this}
   */
  get data() {
    foundry.utils.logCompatibilityWarning(
      "ItemAction.data has been deprecated. Use the data directly on the action instead.",
      {
        since: "PF1 vNEXT",
        until: "PF1 vNEXT+1",
      }
    );

    return this;
  }

  /**
   * Data preparation
   *
   * @internal
   */
  prepareData() {
    // Default action type to other if undefined.
    // Optimally this would be in constructor only, but item action handling can cause that to be lost
    this.actionType ||= "other";

    this.img ||= this.item?.img || this.constructor.FALLBACK_IMAGE;

    this.tag ||= pf1.utils.createTag(this.name);

    // DEPRECATIONS
    if (this.naturalAttack) {
      Object.defineProperty(this.naturalAttack, "primaryAttack", {
        get() {
          foundry.utils.logCompatibilityWarning(
            "ItemAction.naturalAttack.primaryAttack is deprecated in favor of ItemAction.naturalAttack.primary",
            {
              since: "PF1 vNEXT",
              until: "PF1 vNEXT+1",
            }
          );
          return this.primary;
        },
      });
    }

    // Prepare ammo
    const ammoType = this.ammo?.type;
    this.ammo.type = ammoType === "none" ? null : ammoType || this.item?.system.ammo?.type || null;

    if (this.ammo.type) this.ammo.cost ??= 1;
    else this.ammo.cost = 0; // Force zero if no type defined

    // Override activation
    if (game.settings.get("pf1", "unchainedActionEconomy")) {
      this.activation = this.activation.unchained;
    }

    if (!this.item) return; // Nohing more if there's no parent. Temporary Action?

    const rollData = this.getRollData();

    // Update conditionals
    this._prepareConditionals();

    // Prepare max personal charges
    if (this.uses.self?.per) {
      const maxFormula = this.uses.self.per === "single" ? "1" : this.uses.self.maxFormula;
      const maxUses = RollPF.safeRollSync(maxFormula, rollData).total ?? 0;
      this.uses.self.max = maxUses;
    }

    // Remove enhancement bonus override, if wrong type
    if (this.enh?.value != null && !["weapon", "attack"].includes(this.item.type)) {
      this.enh.value = null;
    }

    // Initialize default damageMult if missing (for things that can't inherit it from item)
    if (!Number.isFinite(this.ability?.damageMult)) {
      let canHold = this.item.isPhysical || this.item.isQuasiPhysical || false;
      if (!this.hasAttack) canHold = false;
      if (!canHold) this.ability.damageMult = 1;
    }

    // TODO: Set as initial data
    if (this.naturalAttack.secondary?.damageMult === undefined) {
      foundry.utils.setProperty(this, "naturalAttack.secondary.damageMult", 0.5);
    }
  }

  /** @type {string|null} - Normal material */
  get normalMaterial() {
    return this.material.normal.value || this.item.normalMaterial || null;
  }

  /** @type {string[]} - Addon materials */
  get addonMaterial() {
    const addons = this.material.addon || this.item.addonMaterial || [];
    return addons.filter((o) => !!o);
  }

  /**
   * Returns whether this action is a combat maneuver
   *
   * @type {boolean}
   */
  get isCombatManeuver() {
    return ["mcman", "rcman"].includes(this.actionType);
  }

  /**
   * Creates an action.
   *
   * @param {object[]} data - Data to initialize the action(s) with.
   * @param {object} context - An object containing update context information.
   * @param {ItemPF} [context.parent] - The parent entity to create the action within.
   * @throws {Error} - If the action has no parent
   * @returns {ItemAction[]} - The resulting actions
   */
  static async create(data, context = {}) {
    const { parent, ...updateContext } = context;

    if (!(parent instanceof Item)) throw new Error("No parent declared");

    // Prepare new data
    data = data.map((dataObj) => new this(dataObj).toObject());

    // Update parent
    const actions = parent.toObject().system.actions || [];
    actions.push(...data);
    await parent.update({ "system.actions": actions }, updateContext);

    // Return resulting actions
    return data.map((o) => parent.actions.get(o._id));
  }

  static get defaultDamageType() {
    return {
      values: [],
      custom: "",
    };
  }

  /** @type {ItemPF|undefined} - Parent item */
  get item() {
    return this.parent;
  }

  /** @type {ActorPF|undefined} - Parent actor of the parent item. */
  get actor() {
    return this.parent?.actor;
  }

  /** @type {string} - Action ID */
  get id() {
    return this._id;
  }

  /**
   * Can this action be used?
   *
   * Returns false if any known criteria for use limitation fails. Calls owning item's canUse functinality also.
   *
   * @see {@link pf1.documents.item.ItemBasePF.canUse}
   *
   * @type {boolean}
   */
  get canUse() {
    const item = this.item;
    if (!item.canUse) return false;

    if (this.isSelfCharged) {
      if ((this.uses.self?.value ?? 0) <= 0) return false;
    }

    if (item.isPhysical) {
      if (item.system.quantity <= 0) return false;
    }

    if (this.isCharged) {
      const cost = this.getChargeCostSync({ maximize: true })?.total ?? 0;
      const charges = item.charges;
      if (cost > 0) {
        if (cost > charges) return false;
      }
    }

    const ammo = this.ammo.type;
    if (ammo) {
      // Check if actor has any relevant ammo, regardless if they're set to default
      if (
        this.actor?.itemTypes.loot.filter(
          (i) => i.subType === "ammo" && i.system.extraType === ammo && i.system.quantity > 0
        ).length === 0
      )
        return false;
    }

    return true;
  }

  /** @type {boolean} - Is some type of attack action. */
  get hasAttack() {
    return ["mwak", "rwak", "twak", "msak", "rsak", "mcman", "rcman"].includes(this.actionType);
  }

  /** @type {boolean} - Has multiple attacks */
  get hasMultiAttack() {
    if (!this.hasAttack) return false;
    const exAtk = this.extraAttacks ?? {};
    return exAtk.manual?.length > 0 || !!exAtk.type;
  }

  /** @type {boolean} - Consumes charges on use */
  get autoDeductCharges() {
    return this.getChargeCostSync({ maximize: true })?.total > 0;
  }

  /** @type {boolean} - Does parent item have charges */
  get isCharged() {
    return this.item.isCharged ?? false;
  }

  /** @type {boolean} - Action has charges of its own */
  get isSelfCharged() {
    return !!this.uses?.self?.per;
  }

  /**
   * @param {object} [options] - Additional options to configure behavior.
   * @param {object} [options.rollData=null] - Pre-determined roll data to pass for determining the charge cost.
   * @param {boolean} [options.minimize=false]
   * @param {boolean} [options.maximize=false]
   * @returns {Roll|null} - Cost in charges for this action. Null if not charged.
   */
  async getChargeCost({ minimize = false, maximize = false, rollData = null } = {}) {
    if (!this.isCharged) return null;

    const isSpell = this.item.type === "spell";
    const isSpellpointSpell = isSpell && this.item.useSpellPoints();

    let formula = !isSpellpointSpell ? this.uses.autoDeductChargesCost : this.uses.spellPointCost;
    if (!formula) {
      formula = this.item.getDefaultChargeFormula();
    } else if (typeof formula !== "string") {
      console.warn(this.item.name, "action", this.name, "has invalid charge formula:", formula, this);
      formula = this.item.getDefaultChargeFormula();
    }

    rollData ??= this.getRollData();

    const roll = await RollPF.safeRoll(formula, rollData, undefined, undefined, { maximize, minimize });

    // Clamp single use
    if (this.item.isSingleUse) roll._total = Math.clamp(roll._total, -1, 1);

    return roll;
  }

  /**
   * @param {object} [options] - Additional options to configure behavior.
   * @param {object} [options.rollData=null] - Pre-determined roll data to pass for determining the charge cost.
   * @param {boolean} [options.minimize=false]
   * @param {boolean} [options.maximize=false]
   * @returns {Roll|null} - Cost in charges for this action. Null if not charged.
   */
  getChargeCostSync({ minimize = false, maximize = false, rollData = null } = {}) {
    if (!this.isCharged) return null;

    const isSpell = this.item.type === "spell";
    const isSpellpointSpell = isSpell && this.item.useSpellPoints();

    let formula = !isSpellpointSpell ? this.uses.autoDeductChargesCost : this.uses.spellPointCost;
    if (!formula) {
      formula = this.item.getDefaultChargeFormula();
    } else if (typeof formula !== "string") {
      console.warn(this.item.name, "action", this.name, "has invalid charge formula:", formula, this);
      formula = this.item.getDefaultChargeFormula();
    }

    rollData ??= this.getRollData();

    if (!maximize && !minimize) maximize = true; // Enforce maximization if neither is called in case this is a die
    const roll = RollPF.safeRollSync(formula, rollData, undefined, undefined, { maximize, minimize });

    // Clamp single use
    if (this.item.isSingleUse) roll._total = Math.clamp(roll._total, -1, 1);

    return roll;
  }

  /**
   * @type {number} The action's first increment range (in system configured units)
   */
  get rangeIncrement() {
    return this.getRange({ type: "single" });
  }

  /** @type {number} - The action's exclusive minimum range. */
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
   * @param {"single"|"min"|"max"} [options.type="single"] - What type of range to query. Either "single" (for a single range increment), "max" or "min".
   * @param {object} [options.rollData=null] - Specific roll data to pass.
   * @returns {number|null} The given range, in system configured units, or `null` if no range is applicable.
   */
  getRange({ type = "single", rollData = null } = {}) {
    const baseRange = this.range.units;
    const range = type === "min" ? this.range.minValue : this.range.value;
    let rangeType = type === "min" ? this.range.minUnits : baseRange;

    // Special case of ignoring min range for invalid range types
    if (type === "min" && !["reach", "ft", "mi", "seeText"].includes(baseRange)) return 0;

    if (!rangeType) {
      if (type !== "min") return null;
      // Special handling for reach minimum range to account for natural reach when no explicit minimum range is defined
      if (baseRange === "reach") rangeType = "natural";
      else return 0;
    }

    rollData ??= this.getRollData();
    const singleIncrementRange = calculateRange(range, rangeType, rollData)[0];

    if (["single", "min"].includes(type)) return singleIncrementRange;
    return singleIncrementRange * this.range.maxIncrements;
  }

  /** @type {boolean} - Has measured template */
  get hasTemplate() {
    const { type, size } = this.measureTemplate;
    return !!type && !!size;
  }

  /**
   * Does the action implement a damage roll as part of its usage
   *
   * @type {boolean}
   */
  get hasDamage() {
    return !!this.damage.parts?.length;
  }

  /**
   * Effective critical range when accounting for broken status and action type.
   *
   * @type {number}
   */
  get critRange() {
    if (this.item.isBroken || this.isCombatManeuver) return 20;
    return this.ability?.critRange || 20;
  }

  /**
   * Misfire threshold
   *
   * @type {number} Misfire threshold. Zero if action does not misfire.
   */
  get misfire() {
    const misfire = this.ammo?.misfire ?? null;
    if (Number.isFinite(misfire)) return misfire;
    return this.item.system.ammo?.misfire ?? 0;
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

    const held = rollData.action?.held || rollData.item?.held || "1h";

    let mult = rollData.action?.powerAttack?.multiplier;
    // Use defined override
    if (mult) return mult;

    // Determine default based on attack type and held option
    mult = 1;
    if (this.item.subType === "natural") {
      // Primary
      if (rollData.action.naturalAttack?.primary) {
        const ablDmgMult = rollData.action.ability?.damageMult ?? 1;
        // Primary attack gets +50% damage like with two-handing if ability score multiplier is 1.5x or higher
        if (ablDmgMult >= 1.5) mult = 1.5;
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
    const units = this.range?.units;
    if (!units) return false;
    return !!units;
  }

  /* -------------------------------------------- */

  /**
   * Does the item provide an amount of healing instead of conventional damage?
   *
   * @returns {boolean}
   */
  get isHealing() {
    return this.actionType === "heal" && this.hasDamage;
  }

  get hasEffect() {
    return this.hasDamage || this.notes.effect.length > 0;
  }

  /**
   * Does the Item implement a saving throw as part of its usage
   *
   * @type {boolean}
   */
  get hasSave() {
    return !!this.save?.type;
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
        if (data.save.dc) formula += ` + ${data.save.dc}`;

        const dcSchoolBonus = rollData.attributes.spells?.school?.[this.item.system.school]?.dc ?? 0;
        const universalDCBonus = rollData.attributes?.spells?.school?.all?.dc ?? 0;

        return RollPF.safeRollSync(formula, rollData).total + dcBonus + dcSchoolBonus + universalDCBonus;
      } else {
        // Assume standard base formula for spells with minimum required abilty score
        const level = this.item.system.level ?? 1;
        const minAbl = Math.floor(level / 2);
        return 10 + level + minAbl + dcBonus;
      }
    } else {
      const dcFormula = this.save.dc?.toString() || "0";
      result = RollPF.safeRollSync(dcFormula, rollData).total + dcBonus;
      return result;
    }
  }

  /**
   * @deprecated
   * @type {boolean} - Is sound effect defined?
   */
  get hasSound() {
    foundry.utils.logCompatibilityWarning(
      "ItemAction.hasSound is deprecated with no replacement. Test !!action.soundEffect instead.",
      {
        since: "PF1 vNEXT",
        until: "PF1 vNEXT+1",
      }
    );
    return !!this.soundEffect;
  }

  /** @type {number|null} - Effective enhancement bonus */
  get enhancementBonus() {
    return this.enh?.value ?? this.item.system.enh;
  }

  /** @type {boolean} - Is ranged action */
  get isRanged() {
    return ["rwak", "twak", "rsak", "rcman"].includes(this.actionType);
  }

  /** @type {boolean} - Is spell action? */
  get isSpell() {
    return ["rsak", "msak"].includes(this.actionType);
  }

  /**
   * An array of changes affecting this action's damage
   *
   * @type {ItemChange[]}
   */
  get damageSources() {
    // Build damage context
    const contexts = [pf1.const.actionTypeToContext[this.actionType] ?? "damage"];
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
    const conds = this.conditionals
      .filter((c) => c.default)
      .filter((c) => c.modifiers.find((m) => m.target === "damage"));
    const rollData = this.getRollData();

    if (!rollData) return [];

    const mods = Object.keys(pf1.config.bonusTypes);

    // Turn relevant conditionals into structure accepted by getHighestChanges
    const fakeCondChanges = [];
    for (const c of conds) {
      for (const m of c.modifiers) {
        if (m.target !== "damage") continue;
        const roll = new RollPF(m.formula, rollData);
        const isDeterministic = roll.isDeterministic;
        try {
          if (isDeterministic) roll.evaluate({ async: false });
        } catch (err) {
          // Ignore
        }
        const isModifier = mods.includes(m.type);
        fakeCondChanges.push({
          flavor: c.name,
          value: isDeterministic ? roll.total : m.formula,
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
        type: "enh",
        formula: enh.toString(),
      });
    }

    // Add special cases specific to the item
    // Broken
    if (this.item.isBroken) {
      allChanges.push({
        flavor: game.i18n.localize("PF1.Broken"),
        value: -2,
        type: "untyped",
        formula: "-2",
      });
    }

    return getHighestChanges(allChanges, { ignoreTarget: true });
  }

  /**
   * @internal
   * @returns {object}
   */
  getRollData() {
    const item = this.item;
    const result = item?.getRollData() ?? {};

    result.action = pf1.utils.deepClone(this);
    result.dc = this.hasSave ? this.getDC(result) : 0;

    if (item?.type === "spell") {
      // Add per school CL bonus
      // TOOD: Move to item roll data generation?
      result.cl += result.attributes?.spells?.school?.[item.system.school]?.cl ?? 0;
    }

    // Determine size bonus
    if (this.hasAttack) {
      const size = result.traits?.size || "med";
      result.sizeBonus = this.isCombatManeuver ? pf1.config.sizeSpecialMods[size] : pf1.config.sizeMods[size];
    }

    // BAB override
    if (result.action.bab) {
      const bab = RollPF.safeRollSync(result.action.bab, result).total;
      foundry.utils.setProperty(result, "attributes.bab.total", bab || 0);
    }

    // Add @bab alias
    result.bab = result.attributes?.bab?.total || 0;

    if (Hooks.events["pf1GetRollData"]?.length > 0) Hooks.callAll("pf1GetRollData", this, result);

    return result;
  }

  /**
   * @internal
   */
  _prepareConditionals() {
    const collection = this._conditionals;
    const prior = new Collection([...collection]);
    collection.clear(); // TODO: Remove specific entries after the loop instead of full clear here

    const conditionals = this._source.conditionals;
    if (!conditionals?.length) return;

    for (const o of conditionals) {
      let conditional = null;
      if (prior && prior.has(o._id)) {
        conditional = prior.get(o._id);
        conditional.data = o;
        conditional.prepareData();
      } else conditional = new pf1.components.ItemConditional(o, this);
      collection.set(o._id || conditional.data._id, conditional);
    }

    this.conditionals = collection;
  }

  /**
   * Delete this action
   *
   * @returns {Item} - Updated parent item document.
   */
  async delete() {
    const actions = this.item.toObject().system.actions;
    actions.findSplice((a) => a._id == this.id);

    // Pre-emptively close applications
    const promises = [];
    for (const app of Object.values(this.apps)) {
      promises.push(app.close({ pf1: { action: "delete" }, submit: false, force: true }));
    }
    await Promise.all(promises);

    // Delete action
    return this.item.update({ "system.actions": actions });
  }

  /**
   * Update the action
   *
   * TODO: BROKEN
   *
   * @param {object} updateData - Update data
   * @param {object} context - Update context
   */
  async update(updateData, context = {}) {
    updateData = foundry.utils.expandObject(updateData);

    delete updateData._id; // Prevent ID drift
    this.updateSource(updateData);

    const updates = this.item.actions.map((a) => a.toObject());

    await this.item.update({ "system.actions": updates }, context);
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
    const labels = {};
    rollData ??= this.getRollData();

    const hasActor = !!this.actor;

    // Activation method
    if (this.activation) {
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
        if (activation.type === "special") {
          labels.activation = activation.cost || activationTypes.special;
        } else if (activation.cost > 1 && !!activationTypesPlural[activationType]) {
          labels.activation = [activation.cost.toString(), activationTypesPlural[activationType]].filterJoin(" ");
        } else {
          labels.activation = [
            ["minute", "hour", "action"].includes(activationType) && activation.cost ? activation.cost.toString() : "",
            activationTypes[activationType],
          ].filterJoin(" ");
        }
      }
    }

    // Duration
    // Set duration label
    const duration = this.duration;
    switch (duration?.units) {
      case "spec":
        labels.duration = duration.value;
        break;
      case "seeText":
      case "inst":
      case "perm":
        labels.duration = pf1.config.timePeriods[duration.units];
        break;
      case "turn": {
        const unit = pf1.config.timePeriods[duration.units];
        labels.duration = game.i18n.format("PF1.Time.Format", { value: 1, unit });
        break;
      }
      case "round":
      case "minute":
      case "hour":
      case "day":
      case "month":
      case "year":
        if (duration.value) {
          const unit = pf1.config.timePeriods[duration.units];
          labels.durationFormula = duration.value;
          labels.variableDuration = /@\w/.test(duration.value);
          const roll = new RollPF(duration.value, rollData);
          let value;
          try {
            if (roll.isDeterministic) {
              roll.evaluateSync();
              value = roll.total;
            } else {
              let formula = pf1.utils.formula.unflair(duration.value);
              formula = RollPF.replaceFormulaData(formula, rollData);
              value = pf1.utils.formula.compress(pf1.utils.formula.simplify(formula));
            }
            labels.duration = game.i18n.format("PF1.Time.Format", { value, unit });
          } catch (err) {
            console.error("Error in duration formula:", { formula: duration.value, rollData, roll }, roll.err, this);
          }
        }
        break;
    }

    // Dismissable, but only if special duration isn't used
    // TODO: Better i18n support
    if (labels.duration && duration.dismiss && duration.units !== "spec") {
      labels.duration += " " + game.i18n.localize("PF1.DismissableMark");
    }

    // Difficulty Class
    if (this.hasSave) {
      const totalDC = rollData.dc + (rollData.dcBonus ?? 0);
      labels.save = game.i18n.format("PF1.DCThreshold", { threshold: totalDC });
    }

    // Range
    if (this.hasRange) {
      const rangeUnit = this.range.units;
      const rangeValue = this.range.value;
      const rangeLabel = pf1.config.distanceUnits[rangeUnit];
      labels.range = rangeLabel;
      if (rangeUnit === "spec") {
        labels.range = rangeValue || labels.range;
      } else if (["personal", "touch", "melee", "reach"].includes(rangeUnit)) {
        // Display as is
      } else {
        const range = this.getRange({ type: "single", rollData });
        if (range > 0) {
          const usystem = pf1.utils.getDistanceSystem();
          const rangeUnit = usystem === "metric" ? "m" : "ft";
          const lrange = new Intl.NumberFormat(undefined).format(range);
          labels.range = `${lrange} ${rangeUnit}`;
        }
        if (["close", "medium", "long"].includes(rangeUnit)) {
          labels.range += ` (${rangeLabel})`;
        }
      }

      // Special formatting when no actor present
      if (!hasActor) {
        const units = pf1.utils.getDistanceSystem();
        switch (rangeUnit) {
          case "close":
            labels.range = `${rangeLabel} (${game.i18n.localize(
              units == "metric" ? "PF1.SpellRangeShortMetric" : "PF1.SpellRangeShort"
            )})`;
            break;
          case "medium":
            labels.range = `${rangeLabel} (${game.i18n.localize(
              units == "metric" ? "PF1.SpellRangeMediumMetric" : "PF1.SpellRangeMedium"
            )})`;
            break;
          case "long":
            labels.range = `${rangeLabel} (${game.i18n.localize(
              units == "metric" ? "PF1.SpellRangeLongMetric" : "PF1.SpellRangeLong"
            )})`;
            break;
        }
      }
    }

    // Targets
    const targets = this.target?.value;
    if (targets) labels.targets = targets;

    // Set area label
    if (this?.area) labels.area = this.area;

    // Action type
    labels.actionType = pf1.config.itemActionTypes[this.actionType];

    return labels;
  }

  // -----------------------------------------------------------------------

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

    const isNatural = this.item.subType === "natural";
    if (isNatural) contexts.push("nattack");

    switch (this.actionType) {
      case "twak":
        contexts.push("tattack");
        if (!isNatural) contexts.push("wattack");
        break;
      case "mwak":
      case "rwak":
        if (!isNatural) contexts.push("wattack");
        break;
      case "msak":
      case "rsak":
        contexts.push("sattack");
        break;
    }

    return this.item.getContextChanges(contexts);
  }

  /**
   * Place an attack roll using an item (weapon, feat, spell, or equipment)
   *
   * @param {object} [options] - Options
   * @param {object} [options.data] - Roll data
   * @param {Array<string>} [options.extraParts] - Additional attack parts
   * @param {string} [options.bonus] - Additional attack bonus
   * @param {boolean} [options.primary=true] - Treat as primary natural attack
   * @returns {D20RollPF}
   */
  async rollAttack({ data = null, extraParts = [], bonus = null, primary = true, ...options } = {}) {
    if (typeof options.primaryAttack === "boolean") {
      foundry.utils.logCompatibilityWarning(
        "ItemAttack.rollAttack()'s `primaryAttack` option is deprecated in favor of `primary`",
        {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        }
      );

      primary = options.primaryAttack;
    }
    const rollData = data ?? this.getRollData();
    const itemData = rollData.item;
    const actionData = rollData.action;

    const config = {};

    itemData.primaryAttack = primary;

    // Add misc bonuses/penalties
    itemData.proficiencyPenalty = -4;

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

    // Get relevant changes
    const changes = this.attackSources;

    // Add masterwork bonus to changes (if applicable)
    if (["mwak", "rwak", "twak", "mcman", "rcman"].includes(this.actionType) && this.item.system.masterwork) {
      changes.push(
        new pf1.components.ItemChange({
          formula: "1",
          operator: "add",
          target: "attack",
          type: "enh",
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
          target: "attack",
          type: "enh",
          value: this.enhancementBonus,
          flavor: game.i18n.localize("PF1.EnhancementBonus"),
        })
      );
    }

    // Add bonus parts
    parts.push(...extraParts);
    // Add attack bonus
    if (typeof actionData.attackBonus === "string" && !["", "0"].includes(actionData.attackBonus)) {
      parts.push(actionData.attackBonus);
    }
    // Backwards compatibility
    else if (typeof actionData.attackBonus === "number") {
      itemData.attackBonus = actionData.attackBonus;
      parts.push(`@item.attackBonus[${game.i18n.localize("PF1.AttackRollBonus")}]`);
    }

    // Add proficiency penalty
    try {
      config.proficient = this.item.getProficiency(true);
    } catch (error) {
      // Treat as proficient if there's proficiency incompatibility.
      config.proficient = true;
    }

    // Add secondary natural attack penalty
    const isNatural = this.item.subType === "natural";
    const isNaturalSecondary = isNatural && primary === false;
    config.secondaryPenalty = isNaturalSecondary ? -5 : 0;

    // Add bonus
    rollData.bonus = 0;
    if (bonus) {
      // TODO: Do not pre-roll
      const roll = await RollPF.safeRoll(bonus, rollData);
      rollData.bonus = roll.total;
    }

    // Options for D20RollPF
    const rollOptions = {
      critical: this.critRange,
    };

    if (this.ammo.type && this.ammo.cost > 0) {
      const misfire = this.misfire;
      if (misfire > 0) rollOptions.misfire = misfire;
    }

    // call pre attack hook before changes are filtered and before specific [parts] from config and roll data are created
    Hooks.call("pf1PreAttackRoll", this, config, rollData, rollOptions, parts, changes);

    // Get attack bonus
    getHighestChanges(
      changes.filter((c) => {
        c.applyChange(this.actor);
        return c.operator !== "set";
      }),
      { ignoreTarget: true }
    ).forEach((c) => {
      let value = c.value;
      // BAB override
      if (actionData.bab && c._id === "_bab") {
        value = RollPF.safeRollSync(c.formula, data).total || 0;
      }
      if (value == 0) return;
      parts.push(`${value}[${RollPF.cleanFlavor(c.flavor)}]`);
    });

    // Convert config to roll part
    if (config.secondaryPenalty != 0) {
      parts.push(`${config.secondaryPenalty}[${game.i18n.localize("PF1.SecondaryAttack")}]`);
    }

    if (rollData.bonus != 0) {
      parts.push(`@bonus[${game.i18n.localize("PF1.SituationalBonus")}]`);
    }

    if (!config.proficient) {
      parts.push(`@item.proficiencyPenalty[${game.i18n.localize("PF1.Proficiency.Penalty")}]`);
    }

    const roll = await new pf1.dice.D20RollPF(
      [rollData.d20 || pf1.dice.D20RollPF.standardRoll, ...parts.filter((p) => !!p)].join("+"),
      rollData,
      rollOptions
    ).evaluate();

    // Cleanup roll data that was altered here.
    delete rollData.bonus;

    Hooks.call("pf1AttackRoll", this, roll, config);

    return roll;
  }

  /* -------------------------------------------- */

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
    const itemData = rollData.item;
    const actionData = rollData.action;

    if (!this.hasDamage) {
      throw new Error("You may not make a Damage Roll with this Action.");
    }

    const isNatural = this.item.subType === "natural";

    // Determine critical multiplier
    rollData.critMult = 1;
    if (critical) rollData.critMult = actionData.ability.critMult;
    // Determine ability multiplier
    if (rollData.ablMult == null) {
      const held = actionData?.held || itemData?.held || "1h";
      rollData.ablMult =
        actionData?.ability.damageMult ?? (isNatural ? null : pf1.config.abilityDamageHeldMultipliers[held]) ?? 1;
    }

    // Define Roll parts
    const parts = [];
    const addParts = (property, type) => {
      parts.push(
        ...(this.damage[property]?.map((damage) => ({
          base: damage.formula,
          extra: [],
          damageType: damage.type,
          type,
        })) ?? [])
      );

      // add typed conditionals
      conditionalParts[`damage.${type}`]?.forEach((p) => {
        const [base, damageType, isExtra] = p;
        isExtra ? parts[0].extra.push(base) : parts.push({ base, extra: [], damageType, type });
      });
    };

    addParts("parts", "normal");
    if (critical) addParts("critParts", "crit");
    else addParts("nonCritParts", "nonCrit");

    /**
     * Initialize changes to empty array so mods can still add changes for healing "attacks" via the pre-roll hook below
     *
     *  @type {ItemChange[]}
     */
    let changes = [];
    if (!this.isHealing) {
      // Gather changes
      changes = this.damageSources;

      // Add enhancement bonus to changes
      if (this.enhancementBonus) {
        changes.push(
          new pf1.components.ItemChange({
            formula: this.enhancementBonus.toString(),
            operator: "add",
            target: "damage",
            type: "enh",
            value: this.enhancementBonus,
            flavor: game.i18n.localize("PF1.EnhancementBonus"),
          })
        );
      }

      // Add broken penalty
      if (this.item.isBroken) {
        const label = game.i18n.localize("PF1.Broken");
        parts[0].extra.push(`-2[${label}]`);
      }
    }

    // call pre damage hook before changes are filtered and before specific [parts] from roll data are created
    Hooks.call("pf1PreDamageRoll", this, rollData, parts, changes);

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

    // Determine ability score modifier
    const abl = actionData.ability.damage;
    const ability = rollData.abilities?.[abl];
    if (ability) {
      // Determine ability score bonus
      const max = actionData.ability?.max ?? Infinity;
      if (ability.mod < 0) rollData.ablDamage = Math.min(max, ability.mod);
      else rollData.ablDamage = Math.floor(Math.min(max, ability.mod) * rollData.ablMult);

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
        }).evaluate();
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
    if (this.hasAttack) {
      result["attack"] = game.i18n.localize(pf1.config.conditionalTargets.attack._label);
      result["critMult"] = game.i18n.localize(pf1.config.conditionalTargets.critMult._label);
    }
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

        const exAtk = this.extraAttacks;
        if (exAtk?.manual?.length) {
          exAtk.manual.forEach((part, index) => {
            result[`attack_${index + 1}`] = part.name;
          });
        }
      } else {
        delete result["rapidShotDamage"];
      }
    }
    // Add subtargets affecting effects
    if (target === "effect") {
      if (this.hasSave) result["dc"] = game.i18n.localize("PF1.DC");
    }
    // Add misc subtargets
    if (target === "misc") {
      // Add charges subTarget with specific label
      if (this.isCharged) result["charges"] = game.i18n.localize("PF1.ChargeCost");
    }

    this.item.getConditionalTargets?.(target, result);

    return result;
  }

  /* Generates lists of conditional modifier bonus types applicable to a formula.
   * @param {string} target - The target key as defined in PF1.conditionTargets.
   * @returns {Object.<string, string>} A list of bonus types.
   * */
  getConditionalModifierTypes(target) {
    const result = {};
    if (target === "attack" || target === "damage") {
      // Add types from pf1.config.bonusTypes
      for (const [k, v] of Object.entries(pf1.config.bonusTypes)) {
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
   * Generate attacks.
   *
   * @param {object} [options] - Options
   * @param {boolean} [options.full=true] - Full attack
   * @param {object} [options.rollData] - Roll data
   * @param {boolean} [options.resolve=false] - If the bonuses are to be resolved directly.
   * @param {boolean} [options.conditionals=false] - Include conditional modifications. Requires `resolve` to be enabled.
   * @param {boolean} [options.bonuses=false] - Include other bonuses. Requires `resolve` to be enabled.
   * @returns {Array<object>} - Array of attack data
   */
  getAttacks({ full = true, rollData, resolve = false, conditionals = false, bonuses = false } = {}) {
    rollData ||= this.getRollData();

    const exAtkCfg = pf1.config.extraAttacks[this.extraAttacks?.type] ?? {};

    const bonusToAll = exAtkCfg.modToAll;

    /**
     * Counter for unnamed or other numbered attacks, to be incremented with each usage.
     * Starts at 1 to account for the base attack.
     */
    let unnamedAttack = 0;
    const unnamedAttackNames = new Set();
    const getUniqueName = (name, template) => {
      if (template && template.indexOf("{0}") == -1) template = null;
      let label = name;
      while (unnamedAttackNames.has(label) || !label) {
        unnamedAttack += 1;
        if (template) {
          if (game.i18n.has(template)) label = game.i18n.format(template, { 0: unnamedAttack });
          else label = template.replace("{0}", unnamedAttack);
        } else label = game.i18n.format("PF1.ExtraAttacks.Formula.LabelDefault", { 0: unnamedAttack });
      }
      unnamedAttackNames.add(label);
      return label;
    };

    rollData.attackCount = 0;

    // Replace roll data that won't be available after
    const replaceSpecificRollData = (formula, data) => {
      return formula.replace(/@\w+\b/, (m) => {
        const p = m.slice(1);
        if (p in data) return data[p];
        return m;
      });
    };

    const _rollData = {
      attackCount: 0,
      attackSetCount: 0,
      formulaicAttack: 0,
    };

    const flavor = game.i18n.localize(exAtkCfg.flavor || "");
    const formula = `(${exAtkCfg.bonus || "0"} + ${bonusToAll || "0"})` + (flavor ? `[${flavor}]` : "");
    const attacks = [{ bonus: replaceSpecificRollData(formula, _rollData), label: getUniqueName(this.attackName) }];

    // Extra attacks
    if (full) {
      rollData.fullAttack = 1;
      const unchainedEconomy = game.settings.get("pf1", "unchainedActionEconomy");

      let attackCount = 0;

      const parseAttacks = async (countFormula, bonusFormula = "0", label, bonusLabel) => {
        if (!countFormula || countFormula == "0") return;

        const exAtkCount =
          RollPF.safeRollSync(countFormula, rollData, undefined, undefined, { minized: true })?.total ?? 0;
        if (exAtkCount <= 0) return;

        try {
          for (let i = 0; i < exAtkCount; i++) {
            const _rollData = {
              attackCount: (attackCount += 1),
              attackSetCount: i,
              formulaicAttack: i + 1, // Add and update attack counter
            };

            let formula = bonusFormula;
            if (bonusToAll) formula += ` + ${bonusToAll}`;
            formula = replaceSpecificRollData(formula, _rollData);

            const alabel = game.i18n.has(label) ? game.i18n.format(label, { 0: i + 1 }) : label?.replace("{0}", i + 1);

            attacks.push({
              bonus: bonusLabel ? `(${formula})[${bonusLabel}]` : `(${formula})`,
              formula,
              flavor: bonusLabel,
              // Continue counting if similar to initial attack name
              // If formulaic attacks have a non-default name, number them with their own counter; otherwise, continue unnamed attack numbering
              label: getUniqueName(alabel, label),
              rollData: _rollData,
            });
          }
        } catch (err) {
          console.error(err);
        }
      };

      if (exAtkCfg.iteratives && !unchainedEconomy) {
        parseAttacks(
          pf1.config.iterativeExtraAttacks,
          pf1.config.iterativeAttackModifier,
          null,
          game.i18n.localize("PF1.Iterative")
        );
      }

      // Add attacks defined by configuration
      if (exAtkCfg.count) {
        parseAttacks(exAtkCfg.count, exAtkCfg.bonus, exAtkCfg.attackName, flavor);
      }

      // Add manually entered explicit extra attacks
      if (exAtkCfg.manual) {
        const extraAttacks = this.extraAttacks?.manual ?? [];
        for (const { name, formula } of extraAttacks) {
          if (name) unnamedAttackNames.add(name);
          attacks.push({
            bonus: formula,
            // Use defined label, or fall back to continuously numbered default attack name
            label: name || getUniqueName(),
          });
        }
      }

      // Add custom extra attack formula
      if (exAtkCfg.formula) {
        const formulaCfg = this.extraAttacks.formula ?? {};
        parseAttacks(formulaCfg.count, formulaCfg.bonus, formulaCfg.label);
      }
    }

    // TODO: Move this to be part of the output data as formulas
    if (resolve) {
      const condBonuses = new Array(attacks.length).fill(0);
      if (conditionals) {
        // Conditional modifiers
        this.conditionals
          .filter((c) => c.default && c.modifiers.find((sc) => sc.target === "attack"))
          .forEach((c) => {
            c.modifiers.forEach((cc) => {
              const bonusRoll = RollPF.safeRollSync(cc.formula, rollData, undefined, undefined, { minimize: true });
              if (bonusRoll.total == 0) return;
              if (cc.subTarget?.match(/^attack\.(\d+)$/)) {
                const atk = parseInt(RegExp.$1, 10);
                if (atk in condBonuses) condBonuses[atk] += bonusRoll.total;
              }
            });
          });
      }

      let totalBonus = 0;
      if (bonuses) {
        const sources = this.item.getAttackSources(this.id, { rollData });
        totalBonus = sources.reduce((f, s) => f + s.value, 0);
      }

      attacks.forEach((atk, i) => {
        rollData.attackCount = i;
        const roll = RollPF.safeRollSync(atk.bonus, rollData, undefined, undefined, { minimize: true });
        atk.bonus = roll.total + totalBonus + condBonuses[i];
        delete rollData.attackCount;
      });
    }

    return attacks;
  }

  /**
   * Use action.
   *
   * Wrapper for {@link pf1.documents.item.ItemPF.use() ItemPF.use()}
   *
   * @param {object} options - Options passed to `ItemPF.use()`.
   * @returns {Promise<void>} - Returns what `ItemPF.use()` returns.
   */
  async use(options = {}) {
    options.actionId = this.id;

    // TODO: ItemPF.use() and this.use() relation needs to be flipped.

    return this.item.use(options);
  }

  /**
   * Effective ammo type.
   *
   * @deprecated
   * @type {string|null} - Ammo type string or null if this doesn't use ammo.
   */
  get ammoType() {
    foundry.utils.logCompatibilityWarning("ItemAction.ammoType is deprecated in favor of ItemAction.ammo.type", {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });
    return this.ammo.type;
  }

  /**
   * Effective per-attack ammo cost.
   *
   * @deprecated
   * @type {number} - Number of ammo each attack consumes. Defaults to 1 if using ammo, 0 if not.
   */
  get ammoCost() {
    foundry.utils.logCompatibilityWarning("ItemAction.ammoCost is deprecated in favor of ItemAction.ammo.cost", {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });

    return this.ammo.cost;
  }

  /** @override */
  toObject(source = true, clean = true) {
    const data = super.toObject(source);

    if (!clean) return data;

    // Aggressive data size reduction

    if (!data.img) delete data.img;
    if (!data.tag) delete data.tag;
    if (!data.bab) delete data.bab;
    if (!data.attackName) delete data.attackName;
    if (!data.attackBonus) delete data.attackBonus;
    if (!data.critConfirmBonus) delete data.critConfirmBonus;
    if (!data.measureTemplate?.type) delete data.measureTemplate;
    if (!data.extraAttacks?.type) delete data.extraAttacks;
    if (!data.uses?.self?.per) delete data.uses?.self;
    if (data.save && !data.save.type) {
      // Preserve description even if there's no save (TODO: Maybe cull it anyway?)
      if (!data.save.description) delete data.save.description;
      // RAW preserving harmless=true here is pointless if there's no save.
      if (data.save.harmless === false) delete data.save.harmless;
      if (data.save.harmless !== true && !data.save.description) delete data.save;
      else {
        delete data.save.type;
        delete data.save.dc;
      }
    }
    if (!data.duration?.units) delete data.duration;
    if (data.duration?.dismiss === false) delete data.duration.dismiss;
    if (!data.target?.value) delete data.target;
    if (!data.uses?.autoDeductChargesCost) delete data.uses?.autoDeductChargesCost;
    if (data.uses?.perAttack === false) delete data.uses.perAttack;

    if (data.ability?.max === null) delete data.ability.max;

    if (!data.area) delete data.area;
    if (!data.effect) delete data.effect;
    if (data.notes?.effect) {
      data.notes.effect = data.notes.effect.filter((n) => !!n);
      if (data.notes.effect.length === 0) delete data.notes.effect;
    }
    if (data.notes?.footer) {
      data.notes.footer = data.notes.footer.filter((n) => !!n);
      if (data.notes.footer.length === 0) delete data.notes.footer;
    }

    if (!data.range?.units) delete data.range;
    else {
      if (!data.range?.minUnits) delete data.range?.minValue;
      if (data.range?.maxIncrements === 1) delete data.range?.maxIncrements;
    }

    if (data.damage) {
      if (data.damage.parts?.length == 0) delete data.damage.parts;
      if (data.damage.critParts?.length == 0) delete data.damage.critParts;
      if (data.damage.nonCritParts?.length == 0) delete data.damage.nonCritParts;
      if (Object.keys(data.damage).length == 0) delete data.damage;
    }

    if (data.material) {
      if (!data.material.normal?.value) delete data.material?.normal;
      if (!data.material.addon?.length == 0) delete data.material?.addon;
      if (Object.keys(data.material).length == 0) delete data.material;
    }

    // Diff based cleanup (don't do this for everything, to avoid defaults changing causing problems)
    const defaults = new this.constructor().toObject(true, false);
    const diff = foundry.utils.diffObject(defaults, data);
    if (!diff.naturalAttack) delete data.naturalAttack;
    if (!diff.alignments) delete data.alignments;

    return data;
  }

  /**
   * @type {pf1.applications.component.ItemActionSheet} - Returns current sheet for this action or creates one if it doesn't exist.
   */
  get sheet() {
    this._sheet ??= new pf1.applications.component.ItemActionSheet(this);
    return this._sheet;
  }

  /**
   * Render all connected application instances.
   *
   * @param {boolean} [force=false] - Force rendering
   * @param {object} [context={}] - Optional context
   */
  render(force = false, context = {}) {
    // TODO: Support AppV2
    Object.values(this.apps).forEach((app) => app.render(force, context));
  }

  /* DEPRECATIONS */

  /** @deprecated */
  get spellEffect() {
    foundry.utils.logCompatibilityWarning("ItemAction.spellEffect is deprecated in favor of ItemAction.effect", {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });

    return this.effect;
  }

  /** @deprecated */
  get attackNotes() {
    foundry.utils.logCompatibilityWarning("ItemAction.attackNotes is deprecated in favor of ItemAction.notes.footer", {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });
    return this.notes?.footer;
  }

  /** @deprecated */
  get effectNotes() {
    foundry.utils.logCompatibilityWarning("ItemAction.effectNotes is deprecated in favor of ItemAction.notes.effect", {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });
    return this.notes?.effect;
  }
}
