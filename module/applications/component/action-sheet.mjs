export class ItemActionSheet extends FormApplication {
  constructor(...args) {
    super(...args);

    this.item.apps[this.appId] = this;
    this.action.apps[this.appId] = this;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "systems/pf1/templates/apps/item-action.hbs",
      classes: ["pf1", "sheet", "action", "item-action"],
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
    });
  }
  get title() {
    return `${this.item.name}: ${this.action.name}`;
  }
  get id() {
    return `item-${this.item.uuid}-action-${this.action.id}`;
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

    const context = {
      config: pf1.config,
      editable: this.isEditable,
      user: game.user,
      action,
      item,
      actor,
      img: action.img,
      tag: pf1.utils.createTag(action.name), // Tag placeholder
      damageTypes: pf1.registry.damageTypes.toObject(),
      rollData: action.getRollData(),
    };

    context.data = foundry.utils.mergeObject(action.constructor.defaultData, foundry.utils.deepClone(action.data), {
      inplace: false,
    });

    // Action Details
    context.hasAttack = action.hasAttack;
    context.actionType = context.data.actionType;
    context.isHealing = context.actionType === "heal";
    context.hasDamage = action.hasDamage;
    context.isCombatManeuver = action.isCombatManeuver;
    context.canCrit = action.hasAttack && action.data.ability?.critMult > 1;
    // Can have crit and non-crit damage, or simply show them if they've been defined.
    context.hasCritDamage = context.canCrit || context.data.damage?.critParts?.length > 0;
    context.hasNonCritDamage = context.canCrit || context.data.damage?.nonCritParts?.length > 0;

    context.isCharged = action.isCharged;
    context.isSelfCharged = action.isSelfCharged;
    const chargedUsePeriods = new Set([...Object.keys(pf1.config.limitedUsePeriods), "charges"]);
    chargedUsePeriods.delete("single"); // Single is special
    context.limitedUsePeriods = { ...pf1.config.limitedUsePeriods };
    if (!item.isPhysical) delete context.limitedUsePeriods.single;
    context.showMaxChargeFormula = chargedUsePeriods.has(context.data.uses.self.per);
    if (action.hasRange) {
      context.canInputRange = ["ft", "mi", "spec"].includes(context.data.range.units);
      context.canInputMinRange = ["ft", "mi", "spec"].includes(context.data.range.minUnits);
    }

    context.canInputDuration = !["", "turn", "inst", "perm", "seeText"].includes(context.data.duration?.units || "");

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
    const description = context.data.description;
    context.descriptionHTML = description
      ? await TextEditor.enrichHTML(description, {
          secrets: context.owner,
          rollData: context.rollData,
          async: true,
          relativeTo: this.actor,
        })
      : null;

    // Show additional ranged properties
    context.showMaxRangeIncrements = context.data.range.units === "ft";

    // Prepare attack specific stuff
    if (item.type === "attack") {
      context.isWeaponAttack = item.system.subType === "weapon";
      context.isNaturalAttack = item.system.subType === "natural";
    }

    context.canUseAmmo = context.isNaturalAttack !== true;
    context.usesAmmo = !!action.ammoType;
    context.inheritedAmmoType = item?.system.ammo?.type;

    if (context.usesAmmo) {
      context.inheritedMisfire = item?.system.ammo?.misfire ?? null;
    }

    // Add distance units
    context.distanceUnits = foundry.utils.deepClone(pf1.config.distanceUnits);
    if (item.type !== "spell") {
      for (const d of ["close", "medium", "long"]) {
        delete context.distanceUnits[d];
      }
    }
    // Set whether to show minimum range input
    context.minRangeAvailable = ["reach", "ft", "mi", "seeText"].includes(context.data.range.units);

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
      this.action.data.material?.addon?.reduce((obj, v) => {
        obj[v] = true;
        return obj;
      }, {}) ?? {};

    // Inherited held option's name if any
    context.inheritedHeld = pf1.config.weaponHoldTypes[context.item.system.held];
    // Can hold
    context.canHold = item.isPhysical ?? item.isQuasiPhysical ?? false;
    if (!context.hasAttack) context.canHold = false;

    // Add alignments
    context.alignmentTypes = this._prepareAlignments(this.action.alignments);
    this.alignments = context.alignmentTypes?.values; // Use a deep clone we've already made to track our progress.

    // Ability damage multiplier from held
    const held = context.rollData.action.held || context.rollData.item.held || "1h";
    context.heldAbilityMultiplier = pf1.config.abilityDamageHeldMultipliers[held] ?? 1;

    // Power attack multiplier if inherited
    context.paMultiplier = action.getPowerAttackMult({ rollData: context.rollData });

    // Prepare attack configuration
    context.extraAttacksTypes = Object.fromEntries([
      ...Object.entries(pf1.config.extraAttacks).map(([key, { label }]) => [key, label]),
    ]);

    context.extraAttacksConfig = { ...pf1.config.extraAttacks[action.data.extraAttacks?.type] };
    context.extraAttacksConfig.allowCustom = context.extraAttacksConfig.manual || context.extraAttacksConfig.formula;

    return context;
  }

  _prepareMaterialsAndAddons() {
    const materialList = {};
    const addonList = [];
    pf1.registry.materialTypes.forEach((material) => {
      if (
        material.allowed.lightBlade ||
        material.allowed.oneHandBlade ||
        material.allowed.twoHandBlade ||
        material.allowed.rangedWeapon
      ) {
        if (!material.addon && !material.basic) {
          materialList[material.id] = material.name;
        } else if (!material.basic && !["heatstoneplating", "lazurite", "sunsilk"].includes(material.id)) {
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
    html.find("textarea, .notes input[type='text']").on("drop", this._onTextAreaDrop.bind(this));

    // Modify attack formula
    html.find(".attack-control").click(this._onAttackControl.bind(this));

    // Modify damage formula
    html.find(".damage-control").click(this._onDamageControl.bind(this));
    html.find(".damage-type-visual").on("click", this._onClickDamageType.bind(this));

    // Listen to field entries
    html.find(".entry-selector").click(this._onEntrySelector.bind(this));
    html.find(".entry-control a").click(this._onEntryControl.bind(this));

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
      const conditional = this.object.conditionals.get(elem.dataset?.conditional);
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

    const action = this.object;
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
      const conditionals = foundry.utils.deepClone(action.data.conditionals || []);
      conditionals.push(data);
      await this.object.update({ conditionals });
    }
  }

  _onEntrySelector(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const options = {
      name: a.dataset.for,
      title: a.dataset.title,
      flag: a.dataset.flag === "true",
      boolean: a.dataset.boolean === "true",
      flat: a.dataset.flat === "true",
      fields: a.dataset.fields,
      dtypes: a.dataset.dtypes,
    };

    pf1.applications.EntrySelector.open(this.object, options);
  }

  async _onEntryControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const key = a.closest(".notes").dataset.name;

    // Add
    if (a.classList.contains("add-entry")) {
      const notes = foundry.utils.deepClone(foundry.utils.getProperty(this.object.data, key) ?? []);
      notes.push("");
      const updateData = { [key]: notes };
      return this._updateObject(event, this._getSubmitData(updateData));
    }
    // Delete
    else if (a.classList.contains("delete-entry")) {
      const index = a.closest(".entry").dataset.index;
      const notes = foundry.utils.deepClone(foundry.utils.getProperty(this.object.data, key));
      notes.splice(index, 1);
      const updateData = { [key]: notes };
      return this._updateObject(event, this._getSubmitData(updateData));
    }
  }

  async _onConditionalControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    await this._onSubmit(event, { preventRender: true }); // Submit any unsaved changes

    // Add new conditional
    if (a.classList.contains("add-conditional")) {
      return pf1.components.ItemConditional.create([{}], { parent: this.object });
    }
    // Remove a conditional
    else if (a.classList.contains("delete-conditional")) {
      const li = a.closest(".conditional");
      const conditional = this.object.conditionals.get(li.dataset.conditional);
      return conditional.delete();
    }
    // Add a new conditional modifier
    else if (a.classList.contains("add-conditional-modifier")) {
      const li = a.closest(".conditional");
      const conditional = this.object.conditionals.get(li.dataset.conditional);
      return pf1.components.ItemConditionalModifier.create([{}], { parent: conditional });
    }
    // Remove a conditional modifier
    else if (a.classList.contains("delete-conditional-modifier")) {
      const li = a.closest(".conditional-modifier");
      const conditional = this.object.conditionals.get(li.dataset.conditional);
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
      const damage = foundry.utils.getProperty(this.action.data, k2);
      const damageParts = foundry.utils.getProperty(damage, k3) ?? [];
      damageParts.push(initialData);
      const updateData = { [path]: damageParts };
      return this._updateObject(event, this._getSubmitData(updateData));
    }
    // Remove a damage component
    else if (a.classList.contains("delete-damage")) {
      const li = a.closest(".damage-part");
      const damage = foundry.utils.deepClone(foundry.utils.getProperty(this.action.data, k2));
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
    const damageIndex = clickedElement.closest(".damage-part")?.dataset.damagePart;
    const damagePart = clickedElement.closest(".damage")?.dataset.key;
    if (damageIndex != null && damagePart != null) {
      const app = new pf1.applications.DamageTypeSelector(
        this.action,
        `${damagePart}.${damageIndex}.type`,
        foundry.utils.getProperty(this.object.data, damagePart)[damageIndex].type
      );
      return app.render(true);
    }

    // Check for conditional
    const conditionalElement = clickedElement.closest(".conditional");
    const modifierElement = clickedElement.closest(".conditional-modifier");
    if (conditionalElement && modifierElement) {
      const conditional = this.object.conditionals.get(conditionalElement.dataset.conditional);
      const modifier = conditional.modifiers.get(modifierElement.dataset.modifier);
      const app = new pf1.applications.DamageTypeSelector(modifier, "damageType", modifier.data.damageType);
      return app.render(true);
    }
  }

  async _onAttackControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    const manualExtraAttacks = foundry.utils.deepClone(this.action.data.extraAttacks?.manual ?? []);

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
    const current = foundry.utils.getProperty(this.action.data, attr);
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
    // Handle conditionals array
    const conditionalData = foundry.utils.deepClone(this.object.data.conditionals);
    Object.entries(formData)
      .filter((o) => o[0].startsWith("conditionals"))
      .forEach((o) => {
        let reResult;
        // Handle conditional modifier
        if ((reResult = o[0].match(/^conditionals.([0-9]+).modifiers.([0-9]+).(.+)$/))) {
          const conditionalIdx = parseInt(reResult[1]);
          const modifierIdx = parseInt(reResult[2]);
          const conditional =
            conditionalData[conditionalIdx] ?? foundry.utils.deepClone(this.object.data.conditionals[conditionalIdx]);
          const path = reResult[3];
          foundry.utils.setProperty(conditional.modifiers[modifierIdx], path, o[1]);
        }
        // Handle conditional
        else if ((reResult = o[0].match(/^conditionals.([0-9]+).(.+)$/))) {
          const conditionalIdx = parseInt(reResult[1]);
          const conditional =
            conditionalData[conditionalIdx] ?? foundry.utils.deepClone(this.object.data.conditionals[conditionalIdx]);
          const path = reResult[2];
          foundry.utils.setProperty(conditional, path, o[1]);
        }
      });
    formData["conditionals"] = conditionalData;

    formData = foundry.utils.expandObject(formData);

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

  async close(options) {
    delete this.item.apps[this.appId];
    delete this.action.apps[this.appId];
    this.action._sheet = null;
    return super.close(options);
  }
}
