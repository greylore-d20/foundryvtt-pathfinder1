import { ItemPF } from "./item-pf.mjs";
import { RollPF } from "../../dice/roll.mjs";
import { getDistanceSystem } from "@utils";
import { renderCachedTemplate } from "@utils/handlebars/templates.mjs";

export class ItemSpellPF extends ItemPF {
  /**
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
    const labels = super.getLabels({ actionId });
    const itemData = this.system;

    // Spell Level, School, and Components
    labels.level = pf1.config.spellLevels[itemData.level];
    labels.school = pf1.config.spellSchools[itemData.school];
    labels.components = this.getSpellComponents()
      .map((o) => o[0])
      .join(" ");

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

    const actor = this.parentActor;
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

    if (this.parent != null) {
      const spellbook = this.spellbook;
      if (spellbook != null) {
        const spellAbility = spellbook.ability;
        let ablMod = "";
        if (spellAbility !== "") ablMod = this.parent?.system.abilities?.[spellAbility]?.mod;

        result.cl = this.casterLevel || 0;
        result.sl = this.spellLevel || 0;
        result.classLevel =
          spellbook.class === "_hd"
            ? result.attributes.hd?.total ?? result.details.level.value
            : result.classes?.[spellbook.class]?.level || 0;
        result.ablMod = ablMod;
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

  async addUses(value, data = null) {
    if (!this.parent) return;
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
      return this.parent.update(updateData);
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
        return this.parent.update(actorUpdateData);
      }
    }

    return null;
  }

  async addCharges(value) {
    return this.addUses(value);
  }

  get isCharged() {
    if (this.system.atWill) return false;
    return true;
  }

  get charges() {
    return this.getSpellUses();
  }

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
      isSpontaneous = spellbook.spontaneous;

    if (period == "week") {
      // Spells do not recharge per week
      if (exact) return;
      // When not recharging with exact period, downgrade to "day" which is normal spell restoration period
      period = "day";
    }

    // Spells do not restore on non-day period
    if (!["day", "any"].includes(period)) return;

    if (!spellbook) return;

    // Spontaneous spells do not record charges in spell.
    if (spellbook.spontaneous) return;

    // Spellpoints are not on spells
    if (spellbook.spellPoints?.useSystem ?? false) return;

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

  get spellbook() {
    const bookId = this.system.spellbook;
    return this.parent?.system?.attributes?.spells.spellbooks[bookId];
  }

  getDC(rollData = null) {
    // No actor? No DC!
    if (!this.parent) return 0;

    const spellbook = this.spellbook;
    if (spellbook) {
      let formula = spellbook.baseDCFormula;

      rollData = rollData ?? this.getRollData();
      const data = rollData.item;
      if (data.save.dc.length > 0) formula += ` + ${data.save.dc}`;

      // Get conditional save DC bonus
      const dcBonus = rollData.dcBonus ?? 0;

      return RollPF.safeRoll(formula, rollData).total + dcBonus;
    }
    return 10;
  }

  getSpellUses(max = false) {
    if (!this.parent) return 0;
    const itemData = this.system;
    if (itemData.atWill) return Number.POSITIVE_INFINITY;

    const spellbook = this.spellbook;
    if (!spellbook) return 0;

    const isSpontaneous = spellbook.spontaneous,
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

  getSpellComponents(srcData) {
    if (!srcData) srcData = duplicate(this.system);
    const reSplit = pf1.config.re.traitSeparator,
      srcComponents = this.system.components ?? {},
      srcMaterials = this.system.materials ?? {};

    const components = [];
    const labels = {
      verbal: game.i18n.localize("PF1.SpellComponentKeys.Verbal"),
      somatic: game.i18n.localize("PF1.SpellComponentKeys.Somatic"),
      thought: game.i18n.localize("PF1.SpellComponentKeys.Thought"),
      emotion: game.i18n.localize("PF1.SpellComponentKeys.Emotion"),
      material: game.i18n.localize("PF1.SpellComponentKeys.Material"),
      focus: game.i18n.localize("PF1.SpellComponentKeys.Focus"),
      divineFocus: game.i18n.localize("PF1.SpellComponentKeys.DivineFocus"),
    };

    if (srcComponents.verbal) components.push(labels.verbal);
    if (srcComponents.somatic) components.push(labels.somatic);
    if (srcComponents.thought) components.push(labels.thought);
    if (srcComponents.emotion) components.push(labels.emotion);

    const df = srcComponents.divineFocus;
    // Reverse mapping of CONFIG.PF1.divineFocus for readability
    const dfVariants = { DF: 1, MDF: 2, FDF: 3 };

    if (srcComponents.material) {
      let material = labels.material;
      if (df === dfVariants.MDF) material = `${material}/${labels.divineFocus}`;
      if (srcMaterials.value) material = `${material} (${srcMaterials.value})`;
      if (material) components.push(material);
    }
    if (srcComponents.focus) {
      let focus = labels.focus;
      if (df === dfVariants.FDF) focus = `${focus}/${labels.divineFocus}`;
      if (srcMaterials.focus) focus = `${focus} (${srcMaterials.focus})`;
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
    string = string.replace(/@sl/g, rollData.sl);
    string = string.replace(/@cl/g, "@item.cl");
    return string;
  }

  static async toConsumable(origData, type) {
    const actionData = origData.system.actions?.[0] ?? {};
    const data = {
      type: "consumable",
      name: origData.name,
    };

    data["system.unidentified.name"] =
      origData.unidentifiedName || game.i18n.localize(`PF1.CreateItem${type.capitalize()}`);
    data["system.identified"] = origData.identified ?? true;

    const action = pf1.components.ItemAction.defaultData;

    const [minLevel, minCl] = this.getMinimumCasterLevelBySpellData(origData);
    const level = origData.sl ?? minLevel ?? 1;
    const cl = origData.cl ?? minCl ?? 1;
    const materialPrice = origData.system.materials?.gpValue ?? 0;

    // Fill in pseudo roll data object
    const rollData = origData.system;
    rollData.sl = level;
    rollData.cl = cl;

    // Set consumable type
    data["system.subType"] = type;

    // Set name
    if (type === "wand") {
      data.name = game.i18n.format("PF1.CreateItemWandOf", { name: origData.name });
      data.img = "systems/pf1/icons/items/inventory/wand-star.jpg";
      data["system.price"] = 0;
      data["system.uses.pricePerUse"] =
        Math.floor(((Math.max(0.5, level) * cl * 750 + materialPrice) / 50) * 100) / 100;
      data["system.hardness"] = 5;
      data["system.hp.max"] = 5;
      data["system.hp.value"] = 5;
      action.name = game.i18n.localize("PF1.Use");
      action.img = data.img;
    } else if (type === "potion") {
      data.name = game.i18n.format("PF1.CreateItemPotionOf", { name: origData.name });
      data.img = "systems/pf1/icons/items/potions/minor-blue.jpg";
      data["system.price"] = Math.max(0.5, level) * cl * 50 + materialPrice;
      data["system.hardness"] = 1;
      data["system.hp.max"] = 1;
      data["system.hp.value"] = 1;
      action.range = {
        value: 0,
        units: "personal",
      };
      action.name = game.i18n.localize("PF1.Drink");
      action.img = data.img;
    } else if (type === "scroll") {
      data.name = game.i18n.format("PF1.CreateItemScrollOf", { name: origData.name });
      data.img = "systems/pf1/icons/items/inventory/scroll-magic.jpg";
      data["system.price"] = Math.max(0.5, level) * cl * 25 + materialPrice;
      data["system.hardness"] = 0;
      data["system.hp.max"] = 1;
      data["system.hp.value"] = 1;
      action.name = game.i18n.localize("PF1.Use");
      action.img = data.img;
    }

    // Set charges
    if (type === "wand") {
      data["system.uses.maxFormula"] = "50";
      data["system.uses.value"] = 50;
      data["system.uses.max"] = 50;
      data["system.uses.per"] = "charges";
    } else {
      data["system.uses.per"] = "single";
    }
    // Set activation method
    action.activation.type = "standard";
    // Set activation for unchained action economy
    action.unchainedAction.activation.type = "action";
    action.unchainedAction.activation.cost = 2;

    // Set measure template and range
    if (type !== "potion") {
      action.measureTemplate = actionData.measureTemplate;
      if (["close", "medium", "long"].includes(actionData.range.units)) {
        action.range = {
          units: "ft",
          value: RollPF.safeTotal(pf1.config.spellRangeFormulas[actionData.range.units], rollData).toString(),
        };
      } else {
        action.range = actionData.range;
      }
    }

    // Set damage formula
    action.actionType = origData.actionType;
    for (const d of actionData.damage?.parts ?? []) {
      action.damage.parts.push({ formula: this._replaceConsumableConversionString(d.formula, rollData), type: d.type });
    }

    // Set saves
    if (actionData.save) {
      action.save.description = actionData.save.description;
      action.save.type = actionData.save.type;
      action.save.dc = `10 + ${origData.sl}[${game.i18n.localize("PF1.SpellLevel")}] + ${Math.floor(
        origData.sl / 2
      )}[${game.i18n.localize("PF1.SpellcastingAbility")}]`;
    }

    // Copy variables
    action.actionType = actionData.actionType;
    action.attackNotes = actionData.attackNotes;
    action.effectNotes = actionData.effectNotes;
    action.attackBonus = actionData.attackBonus;
    action.critConfirmBonus = actionData.critConfirmBonus;

    // Replace attack and effect formula data
    for (const arrKey of ["attackNotes", "effectNotes"]) {
      const arr = getProperty(action, arrKey);
      if (!arr) continue;
      for (let a = 0; a < arr.length; a++) {
        const note = arr[a];
        arr[a] = this._replaceConsumableConversionString(note, rollData);
      }
    }

    // Set Caster Level
    data["system.cl"] = cl;
    data["system.aura.school"] = origData.system.school;

    // Set description
    data["system.description.value"] = this._replaceConsumableConversionString(
      await renderTemplate("systems/pf1/templates/internal/consumable-description.hbs", {
        origData: origData,
        data: data,
        isWand: type === "wand",
        isPotion: type === "potion",
        isScroll: type === "scroll",
        sl: level,
        cl: cl,
        config: pf1.config,
      }),
      rollData
    );

    // Create and return synthetic item data
    data["system.actions"] = [action];
    return new ItemPF(expandObject(data)).toObject();
  }

  /**
   * @returns true if the spell is prepared to cast in any manner.
   */
  get canCast() {
    if (this.system.atWill) return true;
    const charges = this.charges; // Cache
    return (
      (this.isCharged && charges > 0) ||
      (this.spellbook?.spontaneous && this.system.preparation.spontaneousPrepared && charges > 0)
    );
  }

  /**
   * Determine if this spell is domain/school spell.
   *
   * @type {boolean}
   */
  get isDomain() {
    return this.system.domain === true;
  }

  get fullDescription() {
    return super.fullDescription + this.system.shortDescription;
  }

  /**
   * @inheritdoc
   */
  getDescription({ chatcard = false, data = {} } = {}) {
    return renderCachedTemplate("systems/pf1/templates/internal/spell-description.hbs", {
      ...data,
      ...this.spellDescriptionData,
      chatcard: chatcard === true,
    });
  }

  get spellDescriptionData() {
    const reSplit = pf1.config.re.traitSeparator;
    const srcData = this.system;
    const firstAction = this.firstAction;
    const actionData = firstAction?.data ?? {};

    const label = {
      school: pf1.config.spellSchools[srcData.school],
      subschool: srcData.subschool || "",
      types: "",
    };
    const data = {
      data: mergeObject(this.system, srcData, { inplace: false }),
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
    {
      const duration = actionData.duration?.value;
      if (duration) label.duration = duration;
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
      const area = actionData.spellArea;

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
