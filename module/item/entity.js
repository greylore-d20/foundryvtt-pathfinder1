import { DicePF } from "../dice.js";
import { createCustomChatMessage } from "../chat.js";
import { createTag, alterRoll, linkData, isMinimumCoreVersion, convertDistance, convertWeight, convertWeightBack } from "../lib.js";
import { ActorPF } from "../actor/entity.js";
import { AbilityTemplate } from "../pixi/ability-template.js";
import { ChatAttack } from "../misc/chat-attack.js";

/**
 * Override and extend the basic :class:`Item` implementation
 */
export class ItemPF extends Item {

  constructor(...args) {
    super(...args);

    /**
     * @property {Object} _prevData
     * When an item gets updated, certain data is stored here for use in _onUpdate.
     */
    this._prevData = {};

    /**
     * @property {Object} links
     * Links are stored here during runtime.
     */
    this.links = {};
  }

  static isInventoryItem(type) {
    return ["weapon", "equipment", "consumable", "loot"].includes(type);
  }

  /* -------------------------------------------- */
  /*  Item Properties                             */
  /* -------------------------------------------- */

  /**
   * Does the Item implement an attack roll as part of its usage
   * @type {boolean}
   */
  get hasAttack() {
    return ["mwak", "rwak", "msak", "rsak"].includes(this.data.data.actionType);
  }

  get hasMultiAttack() {
    return this.hasAttack && this.data.data.attackParts != null && this.data.data.attackParts.length > 0;
  }

  get hasTemplate() {
    const v = getProperty(this.data, "data.measureTemplate.type");
    const s = getProperty(this.data, "data.measureTemplate.size");
    return (typeof v === "string" && v !== "") && ((typeof s === "string" && s.length > 0) || (typeof s === "number" && s > 0));
  }

  get hasAction() {
    return this.hasAttack
    || this.hasDamage
    || this.hasEffect
    || this.hasTemplate;
  }

  get isSingleUse() {
    return getProperty(this.data, "data.uses.per") === "single";
  }

  get isCharged() {
    if (this.type === "consumable" && getProperty(this.data, "data.uses.per") === "single") return true;
    return ["day", "week", "charges"].includes(getProperty(this.data, "data.uses.per"));
  }

  get autoDeductCharges() {
    return this.type === "spell"
      ? getProperty(this.data, "data.preparation.autoDeductCharges") === true
      : (this.isCharged && getProperty(this.data, "data.uses.autoDeductCharges") === true);
  }

  get charges() {
    // Get linked charges
    const link = getProperty(this, "links.charges");
    if (link) return link.charges;

    // Get own charges
    if (getProperty(this.data, "data.uses.per") === "single") return getProperty(this.data, "data.quantity");
    if (this.type === "spell") return this.getSpellUses();
    return getProperty(this.data, "data.uses.value") || 0;
  }

  get chargeCost() {
    if (this.type === "spell") return 1;
    
    const formula = getProperty(this.data, "data.uses.autoDeductChargesCost");
    if (!(typeof formula === "string" && formula.length > 0)) return 1;
    const cost = new Roll(formula, this.getRollData()).roll().total;
    return cost;
  }

  get spellbook() {
    if (this.type !== "spell") return null;
    if (this.actor == null)    return null;
    
    const spellbookIndex = this.data.data.spellbook;
    return this.actor.data.data.attributes.spells.spellbooks[spellbookIndex];
  }

  get casterLevel() {
    const spellbook = this.spellbook;
    if (!spellbook) return null;

    return spellbook.cl.total + (this.data.data.clOffset || 0);
  }

  get spellLevel() {
    if (this.type !== "spell") return null;

    return this.data.data.level + (this.data.data.slOffset || 0);
  }

  /**
   * @param {Object} [rollData] - Data to pass to the roll. If none is given, get new roll data.
   * @returns {Number} The Difficulty Class for this item.
   */
  getDC(rollData=null) {
    if (!rollData) rollData = this.getRollData();
    const data = this.data.data;

    if (this.type === "spell") {
      const spellbook = this.spellbook;
      if (spellbook != null) {
        return new Roll(spellbook.baseDCFormula, rollData).roll().total + new Roll(data.save.dc.length > 0 ? data.save.dc : "0", rollData).roll().total;
      }
    }
    const dcFormula = getProperty(data, "save.dc") || "";
    return new Roll(dcFormula.length > 0 ? data.save.dc : "0", rollData).roll().total;
  }

  /**
   * @param {String} type - The item type (such as "attack" or "equipment")
   * @param {Number} colorType - 0 for the primary color, 1 for the secondary color
   * @returns {String} A color hex, in the format "#RRGGBB"
   */
  static getTypeColor(type, colorType) {
    switch (colorType) {
      case 0:
        switch (type) {
          case "feat":
            return "#8900EA";
          case "spell":
            return "#5C37FF";
          case "class":
            return "#85B1D2";
          case "race":
            return "#00BD29";
          case "attack":
            return "#F21B1B";
          case "weapon":
          case "equipment":
          case "consumable":
          case "loot":
            return "#E5E5E5";
          case "buff":
            return "#FDF767";
          default: return "#FFFFFF";
        }
      case 1:
        switch (type) {
          case "feat":
            return "#5F00A3";
          case "spell":
            return "#4026B2";
          case "class":
            return "#6A8DA8";
          case "race":
            return "#00841C";
          case "attack":
            return "#A91212";
          case "weapon":
          case "equipment":
          case "consumable":
          case "loot":
            return "#B7B7B7";
          case "buff":
            return "#FDF203";
          default:
            return "#C1C1C1";
        }
    }

    return "#FFFFFF";
  }

  get typeColor() {
    return this.constructor.getTypeColor(this.type, 0);
  }

  get typeColor2() {
    return this.constructor.getTypeColor(this.type, 1);
  }

  static get defaultChange() {
    return {
      formula: "",
      operator: "add",
      target: "",
      subTarget: "",
      modifier: "",
      priority: 0,
      value: 0,
    };
  }

  static get defaultContextNote() {
    return {
      text: "",
      target: "",
      subTarget: "",
    };
  }

  /**
   * Generic charge addition (or subtraction) function that either adds charges
   * or quantity, based on item data.
   * @param {number} value       - The amount of charges to add.
   * @returns {Promise}
   */
  async addCharges(value) {
    // Add link charges
    const link = getProperty(this, "links.charges");
    if (link) return link.addCharges(value);

    // Add own charges
    if ( getProperty(this.data, "data.uses.per") === "single"
      && getProperty(this.data, "data.quantity") == null) return;

    if (this.type === "spell") return this.addSpellUses(value);

    let prevValue = this.isSingleUse ? getProperty(this.data, "data.quantity") : getProperty(this.data, "data.uses.value");

    if (this.isSingleUse) await this.update({ "data.quantity"  : prevValue + value });
    else                  await this.update({ "data.uses.value": prevValue + value });
  }

  /* -------------------------------------------- */

  /**
   * Does the Item implement a damage roll as part of its usage
   * @type {boolean}
   */
  get hasDamage() {
    return !!(this.data.data.damage && this.data.data.damage.parts.length);
  }

  /* -------------------------------------------- */

  /**
   * Does the item provide an amount of healing instead of conventional damage?
   * @return {boolean}
   */
  get isHealing() {
    return (this.data.data.actionType === "heal") && this.data.data.damage.parts.length;
  }

  get hasEffect() {
    return this.hasDamage || (this.data.data.effectNotes && this.data.data.effectNotes.length > 0);
  }

  /* -------------------------------------------- */

  /**
   * Does the Item implement a saving throw as part of its usage
   * @type {boolean}
   */
  get hasSave() {
    return !!(this.data.data.save && this.data.data.save.ability);
  }

  /**
   * Should the item show unidentified data
   * @type {boolean}
   */
  get showUnidentifiedData() {
    return (!game.user.isGM && getProperty(this.data, "data.identified") === false);
  }

  /* -------------------------------------------- */
  /*	Data Preparation														*/
  /* -------------------------------------------- */

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    super.prepareData();

    const itemData = this.data;
    const data = itemData.data;
    const C = CONFIG.PF1;
    const labels = {};

    // Physical items
    if (hasProperty(itemData, "data.weight")) {
      // Sync name
      if (!hasProperty(this.data, "data.identifiedName")) setProperty(this.data, "data.identifiedName", this.name);
      // Prepare unidentified cost
      if (!hasProperty(this.data, "data.unidentified.price")) setProperty(this.data, "data.unidentified.price", 0);

      // Convert weight according metric system (lb vs kg)
      itemData.data.weightConverted = convertWeight(itemData.data.weight)
      itemData.data.weightUnits = game.settings.get("pf1", "units") === "metric" ? game.i18n.localize("PF1.Kgs") : game.i18n.localize("PF1.Lbs")
      itemData.data.priceUnits = game.i18n.localize("PF1.CurrencyGP").toLowerCase()
      
      // Set basic data
      itemData.data.hp = itemData.data.hp || { max: 10, value: 10 };
      itemData.data.hardness = itemData.data.hardness || 0;
      itemData.data.carried = itemData.data.carried == null ? true : itemData.data.carried;

      // Equipped label
      labels.equipped = "";
      if (itemData.data.equipped === true) labels.equipped = game.i18n.localize("PF1.Yes");
      else labels.equipped = game.i18n.localize("PF1.No");

      // Carried label
      labels.carried = "";
      if (itemData.data.carried === true) labels.carried = game.i18n.localize("PF1.Yes");
      else labels.carried = game.i18n.localize("PF1.No");

      // Identified label
      labels.identified = "";
      if (itemData.data.identified === true) labels.identified = game.i18n.localize("PF1.YesShort");
      else labels.identified = game.i18n.localize("PF1.NoShort");

      // Slot label
      if (itemData.data.slot) {
        // Add equipment slot
        const equipmentType = getProperty(this.data, "data.equipmentType") || null;
        if (equipmentType != null) {
          const equipmentSlot = getProperty(this.data, "data.slot") || null;
          labels.slot = equipmentSlot == null ? null : CONFIG.PF1.equipmentSlots[equipmentType][equipmentSlot];
        }
        else labels.slot = null;
      }
    }

    // Spell Level,  School, and Components
    if ( itemData.type === "spell" ) {
      labels.level = C.spellLevels[data.level];
      labels.school = C.spellSchools[data.school];
      labels.components = Object.entries(data.components).map(c => {
        c[1] === true ? c[0].titleCase().slice(0,1) : null
      }).filterJoin(",");
    }

    // Feat Items
    else if ( itemData.type === "feat" ) {
      labels.featType = C.featTypes[data.featType];

      // Ability type
      if (data.abilityType && data.abilityType !== "none") {
        labels.abilityType = C.abilityTypes[data.abilityType].short;
      }
      else if (labels.abilityType) {
        delete labels.abilityType;
      }
    }

    // Buff Items
    else if (itemData.type === "buff") {
      labels.buffType = C.buffTypes[data.buffType];
    }

    // Weapon Items
    else if (itemData.type === "weapon") {
      // Type and subtype labels
      let wType = getProperty(this.data, "data.weaponType");
      let typeKeys = Object.keys(C.weaponTypes);
      if (!typeKeys.includes(wType)) wType = typeKeys[0];

      let wSubtype = getProperty(this.data, "data.weaponSubtype");
      let subtypeKeys = Object.keys(C.weaponTypes[wType]).filter(o => !o.startsWith("_"));
      if (!subtypeKeys.includes(wSubtype)) wSubtype = subtypeKeys[0];

      labels.weaponType = C.weaponTypes[wType]._label;
      labels.weaponSubtype = C.weaponTypes[wType][wSubtype];
    }

    // Equipment Items
    else if (itemData.type === "equipment") {
      // Type and subtype labels
      let eType = getProperty(this.data, "data.equipmentType");
      let typeKeys = Object.keys(C.equipmentTypes);
      if (!typeKeys.includes(eType)) eType = typeKeys[0];

      let eSubtype = getProperty(this.data, "data.equipmentSubtype");
      let subtypeKeys = Object.keys(C.equipmentTypes[eType]).filter(o => !o.startsWith("_"));
      if (!subtypeKeys.includes(eSubtype)) eSubtype = subtypeKeys[0];

      labels.equipmentType = C.equipmentTypes[eType]._label;
      labels.equipmentSubtype = C.equipmentTypes[eType][eSubtype];

      // AC labels
      labels.armor = data.armor.value ? `${data.armor.value} AC` : "";
      if (data.armor.dex === "") data.armor.dex = null;
      else if (typeof data.armor.dex === "string" && /\d+/.test(data.armor.dex)) {
        data.armor.dex = parseInt(data.armor.dex);
      }
      // Add enhancement bonus
      if (data.armor.enh == null) data.armor.enh = 0;
    }

    // Activated Items
    if ( data.hasOwnProperty("activation") ) {

      // Ability Activation Label
      let act = data.activation || {};
      if (act) labels.activation = [["minute", "hour"].includes(act.type) ? act.cost.toString() : "", C.abilityActivationTypes[act.type]].filterJoin(" ");

      // Target Label
      let tgt = data.target || {};
      if (["none", "touch", "personal"].includes(tgt.units)) tgt.value = null;
      if (["none", "personal"].includes(tgt.type)) {
        tgt.value = null;
        tgt.units = null;
      }
      labels.target = [tgt.value, C.distanceUnits[tgt.units], C.targetTypes[tgt.type]].filterJoin(" ");
      if (labels.target) labels.target = `Target: ${labels.target}`;

      // Range Label
      let rng = data.range || {};
      if (!["ft", "mi", "spec"].includes(rng.units)) {
        rng.value = null;
        rng.long = null;
      }
      labels.range = [rng.value, rng.long ? `/ ${rng.long}` : null, C.distanceUnits[rng.units]].filterJoin(" ");
      if (labels.range.length > 0) labels.range = ["Range:", labels.range].join(" ");

      // Duration Label
      let dur = data.duration || {};
      if (["inst", "perm", "spec"].includes(dur.units)) dur.value = null;
      labels.duration = [dur.value, C.timePeriods[dur.units]].filterJoin(" ");
    }

    // Item Actions
    if ( data.hasOwnProperty("actionType") ) {
      // Save DC
      let save = data.save || {};
      if (save.type) {
        labels.save = `DC ${this.getDC()}`;
      }

      // Damage
      let dam = data.damage || {};
      if ( dam.parts ) {
        labels.damage = dam.parts.map(d => d[0]).join(" + ").replace(/\+ -/g, "- ");
        labels.damageTypes = dam.parts.map(d => d[1]).join(", ");
      }

      // Add attack parts
      if (!data.attack) data.attack = { parts: [] };
    }

    // Assign labels
    this.labels = labels;

    this.prepareLinks();
  }

  prepareLinks() {
    if (!this.links) return;

    for (let [k, i] of Object.entries(this.links)) {
      switch(k) {
        case "charges":
          const uses = i.data.data.uses;
          for (let [k, v] of Object.entries(uses)) {
            if (["autoDeductCharges", "autoDeductChargesCost"].includes(k)) continue;
            this.data.data.uses[k] = v;
          }
          break;
      }
    }
  }

  async update(data, options={}) {
    const srcData = mergeObject(this.data, expandObject(data), { inplace: false });

    // Update name
    if (data["data.identifiedName"]) data["name"] = data["data.identifiedName"];
    else if (data["name"]) data["data.identifiedName"] = data["name"];

    // Update description
    if (this.type === "spell") await this._updateSpellDescription(data, srcData);

    // Update weight according metric system (lb vs kg)
    if (data["data.weightConverted"]) {
      data["data.weight"] = convertWeightBack(data["data.weightConverted"])
    }
    
    // Set weapon subtype
    if (data["data.weaponType"] != null && data["data.weaponType"] !== getProperty(this.data, "data.weaponType")) {
      const type = data["data.weaponType"];
      const subtype = data["data.weaponSubtype"] || getProperty(this.data, "data.weaponSubtype") || "";
      const keys = Object.keys(CONFIG.PF1.weaponTypes[type])
        .filter(o => !o.startsWith("_"));
      if (!subtype || !keys.includes(subtype)) {
        data["data.weaponSubtype"] = keys[0];
      }
    }

    // Set equipment subtype and slot
    if (data["data.equipmentType"] != null && data["data.equipmentType"] !== getProperty(this.data, "data.equipmentType")) {
      // Set subtype
      const type = data["data.equipmentType"];
      const subtype = data["data.equipmentSubtype"] || getProperty(this.data, "data.equipmentSubtype") || "";
      let keys = Object.keys(CONFIG.PF1.equipmentTypes[type])
        .filter(o => !o.startsWith("_"));
      if (!subtype || !keys.includes(subtype)) {
        data["data.equipmentSubtype"] = keys[0];
      }

      // Set slot
      const slot = data["data.slot"] || getProperty(this.data, "data.slot") || "";
      keys = Object.keys(CONFIG.PF1.equipmentSlots[type]);
      if (!slot || !keys.includes(slot)) {
        data["data.slot"] = keys[0];
      }
    }

    // Set previous data
    this._prevData["level"] = getProperty(this.data, "data.level");

    // Update maximum uses
    this._updateMaxUses(data, {srcData: srcData});

    // Update charges for linked items
    if (data["data.uses.value"] != null) {
      const link = getProperty(this, "links.charges");
      if (link && getProperty(link, "links.charges") == null) {
        await link.update({"data.uses.value": data["data.uses.value"]});
      }
    }

    const diff = diffObject(flattenObject(this.data), data);
    if (Object.keys(diff).length) {
      return super.update(diff, options);
    }
    return false;
  }

  _onUpdate(data, options, userId, context) {
    super._onUpdate(data, options, userId, context);

    // Get changed attributes
    const changed = new Set(Object.keys(data));

    // Level changed
    if (changed.has("data.level")) {
      this._onLevelChange(this._prevData["level"], data["data.level"]);
    }
  }

  _updateMaxUses(data, {srcData=null}={}) {
    let doLinkData = true;
    if (srcData == null) {
      srcData = this.data;
      doLinkData = false;
    }
    const rollData = this.getRollData();

    if (hasProperty(srcData, "data.uses.maxFormula")) {
      if (getProperty(srcData, "data.uses.maxFormula") !== "") {
        let roll = new Roll(getProperty(srcData, "data.uses.maxFormula"), rollData).roll();
        if (doLinkData) linkData(srcData, data, "data.uses.max", roll.total);
        else data["data.uses.max"] = roll.total;
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
   * @return {Promise}
   */
  async roll(altChatData={}, {addDC=true}={}) {
    const actor = this.actor;
    if (actor && !actor.hasPerm(game.user, "OWNER")) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));

    // Basic template rendering data
    const token = this.actor.token;
    const saveType = getProperty(this.data, "data.save.type");
    const saveDC = this.getDC();
    const templateData = {
      actor: this.actor,
      tokenId: token ? `${token.scene._id}.${token.id}` : null,
      item: this.data,
      data: this.getChatData(),
      labels: this.labels,
      hasAttack: this.hasAttack,
      hasMultiAttack: this.hasMultiAttack,
      hasAction: this.hasAction || this.isCharged,
      isHealing: this.isHealing,
      hasDamage: this.hasDamage,
      hasEffect: this.hasEffect,
      isVersatile: this.isVersatile,
      hasSave: this.hasSave,
      isSpell: this.data.type === "spell",
      save: {
        hasSave: addDC === true && typeof saveType === "string" && saveType.length > 0,
        dc: saveDC,
        type: saveType,
        label: game.i18n.localize("PF1.SavingThrowButtonLabel").format(CONFIG.PF1.savingThrows[saveType], saveDC.toString()),
      },
    };

    // Roll spell failure chance
    if (templateData.isSpell && this.actor != null && this.actor.spellFailure > 0) {
      const spellbook = getProperty(this.actor.data, `data.attributes.spells.spellbooks.${this.data.data.spellbook}`);
      if (spellbook && spellbook.arcaneSpellFailure) {
        templateData.spellFailure = new Roll("1d100").roll().total;
        templateData.spellFailureSuccess = templateData.spellFailure > this.actor.spellFailure;
      }
    }

    // Render the chat card template
    const templateType = ["consumable"].includes(this.data.type) ? this.data.type : "item";
    const template = `systems/pf1/templates/chat/${templateType}-card.html`;

    // Basic chat message data
    const chatData = mergeObject({
      user: game.user._id,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
    }, altChatData);

    // Toggle default roll mode
    let rollMode = chatData.rollMode || game.settings.get("core", "rollMode");
    if ( ["gmroll", "blindroll"].includes(rollMode) ) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if ( rollMode === "blindroll" ) chatData["blind"] = true;

    // Create the chat message
    return createCustomChatMessage(template, templateData, chatData);
  }

  /* -------------------------------------------- */
  /*  Chat Cards																	*/
  /* -------------------------------------------- */

  getChatData(htmlOptions, rollData=null) {
    const data = duplicate(this.data.data);
    const labels = this.labels;

    if (!rollData) rollData = this.getRollData();

    htmlOptions = mergeObject(htmlOptions || {}, {
      rollData: rollData,
    });

    // Rich text description
    if (this.showUnidentifiedData) {
      data.description.value = TextEditor.enrichHTML(data.description.unidentified, htmlOptions);
    }
    else {
      data.description.value = TextEditor.enrichHTML(data.description.value, htmlOptions);
    }

    // General equipment properties
    const props = [];
    if ( data.hasOwnProperty("equipped") && ["weapon", "equipment"].includes(this.data.type) ) {
      props.push(
        data.equipped ? game.i18n.localize("PF1.Equipped") : game.i18n.localize("PF1.NotEquipped"),
      );
    }

    if (!this.showUnidentifiedData) {
      // Gather dynamic labels
      const dynamicLabels = {};
      dynamicLabels.range = labels.range || "";
      dynamicLabels.level = labels.sl || "";
      // Range
      if (data.range != null) {
        let rangeValue = [0, "ft"];
        switch (data.range.units) {
          case "close":
            rangeValue = convertDistance(25 + Math.floor(rollData.cl / 2) * 5);
            break;
          case "medium":
            rangeValue = convertDistance(100 + rollData.cl * 10);
            break;
          case "long":
            rangeValue = convertDistance(400 + rollData.cl * 40);
            break;
          case "ft":
          case "mi":
            rangeValue = convertDistance(new Roll(data.range.value.length > 0 ? data.range.value : "0", rollData).roll().total, data.range.units);
            break;
          case "spec":
            rangeValue = convertDistance(new Roll(data.range.value.length > 0 ? data.range.value : "0", rollData).roll().total);
            break;
        }
        dynamicLabels.range = rangeValue[0] > 0 ? game.i18n.localize("PF1.RangeNote").format(`${rangeValue[0]} ${CONFIG.PF1.measureUnits[rangeValue[1]]}`) : null;
      }
      // Duration
      if (data.duration != null) {
        if (!["inst", "perm"].includes(data.duration.units) && typeof data.duration.value === "string") {
          let duration = new Roll(data.duration.value.length > 0 ? data.duration.value : "0", rollData).roll().total;
          dynamicLabels.duration = [duration, CONFIG.PF1.timePeriods[data.duration.units]].filterJoin(" ");
        }
      }

      // Item type specific properties
      const fn = this[`_${this.data.type}ChatData`];
      if (fn) fn.bind(this)(data, labels, props);

      // Ability activation properties
      if ( data.hasOwnProperty("activation") ) {
        props.push(
          labels.target,
          labels.activation,
          dynamicLabels.range,
          dynamicLabels.duration
        );
      }

      // Add save DC
      if (data.hasOwnProperty("actionType") && getProperty(data, "save.description")) {
        let saveDC = this.getDC(rollData);
        let saveDesc = data.save.description;
        if (saveDC > 0 && saveDesc) {
          props.push(`DC ${saveDC}`);
          props.push(saveDesc);
        }
      }
    }

    // Add SR reminder
    if (this.type === "spell") {
      if (data.sr) {
        props.push(game.i18n.localize("PF1.SpellResistance"));
      }
    }

    // Add ability type label
    if (this.type === "feat") {
      if (labels.abilityType) {
        props.push(labels.abilityType);
      }
    }

    // Filter properties and return
    data.properties = props.filter(p => !!p);
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Prepare chat card data for equipment type items
   * @private
   */
  _equipmentChatData(data, labels, props) {
    props.push(
      CONFIG.PF1.equipmentTypes[data.equipmentType][data.equipmentSubtype],
      labels.armor || null,
    );
  }

  /* -------------------------------------------- */

  /**
   * Prepare chat card data for weapon type items
   * @private
   */
  _weaponChatData(data, labels, props) {
    props.push(
      CONFIG.PF1.weaponTypes[data.weaponType]._label,
      CONFIG.PF1.weaponTypes[data.weaponType][data.weaponSubtype],
    );
  }

  /* -------------------------------------------- */

  /**
   * Prepare chat card data for consumable type items
   * @private
   */
  _consumableChatData(data, labels, props) {
    props.push(
      CONFIG.PF1.consumableTypes[data.consumableType]
    );
    if (["day", "week", "charges"].includes(data.uses.per)) {
      props.push(data.uses.value + "/" + data.uses.max + " Charges");
    }
    else props.push(CONFIG.PF1.limitedUsePeriods[data.uses.per]);
    data.hasCharges = data.uses.value >= 0;
  }

  /* -------------------------------------------- */

  /**
   * Render a chat card for Spell type data
   * @return {Object}
   * @private
   */
  _spellChatData(data, labels, props) {
    const ad = this.actor.data.data;

    // Spell saving throw text
    // const abl = data.ability || ad.attributes.spellcasting || "int";
    // if ( this.hasSave && !data.save.dc ) data.save.dc = 8 + ad.abilities[abl].mod + ad.attributes.prof;
    // labels.save = `DC ${data.save.dc} ${CONFIG.PF1.abilities[data.save.ability]}`;

    // Spell properties
    props.push(
      labels.level,
      labels.components,
    );
  }

  /* -------------------------------------------- */

  /**
   * Prepare chat card data for items of the "Feat" type
   */
  _featChatData(data, labels, props) {
    const ad = this.actor.data.data;

    // Spell saving throw text
    // const abl = data.ability || ad.attributes.spellcasting || "str";
    // if ( this.hasSave && !data.save.dc ) data.save.dc = 8 + ad.abilities[abl].mod + ad.attributes.prof;
    // labels.save = `DC ${data.save.dc} ${CONFIG.PF1.abilities[data.save.ability]}`;

    // Feat properties
    props.push(
      CONFIG.PF1.featTypes[data.featType]
    );
  }

  /* -------------------------------------------- */
  /*  Item Rolls - Attack, Damage, Saves, Checks  */
  /* -------------------------------------------- */

  async use({ev=null, skipDialog=false}) {
    if (this.type === "spell") {
      return this.actor.useSpell(this, ev, {skipDialog: skipDialog});
    }
    else if (this.hasAction) {
      return this.useAttack({ev: ev, skipDialog: skipDialog});
    }

    if (this.isCharged) {
      if (this.charges < this.chargeCost) {
        if (this.isSingleUse) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoQuantity"));
        return ui.notifications.warn(game.i18n.localize("PF1.ErrorInsufficientCharges").format(this.name));
      }
      if (this.autoDeductCharges) {
        this.addCharges(-this.chargeCost);
      }
    }
    const chatData = {};
    if (this.data.data.soundEffect) chatData.sound = this.data.data.soundEffect;
    this.roll();
  }

  async useAttack({ev=null, skipDialog=false}={}) {
    if (ev && ev.originalEvent) ev = ev.originalEvent;
    const actor = this.actor;
    if (actor && !actor.hasPerm(game.user, "OWNER")) return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoActorPermission"));

    const itemQuantity = getProperty(this.data, "data.quantity");
    if (itemQuantity != null && itemQuantity <= 0) {
      return ui.notifications.warn(game.i18n.localize("PF1.ErrorNoQuantity"));
    }

    if (this.isCharged && this.charges < this.chargeCost) {
      return ui.notifications.warn(game.i18n.localize("PF1.ErrorInsufficientCharges").format(this.name));
    }

    const rollData = this.getRollData();

    let rolled = false;
    const _roll = async function(fullAttack, form) {
      let attackExtraParts = [],
        damageExtraParts = [],
        primaryAttack = true,
        useMeasureTemplate = false,
        rollMode = game.settings.get("core", "rollMode");
      // Get form data
      if (form) {
        rollData.attackBonus = form.find('[name="attack-bonus"]').val();
        if (rollData.attackBonus) attackExtraParts.push("@attackBonus");
        rollData.damageBonus = form.find('[name="damage-bonus"]').val();
        if (rollData.damageBonus) damageExtraParts.push("@damageBonus");
        rollMode = form.find('[name="rollMode"]').val();

        // Power Attack
        if (form.find('[name="power-attack"]').prop("checked")) {
          rollData.powerAttackBonus = (1 + Math.floor(getProperty(rollData, "attributes.bab.total") / 4)) * 2;
          damageExtraParts.push("floor(@powerAttackBonus * max(0.5, min(1.5, @ablMult))) * @critMult");
          rollData.powerAttackPenalty = -(1 + Math.floor(getProperty(rollData, "attributes.bab.total") / 4));
          attackExtraParts.push("@powerAttackPenalty");
        }
        
        // Point-Blank Shot
        if (form.find('[name="point-blank-shot"]').prop("checked")) {
          rollData.pointBlankBonus = 1;
          attackExtraParts.push("@pointBlankBonus");
          damageExtraParts.push("@pointBlankBonus");
        }
        
        // Rapid Shot
        if (form.find('[name="rapid-shot"]').prop("checked")) {
          rollData.rapidShotPenalty = -2;
          attackExtraParts.push("@rapidShotPenalty");
        }
        
        // Primary Attack (for natural attacks)
        let html = form.find('[name="primary-attack"]');
        if (typeof html.prop("checked") === "boolean") {
          primaryAttack = html.prop("checked");
        }
        // Use measure template
        html = form.find('[name="measure-template"]');
        if (typeof html.prop("checked") === "boolean") {
          useMeasureTemplate = html.prop("checked");
        }
        // Damage ability multiplier
        html = form.find('[name="damage-ability-multiplier"]');
        if (html.length > 0) {
          rollData.item.ability.damageMult = parseFloat(html.val());
        }

        // Caster level offset
        html = form.find('[name="cl-offset"]');
        if (html.length > 0) {
          rollData.cl += parseInt(html.val());
        }
        // Spell level offset
        html = form.find('[name="sl-offset"]');
        if (html.length > 0) {
          rollData.sl += parseInt(html.val());
        }
      }

      // Prepare the chat message data
      let chatTemplateData = {
        name: this.name,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        rollMode: rollMode,
      };

      // Create attacks
      const allAttacks = fullAttack ? this.data.data.attackParts.reduce((cur, r) => {
        cur.push({ bonus: r[0], label: r[1] });
        return cur;
      }, [{ bonus: "", label: `${game.i18n.localize("PF1.Attack")}` }]) : [{ bonus: "", label: `${game.i18n.localize("PF1.Attack")}` }];
      let attacks = [];
      if (this.hasAttack) {
        for (let a = 0; a < allAttacks.length; a++) {
          let atk = allAttacks[a];
          // Create attack object
          let attack = new ChatAttack(this, {label: atk.label, rollData: rollData, primaryAttack: primaryAttack});

          // Add attack roll
          await attack.addAttack({bonus: atk.bonus, extraParts: attackExtraParts});

          // Add damage
          if (this.hasDamage) {
            await attack.addDamage({extraParts: damageExtraParts, critical: false});

            // Add critical hit damage
            if (attack.hasCritConfirm) {
              await attack.addDamage({extraParts: damageExtraParts, critical: true});
            }
          }

          // Add attack notes
          if (a === 0) attack.addAttackNotes();

          // Add effect notes
          attack.addEffectNotes();

          // Add to list
          attacks.push(attack);
          
          if (a === 0 && form && form.find('[name="rapid-shot"]').prop("checked")) {
            let rapidShotAttack = new ChatAttack(this, {label: game.i18n.localize("PF1.RapidShot"), rollData: rollData, primaryAttack: primaryAttack});
            await rapidShotAttack.addAttack({bonus: atk.bonus, extraParts: attackExtraParts});

            // Add damage
            if (this.hasDamage) {
              await rapidShotAttack.addDamage({extraParts: damageExtraParts, critical: false});
  
              // Add critical hit damage
              if (rapidShotAttack.hasCritConfirm) {
                await rapidShotAttack.addDamage({extraParts: damageExtraParts, critical: true});
              }
            }
  
            // Add effect notes
            rapidShotAttack.addEffectNotes();
            
            attacks.push(rapidShotAttack);
          }
        }
      }
      // Add damage only
      else if (this.hasDamage) {
        let attack = new ChatAttack(this, {rollData: rollData, primaryAttack: primaryAttack});
        // Add damage
        await attack.addDamage({extraParts: damageExtraParts, critical: false});

        // Add attack notes
        attack.addAttackNotes();

        // Add effect notes
        attack.addEffectNotes();

        // Add to list
        attacks.push(attack);
      }
      // Add effect notes only
      else if (this.hasEffect) {
        let attack = new ChatAttack(this, {rollData: rollData, primaryAttack: primaryAttack});

        // Add attack notes
        attack.addAttackNotes();

        // Add effect notes
        attack.addEffectNotes();
        
        // Add to list
        attacks.push(attack);
      }
      chatTemplateData.attacks = attacks.map(o => o.finalize());

      // Prompt measure template
      if (useMeasureTemplate) {
        // Determine size
        let dist = getProperty(this.data, "data.measureTemplate.size");
        if (typeof dist === "string") {
          dist = new Roll(getProperty(this.data, "data.measureTemplate.size"), this.getRollData()).roll().total;
        }
        dist = convertDistance(dist)[0];

        // Create data object
        const templateOptions = {
          type: getProperty(this.data, "data.measureTemplate.type"),
          distance: dist,
        };
        if (getProperty(this.data, "data.measureTemplate.overrideColor")) {
          templateOptions.color = getProperty(this.data, "data.measureTemplate.customColor");
        }
        if (getProperty(this.data, "data.measureTemplate.overrideTexture")) {
          templateOptions.texture = getProperty(this.data, "data.measureTemplate.customTexture");
        }

        // Create template
        const template = AbilityTemplate.fromData(templateOptions);
        if (template) {
          if (getProperty(this, "actor.sheet.rendered")) this.actor.sheet.minimize();
          const success = await template.drawPreview(ev);
          if (!success) {
            if (getProperty(this, "actor.sheet.rendered")) this.actor.sheet.maximize();
            return;
          }
        }
      }

      // Deduct charge
      if (this.autoDeductCharges) {
        this.addCharges(-this.chargeCost);
      }
      
      // Set chat data
      let chatData = {
        speaker: ChatMessage.getSpeaker({actor: this.actor}),
        rollMode: rollMode,
        sound: CONFIG.sounds.dice,
        "flags.pf1.noRollRender": true,
      };

      // Set attack sound
      if (this.data.data.soundEffect) chatData.sound = this.data.data.soundEffect;

      // Send spell info
      const hasAction = this.hasAttack || this.hasDamage || this.hasEffect;
      if (this.data.type === "spell" && !hasAction) await this.roll({ rollMode: rollMode }, {addDC: hasAction ? false : true});

      // Dice So Nice integration
      if (game.dice3d != null && game.dice3d.isEnabled()) {
        let dice3dData = attacks.reduce((obj, a) => {
          if (a.attack.roll != null)      obj.results.push(a.attack.roll.parts[0].total);
          if (a.critConfirm.roll != null) obj.results.push(a.critConfirm.roll.parts[0].total);
          return obj;
        }, {
          formula: "",
          results: [],
          whisper: [],
          blind: false,
        });
        if (dice3dData.results.length) {
          dice3dData.formula = `${dice3dData.results.length}d20`;
          // Handle different roll modes
          switch (rollMode) {
            case "gmroll":
              dice3dData.whisper = game.users.entities.filter(u => u.isGM).map(u => u._id);
              break;
            case "selfroll":
              dice3dData.whisper = [game.user._id];
              break;
            case "blindroll":
              dice3dData.whisper = game.users.entities.filter(u => u.isGM).map(u => u._id);
              dice3dData.blind = true;
              break;
          }
          // Roll 3D dice
          chatData.sound = null;
          await game.dice3d.show(dice3dData);
        }
      }
      
      // Post message
      if (hasAction) {
        // Get extra text and properties
        let props = [];
        let extraText = "";
        if (chatTemplateData.attacks.length > 0) extraText = chatTemplateData.attacks[0].attackNotesHTML;

        const properties = this.getChatData(null, rollData).properties;
        if (properties.length > 0) props.push({ header: game.i18n.localize("PF1.InfoShort"), value: properties });

        // Get saving throw data
        const save = getProperty(this.data, "data.save.type");
        const saveDC = this.getDC(rollData);

        const templateData = mergeObject(chatTemplateData, {
          extraText: extraText,
          hasExtraText: extraText.length > 0,
          properties: props,
          hasProperties: props.length > 0,
          item: this.data,
          actor: this.actor.data,
          save: {
            hasSave: typeof save === "string" && save.length > 0,
            dc: saveDC,
            type: save,
            label: game.i18n.localize("PF1.SavingThrowButtonLabel").format(CONFIG.PF1.savingThrows[save], saveDC.toString()),
          },
        }, { inplace: false });
        // Spell failure
        if (this.type === "spell" && this.actor != null && this.actor.spellFailure > 0) {
          const spellbook = getProperty(this.actor.data, `data.attributes.spells.spellbooks.${this.data.data.spellbook}`);
          if (spellbook && spellbook.arcaneSpellFailure) {
            templateData.spellFailure = new Roll("1d100").roll().total;
            templateData.spellFailureSuccess = templateData.spellFailure > this.actor.spellFailure;
          }
        }
        // Add metadata
        const metadata = {};
        metadata.item = this._id;
        metadata.rolls = {
          attacks: {},
        };
        // Add attack rolls
        for (let a = 0; a < attacks.length; a++) {
          const atk = attacks[a];
          const attackRolls = { attack: null, damage: {}, critConfirm: null, critDamage: {} };
          // Add attack roll
          if (atk.attack.roll) attackRolls.attack = atk.attack.roll.toJSON();
          // Add damage rolls
          if (atk.damage.rolls.length) {
            for (let b = 0; b < atk.damage.rolls.length; b++) {
              const r = atk.damage.rolls[b];
              attackRolls.damage[b] = {
                damageType: r.damageType,
                roll: r.roll.toJSON(),
              };
            }
          }
          // Add critical confirmation roll
          if (atk.critConfirm.roll) attackRolls.critConfirm = atk.critConfirm.roll.toJSON();
          // Add critical damage rolls
          if (atk.critDamage.rolls.length) {
            for (let b = 0; b < atk.critDamage.rolls.length; b++) {
              const r = atk.critDamage.rolls[b];
              attackRolls.critDamage[b] = {
                damageType: r.damageType,
                roll: r.roll.toJSON(),
              };
            }
          }

          metadata.rolls.attacks[a] = attackRolls;
        }
        setProperty(chatData, "flags.pf1.metadata", metadata);
        // Create message
        await createCustomChatMessage("systems/pf1/templates/chat/attack-roll.html", templateData, chatData);
      }
      // Post chat card even without action
      else {
        this.roll();
      }
    };

    // Handle fast-forwarding
    if (skipDialog) return _roll.call(this, true);

    // Render modal dialog
    let template = "systems/pf1/templates/apps/attack-roll-dialog.html";
    let dialogData = {
      data: rollData,
      item: this.data.data,
      rollMode: game.settings.get("core", "rollMode"),
      rollModes: CONFIG.Dice.rollModes,
      hasAttack: this.hasAttack,
      hasDamage: this.hasDamage,
      hasDamageAbility: getProperty(this.data, "data.ability.damage") !== "",
      isNaturalAttack: getProperty(this.data, "data.attackType") === "natural",
      isWeaponAttack: getProperty(this.data, "data.attackType") === "weapon",
      isSpell: this.type === "spell",
      hasTemplate: this.hasTemplate,
    };
    const html = await renderTemplate(template, dialogData);

    let roll;
    const buttons = {};
    if (this.hasAttack) {
      if (this.type !== "spell") {
        buttons.normal = {
          label: game.i18n.localize("PF1.SingleAttack"),
          callback: html => roll = _roll.call(this, false, html)
        };
      }
      if ((getProperty(this.data, "data.attackParts") || []).length || this.type === "spell") {
        buttons.multi = {
          label: this.type === "spell" ? game.i18n.localize("PF1.Cast") : game.i18n.localize("PF1.FullAttack"),
          callback: html => roll = _roll.call(this, true, html)
        };
      }
    }
    else {
      buttons.normal = {
        label: this.type === "spell" ? game.i18n.localize("PF1.Cast") : game.i18n.localize("PF1.Use"),
        callback: html => roll = _roll.call(this, false, html)
      };
    }
    return new Promise(resolve => {
      new Dialog({
        title: `${game.i18n.localize("PF1.Use")}: ${this.name}`,
        content: html,
        buttons: buttons,
        default: buttons.multi != null ? "multi" : "normal",
        close: html => {
          resolve(rolled ? roll : false);
        }
      }).render(true);
    });
  }

  /**
   * Place an attack roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.d20Roll logic for the core implementation
   */
  rollAttack({data=null, extraParts=[], bonus=null, primaryAttack=true}={}) {
    const itemData = this.data.data;
    const rollData = mergeObject(this.getRollData(), data || {});

    // Determine size bonus
    rollData.sizeBonus = CONFIG.PF1.sizeMods[rollData.traits.size];
    // Add misc bonuses/penalties
    rollData.item.proficiencyPenalty = -4;

    // Determine ability score modifier
    let abl = itemData.ability.attack;

    // Define Roll parts
    let parts = [];
    // Add ability modifier
    if (abl != "" && rollData.abilities[abl] != null && rollData.abilities[abl].mod !== 0) parts.push(`@abilities.${abl}.mod`);
    // Add bonus parts
    parts = parts.concat(extraParts);
    // Add size bonus
    if (rollData.sizeBonus !== 0) parts.push("@sizeBonus");
    // Add attack bonus
    if (itemData.attackBonus !== "") {
      let attackBonus = new Roll(itemData.attackBonus, rollData).roll().total;
      rollData.item.attackBonus = attackBonus.toString();
      parts.push("@item.attackBonus");
    }

    // Add certain attack bonuses
    if (rollData.attributes.attack.general !== 0) {
      parts.push("@attributes.attack.general");
    }
    if (["mwak", "msak"].includes(itemData.actionType) && rollData.attributes.attack.melee !== 0) {
      parts.push("@attributes.attack.melee");
    }
    else if (["rwak", "rsak"].includes(itemData.actionType) && rollData.attributes.attack.ranged !== 0) {
      parts.push("@attributes.attack.ranged");
    }
    // Add BAB
    if (rollData.attributes.bab.total !== 0 && rollData.attributes.bab.total != null) {
      parts.push("@attributes.bab.total");
    }
    // Add item's enhancement bonus
    if (rollData.item.enh !== 0 && rollData.item.enh != null) {
      parts.push("@item.enh");
    }
    // Subtract energy drain
    if (rollData.attributes.energyDrain != null && rollData.attributes.energyDrain !== 0) {
      parts.push("- max(0, abs(@attributes.energyDrain))");
    }
    // Add proficiency penalty
    if ((this.data.type === "attack") && !itemData.proficient) { parts.push("@item.proficiencyPenalty"); }
    // Add masterwork bonus
    if (this.data.type === "attack" && itemData.masterwork === true && itemData.enh < 1) {
      rollData.item.masterworkBonus = 1;
      parts.push("@item.masterworkBonus");
    }
    // Add secondary natural attack penalty
    if (primaryAttack === false) parts.push("-5");
    // Add bonus
    if (bonus != null) {
      rollData.bonus = bonus;
      parts.push("@bonus");
    }

    let roll = new Roll(["1d20"].concat(parts).join("+"), rollData).roll();
    return roll;
  }

  /* -------------------------------------------- */

  /**
   * Only roll the item's effect.
   */
  rollEffect({critical=false, primaryAttack=true}={}) {
    const rollData = this.getRollData();
    rollData.noCrit = critical ? 0 : 1;

    if (!this.hasEffect) {
      throw new Error("You may not make an Effect Roll with this Item.");
    }

    // Determine critical multiplier
    rollData.critMult = 1;
    if (critical) rollData.critMult = this.data.data.ability.critMult;
    // Determine ability multiplier
    if (this.data.data.ability.damageMult != null) rollData.ablMult = this.data.data.ability.damageMult;
    if (primaryAttack === false && rollData.ablMult > 0) rollData.ablMult = 0.5;

    // Create effect string
    let effectNotes = this.actor.getContextNotes("attacks.effect").reduce((cur, o) => {
      o.notes.reduce((cur2, n) => {
        cur2.push(...n.split(/[\n\r]+/));
        return cur2;
      }, []).forEach(n => {
        cur.push(n);
      });
      return cur;
    }, []);
    effectNotes.push(...(this.data.data.effectNotes || "").split(/[\n\r]+/));
    let effectContent = "";
    for (let fx of effectNotes) {
      if (fx.length > 0) {
        effectContent += `<span class="tag">${fx}</span>`;
      }
    }

    if (effectContent.length === 0) return "";

    const inner = TextEditor.enrichHTML(effectContent, { rollData: rollData });
    return `<div class="flexcol property-group"><label>${game.i18n.localize("PF1.EffectNotes")}</label><div class="flexrow">${inner}</div></div>`;
  }

  /**
   * Place an attack roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.d20Roll logic for the core implementation
   */
  async rollFormula(options={}) {
    const itemData = this.data.data;
    if ( !itemData.formula ) {
      throw new Error(game.i18n.localize("PF1.ErrorNoFormula").format(this.name));
    }

    // Define Roll Data
    const rollData = this.actor.getRollData();
    rollData.item = itemData;
    const title = `${this.name} - ${game.i18n.localize("PF1.OtherFormula")}`;

    const roll = new Roll(itemData.formula, rollData).roll();
    return roll.toMessage({
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      flavor: itemData.chatFlavor || title,
      rollMode: game.settings.get("core", "rollMode")
    });
  }

  /**
   * Place a damage roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.damageRoll logic for the core implementation
   */
  rollDamage({data=null, critical=false, extraParts=[]}={}) {
    const rollData = mergeObject(this.getRollData(), data || {});
    rollData.noCrit = critical ? 0 : 1;

    if (!this.hasDamage) {
      throw new Error("You may not make a Damage Roll with this Item.");
    }

    // Define Roll parts
    let parts = this.data.data.damage.parts.map(p => { return { base: p[0], extra: [], damageType: p[1] }; });
    parts[0].base = alterRoll(parts[0].base, 0, rollData.critMult);
    // Add critical damage parts
    if (critical === true && getProperty(this.data, "data.damage.critParts") != null) {
      parts = parts.concat(this.data.data.damage.critParts.map(p => { return { base: p[0], extra: [], damageType: p[1] }; }));
    }

    // Determine ability score modifier
    let abl = this.data.data.ability.damage;
    if (typeof abl === "string" && abl !== "") {
      rollData.ablDamage = Math.floor(rollData.abilities[abl].mod * rollData.ablMult);
      if (rollData.abilities[abl].mod < 0) rollData.ablDamage = rollData.abilities[abl].mod;
      if (rollData.ablDamage < 0) parts[0].extra.push("@ablDamage");
      else if (critical === true) parts[0].extra.push("@ablDamage * @critMult");
      else if (rollData.ablDamage !== 0) parts[0].extra.push("@ablDamage");
    }
    // Add enhancement bonus
    if (rollData.item.enh != null && rollData.item.enh !== 0 && rollData.item.enh != null) {
      if (critical === true) parts[0].extra.push("@item.enh * @critMult");
      else parts[0].extra.push("@item.enh");
    }

    // Add general damage
    if (rollData.attributes.damage.general !== 0) {
      if (critical === true) parts[0].extra.push("@attributes.damage.general * @critMult");
      else parts[0].extra.push("@attributes.damage.general");
    }
    // Add melee or spell damage
    if (rollData.attributes.damage.weapon !== 0 && ["mwak", "rwak"].includes(this.data.data.actionType)) {
      if (critical === true) parts[0].extra.push("@attributes.damage.weapon * @critMult");
      else parts[0].extra.push("@attributes.damage.weapon");
    }
    else if (rollData.attributes.damage.spell !== 0 && ["msak", "rsak", "spellsave"].includes(this.data.data.actionType)) {
      if (critical === true) parts[0].extra.push("@attributes.damage.spell * @critMult");
      else parts[0].extra.push("@attributes.damage.spell");
    }

    // Create roll
    let rolls = [];
    for (let a = 0; a < parts.length; a++) {
      const part = parts[a];
      let rollParts = [];
      if (a === 0) rollParts = [...part.extra, ...extraParts];
      const roll = {
        roll: new Roll([part.base, ...rollParts].join("+"), rollData).roll(),
        damageType: part.damageType,
      };
      rolls.push(roll);
    }

    return rolls;
  }

  /* -------------------------------------------- */

  /**
   * Adjust a cantrip damage formula to scale it for higher level characters and monsters
   * @private
   */
  _scaleCantripDamage(parts, level, scale) {
    const add = Math.floor((level + 1) / 6);
    if ( add === 0 ) return;
    if ( scale && (scale !== parts[0]) ) {
      parts[0] = parts[0] + " + " + scale.replace(new RegExp(Roll.diceRgx, "g"), (match, nd, d) => `${add}d${d}`);
    } else {
      parts[0] = parts[0].replace(new RegExp(Roll.diceRgx, "g"), (match, nd, d) => `${parseInt(nd)+add}d${d}`);
    }
  }

  /* -------------------------------------------- */

  /**
   * Use a consumable item
   */
  async useConsumable(options={}) {
    let itemData = this.data.data;
    let parts = itemData.damage.parts;
    const data = this.getRollData();

    // Add effect string
    let effectStr = "";
    if (typeof itemData.effectNotes === "string" && itemData.effectNotes.length) {
      effectStr = DicePF.messageRoll({
        data: data,
        msgStr: itemData.effectNotes
      });
    }

    parts = parts.map(obj => {
      return obj[0];
    });
    // Submit the roll to chat
    if (effectStr === "") {
      new Roll(parts.join("+")).toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.localize("PF1.UsesItem").format(this.name)
      });
    }
    else {
      const chatTemplate = "systems/pf1/templates/chat/roll-ext.html";
      const chatTemplateData = { hasExtraText: true, extraText: effectStr };
      // Execute the roll
      let roll = new Roll(parts.join("+"), data).roll();

      // Create roll template data
      const rollData = mergeObject({
        user: game.user._id,
        formula: roll.formula,
        tooltip: await roll.getTooltip(),
        total: roll.total,
      }, chatTemplateData || {});

      // Create chat data
      let chatData = {
        user: game.user._id,
        type: CONST.CHAT_MESSAGE_TYPES.CHAT,
        rollMode: game.settings.get("core", "rollMode"),
        sound: CONFIG.sounds.dice,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: game.i18n.localize("PF1.UsesItem").format(this.name),
        rollMode: game.settings.get("core", "rollMode"),
        roll: roll,
        content: await renderTemplate(chatTemplate, rollData),
      };
      // Handle different roll modes
      switch (chatData.rollMode) {
        case "gmroll":
          chatData["whisper"] = game.users.entities.filter(u => u.isGM).map(u => u._id);
          break;
        case "selfroll":
          chatData["whisper"] = [game.user._id];
          break;
        case "blindroll":
          chatData["whisper"] = game.users.entities.filter(u => u.isGM).map(u => u._id);
          chatData["blind"] = true;
      }

      // Send message
      ChatMessage.create(chatData);
    }
  }

  /* -------------------------------------------- */

  /**
   * @returns {Object} An object with data to be used in rolls in relation to this item.
   */
  getRollData() {
    const result = this.actor != null ? this.actor.getRollData() : {};
    result.item = duplicate(this.data.data);

    if (this.type === "spell" && this.actor != null) {
      const spellbook = this.spellbook;
      const spellAbility = spellbook.ability;
      let ablMod = "";
      if (spellAbility !== "") ablMod = getProperty(this.actor.data, `data.abilities.${spellAbility}.mod`);

      result.cl = this.casterLevel || 0;
      result.sl = this.spellLevel  || 0;
      result.ablMod = ablMod;
    }
    if (this.type === "buff") result.item.level = this.data.data.level;

    return result;
  }

  /* -------------------------------------------- */

  static chatListeners(html) {
    html.on('click', '.card-buttons button', this._onChatCardButton.bind(this));
    html.on('click', '.item-name', this._onChatCardToggleContent.bind(this));
  }

  /* -------------------------------------------- */

  static async _onChatCardButton(event) {
    event.preventDefault();

    // Extract card data
    const button = event.currentTarget;
    button.disabled = true;
    const card = button.closest(".chat-card");
    const messageId = card.closest(".message").dataset.messageId;
    const message =  game.messages.get(messageId);
    const action = button.dataset.action;

    // Validate permission to proceed with the roll
    let isTargetted = ["save", "applyDamage"].includes(action);
    if ( !( isTargetted || game.user.isGM || message.isAuthor ) ) return;

    // Get the Actor from a synthetic Token
    const actor = this._getChatCardActor(card);
    if ( !actor ) return;

    // Get the Item
    const item = actor.getOwnedItem(card.dataset.itemId);

    // Perform action
    await this._onChatCardAction(action, {button: button, item: item});

    // Re-enable the button
    button.disabled = false;
  }

  static async _onChatCardAction(action, {button=null, item=null}={}) {
    // Get card targets
    // const targets = isTargetted ? this._getChatCardTargets(card) : [];

    // Consumable usage
    if (action === "consume") await item.useConsumable({event});
    // Apply damage
    else if (action === "applyDamage") {
      const value = button.dataset.value;
      if (!isNaN(parseInt(value))) ActorPF.applyDamage(parseInt(value));
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the visibility of chat card content when the name is clicked
   * @param {Event} event   The originating click event
   * @private
   */
  static _onChatCardToggleContent(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const card = header.closest(".chat-card");
    const content = card.querySelector(".card-content");
    content.style.display = content.style.display === "none" ? "block" : "none";
  }

  /**
   * Get the Actor which is the author of a chat card
   * @param {HTMLElement} card    The chat card being used
   * @return {Actor|null}         The Actor entity or null
   * @private
   */
  static _getChatCardActor(card) {

    // Case 1 - a synthetic actor from a Token
    const tokenKey = card.dataset.tokenId;
    if (tokenKey) {
      const [sceneId, tokenId] = tokenKey.split(".");
      const scene = game.scenes.get(sceneId);
      if (!scene) return null;
      const tokenData = scene.getEmbeddedEntity("Token", tokenId);
      if (!tokenData) return null;
      const token = new Token(tokenData);
      return token.actor;
    }

    // Case 2 - use Actor ID directory
    const actorId = card.dataset.actorId;
    return game.actors.get(actorId) || null;
  }

  /**
   * Updates the spell's description.
   */

  async _updateSpellDescription(updateData, srcData) {
    const reSplit = CONFIG.PF1.re.traitSeparator;

    const label = {
      school: (CONFIG.PF1.spellSchools[getProperty(srcData, "data.school")] || "").toLowerCase(),
      subschool: (getProperty(srcData, "data.subschool") || ""),
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
    data.learnedAt.class = (getProperty(srcData, "data.learnedAt.class") || []).map(o => {
      return `${o[0]} ${o[1]}`;
    }).sort().join(", ");
    data.learnedAt.domain = (getProperty(srcData, "data.learnedAt.domain") || []).map(o => {
      return `${o[0]} ${o[1]}`;
    }).sort().join(", ");
    data.learnedAt.subDomain = (getProperty(srcData, "data.learnedAt.subDomain") || []).map(o => {
      return `${o[0]} ${o[1]}`;
    }).sort().join(", ");
    data.learnedAt.elementalSchool = (getProperty(srcData, "data.learnedAt.elementalSchool") || []).map(o => {
      return `${o[0]} ${o[1]}`;
    }).sort().join(", ");
    data.learnedAt.bloodline = (getProperty(srcData, "data.learnedAt.bloodline") || []).map(o => {
      return `${o[0]} ${o[1]}`;
    }).sort().join(", ");

    // Set casting time label
    if (getProperty(srcData, "data.activation")) {
      const activationCost = getProperty(srcData, "data.activation.cost");
      const activationType = getProperty(srcData, "data.activation.type");

      if (activationType) {
        if (CONFIG.PF1.abilityActivationTypesPlurals[activationType] != null) {
          if (activationCost === 1) label.castingTime = `${CONFIG.PF1.abilityActivationTypes[activationType]}`;
          else label.castingTime = `${CONFIG.PF1.abilityActivationTypesPlurals[activationType]}`;
        }
        else label.castingTime = `${CONFIG.PF1.abilityActivationTypes[activationType]}`;
      }
      if (!Number.isNaN(activationCost) && label.castingTime != null) label.castingTime = `${activationCost} ${label.castingTime}`;
      if (label.castingTime) label.castingTime = label.castingTime.toLowerCase();
    }

    // Set components label
    let components = [];
    for (let [key, value] of Object.entries(getProperty(srcData, "data.components"))) {
      if (key === "value" && value.length > 0) components.push(...value.split(reSplit));
      else if (key === "verbal" && value) components.push("V");
      else if (key === "somatic" && value) components.push("S");
      else if (key === "material" && value) components.push("M");
      else if (key === "focus" && value) components.push("F");
    }
    if (getProperty(srcData, "data.components.divineFocus") === 1) components.push("DF");
    const df = getProperty(srcData, "data.components.divineFocus");
    // Sort components
    const componentsOrder = ["V", "S", "M", "F", "DF"];
    components.sort((a, b) => {
      let index = [componentsOrder.indexOf(a), components.indexOf(b)];
      if (index[0] === -1 && index[1] === -1) return 0;
      if (index[0] === -1 && index[1] >= 0) return 1;
      if (index[0] >= 0 && index[1] === -1) return -1;
      return index[0] - index[1];
    });
    components = components.map(o => {
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
    if (components.length > 0) label.components = components.join(", ");

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
        if (rangeUnit === "close") label.range = `${label.range} (25 ft. + 5 ft./2 levels)`;
        else if (rangeUnit === "medium") label.range = `${label.range} (100 ft. + 10 ft./level)`;
        else if (rangeUnit === "long") label.range = `${label.range} (400 ft. + 40 ft./level)`;
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

    linkData(srcData, updateData, "data.description.value", await renderTemplate("systems/pf1/templates/internal/spell-description.html", data));
  }

  /* -------------------------------------------- */

  /**
   * Get the Actor which is the author of a chat card
   * @param {HTMLElement} card    The chat card being used
   * @return {Array.<Actor>}      The Actor entity or null
   * @private
   */
  static _getChatCardTargets(card) {
    const character = game.user.character;
    const controlled = canvas.tokens.controlled;
    const targets = controlled.reduce((arr, t) => t.actor ? arr.concat([t.actor]) : arr, []);
    if ( character && (controlled.length === 0) ) targets.push(character);
    if ( !targets.length ) throw new Error(`You must designate a specific Token as the roll target`);
    return targets;
  }

  async addSpellUses(value, data=null) {
    if (!this.actor) return;
    if (this.data.data.atWill) return;
    if (this.data.data.level === 0) return;

    const spellbook = getProperty(this.actor.data, `data.attributes.spells.spellbooks.${this.data.data.spellbook}`),
      isSpontaneous = spellbook.spontaneous,
      spellbookKey = getProperty(this.data, "data.spellbook") || "primary",
      spellLevel = getProperty(this.data, "data.level");
    const newCharges = isSpontaneous
      ? Math.max(0, (getProperty(spellbook, `spells.spell${spellLevel}.value`) || 0) + value)
      : Math.max(0, (getProperty(this.data, "data.preparation.preparedAmount") || 0) + value);

    if (!isSpontaneous) {
      const key = "data.preparation.preparedAmount";
      if (data == null) {
        data = {};
        data[key] = newCharges;
        return this.update(data);
      }
      else {
        data[key] = newCharges;
      }
    }
    else {
      const key = `data.attributes.spells.spellbooks.${spellbookKey}.spells.spell${spellLevel}.value`;
      const actorUpdateData = {};
      actorUpdateData[key] = newCharges;
      return this.actor.update(actorUpdateData);
    }

    return null;
  }

  getSpellUses() {
    if (!this.actor) return 0;
    if (this.data.data.atWill) return Number.POSITIVE_INFINITY;

    const spellbook = getProperty(this.actor.data, `data.attributes.spells.spellbooks.${this.data.data.spellbook}`),
      isSpontaneous = spellbook.spontaneous,
      spellLevel = getProperty(this.data, "data.level");
    
    if (isSpontaneous) {
      if (getProperty(this.data, "data.preparation.spontaneousPrepared") === true) {
        return getProperty(spellbook, `spells.spell${spellLevel}.value`) || 0;
      }
    }
    else {
      return getProperty(this.data, "data.preparation.preparedAmount") || 0;
    }
    return 0;
  }

  static async toConsumable(origData, type) {
    let data = duplicate(game.system.template.Item.consumable);
    for (let t of data.templates) {
      mergeObject(data, duplicate(game.system.template.Item.templates[t]));
    }
    delete data.templates;
    data = {
      type: "consumable",
      name: origData.name,
      data: data,
    };

    const slcl = this.getMinimumCasterLevelBySpellData(origData.data);

    // Set consumable type
    data.data.consumableType = type;

    // Set name
    if (type === "wand") {
      data.name = `Wand of ${origData.name}`;
      data.img = "systems/pf1/icons/items/inventory/wand-star.jpg";
      data.data.price = Math.max(0.5, slcl[0]) * slcl[1] * 750;
      data.data.hardness = 5;
      data.data.hp.max = 5;
      data.data.hp.value = 5;
    }
    else if (type === "potion") {
      data.name = `Potion of ${origData.name}`;
      data.img = "systems/pf1/icons/items/potions/minor-blue.jpg";
      data.data.price = Math.max(0.5, slcl[0]) * slcl[1] * 50;
      data.data.hardness = 1;
      data.data.hp.max = 1;
      data.data.hp.value = 1;
    }
    else if (type === "scroll") {
      data.name = `Scroll of ${origData.name}`;
      data.img = "systems/pf1/icons/items/inventory/scroll-magic.jpg";
      data.data.price = Math.max(0.5, slcl[0]) * slcl[1] * 25;
      data.data.hardness = 0;
      data.data.hp.max = 1;
      data.data.hp.value = 1;
    }

    // Set charges
    if (type === "wand") {
      data.data.uses.maxFormula = "50";
      data.data.uses.value      = 50;
      data.data.uses.max        = 50;
      data.data.uses.per        = "charges";
    }
    else {
      data.data.uses.per = "single";
    }

    // Set activation method
    data.data.activation.type = "standard";

    // Set measure template
    if (type !== "potion") {
      data.data.measureTemplate = getProperty(origData, "data.measureTemplate");
    }

    // Set damage formula
    data.data.actionType = origData.data.actionType;
    for (let d of getProperty(origData, "data.damage.parts")) {
      d[0] = d[0].replace(/@sl/g, slcl[0]);
      d[0] = d[0].replace(/@cl/g, slcl[1]);
      data.data.damage.parts.push(d);
    }

    // Set saves
    data.data.save.description = origData.data.save.description;
    data.data.save.dc = 10 + slcl[0] + Math.floor(slcl[0] / 2);

    // Copy variables
    data.data.attackNotes = origData.data.attackNotes;
    data.data.effectNotes = origData.data.effectNotes;
    data.data.attackBonus = origData.data.attackBonus;
    data.data.critConfirmBonus = origData.data.critConfirmBonus;

    // Determine aura power
    let auraPower = "faint";
    for (let a of CONFIG.PF1.magicAuraByLevel.item) {
      if (a.level <= slcl[1]) auraPower = a.power;
    }
    // Determine caster level label
    let clLabel;
    switch (slcl[1]) {
      case 1:
        clLabel = "1st";
        break;
      case 2:
        clLabel = "2nd";
        break;
      case 3:
        clLabel = "3rd";
        break;
      default:
        clLabel = `${slcl[1]}th`;
        break;
    }
    // Determine spell level label
    let slLabel;
    switch (slcl[0]) {
      case 1:
        slLabel = "1st";
        break;
      case 2:
        slLabel = "2nd";
        break;
      case 3:
        slLabel = "3rd";
        break;
      default:
        slLabel = `${slcl[1]}th`;
        break;
    }

    // Set description
    data.data.description.value = await renderTemplate("systems/pf1/templates/internal/consumable-description.html", {
      origData: origData,
      data: data,
      isWand: type === "wand",
      isPotion: type === "potion",
      isScroll: type === "scroll",
      auraPower: auraPower,
      aura: (CONFIG.PF1.spellSchools[origData.data.school] || "").toLowerCase(),
      sl: slcl[0],
      cl: slcl[1],
      slLabel: slLabel,
      clLabel: clLabel,
      config: CONFIG.PF1,
    });

    return data;
  }

  /**
   * @param {object} itemData - A spell item's data.
   * @returns {number[]} An array containing the spell level and caster level.
   */
  static getMinimumCasterLevelBySpellData(itemData) {
    const learnedAt = getProperty(itemData, "learnedAt.class").reduce((cur, o) => {
      const classes = o[0].split("/");
      for (let cls of classes) cur.push([cls, o[1]]);
      return cur;
    }, []);
    let result = [9, 20];
    for (let o of learnedAt) {
      result[0] = Math.min(result[0], o[1]);
      
      const tc = CONFIG.PF1.classCasterType[o[0]] || "high";
      if (tc === "high") {
        result[1] = Math.min(result[1], 1 + Math.max(0, (o[1] - 1)) * 2);
      }
      else if (tc === "med") {
        result[1] = Math.min(result[1], 1 + Math.max(0, (o[1] - 1)) * 3);
      }
      else if (tc === "low") {
        result[1] = Math.min(result[1], 4 + Math.max(0, (o[1] - 1)) * 3);
      }
    }

    return result;
  }

  async _onLevelChange(curLevel, newLevel) {

    // let newItems = [];
    // // Add linked items by minLevel
    // for (let o of this.links.minLevel) {
      // if (newLevel > curLevel && newLevel >= o.level) {
        // const id = o.target.split(".");

        // // Add from compendium
        // if (id.length === 3) {
          // const pack = game.packs.get([id[0], id[1]].join("."));
          // const item = await pack.getEntity(id[2]);
          // if (item != null) {
            // newItems.push(item);
          // }
        // }
      // }
    // }

    // if (this.actor != null) {
      // if (newItems.length > 0) {
        // this.actor.createEmbeddedEntity("OwnedItem", newItems);
      // }
    // }
  }

  async getLinkedItems(type) {
    const items = getProperty(this.data, `data.links.${type}`);
    if (!items) return [];

    let result = [];
    for (let l of items) {
      let item = await this.getLinkItem(l);
      if (item) result.push(item);
    }

    return result;
  }

  async getAllLinkedItems() {
    let result = [];

    for (let items of Object.values(getProperty(this.data, "data.links"))) {
      for (let l of items) {
        let item = await this.getLinkItem(l);
        if (item) result.push(item);
      }
    }

    return result;
  }

  /**
   * Removes all link references to an item.
   * @param {String} id - The id of the item to remove links to.
   */
  async removeItemLink(id) {
    for (let items of Object.values(getProperty(this.data, "data.links"))) {
      for (let a = 0; a < items.length; a++) {
        let item = items[a];
        if (item.id === id) {
          items.splice(a, 1);
          a--;
        }
      }
    }
  }

  async getLinkItem(l) {
    const id = l.id.split(".");

    // Compendium entry
    if (l.dataType === "compendium") {
      const pack = game.packs.get(id.slice(0, 2).join("."));
      return await pack.getEntity(id[2]);
    }
    // World entry
    else if (l.dataType === "world") {
      return game.items.get(id[1]);
    }
    // Same actor's item
    else if (this.actor != null && this.actor.items != null) {
      return this.actor.items.find(o => o._id === id[0]);
    }

    return null;
  }

  async updateLinkItems() {

    // Update link items
    const linkGroups = (getProperty(this.data, "data.links") || {});
    for (let links of Object.values(linkGroups)) {
      for (let l of links) {
        const i = await this.getLinkItem(l);
        if (i == null) continue;
        l.name = i.name;
        l.img = i.img;
      }
    }
  }

  _cleanLink(oldLink, linkType) {
    if (!this.actor) return;

    const otherItem = this.actor.items.find(o => o._id === oldLink.id);
    if (linkType === "charges" && otherItem && hasProperty(otherItem, "links.charges")) {
      delete otherItem.links.charges;
    }
  }

  /**
   * Generates lists of change subtargets this item can have.
   * @param {string} target - The target key, as defined in CONFIG.PF1.buffTargets.
   * @returns {Object.<string, string>} A list of changes
   */
  getChangeSubTargets(target) {

    let result = {};
    // Add specific skills
    if (target === "skill") {
      if (this.actor == null) {
        for (let [s, skl] of Object.entries(CONFIG.PF1.skills)) {
          result[`skill.${s}`] = skl;
        }
      }
      else {
        const actorSkills = this.actor.data.data.skills;
        for (let [s, skl] of Object.entries(actorSkills)) {
          if (!skl.subSkills) {
            if (skl.custom) result[`skill.${s}`] = skl.name;
            else result[`skill.${s}`] = CONFIG.PF1.skills[s];
          }
          else {
            for (let [s2, skl2] of Object.entries(skl.subSkills)) {
              result[`skill.${s}.subSkills.${s2}`] = `${CONFIG.PF1.skills[s]} (${skl2.name})`;
            }
          }
        }
      }
    }
    // Add static subtargets
    else if (hasProperty(CONFIG.PF1.buffTargets, target)) {
      for (let [k, v] of Object.entries(CONFIG.PF1.buffTargets[target])) {
        if (!k.startsWith("_")) result[k] = v;
      }
    }

    return result;
  }

  /**
   * Generates lists of context note subtargets this item can have.
   * @param {string} target - The target key, as defined in CONFIG.PF1.buffTargets.
   * @returns {Object.<string, string>} A list of changes
   */
  getContextNoteSubTargets(target) {

    let result = {};
    // Add specific skills
    if (target === "skill") {
      if (this.actor == null) {
        for (let [s, skl] of Object.entries(CONFIG.PF1.skills)) {
          result[`skill.${s}`] = skl;
        }
      }
      else {
        const actorSkills = this.actor.data.data.skills;
        for (let [s, skl] of Object.entries(actorSkills)) {
          if (!skl.subSkills) {
            if (skl.custom) result[`skill.${s}`] = skl.name;
            else result[`skill.${s}`] = CONFIG.PF1.skills[s];
          }
          else {
            for (let [s2, skl2] of Object.entries(skl.subSkills)) {
              result[`skill.${s}.subSkills.${s2}`] = `${CONFIG.PF1.skills[s]} (${skl2.name})`;
            }
          }
        }
      }
    }
    // Add static subtargets
    else if (hasProperty(CONFIG.PF1.contextNoteTargets, target)) {
      for (let [k, v] of Object.entries(CONFIG.PF1.contextNoteTargets[target])) {
        if (!k.startsWith("_")) result[k] = v;
      }
    }

    return result;
  }
}
