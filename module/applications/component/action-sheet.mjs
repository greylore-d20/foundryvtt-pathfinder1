import { createTag } from "../../utils/lib.mjs";

export class ItemActionSheet extends FormApplication {
  constructor(...args) {
    super(...args);

    this.item.apps[this.appId] = this;
    this.action.apps[this.appId] = this;
    this.action.sheet = this;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      template: "systems/pf1/templates/apps/item-action.hbs",
      classes: ["pf1", "item", "sheet", "item-action"],
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
    if (this.actor) return `actor-${this.actor.id}-item-${this.item.id}-action-${this.action.id}`;
    return `item-${this.item.id}-action-${this.action.id}`;
  }

  get action() {
    return this.object;
  }
  get item() {
    return this.action.item;
  }
  get actor() {
    return this.item.actor;
  }

  async getData() {
    const data = await super.getData();
    data.action = this.action;
    data.item = this.item;
    data.actor = this.actor;
    data.data = foundry.utils.mergeObject(this.action.constructor.defaultData, deepClone(this.action.data), {
      inplace: false,
    });
    data.damageTypes = pf1.registry.damageTypes.toRecord();
    data.rollData = this.object.getRollData();

    // Set tag
    data.tag = createTag(data.action.name);

    // Include CONFIG values
    data.config = pf1.config;

    // Action Details
    data.hasAttackRoll = this.action.hasAttack;
    data.isHealing = data.data.actionType === "heal";
    data.isCombatManeuver = ["mcman", "rcman"].includes(data.data.actionType);
    data.hasAttack = ["mwak", "rwak", "msak", "rsak", "mcman", "rcman"].includes(data.data.actionType);
    // Can have crit and non-crit damage, or simply show them if they've been defined.
    data.hasCritDamage = data.hasAttack || data.data.damage?.critParts?.length > 0;
    data.hasNonCritDamage = data.hasAttack || data.data.damage?.nonCritParts?.length > 0;

    data.isCharged = this.action.isCharged;
    data.isSelfCharged = this.action.isSelfCharged;
    data.showMaxChargeFormula = ["day", "week", "charges"].includes(data.data.uses.self.per);
    if (this.action.hasRange) {
      data.canInputRange = ["ft", "mi", "spec"].includes(data.data.range.units);
      data.canInputMinRange = ["ft", "mi", "spec"].includes(data.data.range.minUnits);
    }
    if (data.data.duration != null) {
      data.canInputDuration = !["", "inst", "perm", "seeText"].includes(data.data.duration.units);
    }

    // Action Details
    data.itemName = data.item.name;
    data.itemEnh = data.item.system.enh || 0;
    data.isSpell = this.item.type === "spell";
    data.usesSpellPoints = this.item.spellbook?.spellPoints.useSystem;
    data.defaultChargeFormula = this.item.getDefaultChargeFormula();
    data.canUseAmmo = this.action.data.usesAmmo !== undefined;
    data.owned = this.item.actor != null;
    data.parentOwned = this.actor != null;
    data.owner = this.item.isOwner;
    data.isGM = game.user.isGM;
    data.unchainedActionEconomy = game.settings.get("pf1", "unchainedActionEconomy");
    data.hasActivationType = this.action.activation.type;

    // Add description
    data.descriptionHTML = await TextEditor.enrichHTML(data.data.description, {
      secrets: data.owner,
      rollData: data.rollData,
      async: true,
    });

    // Show additional ranged properties
    data.showMaxRangeIncrements = data.data.range.units === "ft";

    // Prepare attack specific stuff
    if (data.item.type === "attack") {
      data.isWeaponAttack = data.item.system.subType === "weapon";
      data.isNaturalAttack = data.item.system.subType === "natural";
    }

    // Add distance units
    data.distanceUnits = deepClone(pf1.config.distanceUnits);
    if (this.item.type !== "spell") {
      for (const d of ["close", "medium", "long"]) {
        delete data.distanceUnits[d];
      }
    }

    // Prepare stuff for actions with conditionals
    if (data.data.conditionals) {
      for (const conditional of data.data.conditionals) {
        for (const modifier of conditional.modifiers) {
          modifier.targets = this.object.getConditionalTargets();
          modifier.subTargets = this.object.getConditionalSubTargets(modifier.target);
          modifier.conditionalModifierTypes = this.object.getConditionalModifierTypes(modifier.target);
          modifier.conditionalCritical = this.object.getConditionalCritical(modifier.target);
        }
      }
    }

    return data;
  }

  /**
   * Copy from core DocumentSheet#isEditable
   */
  get isEditable() {
    let editable = this.options.editable && this.object.parent.isOwner;
    if (this.object.parent.pack) {
      const pack = game.packs.get(this.object.parent.pack);
      if (pack.locked) editable = false;
    }
    return editable;
  }

  activateListeners(html) {
    super.activateListeners(html);

    if (!this.isEditable) return;

    // Modify action image
    html.find(`img[data-edit="img"]`).on("click", this._onEditImage.bind(this));

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

    // Handle alternative file picker
    html.find(".file-picker-alt").click(this._onFilePickerAlt.bind(this));
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

    let data, type;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
      // Surface-level check for conditional
      if (data.default != null && typeof data.name === "string" && Array.isArray(data.modifiers)) type = "conditional";
    } catch (e) {
      return false;
    }

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
      data._id = randomID(16);

      // Append conditional
      const conditionals = deepClone(action.data.conditionals || []).concat(data);
      await this.object.update({ conditionals: conditionals });
    }
  }

  _onEntrySelector(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const options = {
      name: a.getAttribute("for"),
      title: a.innerText,
      flag: a.dataset.flag === "true",
      boolean: a.dataset.boolean === "true",
      flat: a.dataset.flat === "true",
      fields: a.dataset.fields,
      dtypes: a.dataset.dtypes,
    };
    new pf1.applications.EntrySelector(this.object, options).render(true);
  }

  _onEntryControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const key = a.closest(".notes").dataset.name;

    if (a.classList.contains("add-entry")) {
      const notes = deepClone(getProperty(this.object.data, key) ?? []);
      const updateData = { [key]: notes.concat("") };
      return this._onSubmit(event, { updateData });
    } else if (a.classList.contains("delete-entry")) {
      const index = a.closest(".entry").dataset.index;
      const notes = deepClone(getProperty(this.object.data, key));
      notes.splice(index, 1);

      const updateData = {};
      updateData[key] = notes;
      return this._onSubmit(event, { updateData });
    }
  }

  async _onConditionalControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new conditional
    if (a.classList.contains("add-conditional")) {
      await this._onSubmit(event); // Submit any unsaved changes
      return pf1.components.ItemConditional.create([{}], { parent: this.object });
    }

    // Remove a conditional
    if (a.classList.contains("delete-conditional")) {
      await this._onSubmit(event); // Submit any unsaved changes
      const li = a.closest(".conditional");
      const conditional = this.object.conditionals.get(li.dataset.conditional);
      return conditional.delete();
    }

    // Add a new conditional modifier
    if (a.classList.contains("add-conditional-modifier")) {
      await this._onSubmit(event);
      const li = a.closest(".conditional");
      const conditional = this.object.conditionals.get(li.dataset.conditional);
      return pf1.components.ItemConditionalModifier.create([{}], { parent: conditional });
    }

    // Remove a conditional modifier
    if (a.classList.contains("delete-conditional-modifier")) {
      await this._onSubmit(event);
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
      const damage = getProperty(this.action.data, k2);
      const updateData = {};
      updateData[path] = getProperty(damage, k3).concat([initialData]);
      return this._onSubmit(event, { updateData });
    }

    // Remove a damage component
    if (a.classList.contains("delete-damage")) {
      const li = a.closest(".damage-part");
      const damage = deepClone(getProperty(this.action.data, k2));
      getProperty(damage, k3).splice(Number(li.dataset.damagePart), 1);
      const updateData = {};
      updateData[path] = getProperty(damage, k3);
      return this._onSubmit(event, { updateData });
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
        this.object,
        `${damagePart}.${damageIndex}.type`,
        getProperty(this.object.data, damagePart)[damageIndex].type
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

    // Add new attack component
    if (a.classList.contains("add-attack")) {
      const attackParts = this.action.data.attackParts;
      return this._onSubmit(event, { updateData: { attackParts: attackParts.concat([["", ""]]) } });
    }

    // Remove an attack component
    if (a.classList.contains("delete-attack")) {
      const li = a.closest(".attack-part");
      const attackParts = deepClone(this.action.data.attackParts);
      attackParts.splice(Number(li.dataset.attackPart), 1);
      return this._onSubmit(event, { updateData: { attackParts: attackParts } });
    }
  }

  async _onFilePickerAlt(event) {
    const button = event.currentTarget;
    const attr = button.dataset.for;
    const current = getProperty(this.item.data, attr);
    const form = button.form;
    const targetField = form[attr];
    if (!targetField) return;

    const fp = new FilePicker({
      type: button.dataset.type,
      current: current,
      callback: (path) => {
        targetField.value = path;
        if (this.options.submitOnChange) {
          this._onSubmit(event);
        }
      },
      top: this.position.top + 40,
      left: this.position.left + 10,
    });
    fp.browse(current);
  }

  async _onEditImage(event) {
    event.preventDefault();
    const filePicker = new FilePicker({
      type: "image",
      current: this.action.data.img,
      callback: async (path) => {
        await this.action.update({ img: path });
        return this.render();
      },
    });
    filePicker.render();
  }

  async _onTextAreaDrop(event) {
    event.preventDefault();

    const eventData = TextEditor.getDragEventData(event.originalEvent);
    if (!eventData) return;

    const elem = event.currentTarget;
    const link = await TextEditor.getContentLink(eventData);

    // Insert link
    if (link) {
      elem.value = !elem.value ? link : elem.value + "\n" + link;
    }
    return this._onSubmit(event);
  }

  async _updateObject(event, formData) {
    // Handle conditionals array
    const conditionalData = deepClone(this.object.data.conditionals);
    Object.entries(formData)
      .filter((o) => o[0].startsWith("conditionals"))
      .forEach((o) => {
        let reResult;
        // Handle conditional modifier
        if ((reResult = o[0].match(/^conditionals.([0-9]+).modifiers.([0-9]+).(.+)$/))) {
          const conditionalIdx = parseInt(reResult[1]);
          const modifierIdx = parseInt(reResult[2]);
          const conditional =
            conditionalData[conditionalIdx] ?? deepClone(this.object.data.conditionals[conditionalIdx]);
          const path = reResult[3];
          setProperty(conditional.modifiers[modifierIdx], path, o[1]);
        }
        // Handle conditional
        else if ((reResult = o[0].match(/^conditionals.([0-9]+).(.+)$/))) {
          const conditionalIdx = parseInt(reResult[1]);
          const conditional =
            conditionalData[conditionalIdx] ?? deepClone(this.object.data.conditionals[conditionalIdx]);
          const path = reResult[2];
          setProperty(conditional, path, o[1]);
        }
      });
    formData["conditionals"] = conditionalData;

    formData = expandObject(formData);
    return this.action.update(formData);
  }

  async close(options) {
    delete this.item.apps[this.appId];
    delete this.action.apps[this.appId];
    this.action.sheet = null;
    return super.close(options);
  }
}
