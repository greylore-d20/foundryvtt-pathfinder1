import { ItemPF } from "./item-pf.mjs";
import { RollPF } from "@dice/roll.mjs";
import { calculateRangeFormula } from "@utils";
import { renderCachedTemplate } from "@utils/handlebars/templates.mjs";

/**
 * Spell item
 */
export class ItemSpellPF extends ItemPF {
  /**
   * @override
   * @inheritDoc
   */
  static system = Object.freeze({
    ...super.system,
    hasIdentifier: false,
    hasChanges: false,
  });

  /**
   * @internal
   * @override
   * @param {object} data Creation data
   * @param {object} options Context options
   * @param {User} user Triggering user
   */
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    this._assignLevelOnCreate(data, options);

    // Handle preparation data creation
    {
      const prep = data.system.preparation ?? {};
      const prepUpdate = {};

      // Add preparation
      if (this.actor && prepUpdate.value === undefined) {
        // Only spontaneous casters auto-prepare new spells
        if (this.spellbook?.spellPreparationMode === "spontaneous") {
          prepUpdate.value ??= 1;
          prepUpdate.max ??= 1;
        }
      }

      if (!foundry.utils.isEmpty(prepUpdate)) {
        this.updateSource({ system: { preparation: prepUpdate } });
      }
    }
  }

  /**
   * @internal
   * @override
   * @param {object} changed
   * @param {object} options
   * @param {User} user
   */
  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);

    if (!changed.system) return;

    this._preparationPreUpdate(changed);
  }

  /**
   * Constrains and alters prepared slot updates to result in meaningful end results.
   *
   * @private
   * @param {object} changed Change data in pre-update
   */
  _preparationPreUpdate(changed) {
    const prep = changed.system.preparation;
    if (!prep) return;

    const current = this.system.preparation;
    const max = prep.max ?? current.max ?? 0;
    const left = prep.value ?? current.value ?? 0;

    // Constrain left and max to sane values
    if (left > max) {
      if (prep.max !== undefined) {
        prep.value = max;
      } else if (prep.value !== undefined) {
        prep.max = left;
      }
    }

    // TODO: Remove following once DataModel is implemented with relevant constraints
    if (prep.max < 0) prep.max = 0;
    if (prep.value < 0) prep.value = 0;
  }

  /**
   * Assign spell level according to spellbook class if present.
   *
   * @protected
   * @param {object} data Item data
   * @param {object} options Creation options
   */
  _assignLevelOnCreate(data, options) {
    const actor = this.actor;
    const book = this.system.spellbook;
    const cls = actor?.system.attributes?.spells?.spellbooks?.[book]?.class;
    const level = this.system.learnedAt?.class?.[cls];
    if (Number.isFinite(level)) this.updateSource({ "system.level": Math.clamp(level, 0, 9) });
  }

  /** @inheritDoc */
  getLabels({ actionId, rollData } = {}) {
    const labels = super.getLabels({ actionId, rollData });
    const itemData = this.system;

    // Spell Level, School, and Components
    labels.level = pf1.config.spellLevels[itemData.level];
    labels.school = pf1.config.spellSchools[itemData.school];
    labels.components = this.getSpellComponents({ compact: true }).join(" ");

    return labels;
  }

  preCreateData(data, options, user) {
    const updates = super.preCreateData(data, options, user);

    const actor = this.actor;
    if (actor) {
      // Swap non-psychic components for psychic ones
      if (this.spellbook?.psychic === true) {
        if (this.system.components?.verbal === true) {
          updates["system.components.verbal"] = false;
          updates["system.components.thought"] = true;
        }
        if (this.system.components?.somatic === true) {
          updates["system.components.somatic"] = false;
          updates["system.components.emotion"] = true;
        }
      }
    }

    return updates;
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();

    const descs = this.system.descriptors;
    if (descs) {
      descs.custom ??= [];
      descs.value ??= [];
      pf1.utils.traits.translate(descs, pf1.config.spellDescriptors);
    }

    const subs = this.system.subschool;
    if (subs) {
      subs.custom ??= [];
      subs.value ??= [];
      pf1.utils.traits.translate(subs, pf1.config.spellSubschools);
    }
  }

  /** @override */
  getRollData() {
    const result = super.getRollData();

    result.sl = this.spellLevel || 0;

    const spellbook = this.spellbook;
    if (spellbook) {
      const spellAbility = spellbook.ability;
      let ablMod = "";
      if (spellAbility !== "") ablMod = result.abilities?.[spellAbility]?.mod;
      result.ablMod = ablMod;

      result.cl = this.casterLevel || 0;

      // Add @class shortcut to @classes[classTag]
      if (spellbook.class === "_hd")
        result.class = { level: result.attributes.hd?.total ?? result.details?.level?.value ?? 0 };
      else result.class = result.classes?.[spellbook.class] ?? {};

      // Add @spellbook shortcut to @spells[bookId]
      result.spellbook = result.spells[this.system.spellbook];
    } else {
      const [sl, cl] = this.constructor.getMinimumCasterLevelBySpellData(this);

      result.sl = sl;
      result.cl = cl;
      result.ablMod = Math.floor(sl / 2);
    }

    return result;
  }

  /** @override */
  getConditionalTargets(target, result) {
    super.getConditionalTargets(target, result);

    if (target === "effect") {
      result["cl"] = game.i18n.localize("PF1.CasterLevel");
    }

    // Add misc subtargets
    if (target === "misc") {
      if (this.useSpellPoints()) result["charges"] = game.i18n.localize("PF1.SpellPointsCost");
      else delete result["charges"]; // Non-spellpoint spells do not use charges
    }
  }

  /** @inheritDoc */
  getTypeChatData(data, labels, props, rollData) {
    if (rollData.item.sr) {
      props.push(game.i18n.localize("PF1.SpellResistance"));
    }

    // Add charges
    if (this.isCharged && !this.system.atWill) {
      if (this.useSpellPoints()) {
        props.push(`${game.i18n.localize("PF1.SpellPoints")}: ${this.charges}/${this.maxCharges}`);
      } else {
        props.push(`${game.i18n.localize("PF1.ChargePlural")}: ${this.charges}/${this.maxCharges}`);
      }
    }
  }

  /**
   * Add charges to the spell or its relevant resource pool (spell points or spontaneous spells).
   *
   * @override
   * @param {number} value - Number of charges to add
   * @param {object} [data=null] - Additional data to pass to the update
   * @returns {Promise<this | void>} Updated document or undefined if no update is possible or required.
   */
  async addCharges(value, data = null) {
    if (!this.actor) return;
    if (this.system.atWill) return;

    const spellbook = this.spellbook;
    if (!spellbook) return;
    const isSpontaneous = spellbook.spontaneous,
      spellbookKey = this.system.spellbook || "primary",
      spellLevel = this.system.level;

    if (this.useSpellPoints()) {
      const curUses = this.getSpellUses();
      const updateData = {};
      updateData[`system.attributes.spells.spellbooks.${spellbookKey}.spellPoints.value`] = curUses + value;
      await this.actor.update(updateData);
      return this;
    } else {
      const newCharges = isSpontaneous
        ? Math.max(0, (spellbook.spells?.[`spell${spellLevel}`]?.value || 0) + value)
        : Math.max(0, (this.system.preparation?.value || 0) + value);

      if (!isSpontaneous) {
        const key = "system.preparation.value";
        if (data == null) {
          data = {};
          data[key] = newCharges;
          return this.update(data);
        } else {
          data[key] = newCharges;
        }
      } else {
        const key = `system.attributes.spells.spellbooks.${spellbookKey}.spells.spell${spellLevel}.value`;
        const actorUpdateData = {};
        actorUpdateData[key] = newCharges;
        await this.actor.update(actorUpdateData);
        return this;
      }
    }
  }

  /** @inheritDoc */
  get isCharged() {
    if (this.system.atWill) return false;
    return true;
  }

  /** @inheritdoc */
  get hasFiniteCharges() {
    if (this.system.atWill) return false;
    return this.getDefaultChargeCost() > 0;
  }

  /** @type {number} - Remaining charges */
  get charges() {
    return this.getSpellUses();
  }

  /** @type {number} - Maximum possible charges */
  get maxCharges() {
    return this.getSpellUses(true);
  }

  /**
   * Get default charge cost for spell actions.
   *
   * @param options
   * @param options.rollData
   * @returns {number} Number for default cost.
   */
  getDefaultChargeCost({ rollData } = {}) {
    if (this.system.atWill) return 0;

    if (this.useSpellPoints()) {
      rollData ??= this.getRollData();
      const formula = this.getDefaultChargeFormula();
      return RollPF.safeRollSync(formula, rollData).total;
    } else {
      return super.getDefaultChargeCost({ rollData });
    }
  }

  /** @inheritDoc */
  getDefaultChargeFormula() {
    if (this.useSpellPoints()) {
      return this.system.spellPoints?.cost || game.settings.get("pf1", "spellPointCost") || "0";
    } else {
      return super.getDefaultChargeFormula();
    }
  }

  /**
   * @remarks
   * - Recharging individual spells for spell point, spontaneous, or hybrid spellbooks has no effect.
   * @override
   * @inheritDoc
   */
  async recharge({ value, period = "day", exact = false, maximize = true, commit = true, rollData, context } = {}) {
    const spellbook = this.spellbook,
      mode = spellbook?.spellPreparationMode || "prepared";

    // Can not recharge non-prepared spellbooks
    if (mode !== "prepared") return;

    // Spellpoints are not on spells
    if (spellbook?.spellPoints?.useSystem ?? false) return;

    if (period == "week") {
      // Spells do not recharge per week
      if (exact) return;
      // When not recharging with exact period, downgrade to "day" which is normal spell restoration period
      period = "day";
    }

    // Spells do not restore on non-day period
    if (!["day", "any"].includes(period)) return;

    const prep = this.system.preparation ?? {};

    // No specific value given
    maximize = !(Number.isFinite(value) && value >= 0);

    // Set value
    if (maximize) value = prep.max || 0;
    // Clamp charge value
    value = Math.clamp(value, 0, prep.max || 0);

    // Cancel pointless or bad update
    if (value === (prep.value || 0) || !Number.isFinite(value)) return;

    const updateData = { system: { preparation: { value } } };

    if (commit) return this.update(updateData, context);
    return updateData;
  }

  /** @type {number} - Effective spell level with offset taken into account. */
  get spellLevel() {
    return this.system.level + (this.system.slOffset || 0);
  }

  /** @type {numbe|null} - EFfective caster level with CL offset taken into account. Null if not linked to valid spellbook */
  get casterLevel() {
    const spellbook = this.spellbook;
    if (!spellbook) return null;

    return spellbook.cl.total + (this.system.clOffset || 0);
  }

  /** @type {object|undefined} - Actor's linked spellbook data */
  get spellbook() {
    const bookId = this.system.spellbook;
    return this.actor?.system.attributes?.spells.spellbooks[bookId];
  }

  getSpellUses(max = false) {
    const itemData = this.system;
    if (itemData.atWill) return Number.POSITIVE_INFINITY;

    const spellbook = this.spellbook;

    const isSpontaneous = spellbook?.spontaneous ?? false,
      spellLevel = itemData.level;

    if (this.useSpellPoints()) {
      if (max) return spellbook.spellPoints?.max ?? 0;
      return spellbook.spellPoints?.value ?? 0;
    } else {
      if (isSpontaneous) {
        if (itemData.preparation.value > 0) {
          if (max) return spellbook.spells?.[`spell${spellLevel}`]?.max || 0;
          return spellbook.spells?.[`spell${spellLevel}`]?.value || 0;
        }
      } else {
        if (max) return itemData.preparation?.max ?? 0;
        return itemData.preparation?.value ?? 0;
      }
    }

    return 0;
  }

  /** @returns {boolean} - Whether the attached spellbok uses spell points */
  useSpellPoints() {
    return this.spellbook?.spellPoints?.useSystem ?? false;
  }

  /**
   * Spell components
   *
   * @example
   * ```js
   * // Discern Lies on Cleric
   * spell.getSpellComponents(); // V S M/DF
   * spell.getSpellComponents({compact:true}); // V S DF
   * ```
   * @param {object} options - Additional options
   * @param {boolean} [options.compact] - Remove redundant components (e.g. M/DF becomes DF for divine caster)
   * @returns {string[]} - Component keys
   */
  getSpellComponents({ compact = false } = {}) {
    const reSplit = pf1.config.re.traitSeparator,
      srcComponents = this.system.components ?? {},
      srcMaterials = this.system.materials ?? {};

    const kind = this.spellbook?.kind,
      //isArcane = kind === "arcane",
      //isPsychic = kind === "psychic",
      //isAlchemical = kind === "alchemy",
      isDivine = kind === "divine";

    const components = [];
    const labels = pf1.config.spellComponents;

    if (srcComponents.verbal) components.push(labels.verbal);
    if (srcComponents.somatic) components.push(labels.somatic);
    if (srcComponents.thought) components.push(labels.thought);
    if (srcComponents.emotion) components.push(labels.emotion);

    // Reverse mapping of CONFIG.PF1.divineFocus for readability
    const dfVariants = { DF: 1, MDF: 2, FDF: 3 };

    let df = srcComponents.divineFocus;

    // Display focus and material only if they aren't overridden by DF variant
    if (isDivine && df === dfVariants.MDF && compact) {
      // Downgrade to DF since material is not used
      df = dfVariants.DF;
    } else if (srcComponents.material) {
      let material = labels.material;
      // Display indetermined M/DF only if spellcasting kind is not known
      if ((!kind || !compact) && df === dfVariants.MDF) material = `${material}/${labels.divineFocus}`;
      if (srcMaterials.value && !compact) material = `${material} (${srcMaterials.value})`;
      if (material) components.push(material);
    }

    if (isDivine && df === dfVariants.FDF && compact) {
      // Downgrade to DF since focus is not used
      df = dfVariants.DF;
    } else if (srcComponents.focus) {
      let focus = labels.focus;
      // Display indeterminate F/DF only if spellcasting kind is not known
      if ((!kind || !compact) && df === dfVariants.FDF) focus = `${focus}/${labels.divineFocus}`;
      if (srcMaterials.focus && !compact) focus = `${focus} (${srcMaterials.focus})`;
      if (focus) components.push(focus);
    }

    if (df === dfVariants.DF) components.push(labels.divineFocus);
    if (labels.value) components.push(...srcComponents.value.split(reSplit));

    return components;
  }

  /**
   * @param {object} itemData - A spell item's data.
   * @returns {[number,number]} - A tuple containing the spell level and caster level in order.
   */
  static getMinimumCasterLevelBySpellData(itemData) {
    const learnedAt = Object.entries(itemData.system.learnedAt?.class ?? {})?.reduce((cur, [classId, level]) => {
      const classes = classId.split("/");
      for (const cls of classes) cur.push([cls, level]);
      return cur;
    }, []);
    const result = [9, 20];
    for (const [classId, level] of learnedAt) {
      result[0] = Math.min(result[0], level);

      const tc = pf1.config.classCasterType[classId] || "high";
      if (tc === "high") {
        result[1] = Math.min(result[1], 1 + Math.max(0, level - 1) * 2);
      } else if (tc === "med") {
        result[1] = Math.min(result[1], 1 + Math.max(0, level - 1) * 3);
      } else if (tc === "low") {
        result[1] = Math.min(result[1], 1 + Math.max(0, level) * 3);
      }
    }

    return result;
  }

  /**
   * Used in consumable creation
   *
   * @internal
   * @param string
   * @param rollData
   */
  static _replaceConsumableConversionString(string, rollData) {
    return string
      .replace(/@sl/g, `${rollData.sl}[${game.i18n.localize("PF1.SpellLevel")}]`)
      .replace(/@cl/g, "@item.cl")
      .replace(/@ablMod/g, `${rollData.ablMod}[${game.i18n.localize("PF1.AbilityScore")}]`);
  }

  /**
   * Convert spell into a consumable item.
   *
   * @param {object} origData - Spell item data
   * @param {"wand"|"scroll"|"potion"} type - Consumable type
   * @param {object} [options] - Additional options
   * @param {string} [options.spellType="arcane"] - Spell type
   * @returns {object|null} - Item data for appropriate consumable, or null if dialog option was used and it was cancelled.
   */
  static async toConsumable(origData, type, { spellType = "arcane" } = {}) {
    const isWand = type === "wand",
      isPotion = type === "potion",
      isScroll = type === "scroll";

    const [minLevel, minCl] = this.getMinimumCasterLevelBySpellData(origData);
    const level = origData.sl ?? minLevel ?? 1;
    const cl = origData.cl ?? minCl ?? 1;
    const materialPrice = origData.system.materials?.gpValue ?? 0;

    const itemData = {
      type: "consumable",
      name: origData.name,
      system: {
        subType: type,
        spellType: origData.spellType || spellType,
        description: {},
        identified: origData.identified ?? true,
        unidentified: {
          name: origData.unidentifiedName || game.i18n.localize(`PF1.CreateItem${type.capitalize()}`),
        },
        cl, // Caster level
        aura: { school: origData.system.school },
        uses: { per: "single" },
        price: 0,
        hardness: 0,
        hp: { value: 1, max: 1 },
        actions: origData.system.actions ?? [],
        sources: origData.system.sources ?? [],
      },
    };

    // Add basic item type source as source for the consumable
    const extraSources = {
      wand: { id: "PZO1110", pages: "496" },
      scroll: { id: "PZO1110", pages: "490-491" },
      potion: { id: "PZO1110", pages: "477-478" },
    };
    const xsrc = extraSources[type];
    if (xsrc) {
      const osrc = itemData.system.sources.find((s) => s.id == xsrc.id);
      if (osrc) {
        // Merge pages when same source already exists
        if (osrc.pages) osrc.pages += `, ${xsrc.pages}`;
        else osrc.pages = xsrc.pages;
      } else {
        itemData.system.sources.push(xsrc);
      }
    }

    // Initialize default action
    if (itemData.system.actions.length == 0) itemData.system.actions.push(defaultAction);
    const defaultAction = itemData.system.actions[0] ?? pf1.components.ItemAction.defaultData;
    defaultAction.range ??= {};

    // Prepare new action copying over with old data if present

    // Override activation as required by consumables
    defaultAction.activation.type = "standard";
    defaultAction.activation.unchained.type = "action";
    defaultAction.activation.unchained.cost = 2;

    // Fill in pseudo roll data object
    const rollData = {
      item: origData.system,
      ablMod: Math.floor(level / 2), // Minimum usable ability modifier
      sl: level,
      cl,
    };

    if (isWand) {
      itemData.name = game.i18n.format("PF1.CreateItemWandOf", { name: origData.name });
      defaultAction.name = game.i18n.localize("PF1.Use");
      itemData.img = "systems/pf1/icons/items/inventory/wand-star.jpg";
      itemData.system.uses.pricePerUse =
        Math.floor(((Math.max(0.5, level) * cl * 750) / 50) * 100) / 100 + materialPrice;
      itemData.system.hardness = 5;
      itemData.system.hp.max = 5;
      itemData.system.hp.value = 5;
      // Set charges
      itemData.system.uses.maxFormula = "50";
      itemData.system.uses.value = 50;
      itemData.system.uses.max = 50;
      itemData.system.uses.per = "charges";
    } else if (isPotion) {
      itemData.name = game.i18n.format("PF1.CreateItemPotionOf", { name: origData.name });
      defaultAction.name = game.i18n.localize("PF1.Drink");
      itemData.img = "systems/pf1/icons/items/potions/minor-blue.jpg";
      itemData.system.price = Math.max(0.5, level) * cl * 50 + materialPrice;
      itemData.system.hardness = 1;
    } else if (isScroll) {
      itemData.name = game.i18n.format("PF1.CreateItemScrollOf", { name: origData.name });
      defaultAction.name = game.i18n.localize("PF1.Use");
      itemData.img = "systems/pf1/icons/items/inventory/scroll-magic.jpg";
      itemData.system.price = Math.max(0.5, level) * cl * 25 + materialPrice;
    }

    const convertNotes = (data) => {
      // Replace attack and effect formula data
      for (const arrKey of ["attackNotes", "effectNotes"]) {
        const arr = data[arrKey];
        if (!arr) continue;
        for (let idx = 0; idx < arr.length; idx++) {
          arr[idx] = this._replaceConsumableConversionString(arr[idx], rollData);
        }
      }
    };

    // Adjust all actions
    for (const action of itemData.system.actions) {
      // Convert ranges
      if (isPotion && defaultAction === action) {
        // Special handling for potions
        action.range.units = "personal";
        delete action.range.value;
      } else {
        // Convert spell-only ranges
        if (["close", "medium", "long"].includes(action.range?.units)) {
          // TODO: These should only replace @cl with @item.level instead of pre-resolving the scaling formula
          const rlabel = pf1.config.distanceUnits[action.range.units];
          const rvalue = RollPF.safeRollSync(pf1.config.spellRangeFormulas[action.range.units], rollData).total ?? 0;
          action.range.value = `${rvalue}[${rlabel}]`;
          action.range.units = "ft";
        }
      }

      // Convert template
      if (action.measureTemplate?.type) {
        action.measureTemplate.size = this._replaceConsumableConversionString(action.measureTemplate.size, rollData);
      }

      // Convert extra attacks
      const exAtk = action.extraAttacks;
      if (exAtk) {
        if (exAtk.formula?.count?.length)
          exAtk.formula.count = this._replaceConsumableConversionString(exAtk.formula.count, rollData);
        if (exAtk.formula?.bonus?.length)
          exAtk.formula.bonus = this._replaceConsumableConversionString(exAtk.formula.bonus, rollData);

        for (const bAtk of exAtk.manual ?? []) {
          bAtk.formula = this._replaceConsumableConversionString(bAtk.formula, rollData);
        }
      }

      // Set damage formula
      for (const dmgPart of action.damage?.parts ?? []) {
        dmgPart.formula = this._replaceConsumableConversionString(dmgPart.formula, rollData);
      }

      // Set save
      if (action.save?.type) {
        const oldSaveDC = action.save.dc;
        action.save.dc = `10 + ${origData.sl}[${game.i18n.localize("PF1.SpellLevel")}] + ${Math.floor(
          origData.sl / 2
        )}[${game.i18n.localize("PF1.SpellcastingAbility")}]`;
        // Add DC offset
        if (oldSaveDC?.length) action.save.dc += ` + (${oldSaveDC})[${game.i18n.localize("PF1.DCOffset")}]`;
      }

      convertNotes(action);
    }

    convertNotes(itemData.system);

    // Set description
    const spell = new Item.implementation(origData);
    spell.reset();
    // TODO: Make range and duration appear as inline rolls that scale on item CL?
    const desc = await spell.getDescription({ charcard: false, header: true, body: true, rollData });
    itemData.system.description.value = this._replaceConsumableConversionString(desc, rollData);

    // Create and return synthetic item data
    return new ItemPF(foundry.utils.expandObject(itemData)).toObject();
  }

  /**
   * Open Consumable conversion dialog.
   *
   * Automatically calls {@link this.toConsumable} as appropriate.
   *
   * @param {object} itemData - Spell item data
   * @param {object} [options] - Additional options
   * @param {boolean} [options.allowSpell=true] - Allow spell creation
   * @param {string} [options.spellType="arcane"] - Spell type
   * @param {object} [options.actor=undefined] - The actor the consumable is being created on.
   * @returns {Promise<null|false|object>} - Returns null if cancelled, false if no conversion is to take place, or converted data.
   */
  static async toConsumablePrompt(itemData, { allowSpell = true, spellType = "arcane", actor = undefined } = {}) {
    const [sl, cl] = CONFIG.Item.documentClasses.spell.getMinimumCasterLevelBySpellData(itemData);

    const getFormData = (html) => {
      const formData = foundry.utils.expandObject(new FormDataExtended(html.querySelector("form")).object);
      foundry.utils.mergeObject(itemData, formData);
      // NaN check here to allow SL 0
      if (Number.isNaN(itemData.sl)) itemData.sl = 1;
      return itemData;
    };

    const createConsumable = (data, type) => this.toConsumable(data, type, { spellType: data.spellType });

    const buttons = {
      potion: {
        icon: '<i class="fas fa-prescription-bottle"></i>',
        label: game.i18n.localize("PF1.CreateItemPotion"),
        callback: (html) => createConsumable(getFormData(html), "potion"),
      },
      scroll: {
        icon: '<i class="fas fa-scroll"></i>',
        label: game.i18n.localize("PF1.CreateItemScroll"),
        callback: (html) => createConsumable(getFormData(html), "scroll"),
      },
      wand: {
        icon: '<i class="fas fa-magic"></i>',
        label: game.i18n.localize("PF1.CreateItemWand"),
        callback: (html) => createConsumable(getFormData(html), "wand"),
      },
      spell: {
        icon: '<i class="fas fa-hand-sparkles"></i>',
        label: game.i18n.localize("TYPES.Item.spell"),
        callback: () => false,
      },
    };

    if (!allowSpell) delete buttons.spell;

    return Dialog.wait(
      {
        title: game.i18n.format("PF1.CreateItemForSpell", { name: itemData.name }),
        content: await renderTemplate("systems/pf1/templates/internal/create-consumable.hbs", {
          name: itemData.name,
          sl,
          cl,
          isGM: game.user.isGM,
          config: pf1.config,
          spellType,
          // We assume every other check done at `ActorSheetPF._alterDropItemData` has passed
          isNPC: actor?.type === "npc",
        }),
        itemData,
        buttons,
        close: () => null,
        default: "potion",
      },
      {
        classes: [...Dialog.defaultOptions.classes, "pf1", "create-consumable"],
        jQuery: false,
      }
    );
  }

  /**
   * @remarks
   * Checks for at-will and preparation status.
   * @inheritDoc
   */
  get canUse() {
    if (this.system.atWill) return true;

    return (this.system.preparation?.value ?? 0) > 0;
  }

  /**
   * Determine if this spell is domain/school spell.
   *
   * @type {boolean}
   */
  get isDomain() {
    return this.system.domain === true;
  }

  /** @inheritDoc */
  async getDescription({ chatcard = false, data = {}, rollData, header = true, body = true, isolated = false } = {}) {
    const headerContent = header
      ? renderCachedTemplate("systems/pf1/templates/items/headers/spell-header.hbs", {
          ...data,
          ...(await this.getDescriptionData({ rollData, isolated })),
          chatcard: chatcard === true,
        })
      : "";

    let bodyContent = "";
    if (body) bodyContent = `<div class="description-body">` + this.system.description.value + "</div>";

    let separator = "";
    if (header && body) separator = `<h3 class="description-header">${game.i18n.localize("PF1.Description")}</h3>`;

    return headerContent + separator + bodyContent;
  }

  /** @inheritDoc */
  async getDescriptionData({ rollData, isolated = false } = {}) {
    const result = await super.getDescriptionData({ rollData, isolated });

    const system = this.system;
    result.system = system;

    const defaultAction = this.defaultAction;
    const actionData = defaultAction?.data ?? {};

    rollData ??= defaultAction?.getRollData() ?? this.getRollData();

    const labels = this.getLabels({ rollData });
    result.labels = labels;

    labels.school = pf1.config.spellSchools[system.school];
    labels.subschool = pf1.utils.i18n.join([...(system.subschool.total ?? [])]);
    labels.descriptors = pf1.utils.i18n.join([...(system.descriptors.total ?? [])], "conjunction", false);

    // Set information about when the spell is learned
    result.learnedAt = {};
    if (system.learnedAt) {
      const classNames = await pf1.utils.packs.getClassIDMap();
      ["class", "domain", "subDomain", "elementalSchool", "bloodline"].forEach((category) =>
        pf1.utils.i18n.join(
          (result.learnedAt[category] = Object.entries(system.learnedAt[category]).map(([classId, level]) => {
            classId = classNames[classId] || classId;
            return `${classId} ${level}`;
          }))
        )
      );
    }

    // Set components label
    labels.components = pf1.utils.i18n.join(this.getSpellComponents());

    // Set effect label
    {
      const effect = actionData.spellEffect;
      if (effect) labels.effect = effect;
    }

    // Set DC and SR
    {
      const savingThrowDescription = actionData.save?.description;
      labels.savingThrow = savingThrowDescription || game.i18n.localize("PF1.None");

      const sr = system.sr;
      labels.sr = (sr === true ? game.i18n.localize("PF1.Yes") : game.i18n.localize("PF1.No")).toLowerCase();

      if (actionData.range?.units !== "personal") result.useDCandSR = true;
    }

    const harmless = actionData.save?.harmless ?? false;
    if (harmless) labels.harmless = game.i18n.localize("PF1.Yes").toLowerCase();

    return result;
  }

  /**
   * Number of slots the spell takes to prepare.
   *
   * Quick access to .system.slotCost with additional considerations such as at-will toggle.
   *
   * Defaults to 1 if the data is not present, 0 if the spell is at-will.
   *
   * @type {number}
   */
  get slotCost() {
    if (this.system.atWill) return 0;
    return this.system.slotCost ?? 1;
  }
}
