import { ItemPF } from "./item-pf.mjs";
import { RollPF } from "../../dice/roll.mjs";

export class ItemSpellPF extends ItemPF {
  prepareData() {
    const itemData = super.prepareData();
    const data = itemData;
    const labels = this.labels;
    const C = CONFIG.PF1;

    // Spell Level,  School, and Components
    if (itemData.type === "spell") {
      labels.level = C.spellLevels[data.level];
      labels.school = C.spellSchools[data.school];
      labels.components = this.getSpellComponents()
        .map((o) => o[0])
        .join(" ");
    }
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

  prepareDerivedItemData() {
    super.prepareDerivedItemData();

    // Update description
    this._updateSpellDescription();
  }

  preCreateData(data, options, user) {
    const updates = super.preCreateData(data, options, user);

    const actor = this.parentActor;
    if (actor) {
      // Swap non-psychic components for psychic ones
      if (this.spellbook?.psychic === true) {
        if (this.data.components?.verbal === true) {
          updates["system.components.verbal"] = false;
          updates["system.components.thought"] = true;
        }
        if (this.data.components?.somatic === true) {
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
        if (spellAbility !== "") ablMod = getProperty(this.parent, `system.abilities.${spellAbility}.mod`);

        result.cl = this.casterLevel || 0;
        result.sl = this.spellLevel || 0;
        result.classLevel =
          spellbook.class === "_hd"
            ? result.attributes.hd?.total ?? result.details.level.value
            : spellbook.class?.length > 0
            ? getProperty(result, `classes.${spellbook.class}.level`) || 0 // `
            : 0;
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
      spellbookKey = getProperty(this, "system.spellbook") || "primary",
      spellLevel = getProperty(this, "system.level");

    if (this.useSpellPoints()) {
      const curUses = this.getSpellUses();
      const updateData = {};
      updateData[`system.attributes.spells.spellbooks.${spellbookKey}.spellPoints.value`] = curUses + value;
      return this.parent.update(updateData);
    } else {
      const newCharges = isSpontaneous
        ? Math.max(0, (getProperty(spellbook, `spells.spell${spellLevel}.value`) || 0) + value)
        : Math.max(0, (getProperty(this, "system.preparation.preparedAmount") || 0) + value);

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
      const dcBonus = rollData["dcBonus"] ?? 0;

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
          if (max) return getProperty(spellbook, `spells.spell${spellLevel}.max`) || 0;
          return getProperty(spellbook, `spells.spell${spellLevel}.value`) || 0;
        }
      } else {
        if (max) return itemData.preparation?.maxAmount ?? 0;
        return itemData.preparation?.preparedAmount ?? 0;
      }
    }

    return 0;
  }

  useSpellPoints() {
    if (!this.parent) return false;

    return this.spellbook?.spellPoints?.useSystem ?? false;
  }

  getSpellComponents(srcData) {
    if (!srcData) srcData = duplicate(this.system);
    const reSplit = CONFIG.PF1.re.traitSeparator;

    let components = [];
    const compKeys = {
      V: game.i18n.localize("PF1.SpellComponentKeys.Verbal"),
      S: game.i18n.localize("PF1.SpellComponentKeys.Somatic"),
      T: game.i18n.localize("PF1.SpellComponentKeys.Thought"),
      E: game.i18n.localize("PF1.SpellComponentKeys.Emotion"),
      M: game.i18n.localize("PF1.SpellComponentKeys.Material"),
      F: game.i18n.localize("PF1.SpellComponentKeys.Focus"),
      DF: game.i18n.localize("PF1.SpellComponentKeys.DivineFocus"),
    };
    for (const [key, value] of Object.entries(srcData.components ?? {})) {
      if (key === "value" && value.length > 0) components.push(...value.split(reSplit));
      else if (key === "verbal" && value) components.push(compKeys.V);
      else if (key === "somatic" && value) components.push(compKeys.S);
      else if (key === "thought" && value) components.push(compKeys.T);
      else if (key === "emotion" && value) components.push(compKeys.E);
      else if (key === "material" && value) components.push(compKeys.M);
      else if (key === "focus" && value) components.push(compKeys.F);
    }
    if (getProperty(srcData, "components.divineFocus") === 1) components.push(compKeys.DF);
    const df = getProperty(srcData, "components.divineFocus");
    // Sort components
    const componentsOrder = [compKeys.V, compKeys.S, compKeys.T, compKeys.E, compKeys.M, compKeys.F, compKeys.DF];
    components.sort((a, b) => {
      const index = [componentsOrder.indexOf(a), components.indexOf(b)];
      if (index[0] === -1 && index[1] === -1) return 0;
      if (index[0] === -1 && index[1] >= 0) return 1;
      if (index[0] >= 0 && index[1] === -1) return -1;
      return index[0] - index[1];
    });
    components = components.map((o) => {
      if (o === compKeys.M) {
        if (df === 2) o = `${compKeys.M}/${compKeys.DF}`;
        if (getProperty(srcData, "system.materials.value"))
          o = `${o} (${getProperty(srcData, "system.materials.value")})`;
      }
      if (o === compKeys.F) {
        if (df === 3) o = `${compKeys.F}/${compKeys.DF}`;
        if (getProperty(srcData, "system.materials.focus"))
          o = `${o} (${getProperty(srcData, "system.materials.focus")})`;
      }
      return o;
    });
    return components;
  }

  /**
   * @param {object} itemData - A spell item's data.
   * @returns {number[]} An array containing the spell level and caster level.
   */
  static getMinimumCasterLevelBySpellData(itemData) {
    const learnedAt = getProperty(itemData, "system.learnedAt.class").reduce((cur, o) => {
      const classes = o[0].split("/");
      for (const cls of classes) cur.push([cls, o[1]]);
      return cur;
    }, []);
    const result = [9, 20];
    for (const o of learnedAt) {
      result[0] = Math.min(result[0], o[1]);

      const tc = CONFIG.PF1.classCasterType[o[0]] || "high";
      if (tc === "high") {
        result[1] = Math.min(result[1], 1 + Math.max(0, o[1] - 1) * 2);
      } else if (tc === "med") {
        result[1] = Math.min(result[1], 1 + Math.max(0, o[1] - 1) * 3);
      } else if (tc === "low") {
        result[1] = Math.min(result[1], 1 + Math.max(0, o[1] - 1) * 3);
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
    const action = pf1.components.ItemAction.defaultData;

    const slcl = this.getMinimumCasterLevelBySpellData(origData);
    if (origData.sl == null) origData.sl = slcl[0];
    if (origData.cl == null) origData.cl = slcl[1];
    const materialPrice = origData.materials?.gpValue ?? 0;

    // Set consumable type
    data["system.consumableType"] = type;

    // Set name
    if (type === "wand") {
      data.name = game.i18n.localize("PF1.CreateItemWandOf").format(origData.name);
      data.img = "systems/pf1/icons/items/inventory/wand-star.jpg";
      data["system.price"] = 0;
      data["system.uses.pricePerUse"] =
        Math.floor(((Math.max(0.5, origData.sl) * origData.cl * 750 + materialPrice) / 50) * 100) / 100;
      data["system.hardness"] = 5;
      data["system.hp.max"] = 5;
      data["system.hp.value"] = 5;
      action.name = game.i18n.localize("PF1.Use");
      action.img = data.img;
    } else if (type === "potion") {
      data.name = game.i18n.localize("PF1.CreateItemPotionOf").format(origData.name);
      data.img = "systems/pf1/icons/items/potions/minor-blue.jpg";
      data["system.price"] = Math.max(0.5, origData.sl) * origData.cl * 50 + materialPrice;
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
      data.name = game.i18n.localize("PF1.CreateItemScrollOf").format(origData.name);
      data.img = "systems/pf1/icons/items/inventory/scroll-magic.jpg";
      data["system.price"] = Math.max(0.5, origData.sl) * origData.cl * 25 + materialPrice;
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
          value: RollPF.safeTotal(CONFIG.PF1.spellRangeFormulas[actionData.range.units], origData).toString(),
        };
      } else {
        action.range = actionData.range;
      }
    }

    // Set damage formula
    action.actionType = origData.actionType;
    for (const d of actionData.damage?.parts ?? []) {
      action.damage.parts.push([this._replaceConsumableConversionString(d[0], origData), d[1]]);
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
    data["system.aura.school"] = origData.school;

    // Replace attack and effect formula data
    for (const arrKey of ["attackNotes", "effectNotes"]) {
      const arr = getProperty(action, arrKey);
      if (!arr) continue;
      for (let a = 0; a < arr.length; a++) {
        const note = arr[a];
        arr[a] = this._replaceConsumableConversionString(note, origData);
      }
    }

    // Set Caster Level
    data["system.cl"] = origData.cl;

    // Set description
    data["system.description.value"] = this._replaceConsumableConversionString(
      await renderTemplate("systems/pf1/templates/internal/consumable-description.hbs", {
        origData: origData,
        data: data,
        isWand: type === "wand",
        isPotion: type === "potion",
        isScroll: type === "scroll",
        sl: origData.sl,
        cl: origData.cl,
        config: CONFIG.PF1,
      }),
      origData
    );

    // Create and return synthetic item data
    data["system.actions"] = [action];
    return new ItemPF(expandObject(data)).toObject();
  }

  /**
   * Updates the spell's description.
   *
   * @param data
   */
  async _updateSpellDescription(data) {
    this.system.description.value = await renderTemplate(
      "systems/pf1/templates/internal/spell-description.hbs",
      mergeObject(data ?? {}, this.spellDescriptionData)
    );
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

  get fullDescription() {
    return super.fullDescription + this.system.shortDescription;
  }

  get spellDescriptionData() {
    const reSplit = CONFIG.PF1.re.traitSeparator;
    const srcData = this.system;
    const firstAction = this.firstAction;
    const actionData = firstAction?.data ?? {};

    const label = {
      school: (CONFIG.PF1.spellSchools[getProperty(srcData, "school")] || "").toLowerCase(),
      subschool: getProperty(srcData, "subschool") || "",
      types: "",
    };
    const data = {
      data: mergeObject(this.system, srcData, { inplace: false }),
      label: label,
    };

    // Set subschool and types label
    const types = getProperty(srcData, "types");
    if (typeof types === "string" && types.length > 0) {
      label.types = types.split(reSplit).join(", ");
    }
    // Set information about when the spell is learned
    data.learnedAt = {};
    data.learnedAt.class = (getProperty(srcData, "learnedAt.class") || [])
      .map((o) => {
        return `${o[0]} ${o[1]}`;
      })
      .sort()
      .join(", ");
    data.learnedAt.domain = (getProperty(srcData, "learnedAt.domain") || [])
      .map((o) => {
        return `${o[0]} ${o[1]}`;
      })
      .sort()
      .join(", ");
    data.learnedAt.subDomain = (getProperty(srcData, "learnedAt.subDomain") || [])
      .map((o) => {
        return `${o[0]} ${o[1]}`;
      })
      .sort()
      .join(", ");
    data.learnedAt.elementalSchool = (getProperty(srcData, "learnedAt.elementalSchool") || [])
      .map((o) => {
        return `${o[0]} ${o[1]}`;
      })
      .sort()
      .join(", ");
    data.learnedAt.bloodline = (getProperty(srcData, "learnedAt.bloodline") || [])
      .map((o) => {
        return `${o[0]} ${o[1]}`;
      })
      .sort()
      .join(", ");

    // Set casting time label
    const act = game.settings.get("pf1", "unchainedActionEconomy")
      ? getProperty(firstAction, "system.unchainedAction.activation")
      : getProperty(firstAction, "system.activation");
    if (act != null) {
      const activationCost = act.cost;
      const activationType = act.type;
      const activationTypes = game.settings.get("pf1", "unchainedActionEconomy")
        ? CONFIG.PF1.abilityActivationTypes_unchained
        : CONFIG.PF1.abilityActivationTypes;
      const activationTypesPlurals = game.settings.get("pf1", "unchainedActionEconomy")
        ? CONFIG.PF1.abilityActivationTypesPlurals_unchained
        : CONFIG.PF1.abilityActivationTypesPlurals;

      if (activationType) {
        if (activationTypesPlurals[activationType] != null) {
          if (activationCost === 1) label.castingTime = `${activationTypes[activationType]}`;
          else label.castingTime = `${activationTypesPlurals[activationType]}`;
        } else label.castingTime = `${activationTypes[activationType]}`;
      }
      if (!Number.isNaN(activationCost) && label.castingTime != null)
        label.castingTime = `${activationCost} ${label.castingTime}`;
      if (label.castingTime) label.castingTime = label.castingTime.toLowerCase();
    }

    // Set components label
    label.components = this.getSpellComponents(srcData).join(", ");

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
        label.range = (CONFIG.PF1.distanceUnits[rangeUnit] || "").toLowerCase();
        let units = game.settings.get("pf1", "distanceUnits"); // override
        if (units === "default") units = game.settings.get("pf1", "units");
        if (rangeUnit === "close")
          label.range = `${label.range} ${game.i18n.localize(
            units == "metric" ? "PF1.SpellRangeShortMetric" : "PF1.SpellRangeShort"
          )}`;
        else if (rangeUnit === "medium")
          label.range = `${label.range} ${game.i18n.localize(
            units == "metric" ? "PF1.SpellRangeMediumMetric" : "PF1.SpellRangeMedium"
          )}`;
        else if (rangeUnit === "long")
          label.range = `${label.range} ${game.i18n.localize(
            units == "metric" ? "PF1.SpellRangeLongMetric" : "PF1.SpellRangeLong"
          )}`;
        else if (["ft", "mi"].includes(rangeUnit)) {
          if (!rangeValue) label.range = "";
          else label.range = `${rangeValue} ${label.range}`;
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
      if (savingThrowDescription) label.savingThrow = savingThrowDescription;
      else label.savingThrow = "none";

      const sr = srcData.sr;
      label.sr = (sr === true ? game.i18n.localize("PF1.Yes") : game.i18n.localize("PF1.No")).toLowerCase();

      if (actionData.range?.units !== "personal") data.useDCandSR = true;
    }
    return data;
  }
}
