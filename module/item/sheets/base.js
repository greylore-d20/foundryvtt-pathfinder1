import { createTabs } from "../../lib.js";
import { EntrySelector } from "../../apps/entry-selector.js";
import { ItemPF } from "../entity.js";

/**
 * Override and extend the core ItemSheet implementation to handle D&D5E specific item types
 * @type {ItemSheet}
 */
export class ItemSheetPF extends ItemSheet {
  constructor(...args) {
    super(...args);

    this.options.submitOnClose = false;

    /**
     * Track the set of item filters which are applied
     * @type {Set}
     */
    this._filters = {
    };

    this.items = [];
  }

  /* -------------------------------------------- */

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      width: 580,
      classes: ["pf1", "sheet", "item"],
    });
  }

  /* -------------------------------------------- */

  /**
   * Return a dynamic reference to the HTML template path used to render this Item Sheet
   * @return {string}
   */
  get template() {
    const path = "systems/pf1/templates/items/";
    return `${path}/${this.item.data.type}.html`;
  }

  /* -------------------------------------------- */

  /**
   * Prepare item sheet data
   * Start with the base item data and extending with additional properties for rendering.
   */
  async getData() {
    const data = await super.getData();
    const rollData = this.item.getRollData();
    data.labels = this.item.labels;

    // Include sub-items
    data.items = [];
    if (this.item.items != null) {
      data.items = this.item.items.map(i => {
        i.data.labels = i.labels;
        return i.data;
      });
    }

    // Include CONFIG values
    data.config = CONFIG.PF1;

    // Item Type, Status, and Details
    data.itemType = this._getItemType(data.item);
    data.itemStatus = this._getItemStatus(data.item);
    data.itemProperties = this._getItemProperties(data.item);
    data.itemName = data.item.name;
    data.isPhysical = data.item.data.hasOwnProperty("quantity");
    data.isSpell = this.item.type === "spell";
    data.owned = this.item.actor != null;
    data.owner = this.item.hasPerm(game.user, "OWNER");
    data.isGM = game.user.isGM;
    data.showIdentifyDescription = data.isGM && data.isPhysical;
    data.showUnidentifiedData = this.item.showUnidentifiedData;
    if (rollData.item.auraStrength != null) {
      const auraStrength = rollData.item.auraStrength;
      data.auraStrength = auraStrength;

      if (CONFIG.PF1.auraStrengths[auraStrength] != null) {
        const auraStrength_name = CONFIG.PF1.auraStrengths[auraStrength];
        data.auraStrength_name = auraStrength_name;

        data.labels.identify = game.i18n.localize("PF1.IdentifyDCNumber").format(15 + rollData.item.cl);
        // const auraSchool = CONFIG.PF1.spellSchools[rollData.item.aura.school];
        // data.labels.aura = `${auraStrength_name} ${auraSchool}`;
      }
    }

    // Unidentified data
    if (this.item.showUnidentifiedData) {
      data.itemName = getProperty(this.item.data, "data.unidentified.name") || getProperty(this.item.data, "data.identifiedName") || this.item.name;
    }
    else {
      data.itemName = getProperty(this.item.data, "data.identifiedName") || this.item.name;
    }

    // Action Details
    data.hasAttackRoll = this.item.hasAttack;
    data.isHealing = data.item.data.actionType === "heal";

    data.isCharged = false;
    if (data.item.data.uses != null) {
      data.isCharged = ["day", "week", "charges"].includes(data.item.data.uses.per);
    }
    if (data.item.data.range != null) {
      data.canInputRange = ["ft", "mi", "spec"].includes(data.item.data.range.units);
    }
    if (data.item.data.duration != null) {
      data.canInputDuration = !(["", "inst", "perm", "seeText"].includes(data.item.data.duration.units));
    }

    // Prepare feat specific stuff
    if (data.item.type === "feat") {
      data.isClassFeature = getProperty(this.item.data, "data.featType") === "classFeat";
      data.isTemplate = getProperty(this.item.data, "data.featType") === "template";
    }

    // Prepare weapon specific stuff
    if (data.item.type === "weapon") {
      data.isRanged = (data.item.data.weaponSubtype === "ranged" || data.item.data.properties["thr"] === true);

      // Prepare categories for weapons
      data.weaponCategories = { types: {}, subTypes: {} };
      for (let [k, v] of Object.entries(CONFIG.PF1.weaponTypes)) {
        if (typeof v === "object") data.weaponCategories.types[k] = v._label;
      }
      const type = data.item.data.weaponType;
      if (hasProperty(CONFIG.PF1.weaponTypes, type)) {
        for (let [k, v] of Object.entries(CONFIG.PF1.weaponTypes[type])) {
          // Add static targets
          if (!k.startsWith("_")) data.weaponCategories.subTypes[k] = v;
        }
      }
    }

    // Prepare equipment specific stuff
    if (data.item.type === "equipment") {
      // Prepare categories for equipment
      data.equipmentCategories = { types: {}, subTypes: {} };
      for (let [k, v] of Object.entries(CONFIG.PF1.equipmentTypes)) {
        if (typeof v === "object") data.equipmentCategories.types[k] = v._label;
      }
      const type = data.item.data.equipmentType;
      if (hasProperty(CONFIG.PF1.equipmentTypes, type)) {
        for (let [k, v] of Object.entries(CONFIG.PF1.equipmentTypes[type])) {
          // Add static targets
          if (!k.startsWith("_")) data.equipmentCategories.subTypes[k] = v;
        }
      }

      // Prepare slots for equipment
      data.equipmentSlots = CONFIG.PF1.equipmentSlots[type];

      // Whether the equipment should show armor data
      data.showArmorData = ["armor", "shield"].includes(type);

      // Whether the current equipment type has multiple slots
      data.hasMultipleSlots = Object.keys(data.equipmentSlots).length > 1;
    }

    // Prepare attack specific stuff
    if (data.item.type === "attack") {
      data.isWeaponAttack = data.item.data.attackType === "weapon";
      data.isNaturalAttack = data.item.data.attackType === "natural";
    }

    // Prepare spell specific stuff
    if (data.item.type === "spell") {
      let spellbook = null;
      if (this.actor != null) {
        spellbook = getProperty(this.actor.data, `data.attributes.spells.spellbooks.${this.item.data.data.spellbook}`);
      }

      data.isPreparedSpell = spellbook != null ? !spellbook.spontaneous : false;
      data.isAtWill = data.item.data.atWill;
      data.spellbooks = {};
      if (this.item.actor) {
        data.spellbooks = duplicate(this.item.actor.data.data.attributes.spells.spellbooks);
      }

      // Enrich description
      data.description = TextEditor.enrichHTML(data.data.description.value, { rollData: this.item.getRollData() });
      if (data.data.shortDescription != null) {
        data.shortDescription = TextEditor.enrichHTML(data.data.shortDescription, { rollData: this.item.getRollData() });
      }
    }

    // Prepare class specific stuff
    if (data.item.type === "class") {
      data.isMythicPath = data.data.classType === "mythic";

      for (let [a, s] of Object.entries(data.data.savingThrows)) {
        s.label = CONFIG.PF1.savingThrows[a];
      }
      for (let [a, s] of Object.entries(data.data.fc)) {
        s.label = CONFIG.PF1.favouredClassBonuses[a];
      }

      data.isBaseClass = data.data.classType === "base";
      data.isRacialHD = data.data.classType === "racial";

      if (this.actor != null) {
        let healthConfig  = game.settings.get("pf1", "healthConfig");
        data.healthConfig =  data.isRacialHD ? healthConfig.hitdice.Racial : this.actor.data.type === "character" ? healthConfig.hitdice.PC : healthConfig.hitdice.NPC;
      } else data.healthConfig = {auto: false};

      // Add skill list
      if (!this.item.actor) {
        data.skills = Object.entries(CONFIG.PF1.skills).reduce((cur, o) => {
          cur[o[0]] = { name: o[1], classSkill: getProperty(this.item.data, `data.classSkills.${o[0]}`) === true };
          return cur;
        }, {});
      }
      else {
        data.skills = Object.entries(this.item.actor.data.data.skills).reduce((cur, o) => {
          const key = o[0];
          const name = CONFIG.PF1.skills[key] != null ? CONFIG.PF1.skills[key] : o[1].name;
          cur[o[0]] = { name: name, classSkill: getProperty(this.item.data, `data.classSkills.${o[0]}`) === true };
          return cur;
        }, {});
      }
    }

    // Prepare stuff for items with changes
    if (data.item.data.changes) {
      data.changes = { targets: {}, modifiers: CONFIG.PF1.bonusModifiers };
      for (let [k, v] of Object.entries(CONFIG.PF1.buffTargets)) {
        if (typeof v === "object") data.changes.targets[k] = v._label;
      }
      data.item.data.changes.forEach(item => {
        item.subTargets = this.item.getChangeSubTargets(item.target);
      });
    }

    // Prepare stuff for attacks with conditionals
    if (data.item.data.conditionals) {
      data.conditionals = { targets: {}, conditionalModifierTypes: {} };
      for (const conditional of data.item.data.conditionals) {
        for (const modifier of conditional.modifiers) {
          modifier.targets = this.item.getConditionalTargets();
          modifier.subTargets = this.item.getConditionalSubTargets(modifier.target);
          modifier.conditionalModifierTypes = this.item.getConditionalModifierTypes(modifier.target)
          modifier.conditionalCritical = this.item.getConditionalCritical(modifier.target);
          modifier.isAttack = modifier.target === "attack";
          modifier.isDamage = modifier.target === "damage";
          modifier.isSpell = modifier.target === "spell";
        }
      }
    }

    // Prepare stuff for items with context notes
    if (data.item.data.contextNotes) {
      data.contextNotes = { targets: {} };
      for (let [k, v] of Object.entries(CONFIG.PF1.contextNoteTargets)) {
        if (typeof v === "object") data.contextNotes.targets[k] = v._label;
      }
      data.item.data.contextNotes.forEach(item => {
        item.subNotes = this.item.getContextNoteSubTargets(item.target);
      });
    }

    // Add links
    await this._prepareLinks(data);

    return data;
  }

  async _prepareLinks(data) {

    data.links = {
      list: [],
    };

    // Add children link type
    data.links.list.push({
      id: "children",
      label: game.i18n.localize("PF1.LinkTypeChildren"),
      help: game.i18n.localize("PF1.LinkHelpChildren"),
      items: [],
    });

    // Add charges link type
    if (["feat", "consumable", "attack"].includes(this.item.type)) {
      data.links.list.push({
        id: "charges",
        label: game.i18n.localize("PF1.LinkTypeCharges"),
        help: game.i18n.localize("PF1.LinkHelpCharges"),
        items: [],
      });
    }

    // Add class associations
    if (this.item.type === "class") {
      data.links.list.push({
        id: "classAssociations",
        label: game.i18n.localize("PF1.LinkTypeClassAssociations"),
        help: game.i18n.localize("PF1.LinkHelpClassAssociations"),
        fields: {
          level: {
            type: "Number",
            label: game.i18n.localize("PF1.Level"),
          },
        },
        items: [],
      });
    }

    // Add ammunition links
    if (this.item.type === "attack") {
      data.links.list.push({
        id: "ammunition",
        label: game.i18n.localize("PF1.LinkTypeAmmunition"),
        help: game.i18n.localize("PF1.LinkHelpAmmunition"),
        fields: {
          recoverChance: {
            type: "Number",
            label: game.i18n.localize("PF1.RecoverChancePercentage"),
          },
        },
        items: [],
      });
    }

    // Post process data
    for (let l of data.links.list) {
      const items = getProperty(this.item.data, `data.links.${l.id}`) || [];
      for (let a = 0; a < items.length; a++) {
        const i = items[a];
        i._index = a;

        // Add item to stack
        l.items.push(i);
      }

      // Sort items
      if (l.id === "classAssociations") {
        l.items = l.items.sort((a, b) => {
          return a.level - b.level;
        });
      }
    }

    await this.item.updateLinkItems();
  }

  /* -------------------------------------------- */

  /**
   * Get the text item type which is shown in the top-right corner of the sheet
   * @return {string}
   * @private
   */
  _getItemType(item) {
    let typeKeys = Object.keys(CONFIG.PF1.itemTypes);
    let itemType = item.type;
    if (!typeKeys.includes(itemType)) itemType = typeKeys[0];
    return game.i18n.localize(CONFIG.PF1.itemTypes[itemType]);
  }

  /**
   * Get the text item status which is shown beneath the Item type in the top-right corner of the sheet
   * @return {string}
   * @private
   */
  _getItemStatus(item) {
    if ( item.type === "spell" ) {
      const spellbook = this.item.spellbook;
      if (item.data.preparation.mode === "prepared") {
        if (item.data.preparation.preparedAmount > 0) {
          if (spellbook != null && spellbook.spontaneous) {
            return game.i18n.localize("PF1.SpellPrepPrepared");
          }
          else {
            return game.i18n.localize("PF1.AmountPrepared").format(item.data.preparation.preparedAmount);
          }
        }
        return game.i18n.localize("PF1.Unprepared");
      }
      else if (item.data.preparation.mode) {
        return item.data.preparation.mode.titleCase();
      }
      else return "";
    }
    else if ( ["weapon", "equipment"].includes(item.type) ) return item.data.equipped ? game.i18n.localize("PF1.Equipped") : game.i18n.localize("PF1.NotEquipped");
  }

  /* -------------------------------------------- */

  /**
   * Get the Array of item properties which are used in the small sidebar of the description tab
   * @return {Array}
   * @private
   */
  _getItemProperties(item) {
    const props = [];
    const labels = this.item.labels;

    if ( item.type === "weapon" ) {
      props.push(...Object.entries(item.data.properties)
        .filter(e => e[1] === true)
        .map(e => CONFIG.PF1.weaponProperties[e[0]]));
    }

    else if ( item.type === "spell" ) {
      props.push(
        labels.components,
        labels.materials
      )
    }

    else if ( item.type === "equipment" ) {
      props.push(CONFIG.PF1.equipmentTypes[item.data.armor.type]);
      props.push(labels.armor);
    }

    else if ( item.type === "feat" ) {
      props.push(labels.featType);
    }

    // Action type
    if ( item.data.actionType ) {
      props.push(CONFIG.PF1.itemActionTypes[item.data.actionType]);
    }

    // Action usage
    if ( (item.type !== "weapon") && item.data.activation && !isObjectEmpty(item.data.activation) ) {
      props.push(
        labels.activation,
        labels.range,
        labels.target,
        labels.duration
      )
    }

    // Tags
    if (getProperty(item, "data.tags") != null) {
      props.push(...getProperty(item, "data.tags").map(o => {
        return o[0];
      }));
    }

    return props.filter(p => !!p);
  }

  /* -------------------------------------------- */

  setPosition(position={}) {
    // if ( this._sheetTab === "details" ) position.height = "auto";
    return super.setPosition(position);
  }

  /* -------------------------------------------- */
  /*  Form Submission                             */
  /* -------------------------------------------- */

  /**
   * Extend the parent class _updateObject method to ensure that damage ends up in an Array
   * @private
   */
  async _updateObject(event, formData) {
    // Handle Damage Array
    let damage = Object.entries(formData).filter(e => e[0].startsWith("data.damage.parts"));
    formData["data.damage.parts"] = damage.reduce((arr, entry) => {
      let [i, j] = entry[0].split(".").slice(3);
      if ( !arr[i] ) arr[i] = [];
      arr[i][j] = entry[1];
      return arr;
    }, []);

    // Handle Critical Damage Array
    let critDamage = Object.entries(formData).filter(e => e[0].startsWith("data.damage.critParts"));
    formData["data.damage.critParts"] = critDamage.reduce((arr, entry) => {
      let [i, j] = entry[0].split(".").slice(3);
      if ( !arr[i] ) arr[i] = [];
      arr[i][j] = entry[1];
      return arr;
    }, []);

    // Handle Non-critical Damage Array
    let nonCritDamage = Object.entries(formData).filter(e => e[0].startsWith("data.damage.nonCritParts"));
    formData["data.damage.nonCritParts"] = nonCritDamage.reduce((arr, entry) => {
      let [i, j] = entry[0].split(".").slice(3);
      if ( !arr[i] ) arr[i] = [];
      arr[i][j] = entry[1];
      return arr;
    }, []);

    // Handle Attack Array
    let attacks = Object.entries(formData).filter(e => e[0].startsWith("data.attackParts"));
    formData["data.attackParts"] = attacks.reduce((arr, entry) => {
      let [i, j] = entry[0].split(".").slice(2);
      if ( !arr[i] ) arr[i] = [];
      arr[i][j] = entry[1];
      return arr;
    }, []);

    // Handle change array
    let change = Object.entries(formData).filter(e => e[0].startsWith("data.changes"));
    formData["data.changes"] = change.reduce((arr, entry) => {
      let [i, j] = entry[0].split(".").slice(2);
      if ( !arr[i] ) arr[i] = ItemPF.defaultChange;
      arr[i][j] = entry[1];
      // Reset subtarget (if necessary)
      if (j === "subTarget") {
        const target = (change.find(o => o[0] === `data.changes.${i}.target`) || [])[1];
        const subTarget = entry[1];
        if (typeof target === "string") {
          const keys = Object.keys(this.item.getChangeSubTargets(target));
          if (!keys.includes(subTarget)) arr[i][j] = keys[0];
        }
      }
      // Limit priority
      if (j === "priority") {
        const prio = Math.max(-1000, Math.min(1000, entry[1]));
        arr[i][j] = prio;
      }
      return arr;
    }, []);

    // Handle conditionals array
    let conditionals = Object.entries(formData).filter(e => e[0].startsWith("data.conditionals"));
    formData["data.conditionals"] = conditionals.reduce((arr, entry) => {
      let [i, j, k] = entry[0].split(".").slice(2);
      if ( !arr[i] ) arr[i] = ItemPF.defaultConditional;
      if (k) {
        const target = formData[`data.conditionals.${i}.${j}.target`];
        if ( !arr[i].modifiers[j] ) arr[i].modifiers[j] = ItemPF.defaultConditionalModifier;
        arr[i].modifiers[j][k] = entry[1];
        // Target dependent keys
        if (["subTarget", "critical", "type"].includes(k)) {
          const target = (conditionals.find(o => o[0] === `data.conditionals.${i}.${j}.target`) || [])[1];
          const val = entry[1];
          if (typeof target === "string") {
            let keys;
            switch (k) {
              case "subTarget":
                keys = Object.keys(this.item.getConditionalSubTargets(target));
                break;
              case "type":
                keys = Object.keys(this.item.getConditionalModifierTypes(target));
                break;
              case "critical":
                keys = Object.keys(this.item.getConditionalCritical(target));
                break;
            }
            // Reset subTarget, non-damage type, and critical if necessary
            if (!keys.includes(val) && (target !== "damage" && k !== "type")) arr[i].modifiers[j][k] = keys[0];
          }
        }
      } else {
        arr[i][j] = entry[1];
      }
      return arr;
    }, []);

    // Handle notes array
    let note = Object.entries(formData).filter(e => e[0].startsWith("data.contextNotes"));
    formData["data.contextNotes"] = note.reduce((arr, entry) => {
      let [i, j] = entry[0].split(".").slice(2);
      if ( !arr[i] ) arr[i] = {};
      arr[i][j] = entry[1];
      // Reset subtarget (if necessary)
      if (j === "subTarget") {
        const target = (note.find(o => o[0] === `data.contextNotes.${i}.target`) || [])[1];
        const subTarget = entry[1];
        if (typeof target === "string") {
          const keys = Object.keys(this.item.getContextNoteSubTargets(target));
          if (!keys.includes(subTarget)) arr[i][j] = keys[0];
        }
      }
      // }
      return arr;
    }, []);

    // Handle links arrays
    let links = Object.entries(formData).filter(e => e[0].startsWith("data.links"));
    for (let e of links) {
      const path = e[0].split(".");
      const linkType = path[2];
      const index = path[3];
      const subPath = path.slice(4).join(".");
      const value = e[1];

      delete formData[e[0]];

      if (!formData[`data.links.${linkType}`]) formData[`data.links.${linkType}`] = duplicate(getProperty(this.item.data, `data.links.${linkType}`));

      setProperty(formData[`data.links.${linkType}`][index], subPath, value);
    }

    // Update the Item
    return super._updateObject(event, formData);
  }

  /* -------------------------------------------- */

  /**
   * Activate listeners for interactive item sheet events
   */
  activateListeners(html) {
    super.activateListeners(html);

    // Activate tabs
    const tabGroups = {
      "primary": {
        "description": {},
        "links": {},
      },
    };
    createTabs.call(this, html, tabGroups);

    // Tooltips
    html.mousemove(ev => this._moveTooltips(ev));

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Trigger form submission from textarea elements.
    html.find("textarea").change(this._onSubmit.bind(this));

    // Add drop handler to textareas
    html.find("textarea").on("drop", this._onTextAreaDrop.bind(this));

    // Modify attack formula
    html.find(".attack-control").click(this._onAttackControl.bind(this));

    // Modify damage formula
    html.find(".damage-control").click(this._onDamageControl.bind(this));

    // Modify buff changes
    html.find(".change-control").click(this._onBuffControl.bind(this));

    // Modify note changes
    html.find(".context-note-control").click(this._onNoteControl.bind(this));

    // Create attack
    if (["weapon"].includes(this.item.data.type)) {
      html.find("button[name='create-attack']").click(this._createAttack.bind(this));
    }

    // Modify conditionals
    html.find(".conditional-control").click(this._onConditionalControl.bind(this));

    // Listen to field entries
    html.find(".entry-selector").click(this._onEntrySelector.bind(this));

    // Add drop handler to link tabs
    html.find('div[data-group="links"]').on("drop", this._onLinksDrop.bind(this));

    html.find(".link-control").click(this._onLinkControl.bind(this));

    // Handle alternative file picker
    html.find(".file-picker-alt").click(this._onFilePickerAlt.bind(this));
  }

  /* -------------------------------------------- */

  _moveTooltips(event) {
    const elem = $(event.currentTarget);
    const x = event.clientX;
    const y = event.clientY + 24;
    elem.find(".tooltip:hover .tooltipcontent").css("left", `${x}px`).css("top", `${y}px`);
  }

  async _onTextAreaDrop(event) {
    event.preventDefault();
	  const data = JSON.parse(event.originalEvent.dataTransfer.getData('text/plain'));
    if ( !data ) return;
    
    const elem = event.currentTarget;
    let link;

	  // Case 1 - Entity from Compendium Pack
    if ( data.pack ) {
      const pack = game.packs.get(data.pack);
      if (!pack) return;
      const entity = await pack.getEntity(data.id);
      link = `@Compendium[${data.pack}.${data.id}]{${entity.name}}`;
    }

    // Case 2 - Entity from World
    else {
      const config = CONFIG[data.type];
      if ( !config ) return false;
      const entity = config.collection.instance.get(data.id);
      if ( !entity ) return false;
      link = `@${data.type}[${entity._id}]{${entity.name}}`
    }

    // Insert link
    if (link) {
      elem.value = !elem.value ? link : elem.value + "\n" + link;
    }
    return this._onSubmit(event);
  }

  async _onLinksDrop(event) {
    const elem = event.currentTarget;
    const linkType = elem.dataset.tab;
    
    // Try to extract the data
    let data;
    try {
      data = JSON.parse(event.originalEvent.dataTransfer.getData('text/plain'));
      if (data.type !== "Item") return;
    } catch (err) {
      return false;
    }

    let targetItem;
    let dataType = "";
    let itemLink = "";

    // Case 1 - Import from a Compendium pack
    if (data.pack) {
      dataType = "compendium";
      const pack = game.packs.find(p => p.collection === data.pack);
      const packItem = await pack.getEntity(data.id);
      if (packItem != null) {
        targetItem = packItem;
        itemLink = `${pack.collection}.${packItem._id}`;
      }
    }

    // Case 2 - Data explicitly provided; check same actor for item
    else if (data.data) {
      dataType = "data";
      if (this.item && this.item.actor) {
        targetItem = this.item.actor.items.find(o => o._id === data.data._id);
      }
      itemLink = data.data._id;
    }

    // Case 3 - Import from World entity
    else {
      dataType = "world";
      targetItem = game.items.get(data.id);
      itemLink = `world.${data.id}`;
    }

    await this.item.createItemLink(linkType, dataType, targetItem, itemLink);
  }

  /**
   * @param {string} linkType - The type of link.
   * @param {string} dataType - Either "compendium", "data" or "world".
   * @param {Object} itemData - The (new) item's data.
   * @param {string} itemLink - The link identifier for the item.
   * @param {Object} [data] - The raw data from a drop event.
   * @returns {boolean} Whether a link to the item is possible here.
   */
  canCreateLink(linkType, dataType, itemData, itemLink, data=null) {
    const actor = this.item.actor;
    const sameActor = actor != null && data != null && data.actorId === actor._id;

    // Don't create link to self
    const itemId = itemLink.split(".").slice(-1)[0];
    if (itemId === this.item._id) return false;

    // Don't create existing links
    const links = getProperty(this.item.data, `data.links.${linkType}`) || [];
    if (links.filter(o => o.id === itemLink).length) return false;

    if (["children", "charges", "ammunition"].includes(linkType) && sameActor) return true;

    if (linkType === "classAssociations" && dataType === "compendium") return true;

    return false;
  }

  /**
   * @param {string} linkType - The type of link.
   * @param {string} dataType - Either "compendium", "data" or "world".
   * @param {Object} itemData - The (new) item's data.
   * @param {string} itemLink - The link identifier for the item.
   * @param {Object} [data] - The raw data from a drop event.
   * @returns {Array} An array to insert into this item's link data.
   */
  generateInitialLinkData(linkType, dataType, itemData, itemLink, data=null) {

    const result = {
      id: itemLink,
      dataType: dataType,
      name: itemData.name,
      img: itemData.img,
      hiddenLinks: {},
    };

    if (linkType === "classAssociations") {
      result.level = 1;
    }

    if (linkType === "ammunition") {
      result.recoverChance = 50;
    }

    return result;
  }

  /**
   * Add or remove a damage part from the damage formula
   * @param {Event} event     The original click event
   * @return {Promise}
   * @private
   */
  async _onDamageControl(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const list = a.closest(".damage");
    const k = list.dataset.key || "data.damage.parts";
    const k2 = k.split(".").slice(0, -1).join(".");
    const k3 = k.split(".").slice(-1).join(".");

    // Add new damage component
    if ( a.classList.contains("add-damage") ) {
      // Get initial data
      const initialData = ["", ""];

      // Add data
      await this._onSubmit(event);  // Submit any unsaved changes
      const damage = getProperty(this.item.data, k2);
      const updateData = {};
      updateData[k] = getProperty(damage, k3).concat([initialData]);
      return this.item.update(updateData);
    }

    // Remove a damage component
    if ( a.classList.contains("delete-damage") ) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const li = a.closest(".damage-part");
      const damage = duplicate(getProperty(this.item.data, k2));
      getProperty(damage, k3).splice(Number(li.dataset.damagePart), 1);
      const updateData = {};
      updateData[k] = getProperty(damage, k3);
      return this.item.update(updateData);
    }
  }

  async _onAttackControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new attack component
    if ( a.classList.contains("add-attack") ) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const attackParts = this.item.data.data.attackParts;
      return this.item.update({"data.attackParts": attackParts.concat([["", ""]])});
    }

    // Remove an attack component
    if ( a.classList.contains("delete-attack") ) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const li = a.closest(".attack-part");
      const attackParts = duplicate(this.item.data.data.attackParts);
      attackParts.splice(Number(li.dataset.attackPart), 1);
      return this.item.update({"data.attackParts": attackParts});
    }
  }

  async _onBuffControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new change
    if (a.classList.contains("add-change")) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const changes = this.item.data.data.changes || [];
      return this.item.update({"data.changes": changes.concat([ItemPF.defaultChange])});
    }

    // Remove a change
    if (a.classList.contains("delete-change")) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const li = a.closest(".change");
      const changes = duplicate(this.item.data.data.changes);
      changes.splice(Number(li.dataset.change), 1);
      return this.item.update({"data.changes": changes});
    }
  }

  async _onConditionalControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new conditional
    if (a.classList.contains("add-conditional")) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const conditionals = this.item.data.data.conditionals || [];
      return this.item.update({"data.conditionals": conditionals.concat([ItemPF.defaultConditional])});
    }

    // Remove a conditional
    if (a.classList.contains("delete-conditional")) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const li = a.closest(".conditional");
      const conditionals = duplicate(this.item.data.data.conditionals);
      conditionals.splice(Number(li.dataset.conditional), 1);
      return this.item.update({"data.conditionals": conditionals});
    }

    // Add a new conditional modifier
    if (a.classList.contains("add-conditional-modifier")) {
      await this._onSubmit(event);
      const li = a.closest(".conditional");
      const conditionals = this.item.data.data.conditionals;
      conditionals[Number(li.dataset.conditional)].modifiers.push(ItemPF.defaultConditionalModifier);
      // duplicate object to ensure update
      return this.item.update({"data.conditionals": duplicate(conditionals)});
    }

    // Remove a conditional modifier
    if (a.classList.contains("delete-conditional-modifier")) {
      await this._onSubmit(event);
      const li = a.closest(".conditional-modifier");
      const conditionals = duplicate(this.item.data.data.conditionals);
      conditionals[Number(li.dataset.conditional)].modifiers.splice(Number(li.dataset.modifier), 1);
      return this.item.update({"data.conditionals": conditionals});
    }
  }

  async _onNoteControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Add new note
    if (a.classList.contains("add-note")) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const contextNotes = this.item.data.data.contextNotes || [];
      return this.item.update({"data.contextNotes": contextNotes.concat([ItemPF.defaultContextNote])});
    }

    // Remove a note
    if (a.classList.contains("delete-note")) {
      await this._onSubmit(event);  // Submit any unsaved changes
      const li = a.closest(".context-note");
      const contextNotes = duplicate(this.item.data.data.contextNotes);
      contextNotes.splice(Number(li.dataset.note), 1);
      return this.item.update({"data.contextNotes": contextNotes});
    }
  }

  async _onLinkControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Delete link
    if (a.classList.contains("delete-link")) {
      await this._onSubmit(event);
      const li = a.closest(".links-item");
      const group = a.closest('div[data-group="links"]');
      let links = duplicate(getProperty(this.item.data, `data.links.${group.dataset.tab}`) || []);
      const link = links.find(o => o.id === li.dataset.link);
      links = links.filter(o => o !== link);

      const updateData = {};
      updateData[`data.links.${group.dataset.tab}`] = links;

      // Call hook for deleting a link
      Hooks.call("deleteItemLink", this.item, link, group.dataset.tab);

      await this.item.update(updateData);

      // Clean link
      this.item._cleanLink(link, group.dataset.tab);
      game.socket.emit("system.pf1", { eventType: "cleanItemLink", actorUUID: this.item.actor.uuid, itemUUID: this.item.uuid, link: link, linkType: group.dataset.tab });
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
      callback: path => {
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

  async _createAttack(event) {
    if (this.item.actor == null) throw new Error(game.i18n.localize("PF1.ErrorItemNoOwner"));

    await this._onSubmit(event);

    await this.item.actor.createAttackFromWeapon(this.item);
  }

  _onEntrySelector(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const options = {
      name: a.getAttribute("for"),
      title: a.innerText,
      fields: a.dataset.fields,
      dtypes: a.dataset.dtypes,
    };
    new EntrySelector(this.item, options).render(true);
  }

  async saveMCEContent(updateData=null) {
    let manualUpdate = false;
    if (updateData == null) {
      manualUpdate = true;
      updateData = {};
    }

    for (const [key, editor] of Object.entries(this.editors)) {
      if (editor.mce == null) continue;

      updateData[key] = editor.mce.getContent();
    }

    if (manualUpdate && Object.keys(updateData).length > 0) await this.item.update(updateData);
  }
}
