import { createTag } from "../../../lib.js";

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
    return this.item.parentActor;
  }

  async getData() {
    const data = await super.getData();
    data.action = this.action;
    data.item = this.item;
    data.actor = this.actor;
    data.data = foundry.utils.mergeObject(this.action.constructor.defaultData, this.action.data, { inplace: false });
    data.damageTypes = game.pf1.damageTypes.toRecord();

    // Set tag
    data.tag = createTag(data.name);

    // Include CONFIG values
    data.config = CONFIG.PF1;

    // Action Details
    data.hasAttackRoll = this.action.hasAttack;
    data.isHealing = data.actionType === "heal";
    data.isCombatManeuver = ["mcman", "rcman"].includes(data.actionType);

    data.isCharged = this.action.isCharged;
    if (this.action.hasRange) {
      data.canInputRange = ["ft", "mi", "spec"].includes(data.range.units);
      data.canInputMinRange = ["ft", "mi", "spec"].includes(data.range.minUnits);
    }
    if (data.duration != null) {
      data.canInputDuration = !["", "inst", "perm", "seeText"].includes(data.duration.units);
    }

    // Action Details
    data.itemName = data.item.name;
    data.itemEnh = data.item.data.enh || 0;
    data.isSpell = this.item.type === "spell";
    data.canUseAmmo = this.action.data.usesAmmo !== undefined;
    data.owned = this.item.actor != null;
    data.parentOwned = this.actor != null;
    data.owner = this.item.isOwner;
    data.isGM = game.user.isGM;
    data.unchainedActionEconomy = game.settings.get("pf1", "unchainedActionEconomy");
    data.hasActivationType =
      (game.settings.get("pf1", "unchainedActionEconomy") && data.unchainedAction.activation.type) ||
      (!game.settings.get("pf1", "unchainedActionEconomy") && data.activation.type);

    // Show additional ranged properties
    data.showMaxRangeIncrements = data.range.units === "ft";

    // Prepare attack specific stuff
    if (data.item.type === "attack") {
      data.isWeaponAttack = data.item.data.attackType === "weapon";
      data.isNaturalAttack = data.item.data.attackType === "natural";
    }

    // Add distance units
    data.distanceUnits = deepClone(CONFIG.PF1.distanceUnits);
    if (this.item.type !== "spell") {
      for (const d of ["close", "medium", "long"]) {
        delete data.distanceUnits[d];
      }
    }

    // Prepare stuff for actions with conditionals
    if (data.conditionals) {
      for (const conditional of data.conditionals) {
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
      flat: a.dataset.flat === "true",
      fields: a.dataset.fields,
      dtypes: a.dataset.dtypes,
    };
    new game.pf1.applications.EntrySelector(this.object, options).render(true);
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
      return game.pf1.documentComponents.ItemConditional.create([{}], { parent: this.object });
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
      return game.pf1.documentComponents.ItemConditionalModifier.create([{}], { parent: conditional });
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
    const k = list.dataset.key || "damage.parts";
    const k2 = k.split(".").slice(0, -1).join(".");
    const k3 = k.split(".").slice(-1).join(".");

    // Add new damage component
    if (a.classList.contains("add-damage")) {
      // Get initial data
      const damageTypeBase = game.pf1.documentComponents.ItemAction.defaultDamageType;
      const initialData = ["", damageTypeBase];

      // Add data
      const damage = getProperty(this.action.data, k2);
      const updateData = {};
      updateData[k] = getProperty(damage, k3).concat([initialData]);
      return this._onSubmit(event, { updateData });
    }

    // Remove a damage component
    if (a.classList.contains("delete-damage")) {
      const li = a.closest(".damage-part");
      const damage = deepClone(getProperty(this.action.data, k2));
      getProperty(damage, k3).splice(Number(li.dataset.damagePart), 1);
      const updateData = {};
      updateData[k] = getProperty(damage, k3);
      return this._onSubmit(event, { updateData });
    }
  }

  async _onClickDamageType(event) {
    event.preventDefault();
    const clickedElement = event.currentTarget;
    let dataPath = clickedElement.dataset.name;
    let targetObj = this.object;

    // Check for conditional
    {
      const conditionalElement = clickedElement.closest(".conditional");
      const modifierElement = clickedElement.closest(".conditional-modifier");
      if (conditionalElement && modifierElement) {
        const conditional = this.object.conditionals.get(conditionalElement.dataset.conditional);
        const modifier = conditional.modifiers.get(modifierElement.dataset.modifier);
        targetObj = modifier;
        dataPath = "damageType";
      }
    }

    const app = new game.pf1.applications.DamageTypeSelector(targetObj, dataPath);
    app.render(true);
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
    const data = JSON.parse(event.originalEvent.dataTransfer.getData("text/plain"));
    if (!data) return;

    const elem = event.currentTarget;
    let link;

    // Case 1 - Document from Compendium Pack
    if (data.pack) {
      const pack = game.packs.get(data.pack);
      if (!pack) return;
      const doc = await pack.getDocument(data.id);
      link = `@Compendium[${data.pack}.${data.id}]{${doc.name}}`;
    }

    // Case 2 - Document from World
    else {
      const config = CONFIG[data.type];
      if (!config) return false;
      const doc = config.collection.instance.get(data.id);
      if (!doc) return false;
      link = `@${data.type}[${doc._id}]{${doc.name}}`;
    }

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
