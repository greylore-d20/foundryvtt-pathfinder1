import { ItemPF } from "../entity.js";

export class ItemSpellPF extends ItemPF {
  prepareData() {
    const itemData = super.prepareData();
    const data = itemData.data;
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
        if (this.data.data.components?.verbal === true) {
          updates["data.components.verbal"] = false;
          updates["data.components.thought"] = true;
        }
        if (this.data.data.components?.somatic === true) {
          updates["data.components.somatic"] = false;
          updates["data.components.emotion"] = true;
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
        if (spellAbility !== "") ablMod = getProperty(this.parent.data, `data.abilities.${spellAbility}.mod`);

        result.cl = this.casterLevel || 0;
        result.sl = this.spellLevel || 0;
        result.classLevel =
          spellbook.class === "_hd"
            ? result.attributes.hd.total
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

  getTypeChatData(data, labels, props) {
    if (data.sr) {
      props.push(game.i18n.localize("PF1.SpellResistance"));
    }

    // Add charges
    if (this.isCharged && !this.data.data.atWill) {
      if (this.useSpellPoints()) {
        props.push(`${game.i18n.localize("PF1.SpellPoints")}: ${this.charges}/${this.maxCharges}`);
      } else {
        props.push(`${game.i18n.localize("PF1.ChargePlural")}: ${this.charges}/${this.maxCharges}`);
      }
    }
  }

  /**
   * @param {object} options
   * @param {Event} options.ev
   * @param {boolean} options.skipDialog
   * @param {boolean} options.chatMessage
   * @param {string|undefined} options.rollMode
   */
  async use({ ev = null, skipDialog = false, chatMessage = true, rollMode } = {}) {
    return this.useSpell(ev, { skipDialog, chatMessage, rollMode });
  }

  /**
   * Cast a Spell, consuming a spell slot of a certain level
   *
   * @param {MouseEvent} ev - The click event
   * @param {object} options - Additional options
   * @param {boolean} options.skipDialog - Whether to skip the roll dialog
   * @param {boolean} options.chatMessage
   * @param {string|undefined} options.rollMode Roll mode override
   * @returns {Promise<ChatMessage|void|null>} The chat message created by the spell's usage
   */
  async useSpell(ev, { skipDialog = false, chatMessage = true, rollMode } = {}) {
    if (!this.testUserPermission(game.user, "OWNER")) {
      const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(this.name);
      console.warn(msg);
      return ui.notifications.warn(msg);
    }

    if (
      getProperty(this.data, "data.preparation.mode") !== "atwill" &&
      this.getSpellUses() < this.chargeCost &&
      this.autoDeductCharges
    ) {
      const msg = game.i18n.localize("PF1.ErrorNoSpellsLeft");
      console.warn(msg);
      return ui.notifications.warn(msg);
    }

    // Invoke the Item roll
    return this.useAttack({ ev, skipDialog, chatMessage, rollMode });
  }

  async addSpellUses(value, data = null) {
    console.warn("ItemPF.addSpellUses() is deprecated in favor of ItemSpellPF.addUses()");
    return this.addUses(value, data);
  }

  async addUses(value, data = null) {
    if (!this.parent) return;
    if (this.data.data.atWill) return;

    const spellbook = getProperty(this.parent.data, `data.attributes.spells.spellbooks.${this.data.data.spellbook}`),
      isSpontaneous = spellbook.spontaneous,
      spellbookKey = getProperty(this.data, "data.spellbook") || "primary",
      spellLevel = getProperty(this.data, "data.level");

    if (this.useSpellPoints()) {
      const curUses = this.getSpellUses();
      const updateData = {};
      updateData[`data.attributes.spells.spellbooks.${spellbookKey}.spellPoints.value`] = curUses + value;
      return this.parent.update(updateData);
    } else {
      const newCharges = isSpontaneous
        ? Math.max(0, (getProperty(spellbook, `spells.spell${spellLevel}.value`) || 0) + value)
        : Math.max(0, (getProperty(this.data, "data.preparation.preparedAmount") || 0) + value);

      if (!isSpontaneous) {
        const key = "data.preparation.preparedAmount";
        if (data == null) {
          data = {};
          data[key] = newCharges;
          return this.update(data);
        } else {
          data[key] = newCharges;
        }
      } else {
        const key = `data.attributes.spells.spellbooks.${spellbookKey}.spells.spell${spellLevel}.value`;
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
    if (this.spellbook?.spellPreparationMode === "spontaneous") return false;
    if (this.maxCharges > 0 && this.chargeCost > 0) return true;
    return super.isCharged;
  }

  get autoDeductCharges() {
    return getProperty(this.data, "data.preparation.autoDeductCharges") === true;
  }

  get charges() {
    return this.getSpellUses();
  }

  get maxCharges() {
    return this.getSpellUses(true);
  }

  get chargeCost() {
    if (this.useSpellPoints()) return this.getSpellPointCost();
    return 1;
  }

  get spellLevel() {
    return this.data.data.level + (this.data.data.slOffset || 0);
  }

  get casterLevel() {
    const spellbook = this.spellbook;
    if (!spellbook) return null;

    return spellbook.cl.total + (this.data.data.clOffset || 0);
  }

  get spellbook() {
    if (this.parent == null) return null;

    const spellbookIndex = this.data.data.spellbook;
    return this.parent?.data?.data.attributes.spells.spellbooks[spellbookIndex];
  }

  getDC(rollData = null) {
    // No actor? No DC!
    if (!this.parent) return 0;

    rollData = rollData ?? this.getRollData();
    const data = rollData.item;

    let result = 10;

    // Get conditional save DC bonus
    const dcBonus = rollData["dcBonus"] ?? 0;

    const spellbook = this.spellbook;
    if (spellbook != null) {
      let formula = spellbook.baseDCFormula;
      if (data.save.dc.length > 0) formula += ` + ${data.save.dc}`;
      result = RollPF.safeRoll(formula, rollData).total + dcBonus;
    }
    return result;
  }

  getSpellUses(max = false) {
    if (!this.parent) return 0;
    if (this.data.data.atWill) return Number.POSITIVE_INFINITY;

    const spellbook = getProperty(this.parent.data, `data.attributes.spells.spellbooks.${this.data.data.spellbook}`),
      isSpontaneous = spellbook.spontaneous,
      spellLevel = getProperty(this.data, "data.level");

    if (this.useSpellPoints()) {
      if (max) return getProperty(spellbook, "spellPoints.max");
      return getProperty(spellbook, "spellPoints.value");
    } else {
      if (isSpontaneous) {
        if (getProperty(this.data, "data.preparation.spontaneousPrepared") === true) {
          if (max) return getProperty(spellbook, `spells.spell${spellLevel}.max`) || 0;
          return getProperty(spellbook, `spells.spell${spellLevel}.value`) || 0;
        }
      } else {
        if (max) return getProperty(this.data, "data.preparation.maxAmount") || 0;
        return getProperty(this.data, "data.preparation.preparedAmount") || 0;
      }
    }

    return 0;
  }

  useSpellPoints() {
    if (!this.parent) return false;

    const spellbookKey = this.data.data.spellbook;
    const spellbook = getProperty(this.parent.data, `data.attributes.spells.spellbooks.${spellbookKey}`);
    return getProperty(spellbook, "spellPoints.useSystem") || false;
  }

  getSpellPointCost(rollData = null) {
    if (!rollData) rollData = this.getRollData();

    const roll = RollPF.safeRoll(getProperty(this.data, "data.spellPoints.cost") || "0", rollData);
    return roll.total;
  }

  getSpellComponents(srcData) {
    if (!srcData) srcData = duplicate(this.data);
    const reSplit = CONFIG.PF1.re.traitSeparator;

    let components = [];
    for (const [key, value] of Object.entries(getProperty(srcData, "data.components"))) {
      if (key === "value" && value.length > 0) components.push(...value.split(reSplit));
      else if (key === "verbal" && value) components.push("V");
      else if (key === "somatic" && value) components.push("S");
      else if (key === "thought" && value) components.push("T");
      else if (key === "emotion" && value) components.push("E");
      else if (key === "material" && value) components.push("M");
      else if (key === "focus" && value) components.push("F");
    }
    if (getProperty(srcData, "data.components.divineFocus") === 1) components.push("DF");
    const df = getProperty(srcData, "data.components.divineFocus");
    // Sort components
    const componentsOrder = ["V", "S", "T", "E", "M", "F", "DF"];
    components.sort((a, b) => {
      const index = [componentsOrder.indexOf(a), components.indexOf(b)];
      if (index[0] === -1 && index[1] === -1) return 0;
      if (index[0] === -1 && index[1] >= 0) return 1;
      if (index[0] >= 0 && index[1] === -1) return -1;
      return index[0] - index[1];
    });
    components = components.map((o) => {
      if (o === "M") {
        if (df === 2) o = "M/DF";
        if (getProperty(srcData, "data.materials.value")) o = `${o} (${getProperty(srcData, "data.materials.value")})`;
      }
      if (o === "F") {
        if (df === 3) o = "F/DF";
        if (getProperty(srcData, "data.materials.focus")) o = `${o} (${getProperty(srcData, "data.materials.focus")})`;
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
    const learnedAt = getProperty(itemData, "learnedAt.class").reduce((cur, o) => {
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
    const data = {
      type: "consumable",
      name: origData.name,
    };

    const slcl = this.getMinimumCasterLevelBySpellData(origData.data);
    if (origData.sl == null) origData.sl = slcl[0];
    if (origData.cl == null) origData.cl = slcl[1];
    const materialPrice = origData.data.materials?.gpValue ?? 0;

    // Set consumable type
    data["data.consumableType"] = type;

    // Set range
    data["data.range.units"] = origData.data.range.units;
    data["data.range.value"] = origData.data.range.value;
    switch (origData.data.range.units) {
      case "close":
        data["data.range.value"] = RollPF.safeRoll("25 + floor(@cl / 2) * 5", { cl: origData.cl }).total.toString();
        data["data.range.units"] = "ft";
        break;
      case "medium":
        data["data.range.value"] = RollPF.safeRoll("100 + @cl * 10", { cl: origData.cl }).total.toString();
        data["data.range.units"] = "ft";
        break;
      case "long":
        data["data.range.value"] = RollPF.safeRoll("400 + @cl * 40", { cl: origData.cl }).total.toString();
        data["data.range.units"] = "ft";
        break;
    }

    // Set name
    if (type === "wand") {
      data.name = game.i18n.localize("PF1.CreateItemWandOf").format(origData.name);
      data.img = "systems/pf1/icons/items/inventory/wand-star.jpg";
      data["data.price"] = 0;
      data["data.uses.pricePerUse"] =
        Math.floor(((Math.max(0.5, origData.sl) * origData.cl * 750 + materialPrice) / 50) * 100) / 100;
      data["data.hardness"] = 5;
      data["data.hp.max"] = 5;
      data["data.hp.value"] = 5;
    } else if (type === "potion") {
      data.name = game.i18n.localize("PF1.CreateItemPotionOf").format(origData.name);
      data.img = "systems/pf1/icons/items/potions/minor-blue.jpg";
      data["data.price"] = Math.max(0.5, origData.sl) * origData.cl * 50 + materialPrice;
      data["data.hardness"] = 1;
      data["data.hp.max"] = 1;
      data["data.hp.value"] = 1;
      data["data.range.value"] = 0;
      data["data.range.units"] = "personal";
    } else if (type === "scroll") {
      data.name = game.i18n.localize("PF1.CreateItemScrollOf").format(origData.name);
      data.img = "systems/pf1/icons/items/inventory/scroll-magic.jpg";
      data["data.price"] = Math.max(0.5, origData.sl) * origData.cl * 25 + materialPrice;
      data["data.hardness"] = 0;
      data["data.hp.max"] = 1;
      data["data.hp.value"] = 1;
    }

    // Set charges
    if (type === "wand") {
      data["data.uses.maxFormula"] = "50";
      data["data.uses.value"] = 50;
      data["data.uses.max"] = 50;
      data["data.uses.per"] = "charges";
    } else {
      data["data.uses.per"] = "single";
    }

    // Set activation method
    data["data.activation.type"] = "standard";
    // Set activation for unchained action economy
    data["data.unchainedAction.activation.type"] = "action";
    data["data.unchainedAction.activation.cost"] = 2;

    // Set measure template
    if (type !== "potion") {
      data["data.measureTemplate"] = getProperty(origData, "data.measureTemplate");
    }

    // Set damage formula
    data["data.actionType"] = origData.data.actionType;
    data["data.damage.parts"] = [];
    for (const d of origData.data.damage.parts) {
      data["data.damage.parts"].push([this._replaceConsumableConversionString(d[0], origData), d[1]]);
    }

    // Set saves
    data["data.save.description"] = origData.data.save.description;
    data["data.save.type"] = origData.data.save.type;
    data["data.save.dc"] = `10 + ${origData.sl}[${game.i18n.localize("PF1.SpellLevel")}] + ${Math.floor(
      origData.sl / 2
    )}[${game.i18n.localize("PF1.SpellcastingAbility")}]`;

    // Copy variables
    data["data.attackNotes"] = origData.data.attackNotes;
    data["data.effectNotes"] = origData.data.effectNotes;
    data["data.attackBonus"] = origData.data.attackBonus;
    data["data.critConfirmBonus"] = origData.data.critConfirmBonus;
    data["data.aura.school"] = origData.data.school;

    // Replace attack and effect formula data
    for (const arrKey of ["data.attackNotes", "data.effectNotes"]) {
      const arr = data[arrKey];
      for (let a = 0; a < arr.length; a++) {
        const note = arr[a];
        arr[a] = this._replaceConsumableConversionString(note, origData);
      }
    }

    // Set Caster Level
    data["data.cl"] = origData.cl;

    // Set description
    data["data.description.value"] = this._replaceConsumableConversionString(
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
    return new ItemPF(expandObject(data)).data;
  }

  /**
   * Updates the spell's description.
   *
   * @param data
   */
  async _updateSpellDescription(data) {
    this.data.data.description.value = await renderTemplate(
      "systems/pf1/templates/internal/spell-description.hbs",
      mergeObject(data ?? {}, this.spellDescriptionData)
    );
  }

  get fullDescription() {
    return super.fullDescription + this.data.data.shortDescription;
  }

  get spellDescriptionData() {
    const reSplit = CONFIG.PF1.re.traitSeparator;
    const srcData = this.data;

    const label = {
      school: (CONFIG.PF1.spellSchools[getProperty(srcData, "data.school")] || "").toLowerCase(),
      subschool: getProperty(srcData, "data.subschool") || "",
      types: "",
    };
    const data = {
      data: mergeObject(this.data.data, srcData.data, { inplace: false }),
      label: label,
    };

    // Set subschool and types label
    const types = getProperty(srcData, "data.types");
    if (typeof types === "string" && types.length > 0) {
      label.types = types.split(reSplit).join(", ");
    }
    // Set information about when the spell is learned
    data.learnedAt = {};
    data.learnedAt.class = (getProperty(srcData, "data.learnedAt.class") || [])
      .map((o) => {
        return `${o[0]} ${o[1]}`;
      })
      .sort()
      .join(", ");
    data.learnedAt.domain = (getProperty(srcData, "data.learnedAt.domain") || [])
      .map((o) => {
        return `${o[0]} ${o[1]}`;
      })
      .sort()
      .join(", ");
    data.learnedAt.subDomain = (getProperty(srcData, "data.learnedAt.subDomain") || [])
      .map((o) => {
        return `${o[0]} ${o[1]}`;
      })
      .sort()
      .join(", ");
    data.learnedAt.elementalSchool = (getProperty(srcData, "data.learnedAt.elementalSchool") || [])
      .map((o) => {
        return `${o[0]} ${o[1]}`;
      })
      .sort()
      .join(", ");
    data.learnedAt.bloodline = (getProperty(srcData, "data.learnedAt.bloodline") || [])
      .map((o) => {
        return `${o[0]} ${o[1]}`;
      })
      .sort()
      .join(", ");

    // Set casting time label
    const act = game.settings.get("pf1", "unchainedActionEconomy")
      ? getProperty(srcData, "data.unchainedAction.activation")
      : getProperty(srcData, "data.activation");
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
      const duration = getProperty(srcData, "data.spellDuration");
      if (duration) label.duration = duration;
    }
    // Set effect label
    {
      const effect = getProperty(srcData, "data.spellEffect");
      if (effect) label.effect = effect;
    }
    // Set targets label
    {
      const targets = getProperty(srcData, "data.target.value");
      if (targets) label.targets = targets;
    }
    // Set range label
    {
      const rangeUnit = getProperty(srcData, "data.range.units");
      const rangeValue = getProperty(srcData, "data.range.value");

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
      const area = getProperty(srcData, "data.spellArea");

      if (area) label.area = area;
    }

    // Set DC and SR
    {
      const savingThrowDescription = getProperty(srcData, "data.save.description");
      if (savingThrowDescription) label.savingThrow = savingThrowDescription;
      else label.savingThrow = "none";

      const sr = getProperty(srcData, "data.sr");
      label.sr = (sr === true ? game.i18n.localize("PF1.Yes") : game.i18n.localize("PF1.No")).toLowerCase();

      if (getProperty(srcData, "data.range.units") !== "personal") data.useDCandSR = true;
    }
    return data;
  }
}
