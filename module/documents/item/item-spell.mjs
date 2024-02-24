import { ItemPF } from "./item-pf.mjs";
import { RollPF } from "../../dice/roll.mjs";
import { getDistanceSystem } from "@utils";
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
    const max = prep.maxAmount ?? current.maxAmount ?? 0;
    const left = prep.preparedAmount ?? current.preparedAmount ?? 0;

    // Constrain left and max to sane values
    if (left > max) {
      if (prep.maxAmount !== undefined) {
        prep.preparedAmount = max;
      } else if (prep.preparedAmount !== undefined) {
        prep.maxAmount = left;
      }
    }

    // TODO: Remove following once DataModel is implemented with relevant constraints
    if (prep.maxAmount < 0) prep.maxAmount = 0;
    if (prep.preparedAmount < 0) prep.preparedAmount = 0;
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
   * @param {number} [bonus=0] - Another bonus to account for.
   * @returns {number} The spell's effective spell level.
   */
  getEffectiveSpellLevel(bonus = 0) {
    const slOffset = this.system.slOffset ?? 0;
    const spellLevel = this.system.level;
    return Math.max(0, spellLevel + slOffset + bonus);
  }

  /**
   * Returns the spell's effective caster level, after counting in offsets.
   *
   * @param {number} [bonus=0] - Another bonus to account for.
   * @returns {number} The spell's effective caster level.
   */
  getEffectiveCasterLevel(bonus = 0) {
    const clOffset = this.system.clOffset ?? 0;
    const casterLevel = this.spellbook?.cl.total ?? 0;
    return Math.max(0, casterLevel + clOffset + bonus);
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
   * @deprecated Use {@link addCharges} instead.
   * @param {number} value - The number of charges to add.
   * @param {object} [data=null] - Additional data to pass to the update
   * @returns {Promise<this | void>} Updated document or undefined if no update is possible.
   */
  async addUses(value, data = null) {
    foundry.utils.logCompatibilityWarning("ItemSpellPF.addUses() is deprecated in favor of .addCharges()", {
      since: "PF1 v9",
      until: "PF1 v10",
    });

    return this.addCharges(value, data);
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
        : Math.max(0, (this.system.preparation?.preparedAmount || 0) + value);

      if (!isSpontaneous) {
        const key = "system.preparation.preparedAmount";
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
    if (prep.preparedAmount == prep.maxAmount) return;

    if (maximize) value = prep.maxAmount;
    value = Math.clamped(value, 0, prep.maxAmount);

    if (!Number.isFinite(value)) return;

    updateData.system.preparation.preparedAmount = prep.maxAmount;

    if (commit) this.update(updateData, context);
    return updateData;
  }

  get spellLevel() {
    return this.system.level + (this.system.slOffset || 0);
  }

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
      if (max) return spellbook.spellPoints?.max;
      return spellbook.spellPoints?.value;
    } else {
      if (isSpontaneous) {
        if (itemData.preparation.spontaneousPrepared === true) {
          if (max) return spellbook.spells?.[`spell${spellLevel}`]?.max || 0;
          return spellbook.spells?.[`spell${spellLevel}`]?.value || 0;
        }
      } else {
        if (max) return itemData.preparation?.maxAmount ?? 0;
        return itemData.preparation?.preparedAmount ?? 0;
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
      const frmAtk = action.formulaicAttacks;
      if (frmAtk) {
        if (frmAtk.count?.formula?.length)
          frmAtk.count.formula = this._replaceConsumableConversionString(frmAtk.count.formula, rollData);
        if (frmAtk.bonus?.formula?.length)
          frmAtk.bonus.formula = this._replaceConsumableConversionString(frmAtk.bonus.formula, rollData);
      }

      for (const bAtk of action.attackParts ?? []) {
        bAtk[0] = this._replaceConsumableConversionString(bAtk[0], rollData);
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
   * @returns {Promise<null|false|object>} - Returns null if cancelled, false if no conversion is to take place, or converted data.
   */
  static async toConsumablePrompt(itemData, { allowSpell = true, spellType = "arcane" } = {}) {
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

    const book = this.spellbook;
    const prep = this.system.preparation;
    if (book?.spontaneous) return prep?.spontaneousPrepared ?? true;
    else return (prep?.preparedAmount ?? 0) > 0;
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
  getDescription({ chatcard = false, data = {} } = {}) {
    return (
      renderCachedTemplate("systems/pf1/templates/internal/spell-description.hbs", {
        ...data,
        ...this.spellDescriptionData,
        chatcard: chatcard === true,
      }) + this.system.description.value
    );
  }

  get spellDescriptionData() {
    const reSplit = pf1.config.re.traitSeparator;
    const srcData = this.system;
    const firstAction = this.firstAction;
    const actionData = firstAction?.data ?? {};

    const rollData = firstAction?.getRollData();

    const label = {
      school: pf1.config.spellSchools[srcData.school],
      subschool: srcData.subschool || "",
      types: "",
    };
    const data = {
      data: foundry.utils.mergeObject(this.system, srcData, { inplace: false }),
      label: label,
    };

    // Set subschool and types label
    const types = srcData.types;
    if (typeof types === "string" && types.length > 0) {
      label.types = types.split(reSplit).join(", ");
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

      // Dismissable
      // TODO: Better i18n support
      if (label.duration && duration.dismiss) {
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
        const units = getDistanceSystem();
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
            else label.range = `${rangeValue} ${label.range}`;
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
