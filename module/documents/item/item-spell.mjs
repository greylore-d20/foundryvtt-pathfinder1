import { ItemPF } from "./item-pf.mjs";
import { RollPF } from "../../dice/roll.mjs";
import { calculateRangeFormula } from "@utils";
import { renderCachedTemplate } from "@utils/handlebars/templates.mjs";

export class ItemSpellPF extends ItemPF {
  /**
   * @override
   */
  static system = Object.freeze({
    ...super.system,
    hasIdentifier: false,
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
      if (prep.maxAmount !== undefined) {
        foundry.utils.logCompatibilityWarning("ItemSpellPF preparation.maxAmount is now preparation.max", {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        });
        prepUpdate.max = prep.maxAmount;
        prepUpdate["-=maxAmount"] = null;
      }
      if (prep.preparedAmount !== undefined) {
        foundry.utils.logCompatibilityWarning("ItemSpellPF preparation.preparedAmount is now preparation.value", {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        });
        prepUpdate.value = prep.preparedAmount;
        prepUpdate["-=preparedAmount"] = null;
      }
      if (prep.spontaneousPrepared !== undefined) {
        foundry.utils.logCompatibilityWarning("ItemSpellPF preparation.spontaneousPrepared is now preparation.value", {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        });
        prepUpdate.value = prep.spontaneousPrepared ? 1 : 0;
        prepUpdate["-=spontaneousPrepared"] = null;
      }

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

    const prep = changed.system.preparation;
    if (prep) {
      if (prep.maxAmount !== undefined) {
        foundry.utils.logCompatibilityWarning("ItemSpellPF preparation.maxAmount is now preparation.max", {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        });
        prep.max = prep.maxAmount;
        delete prep.maxAmount;
      }
      if (prep.preparedAmount !== undefined) {
        foundry.utils.logCompatibilityWarning("ItemSpellPF preparation.preparedAmount is now preparation.value", {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        });
        prep.value = prep.preparedAmount;
        delete prep.preparedAmount;
      }
      if (prep.spontaneousPrepared !== undefined) {
        foundry.utils.logCompatibilityWarning("ItemSpellPF preparation.spontaneousPrepared is now preparation.value", {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        });
        prep.value = prep.spontaneousPrepared ? 1 : 0;
        delete prep.spontaneousPrepared;
      }
    }
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
    if (Number.isFinite(level)) this.updateSource({ "system.level": Math.clamped(level, 0, 9) });
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

  /**
   * Returns the spell's effective spell level, after counting in offsets.
   *
   * @deprecated
   * @param {number} [bonus=0] - Another bonus to account for.
   * @returns {number} The spell's effective spell level.
   */
  getEffectiveSpellLevel(bonus = 0) {
    foundry.utils.logCompatibilityWarning(
      `ItemSpellPF.getEffectiveSpellLevel() is deprecated. Use ItemSpellPF.spellLevel instead.`,
      { since: "PF1 vNEXT", until: "PF1 vNEXT+1" }
    );

    return (this.spellLevel ?? 0) + bonus;
  }

  /**
   * Returns the spell's effective caster level, after counting in offsets.
   *
   * @deprecated
   * @param {number} [bonus=0] - Another bonus to account for.
   * @returns {number} The spell's effective caster level.
   */
  getEffectiveCasterLevel(bonus = 0) {
    foundry.utils.logCompatibilityWarning(
      `ItemSpellPF.getEffectiveCasterLevel() is deprecated. Use ItemSpellPF.casterLevel instead.`,
      { since: "PF1 vNEXT", until: "PF1 vNEXT+1" }
    );

    return (this.casterLevel ?? 0) + bonus;
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

  prepareBaseData() {
    super.prepareBaseData();

    this.system.preparation ??= {};
    const prep = this.system.preparation;
    // Compatibility shims
    const compat = [
      ["maxAmount", "max"],
      ["preparedAmount", "value"],
      ["spontaneousPrepared", "value"],
    ];
    for (const [oldk, newk] of compat) {
      if (!Object.getOwnPropertyDescriptor(prep, oldk)?.["get"]) {
        delete prep[oldk];
        Object.defineProperty(prep, oldk, {
          get() {
            foundry.utils.logCompatibilityWarning(
              `ItemSpellPF preparation.${oldk} is deprecated in favor of preparation.${newk}`,
              { since: "PF1 vNEXT", until: "PF1 vNEXT+1" }
            );
            return prep[newk];
          },
          enumerable: false,
        });
      }
    }
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    const descs = this.system.descriptors;
    if (descs) {
      descs.custom ??= [];
      descs.value ??= [];
      descs.total = new Set([...descs.value.map((d) => pf1.config.spellDescriptors[d] || d), ...descs.custom]);
    }
  }

  getRollData() {
    const result = super.getRollData();

    if (this.actor) {
      const spellbook = this.spellbook;
      if (spellbook != null) {
        const spellAbility = spellbook.ability;
        let ablMod = "";
        if (spellAbility !== "") ablMod = result.abilities?.[spellAbility]?.mod;

        result.cl = this.casterLevel || 0;
        result.sl = this.spellLevel || 0;
        result.classLevel =
          spellbook.class === "_hd"
            ? result.attributes.hd?.total ?? result.details.level.value
            : result.classes?.[spellbook.class]?.level || 0;
        result.ablMod = ablMod;

        // Add @spellbook shortcut to @spells[bookId]
        result.spellbook = result.spells[this.system.spellbook];
      }
    }

    return result;
  }

  getConditionalSubTargets(target) {
    const result = super.getConditionalSubTargets(target);

    // Add subtargets affecting effects
    if (target === "effect") {
      result["cl"] = game.i18n.localize("PF1.CasterLevel");
    }

    // Add misc subtargets
    if (target === "misc") {
      // Add charges subTarget with specific label
      if (this.type === "spell" && this.useSpellPoints()) result["charges"] = game.i18n.localize("PF1.SpellPointsCost");
    }

    return result;
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
      return RollPF.safeRoll(formula, rollData).total;
    } else {
      return super.getDefaultChargeCost({ rollData });
    }
  }

  getDefaultChargeFormula() {
    if (this.useSpellPoints()) {
      return this.system.spellPoints?.cost || game.settings.get("pf1", "spellPointCost") || "0";
    } else {
      return super.getDefaultChargeFormula();
    }
  }

  /**
   * @inheritdoc
   */
  async recharge({ value, period = "day", exact = false, maximize = true, commit = true, rollData, context } = {}) {
    const itemData = this.system,
      spellbook = this.spellbook,
      isSpontaneous = spellbook?.spontaneous ?? false;

    if (period == "week") {
      // Spells do not recharge per week
      if (exact) return;
      // When not recharging with exact period, downgrade to "day" which is normal spell restoration period
      period = "day";
    }

    // Spells do not restore on non-day period
    if (!["day", "any"].includes(period)) return;

    // Spontaneous spells do not record charges in spell.
    if (isSpontaneous) return;

    // Spellpoints are not on spells
    if (spellbook?.spellPoints?.useSystem ?? false) return;

    const updateData = { system: { preparation: {} } };

    const prep = itemData.preparation;
    if (prep.value == prep.max) return;

    if (maximize) value = prep.max ?? 0;
    value = Math.clamped(value, 0, prep.max ?? 0);

    if (!Number.isFinite(value)) return;

    updateData.system.preparation.value = prep.max ?? 0;

    if (commit) this.update(updateData, context);
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

  getDC(rollData = null) {
    foundry.utils.logCompatibilityWarning("ItemSpellPF.getDC() is deprecated in favor of ItemAction.getDC()", {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });

    return this.firstAction?.getDC(rollData) ?? 10;
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

  useSpellPoints() {
    return this.spellbook?.spellPoints?.useSystem ?? false;
  }

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
   * @returns {number[]} An array containing the spell level and caster level.
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
      },
    };

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
          const rlabel = pf1.config.distanceUnits[action.range.units];
          const rvalue = RollPF.safeRoll(pf1.config.spellRangeFormulas[action.range.units], rollData).total ?? 0;
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
    itemData.system.description.value = this._replaceConsumableConversionString(
      origData.system.description.value,
      rollData
    );

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
   * @type {boolean} - true if the default action is prepared to cast
   */
  get canCast() {
    foundry.utils.logCompatibilityWarning(
      "ItemSpellPF.canCast is deprecated in favor of ItemBasePF.canUse and ItemAction.canUse",
      {
        since: "PF1 vNEXT",
        until: "PF1 vNEXT+1",
      }
    );

    return this.canUse && (this.firstAction?.canUse ?? true);
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

  /**
   * @inheritdoc
   */
  getDescription({ chatcard = false, data = {}, rollData, header = true, body = true } = {}) {
    const headerContent = header
      ? renderCachedTemplate("systems/pf1/templates/internal/spell-description.hbs", {
          ...data,
          ...this.getDescriptionData({ rollData }),
          chatcard: chatcard === true,
        })
      : "";
    const bodyContent = body ? this.system.description.value : "";
    return headerContent + bodyContent;
  }

  getDescriptionData({ rollData } = {}) {
    const reSplit = pf1.config.re.traitSeparator;
    const srcData = this.system;
    const firstAction = this.firstAction;
    const actionData = firstAction?.data ?? {};

    rollData ??= firstAction?.getRollData();

    const label = {
      school: pf1.config.spellSchools[srcData.school],
      subschool: srcData.subschool || "",
      descriptors: "",
    };
    const data = {
      data: foundry.utils.mergeObject(this.system, srcData, { inplace: false }),
      label: label,
    };

    // Set subschool and descriptors label
    {
      const value = srcData.descriptors?.value ?? [];
      const custom = srcData.descriptors?.custom ?? [];
      label.descriptors = [
        ...value.map((descriptor) => pf1.config.spellDescriptors[descriptor] ?? descriptor),
        ...custom,
      ]
        .filter((x) => x)
        .join(", ");
    }
    // Set information about when the spell is learned
    data.learnedAt = {};
    if (srcData.learnedAt) {
      ["class", "domain", "subDomain", "elementalSchool", "bloodline"].forEach(
        (category) =>
          (data.learnedAt[category] = Object.entries(srcData.learnedAt[category])
            .map(([classId, level]) => `${classId} ${level}`)
            .join(", "))
      );
    }

    const isUnchainedActionEconomy = game.settings.get("pf1", "unchainedActionEconomy");

    // Set casting time label
    const act = firstAction?.activation;
    if (act != null) {
      const activationCost = act.cost;
      const activationType = act.type;
      const activationTypes = isUnchainedActionEconomy
        ? pf1.config.abilityActivationTypes_unchained
        : pf1.config.abilityActivationTypes;
      const activationTypesPlurals = isUnchainedActionEconomy
        ? pf1.config.abilityActivationTypesPlurals_unchained
        : pf1.config.abilityActivationTypesPlurals;

      if (activationType) {
        if (activationTypesPlurals[activationType] != null) {
          if (activationCost === 1) label.castingTime = `${activationTypes[activationType]}`;
          else label.castingTime = `${activationTypesPlurals[activationType]}`;
        } else label.castingTime = `${activationTypes[activationType]}`;
      }
      if (!Number.isNaN(activationCost) && label.castingTime != null)
        label.castingTime = `${activationCost} ${label.castingTime}`;
    }

    // Set components label
    label.components = this.getSpellComponents().join(", ");

    // Set duration label
    const duration = actionData.duration;
    if (duration?.units) {
      switch (duration.units) {
        case "spec":
          label.duration = duration.value;
          break;
        case "seeText":
        case "inst":
        case "perm":
          label.duration = pf1.config.timePeriods[duration.units];
          break;
        case "turn": {
          const unit = pf1.config.timePeriods[duration.units];
          label.duration = game.i18n.format("PF1.Time.Format", { value: 1, unit });
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
            const roll = Roll.defaultImplementation.safeRoll(duration.value, rollData);
            const value = roll.total;
            if (!roll.err) {
              label.duration = game.i18n.format("PF1.Time.Format", { value, unit });
            }
          }
          break;
      }

      // Dismissable, but only if special duration isn't used
      // TODO: Better i18n support
      if (label.duration && duration.dismiss && duration.units !== "spec") {
        label.duration += " " + game.i18n.localize("PF1.DismissableMark");
      }
    }

    // Set effect label
    {
      const effect = actionData.spellEffect;
      if (effect) label.effect = effect;
    }
    // Set targets label
    {
      const targets = actionData.target?.value;
      if (targets) label.targets = targets;
    }
    // Set range label
    {
      const rangeUnit = actionData.range?.units;
      const rangeValue = actionData.range?.value;

      if (rangeUnit != null && rangeUnit !== "none") {
        label.range = pf1.config.distanceUnits[rangeUnit];
        const units = pf1.utils.getDistanceSystem();
        switch (rangeUnit) {
          case "close":
            label.range = `${label.range} ${game.i18n.localize(
              units == "metric" ? "PF1.SpellRangeShortMetric" : "PF1.SpellRangeShort"
            )}`;
            break;
          case "medium":
            label.range = `${label.range} ${game.i18n.localize(
              units == "metric" ? "PF1.SpellRangeMediumMetric" : "PF1.SpellRangeMedium"
            )}`;
            break;
          case "long":
            label.range = `${label.range} ${game.i18n.localize(
              units == "metric" ? "PF1.SpellRangeLongMetric" : "PF1.SpellRangeLong"
            )}`;
            break;
          case "ft":
          case "mi":
            if (!rangeValue) label.range = "";
            else {
              let rf = calculateRangeFormula(rangeValue, rangeUnit, rollData);
              if (rangeUnit === "mi") rf /= 5_280; // Convert feet back to miles
              const [r, rt] = pf1.utils.convertDistance(rf, rangeUnit);
              const rl = pf1.config.measureUnitsShort[rt];
              label.range = `${r} ${rl}`;
            }
            break;
          case "spec":
            label.range = rangeValue || label.range;
            break;
        }
      }
    }
    // Set area label
    {
      const area = actionData.area;

      if (area) label.area = area;
    }

    // Set DC and SR
    {
      const savingThrowDescription = actionData.save?.description;
      label.savingThrow = savingThrowDescription || game.i18n.localize("PF1.None");

      const sr = srcData.sr;
      label.sr = (sr === true ? game.i18n.localize("PF1.Yes") : game.i18n.localize("PF1.No")).toLowerCase();

      if (actionData.range?.units !== "personal") data.useDCandSR = true;
    }

    const harmless = actionData.save?.harmless ?? false;
    if (harmless) label.harmless = game.i18n.localize("PF1.Yes").toLowerCase();

    return data;
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
