import { naturalSort } from "@utils";

export class ItemActionSheet extends FormApplication {
  constructor(...args) {
    super(...args);

    this.item.apps[this.appId] = this;
    this.action.apps[this.appId] = this;
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      template: "systems/pf1/templates/apps/item-action.hbs",
      classes: [...options.classes, "pf1", "sheet", "action", "item-action"],
      width: 580,
      height: 720,
      closeOnSubmit: false,
      submitOnClose: true,
      submitOnChange: true,
      resizable: true,
      scrollY: [".tab"],
      tabs: [
        {
          navSelector: "nav.tabs[data-group='primary']",
          contentSelector: "section.primary-body",
          initial: "description",
          group: "primary",
        },
      ],
      dragDrop: [
        {
          dragSelector: "li.conditional",
          dropSelector: 'div[data-tab="conditionals"]',
        },
      ],
    };
  }

  get title() {
    return `${this.item.name}: ${this.action.name}`;
  }

  get id() {
    return `item-${this.item.uuid.replaceAll(".", "-")}-action-${this.action.id}`;
  }

  /** @type {ItemAction} */
  get action() {
    return this.object;
  }

  /** @type {ItemPF} */
  get item() {
    return this.action.item;
  }

  /** @type {ActorPF} */
  get actor() {
    return this.item.actor;
  }

  async getData() {
    const action = this.action;
    const item = this.item;
    const actor = this.actor;

    const editable = this.isEditable;

    const context = {
      config: pf1.config,
      editable,
      cssClass: editable ? "editable" : "locked",
      user: game.user,
      data: action.toObject(false, false),
      action,
      item,
      actor,
      img: action.img,
      tag: action._source.tag, // True tag
      damageTypes: pf1.registry.damageTypes.toObject(),
      rollData: action.getRollData(),
    };

    // Action Details
    context.hasAttack = action.hasAttack;
    context.actionType = action.actionType;
    context.isHealing = context.actionType === "heal";
    context.hasDamage = action.hasDamage;
    context.isCombatManeuver = action.isCombatManeuver;
    context.canCrit = action.hasAttack && action.ability?.critMult > 1;
    // Can have crit and non-crit damage, or simply show them if they've been defined.
    context.hasCritDamage = context.canCrit || action.damage?.critParts?.length > 0;
    context.hasNonCritDamage = context.canCrit || action.damage?.nonCritParts?.length > 0;

    context.isCharged = action.isCharged;
    context.isSelfCharged = action.isSelfCharged;
    const chargedUsePeriods = new Set([...Object.keys(pf1.config.limitedUsePeriods), "charges"]);
    chargedUsePeriods.delete("single"); // Single is special
    context.limitedUsePeriods = { ...pf1.config.limitedUsePeriods };
    if (!item.isPhysical) delete context.limitedUsePeriods.single;
    context.showMaxChargeFormula = chargedUsePeriods.has(action.uses.self.per);
    if (action.hasRange) {
      context.canInputRange = ["ft", "mi", "spec"].includes(action.range.units);
      context.canInputMinRange = ["ft", "mi", "spec"].includes(action.range.minUnits);
    }

    context.canInputDuration = !["", "turn", "inst", "perm", "seeText"].includes(action.duration?.units || "");

    // Action Details
    context.itemName = item.name;
    context.itemEnh = item.system.enh || 0;
    context.isSpell = item.type === "spell";
    context.usesSpellPoints = item.spellbook?.spellPoints.useSystem;
    context.defaultChargeFormula = item.getDefaultChargeFormula();
    context.owned = actor != null;
    context.parentOwned = actor != null;
    context.owner = item.isOwner;
    context.isGM = game.user.isGM;
    context.unchainedActionEconomy = game.settings.get("pf1", "unchainedActionEconomy");
    context.activation = action.activation;
    context.hasActivationType = context.activation.type;
    context.abilityActivationTypes = context.unchainedActionEconomy
      ? pf1.config.abilityActivationTypes_unchained
      : pf1.config.abilityActivationTypes;

    // Add description
    const description = action.description;
    context.descriptionHTML = description
      ? await TextEditor.enrichHTML(description, {
          secrets: context.owner,
          rollData: context.rollData,
          relativeTo: this.actor,
        })
      : null;

    // Show additional ranged properties
    context.showMaxRangeIncrements = action.range.units === "ft";

    // Prepare attack specific stuff
    if (item.type === "attack") {
      context.isWeaponAttack = item.system.subType === "weapon";
      context.isNaturalAttack = item.system.subType === "natural";
    }

    context.canUseAmmo = context.isNaturalAttack !== true;
    context.usesAmmo = !!action.ammo.type;
    context.inheritedAmmoType = item?.system.ammo?.type;

    if (context.usesAmmo) {
      context.inheritedMisfire = item?.system.ammo?.misfire ?? null;
    }

    if (context.canUseAmmo) {
      context.ammoTypes = {
        none: game.i18n.localize("PF1.None"),
        "": game.i18n.format("PF1.InheritAs", { inherited: pf1.config.ammoTypes[context.inheritedAmmoType] }),
        ...pf1.config.ammoTypes,
      };
      if (!context.inheritedAmmoType) delete context.ammoTypes[""];
    }

    // Add distance units
    context.distanceUnits = foundry.utils.deepClone(pf1.config.distanceUnits);
    delete context.distanceUnits.none; // same as empty selection
    if (item.type !== "spell") {
      for (const d of ["close", "medium", "long"]) {
        delete context.distanceUnits[d];
      }
    }
    // Set whether to show minimum range input
    context.minRangeAvailable = ["reach", "ft", "mi", "seeText"].includes(action.range.units);

    // Prepare stuff for actions with conditionals
    if (context.data.conditionals) {
      for (const conditional of context.data.conditionals) {
        for (const modifier of conditional.modifiers) {
          modifier.targets = action.getConditionalTargets();
          modifier.subTargets = action.getConditionalSubTargets(modifier.target);
          modifier.conditionalModifierTypes = action.getConditionalModifierTypes(modifier.target);
          modifier.conditionalCritical = action.getConditionalCritical(modifier.target);
        }
      }
    }

    // Add materials and addons
    context.materialCategories = this._prepareMaterialsAndAddons();

    context.materialAddons =
      this.action.addonMaterial.reduce((obj, v) => {
        obj[v] = true;
        return obj;
      }, {}) ?? {};

    // Can hold (attacks & weapons only and only if they have attack rolls)
    context.canHold = action.hasAttack;
    // Inherited held option's name if any
    context.inheritedHeld =
      context.canHold && ["attack", "weapon"].includes(item.type)
        ? pf1.config.weaponHoldTypes[context.item.system.held]
        : null;

    // Add alignments
    context.alignmentTypes = this._prepareAlignments(this.action.alignments);
    this.alignments = context.alignmentTypes?.values; // Use a deep clone we've already made to track our progress.

    // Ability damage multiplier from held
    const held = context.rollData.action.held || context.rollData.item.held || "normal";
    context.heldAbilityMultiplier = pf1.config.abilityDamageHeldMultipliers[held] ?? 1;

    // Power attack multiplier if inherited
    context.paMultiplier = action.getPowerAttackMult({ rollData: context.rollData });

    // Prepare attack configuration
    context.extraAttacksTypes = Object.fromEntries([
      ...Object.entries(pf1.config.extraAttacks).map(([key, { label }]) => [key, label]),
    ]);

    context.extraAttacksConfig = { ...pf1.config.extraAttacks[action.extraAttacks?.type] };
    context.extraAttacksConfig.allowCustom = context.extraAttacksConfig.manual || context.extraAttacksConfig.formula;

    return context;
  }

  _prepareMaterialsAndAddons() {
    const materialList = {};
    const addonList = [];
    naturalSort([...pf1.registry.materials], "name").forEach((material) => {
      if (
        material.allowed.lightBlade ||
        material.allowed.oneHandBlade ||
        material.allowed.twoHandBlade ||
        material.allowed.rangedWeapon
      ) {
        if (!material.addon && !material.basic) {
          materialList[material.id] = material.name;
        } else if (material.addon && material.isValidAddon(this.action.normalMaterial)) {
          addonList.push({ key: material.id, name: material.name });
        }
      }
    });

    return {
      materials: materialList,
      addons: addonList,
    };
  }

  _prepareAlignments(alignments = {}) {
    const alignmentChoices = {};

    Object.keys(pf1.config.damageResistances).forEach((dType) => {
      if (!["magic", "epic"].includes(dType)) alignmentChoices[dType] = pf1.config.damageResistances[dType];
    });

    return {
      choices: alignmentChoices,
      values: alignments,
    };
  }

  /**
   * Copy from core DocumentSheet#isEditable
   */
  get isEditable() {
    const parentItem = this.item;
    let editable = this.options.editable && parentItem.isOwner;
    if (parentItem.pack) {
      const pack = game.packs.get(parentItem.pack);
      if (pack.locked) editable = false;
    }
    return editable;
  }

  activateListeners(html) {
    super.activateListeners(html);

    if (!this.isEditable) return;

    // Modify action image
    html.find("img[data-edit]").click((ev) => this._onEditImage(ev));

    // Add drop handler to textareas
    html.find("textarea, .card-notes input[type='text']").on("drop", this._onTextAreaDrop.bind(this));

    // Modify attack formula
    html.find(".attack-control").click(this._onAttackControl.bind(this));

    // Modify damage formula
    html.find(".damage-control").click(this._onDamageControl.bind(this));
    html.find(".damage-type-visual").on("click", this._onClickDamageType.bind(this));

    // Note control
    html.find(".card-notes .controls a").click(this._onNoteEntryControl.bind(this));

    // Modify conditionals
    html.find(".conditional-control").click(this._onConditionalControl.bind(this));

    // Handle Alignment tristate checkboxes
    html.find(".alignmentCheckbox").on("change", (event) => {
      this._onAlignmentChecked(event);
    });

    const alignmentItems = $(".alignmentCheckbox.actionCheckbox").each((index, item) => {
      const type = $(item).attr("data-type");
      if (!(this.alignments[type] || this.alignments[type] === false)) {
        item.indeterminate = true;
      }
    });
  }

  _onDragStart(event) {
    const elem = event.currentTarget;

    // Drag conditional
    if (elem.dataset?.conditional) {
      const conditional = this.action.conditionals.get(elem.dataset?.conditional);
      event.dataTransfer.setData("text/plain", JSON.stringify(conditional.data));
    }
  }

  /**
   * Foundry defauts to isGM check.
   *
   * @override
   */
  _canDragStart(selector) {
    return this.isEditable;
  }

  /**
   * Foundry defauts to isGM check.
   *
   * @override
   */
  _canDragDrop(selector) {
    return this.isEditable;
  }

  async _onDrop(event) {
    event.preventDefault();
    event.stopPropagation();

    const data = TextEditor.getDragEventData(event);
    let type;
    // Surface-level check for conditional
    if (data.default != null && typeof data.name === "string" && Array.isArray(data.modifiers)) type = "conditional";

    const action = this.action;
    // Handle conditionals
    if (type === "conditional") {
      // Check targets and other fields for valid values, reset if necessary
      for (const modifier of data.modifiers) {
        if (!Object.keys(action.getConditionalTargets()).includes(modifier.target)) modifier.target = "";
        let keys;
        for (let [k, v] of Object.entries(modifier)) {
          switch (k) {
            case "subTarget":
              keys = Object.keys(action.getConditionalSubTargets(modifier.target));
              break;
            case "type":
              keys = Object.keys(action.getConditionalModifierTypes(modifier.target));
              break;
            case "critical":
              keys = Object.keys(action.getConditionalCritical(modifier.target));
              break;
          }
          if (!keys?.includes(v)) v = keys?.[0] ?? "";
        }
      }

      // Renew conditional ID
      data._id = foundry.utils.randomID(16);

      // Append conditional
      const conditionals = action.toObject().conditionals || [];
      conditionals.push(data);
      await this.action.update({ conditionals });
    }
  }

  async _onNoteEntryControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const key = a.dataset.name;

    switch (a.dataset.action) {
      // Add
      case "add": {
        const notes = foundry.utils.getProperty(this.action.toObject(), key) ?? [];
        notes.push("");
        const updateData = { [key]: notes };
        return this._updateObject(event, this._getSubmitData(updateData));
      }
      // Delete
      case "delete": {
        const index = Number(a.dataset.index);
        const notes = foundry.utils.getProperty(this.action.toObject(), key) ?? [];
        notes.splice(index, 1);
        const updateData = { [key]: notes };
        return this._updateObject(event, this._getSubmitData(updateData));
      }
    }
  }

  async _onConditionalControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    await this._onSubmit(event, { preventRender: true }); // Submit any unsaved changes

    // Add new conditional
    if (a.classList.contains("add-conditional")) {
      return pf1.components.ItemConditional.create([{}], { parent: this.action });
    }
    // Remove a conditional
    else if (a.classList.contains("delete-conditional")) {
      const li = a.closest(".conditional");
      const conditional = this.action.conditionals.get(li.dataset.conditional);
      return conditional.delete();
    }
    // Add a new conditional modifier
    else if (a.classList.contains("add-conditional-modifier")) {
      const li = a.closest(".conditional");
      const conditional = this.action.conditionals.get(li.dataset.conditional);
      return pf1.components.ItemConditionalModifier.create([{}], { parent: conditional });
    }
    // Remove a conditional modifier
    else if (a.classList.contains("delete-conditional-modifier")) {
      const li = a.closest(".conditional-modifier");
      const conditional = this.action.conditionals.get(li.dataset.conditional);
      const modifier = conditional.modifiers.get(li.dataset.modifier);
      return modifier.delete();
    }
  }

  /**
   * Add or remove a damage part from the damage formula
   *
   * @param {Event} event     The original click event
   * @returns {Promise}
   * @private
   */
  async _onDamageControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const list = a.closest(".damage");
    const path = list.dataset.key || "damage.parts";
    const k2 = path.split(".").slice(0, -1).join(".");
    const k3 = path.split(".").slice(-1).join(".");

    // Add new damage component
    if (a.classList.contains("add-damage")) {
      // Get initial data
      const damageTypeBase = pf1.components.ItemAction.defaultDamageType;
      const initialData = {
        formula: "",
        type: damageTypeBase,
      };

      // Add data
      const damage = foundry.utils.getProperty(this.action.toObject(), k2);
      const damageParts = foundry.utils.getProperty(damage, k3) ?? [];
      damageParts.push(initialData);
      const updateData = { [path]: damageParts };
      return this._updateObject(event, this._getSubmitData(updateData));
    }
    // Remove a damage component
    else if (a.classList.contains("delete-damage")) {
      const li = a.closest(".damage-part");
      const damage = foundry.utils.getProperty(this.action.toObject(), k2);
      const damageParts = foundry.utils.getProperty(damage, k3) ?? [];
      if (damageParts.length) {
        damageParts.splice(Number(li.dataset.damagePart), 1);
        const updateData = { [path]: damageParts };
        return this._updateObject(event, this._getSubmitData(updateData));
      }
    }
  }

  async _onClickDamageType(event) {
    event.preventDefault();
    const clickedElement = event.currentTarget;

    // Check for normal damage part
    const damageIndex = Number(clickedElement.closest(".damage-part")?.dataset.damagePart);
    const damagePart = clickedElement.closest(".damage")?.dataset.key;
    if (damageIndex >= 0 && damagePart) {
      const app = new pf1.applications.DamageTypeSelector(
        this.action,
        `${damagePart}.${damageIndex}.type`,
        foundry.utils.getProperty(this.action, damagePart)[damageIndex].type,
        {
          updateCallback: (update) => {
            const damageArray = foundry.utils.getProperty(this.action.toObject(), damagePart) ?? [];
            damageArray[damageIndex].type = update;
            this.action.update({ [damagePart]: damageArray });
          },
        }
      );
      return app.render(true);
    }

    // Check for conditional
    const conditionalElement = clickedElement.closest(".conditional");
    const modifierElement = clickedElement.closest(".conditional-modifier");
    if (conditionalElement && modifierElement) {
      const conditional = this.action.conditionals.get(conditionalElement.dataset.conditional);
      const modifier = conditional.modifiers.get(modifierElement.dataset.modifier);
      const app = new pf1.applications.DamageTypeSelector(modifier, "damageType", modifier.data.damageType, {
        updateCallback: (update) => {
          modifier.update({ damageType: update });
        },
      });
      return app.render(true);
    }
  }

  async _onAttackControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    const manualExtraAttacks = this.action.toObject().extraAttacks?.manual ?? [];

    // Add new attack component
    if (a.classList.contains("add-attack")) {
      manualExtraAttacks.push({ formula: "", name: "" });
      const updateData = { extraAttacks: { manual: manualExtraAttacks } };
      return this._updateObject(event, this._getSubmitData(updateData));
    }
    // Remove an attack component
    else if (a.classList.contains("delete-attack")) {
      const li = a.closest(".attack-part");
      manualExtraAttacks.splice(Number(li.dataset.attackPart), 1);
      const updateData = { extraAttacks: { manual: manualExtraAttacks } };
      return this._updateObject(event, this._getSubmitData(updateData));
    }
  }

  /**
   * Clone of item/actor sheet image editor callback.
   *
   * @protected
   * @param {Event} event
   */
  _onEditImage(event) {
    const attr = event.currentTarget.dataset.edit;
    const current = foundry.utils.getProperty(this.action, attr);
    const fp = new FilePicker({
      type: "image",
      current,
      callback: (path) => this.action.update({ img: path }),
      top: this.position.top + 40,
      left: this.position.left + 10,
    });
    fp.browse();
  }

  async _onTextAreaDrop(event) {
    event.preventDefault();

    const eventData = TextEditor.getDragEventData(event.originalEvent);
    if (!eventData) return;

    const elem = event.currentTarget;
    const link = await TextEditor.getContentLink(eventData, { relativeTo: this.actor });

    // Insert link
    if (link) {
      elem.value = !elem.value ? link : elem.value + "\n" + link;

      return this._onSubmit(event); // Save
    }
  }

  async _onAlignmentChecked(event) {
    const el = event.target;
    const previousValue = this.alignments[el.dataset.type];

    // Move from one phase to the next in our tristate checkbox
    el.checked = previousValue === false;
    el.indeterminate = previousValue === true;

    if (el.checked) {
      this.alignments[el.dataset.type] = true;
    } else if (el.indeterminate) {
      this.alignments[el.dataset.type] = null;
    } else {
      this.alignments[el.dataset.type] = false;
    }
  }

  async _updateObject(event, formData) {
    const oldData = this.action.toObject(true, false);

    // Handle conditionals array
    const conditionalData = oldData.conditionals ?? [];
    Object.entries(formData)
      .filter((o) => o[0].startsWith("conditionals"))
      .forEach((o) => {
        let reResult;
        // Handle conditional modifier
        if ((reResult = o[0].match(/^conditionals.([0-9]+).modifiers.([0-9]+).(.+)$/))) {
          const conditionalIdx = parseInt(reResult[1]);
          const modifierIdx = parseInt(reResult[2]);
          const conditional = conditionalData[conditionalIdx] ?? oldData.conditionals[conditionalIdx];
          const path = reResult[3];
          foundry.utils.setProperty(conditional.modifiers[modifierIdx], path, o[1]);
        }
        // Handle conditional
        else if ((reResult = o[0].match(/^conditionals.([0-9]+).(.+)$/))) {
          const conditionalIdx = parseInt(reResult[1]);
          const conditional = conditionalData[conditionalIdx] ?? oldData.conditionals[conditionalIdx];
          const path = reResult[2];
          foundry.utils.setProperty(conditional, path, o[1]);
        }
      });
    formData["conditionals"] = conditionalData;

    formData = foundry.utils.expandObject(formData);

    // Merge partial damage data to preserve overall data
    if (formData.damage) {
      for (const [key, array] of Object.entries(formData.damage)) {
        if (Array.isArray(array)) continue;
        const damage = oldData.damage[key] ?? [];
        for (const [idx, data] of Object.entries(array)) {
          damage[idx] = foundry.utils.mergeObject(damage[Number(idx)] ?? {}, data);
        }
        formData.damage[key] = damage;
      }
    }

    // Adjust Material Addons object to array
    const material = formData.material;
    if (material?.addon) {
      material.addon = Object.entries(material.addon)
        .filter(([_, chosen]) => chosen)
        .map(([key]) => key);
    }

    if (formData.alignments) {
      // Adjust Alignment Types (this is necessary to handle null values for inheritance)
      for (const [key, value] of Object.entries(this.alignments)) {
        formData.alignments[key] = value;
      }
    }

    // Uniform style for
    if (formData.measureTemplate) {
      if (formData.measureTemplate.color) {
        const c = Color.fromString(formData.measureTemplate.color);
        if (Number.isFinite(Number(c))) formData.measureTemplate.color = c.toString();
        else console.warn("Invalid color provided to template", formData.measureTemplate.color, this.action);
      }
    }

    // Do not add image if it's same as parent item
    if (formData.img === this.item?.img) delete formData.img;

    return this.action.update(formData);
  }

  async close(options = {}) {
    delete this.item.apps[this.appId];
    delete this.action.apps[this.appId];
    if (this.action._sheet === this) this.action._sheet = null;

    if (options.force && this._state <= Application.RENDER_STATES.NONE) return; // HACK: already closed, would error without

    return super.close(options);
  }
}
