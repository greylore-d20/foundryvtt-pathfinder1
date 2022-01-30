import { ItemBasePF } from "./base.js";
import { DicePF, formulaHasDice } from "../dice.js";
import { createCustomChatMessage } from "../chat.js";
import { createTag, linkData, convertDistance, convertWeight, convertWeightBack } from "../lib.js";
import { ActorPF } from "../actor/entity.js";
import { ItemChange } from "./components/change.js";
import { ItemScriptCall } from "./components/script-call.js";
import { getHighestChanges } from "../actor/apply-changes.js";
import { RollPF } from "../roll.js";

/**
 * Override and extend the basic :class:`Item` implementation
 */
export class ItemPF extends ItemBasePF {
  // TODO: Remove once all broken _id references are fixed.
  get _id() {
    console.error("ItemPF._id is obsolete; use ItemPF.id instead.");
    return this.id;
  }

  constructor(...args) {
    super(...args);

    /**
     * @property {object} links
     * Links are stored here during runtime.
     */
    if (this.links === undefined) this.links = {};

    /**
     * @property {object} _rollData
     * Cached roll data for this item.
     */
    if (this._rollData === undefined) this._rollData = null;
  }

  static isInventoryItem(type) {
    return ["weapon", "equipment", "consumable", "loot", "container"].includes(type);
  }

  _preCreate(data, options, user) {
    super._preCreate(data, options, user);

    let updates = {};
    if (typeof this.preCreateData === "function") {
      updates = this.preCreateData(data, options, user);
    }

    if (Object.keys(updates).length) return this.data.update(updates);
  }

  /**
   * Meant to be overridden.
   *
   * @param data
   * @param options
   * @param user
   * @returns {Object} Update data to replace with.
   */
  preCreateData(data, options, user) {
    return {};
  }

  /**
   * @returns {string[]} The keys of data variables to memorize between updates, for e.g. determining the difference in update.
   */
  get memoryVariables() {
    return ["data.quantity", "data.level"];
  }

  /* -------------------------------------------- */
  /*  Item Properties                             */
  /* -------------------------------------------- */

  get isOwned() {
    return super.isOwned || this.parentItem != null;
  }

  // Overriden by more specific implementations where necessary
  get isActive() {
    return true;
  }

  /**
   * Does the Item implement an attack roll as part of its usage
   *
   * @type {boolean}
   */
  get hasAttack() {
    return ["mwak", "rwak", "msak", "rsak", "mcman", "rcman"].includes(this.data.data.actionType);
  }

  get hasMultiAttack() {
    return (
      this.hasAttack &&
      ((this.data.data.attackParts != null && this.data.data.attackParts.length > 0) ||
        this.data.data.formulaicAttacks?.count?.value > 0)
    );
  }

  get hasTemplate() {
    const v = getProperty(this.data, "data.measureTemplate.type");
    const s = getProperty(this.data, "data.measureTemplate.size");
    return (
      typeof v === "string" && v !== "" && ((typeof s === "string" && s.length > 0) || (typeof s === "number" && s > 0))
    );
  }

  get hasSound() {
    return !!this.data.data.soundEffect;
  }

  get hasAction() {
    return (
      this.hasAttack ||
      this.hasDamage ||
      this.hasEffect ||
      this.hasSave ||
      this.hasTemplate ||
      this.hasSound ||
      this.isCharged
    );
  }

  get isSingleUse() {
    return getProperty(this.data, "data.uses.per") === "single" || !hasProperty(this.data, "data.uses.per");
  }

  get isCharged() {
    if (getProperty(this.data, "data.uses.per") === "single") return true;
    return ["day", "week", "charges"].includes(getProperty(this.data, "data.uses.per"));
  }

  get autoDeductCharges() {
    return this.isCharged && getProperty(this.data, "data.uses.autoDeductCharges") === true;
  }

  get charges() {
    // No actor? No charges!
    if (!this.parent) return 0;

    // Get linked charges
    const link = getProperty(this, "links.charges");
    if (link) return link.charges;

    // Get own charges
    if (this.isSingleUse) return getProperty(this.data, "data.quantity");
    return getProperty(this.data, "data.uses.value") || 0;
  }

  get maxCharges() {
    // No actor? No charges!
    if (!this.parent) return 0;

    // Get linked charges
    const link = getProperty(this, "links.charges");
    if (link) return link.maxCharges;

    // Get own charges
    if (this.isSingleUse) return getProperty(this.data, "data.quantity");
    return getProperty(this.data, "data.uses.max") || 0;
  }

  get chargeCost() {
    const formula = getProperty(this.data, "data.uses.autoDeductChargesCost");
    if (!(typeof formula === "string" && formula.length > 0)) return 1;
    const cost = RollPF.safeRoll(formula, this.getRollData()).total;
    return cost;
  }

  /**
   * Returns total duration in seconds or null.
   *
   * @returns {number|null} Seconds or null.
   */
  get totalDurationSeconds() {
    return this.data.data.duration?.totalSeconds ?? null;
  }

  get auraStrength() {
    const cl = getProperty(this.data, "data.cl") || 0;
    if (cl < 1) {
      return 0;
    } else if (cl < 6) {
      return 1;
    } else if (cl < 12) {
      return 2;
    } else if (cl < 21) {
      return 3;
    }
    return 4;
  }

  // Returns range (in system configured units)
  get range() {
    const range = getProperty(this.data, "data.range.value");
    const rangeType = getProperty(this.data, "data.range.units");

    if (rangeType == null) return null;

    switch (rangeType) {
      case "melee":
      case "touch":
        return convertDistance(getProperty(this.getRollData(), "range.melee") || 0)[0];
      case "reach":
        return convertDistance(getProperty(this.getRollData(), "range.reach") || 0)[0];
      case "close":
        return convertDistance(RollPF.safeRoll("25 + floor(@cl / 2) * 5", this.getRollData()).total)[0];
      case "medium":
        return convertDistance(RollPF.safeRoll("100 + @cl * 10", this.getRollData()).total)[0];
      case "long":
        return convertDistance(RollPF.safeRoll("400 + @cl * 40", this.getRollData()).total)[0];
      case "mi":
        return convertDistance(range * 5280)[0];
      default:
        return convertDistance(range)[0];
    }
  }

  get minRange() {
    const rng = this.data.data.range;
    if (rng.minUnits !== "" && rng.minValue !== null) {
      const rollData = this.getRollData();
      const formula = { melee: "@range.melee", reach: "@range.reach" }[rng.minUnits] ?? (rng.minValue || "0");
      return convertDistance(RollPF.safeRoll(formula, rollData).total)[0];
    }
    return 0;
  }

  get maxRange() {
    return this.data.data.range.maxIncrements * this.range;
  }

  get parentActor() {
    if (this.parent) return this.parent;

    let actor = null;
    let p = this.parentItem;
    while (!actor && p) {
      actor = p.actor;
      p = p.parentItem;
    }
    return actor;
  }

  get limited() {
    if (this.parentItem) return this.parentItem.limited;
    return super.limited;
  }

  getName(forcePlayerPerspective = false) {
    if (game.user.isGM && !forcePlayerPerspective) return this.name;
    if (getProperty(this.data, "data.identified") === false && getProperty(this.data, "data.unidentified.name"))
      return getProperty(this.data, "data.unidentified.name");
    return this.name;
  }

  testUserPermission(user, permission, { exact = false } = {}) {
    if (this.parentActor) return this.parentActor.testUserPermission(user, permission, { exact });
    if (this.parentItem) return this.parentItem.testUserPermission(user, permission, { exact });
    return super.testUserPermission(user, permission, { exact });
  }

  get permission() {
    if (this.parentActor) return this.parentActor.permission;
    return super.permission;
  }

  get fullDescription() {
    return this.data.data.description.value;
  }

  /**
   * @returns {ActiveEffect} An active effect associated with this item.
   */
  get effect() {
    return this.actor.effects.find((o) => {
      const origin = o.data.origin.split(".");
      if (origin[2] === "Item" && origin[3] === this.id) return true;
      return false;
    });
  }

  /**
   * @param {object} [rollData] - Data to pass to the roll. If none is given, get new roll data.
   * @returns {number} The Difficulty Class for this item.
   */
  getDC(rollData = null) {
    // No actor? No DC!
    if (!this.parent) return 0;

    rollData = rollData ?? this.getRollData();
    const data = rollData.item;

    let result = 10;

    // Get conditional save DC bonus
    const dcBonus = rollData["dcBonus"] ?? 0;

    const dcFormula = getProperty(data, "save.dc")?.toString() || "0";
    try {
      result = RollPF.safeRoll(dcFormula, rollData).total + dcBonus;
    } catch (e) {
      console.error(e, dcFormula);
    }
    return result;
  }

  /**
   * @param {string} type - The item type (such as "attack" or "equipment")
   * @param {number} colorType - 0 for the primary color, 1 for the secondary color
   * @returns {string} A color hex, in the format "#RRGGBB"
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
          default:
            return "#FFFFFF";
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

  static get defaultConditional() {
    return {
      default: false,
      name: "",
      modifiers: [],
    };
  }

  static get defaultConditionalModifier() {
    return {
      formula: "",
      target: "",
      subTarget: "",
      type: "",
      critical: "",
    };
  }

  static get defaultContextNote() {
    return {
      text: "",
      subTarget: "",
    };
  }

  /**
   * Generic charge addition (or subtraction) function that either adds charges
   * or quantity, based on item data.
   *
   * @param {number} value       - The amount of charges to add.
   * @returns {Promise}
   */
  async addCharges(value) {
    // Add link charges
    const link = getProperty(this, "links.charges");
    if (link) return link.addCharges(value);

    // Add own charges
    if (getProperty(this.data, "data.uses.per") === "single" && getProperty(this.data, "data.quantity") == null) return;

    const prevValue = this.isSingleUse
      ? getProperty(this.data, "data.quantity")
      : getProperty(this.data, "data.uses.value");

    if (this.isSingleUse) await this.update({ "data.quantity": prevValue + value });
    else await this.update({ "data.uses.value": prevValue + value });
  }

  /* -------------------------------------------- */

  /**
   * Does the Item implement a damage roll as part of its usage
   *
   * @type {boolean}
   */
  get hasDamage() {
    return !!(this.data.data.damage && this.data.data.damage.parts.length);
  }

  /**
   * Does the item have range defined.
   *
   * @type {boolean}
   */
  get hasRange() {
    return this.data.data.range?.units != null;
  }

  /* -------------------------------------------- */

  /**
   * Does the item provide an amount of healing instead of conventional damage?
   *
   * @returns {boolean}
   */
  get isHealing() {
    return this.data.data.actionType === "heal" && this.data.data.damage.parts.length;
  }

  get hasEffect() {
    return this.hasDamage || (this.data.data.effectNotes != null && this.data.data.effectNotes.length > 0);
  }

  /* -------------------------------------------- */

  /**
   * Does the Item implement a saving throw as part of its usage
   *
   * @type {boolean}
   */
  get hasSave() {
    return typeof this.data.data.save?.type === "string" && this.data.data.save?.type.length > 0;
  }

  /**
   * Should the item show unidentified data
   *
   * @type {boolean}
   */
  get showUnidentifiedData() {
    return !game.user.isGM && getProperty(this.data, "data.identified") === false;
  }

  /* -------------------------------------------- */
  /*	Data Preparation														*/
  /* -------------------------------------------- */

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    const itemData = super.prepareData() || this.data;
    const data = itemData.data;
    const C = CONFIG.PF1;
    const labels = {};

    // Physical items
    if (itemData.data.weight !== undefined) {
      // Sync name
      if (this.data.data.identifiedName === undefined) this.data.data.identifiedName = this.name;
      if (this.showUnidentifiedData) {
        // Set unidentified name for players
        const unidentifiedName = this.data.data.unidentified.name;
        if (unidentifiedName) this.data.name = unidentifiedName;
        // Set unidentified description for players
        this.data.data.description.value = this.data.data.description.unidentified;
      }
      // Prepare unidentified cost
      if (this.data.data.unidentified.price === undefined) this.data.data.unidentified.price = 0;

      // Convert weight according metric system (lb vs kg)
      let usystem = game.settings.get("pf1", "weightUnits"); // override
      if (usystem === "default") usystem = game.settings.get("pf1", "units");
      itemData.data.weightConverted = convertWeight(itemData.data.weight);
      itemData.data.weightUnits = usystem === "metric" ? game.i18n.localize("PF1.Kgs") : game.i18n.localize("PF1.Lbs");
      itemData.data.priceUnits = game.i18n.localize("PF1.CurrencyGP").toLowerCase();

      // Set basic data
      itemData.data.hp = itemData.data.hp || { max: 10, value: 10 };
      itemData.data.hardness = itemData.data.hardness || 0;
      itemData.data.carried = itemData.data.carried == null ? true : itemData.data.carried;

      // Equipped label
      const checkYes = '<i class="fas fa-check"></i>';
      const checkNo = '<i class="fas fa-times"></i>';
      labels.equipped = "";
      if (itemData.data.equipped === true) labels.equipped = checkYes;
      else labels.equipped = checkNo;

      // Carried label
      labels.carried = "";
      if (itemData.data.carried === true) labels.carried = checkYes;
      else labels.carried = checkNo;

      // Identified label
      labels.identified = "";
      if (itemData.data.identified === true) labels.identified = checkYes;
      else labels.identified = checkNo;

      // Slot label
      if (itemData.data.slot) {
        // Add equipment slot
        const equipmentType = this.data.data.equipmentType || null;
        if (equipmentType != null) {
          const equipmentSlot = this.data.data.slot || null;
          labels.slot = equipmentSlot == null ? null : CONFIG.PF1.equipmentSlots[equipmentType]?.[equipmentSlot];
        } else labels.slot = null;
      }
    }

    // Activated Items
    if (Object.prototype.hasOwnProperty.call(data, "activation")) {
      const activationTypes = game.settings.get("pf1", "unchainedActionEconomy")
        ? CONFIG.PF1.abilityActivationTypes_unchained
        : CONFIG.PF1.abilityActivationTypes;
      const activationTypesPlural = game.settings.get("pf1", "unchainedActionEconomy")
        ? CONFIG.PF1.abilityActivationTypesPlurals_unchained
        : CONFIG.PF1.abilityActivationTypesPlurals;

      // Ability Activation Label
      const act = game.settings.get("pf1", "unchainedActionEconomy")
        ? data.unchainedAction.activation || {}
        : data.activation || {};
      if (act && act.cost > 1 && activationTypesPlural[act.type] != null) {
        labels.activation = [act.cost.toString(), activationTypesPlural[act.type]].filterJoin(" ");
      } else if (act) {
        labels.activation = [
          ["minute", "hour", "action"].includes(act.type) && act.cost ? act.cost.toString() : "",
          activationTypes[act.type],
        ].filterJoin(" ");
      }

      // Target Label
      const tgt = data.target || {};
      if (["none", "touch", "personal"].includes(tgt.units)) tgt.value = null;
      if (["none", "personal"].includes(tgt.type)) {
        tgt.value = null;
        tgt.units = null;
      }
      labels.target = [tgt.value, C.distanceUnits[tgt.units], C.targetTypes[tgt.type]].filterJoin(" ");
      if (labels.target) labels.target = `${game.i18n.localize("PF1.Target")}: ${labels.target}`;

      // Range Label
      const rng = duplicate(data.range || {});
      if (!["ft", "mi", "spec"].includes(rng.units)) {
        rng.value = null;
        rng.long = null;
      } else if (typeof rng.value === "string" && rng.value.length) {
        try {
          rng.value = RollPF.safeTotal(rng.value, this.getRollData()).toString();
        } catch (err) {
          console.error(err);
        }
      }
      labels.range = [rng.value, rng.long ? `/ ${rng.long}` : null, C.distanceUnits[rng.units]].filterJoin(" ");
      if (labels.range.length > 0) labels.range = [`${game.i18n.localize("PF1.Range")}:`, labels.range].join(" ");

      // Duration Label
      const dur = duplicate(data.duration || {});
      if (["inst", "perm", "spec", "seeText"].includes(dur.units)) dur.value = game.i18n.localize("PF1.Duration") + ":";
      else if (typeof dur.value === "string" && this.parentActor) {
        dur.value = RollPF.safeRoll(dur.value || "0", this.getRollData(), [this.name, "Duration"]).total.toString();
      }
      labels.duration = [dur.value, C.timePeriods[dur.units]].filterJoin(" ");
    }

    // Item Actions
    if (Object.prototype.hasOwnProperty.call(data, "actionType")) {
      // Damage
      const dam = data.damage || {};
      if (dam.parts && dam.parts instanceof Array) {
        labels.damage = dam.parts
          .map((d) => d[0])
          .join(" + ")
          .replace(/\+ -/g, "- ");
        labels.damageTypes = dam.parts.map((d) => d[1]).join(", ");
      }

      // Add attack parts
      if (!data.attack) data.attack = { parts: [] };
    }

    // Assign labels
    this.labels = labels;

    this.prepareLinks();

    // Update changes
    if (this.data.data.changes instanceof Array) {
      this.changes = this._prepareChanges(this.data.data.changes);
    }

    // Update script calls
    if (this.data.data.scriptCalls instanceof Array) {
      this.scriptCalls = this._prepareScriptCalls(this.data.data.scriptCalls);
    }

    // Update contained items
    if (this.data.data.inventoryItems instanceof Array) {
      this.items = this._prepareInventory(this.data.data.inventoryItems);
    }

    // Initialize tag for items that have tagged template
    const taggedTypes = game.system.template.Item.types.filter((t) =>
      game.system.template.Item[t].templates?.includes("tagged")
    );
    if (this.data.data["useCustomTag"] !== true && taggedTypes.includes(this.data.type)) {
      const name = this.name;
      this.data.data.tag = createTag(name);
    }

    if (!this.actor) {
      this.prepareDerivedItemData();
    }

    return itemData;
  }

  prepareDerivedItemData() {
    // Parse formulaic attacks
    if (this.hasAttack) {
      this.parseFormulaicAttacks({ formula: getProperty(this.data, "data.formulaicAttacks.count.formula") });
    }

    // Update maximum uses
    this._updateMaxUses();

    // Add saving throw DC label
    if (this.data.data.actionType !== undefined && this.hasSave) {
      // Save DC
      if (this.hasSave) {
        this.labels.save = `DC ${this.getDC()}`;
      }
    }

    // Re-render sheet, if open
    if (this.sheet?.rendered) {
      this.sheet?.render();
    }
  }

  prepareLinks() {
    if (!this.links) return;

    for (const [k, i] of Object.entries(this.links)) {
      switch (k) {
        case "charges": {
          const uses = i.data.data.uses;
          for (const [k, v] of Object.entries(uses)) {
            if (["autoDeductCharges", "autoDeductChargesCost"].includes(k)) continue;
            this.data.data.uses[k] = v;
          }
          break;
        }
      }
    }
  }

  _prepareChanges(changes) {
    const prior = this.changes;
    const collection = new Collection();
    for (const c of changes) {
      let change = null;
      if (prior && prior.has(c._id)) {
        change = prior.get(c._id);
        change.data = c;
        change.prepareData();
      } else change = ItemChange.create(c, this);
      collection.set(c._id || change.data._id, change);
    }
    return collection;
  }

  _prepareScriptCalls(scriptCalls) {
    const prior = this.scriptCalls;
    const collection = new Collection();
    for (const s of scriptCalls) {
      let scriptCall = null;
      if (prior && prior.has(s.id)) {
        scriptCall = prior.get(s.id);
        scriptCall.data = s;
      } else scriptCall = ItemScriptCall.create(s, this);
      collection.set(s._id || scriptCall.data._id, scriptCall);
    }
    return collection;
  }

  _prepareInventory(inventory) {
    const prior = this.items;
    const collection = new Collection();
    for (const o of inventory) {
      let item = null;
      if (prior && prior.has(o._id)) {
        item = prior.get(o._id);
        item.data.update(o);
        item.prepareData();
      } else {
        item = new CONFIG.Item.documentClass(o);
        item.parentItem = this;
      }

      collection.set(o._id || item.data._id, item);
    }
    return collection;
  }

  /**
   * Executes all script calls on this item of a specified category.
   *
   * @param {string} category - The category of script calls to call.
   * @param {object.<string, object>} [extraParams={}] - A dictionary of extra parameters to pass as variables for use in the script.
   * @returns {Promise.<object>} The shared object between calls which may have been given data.
   */
  async executeScriptCalls(category, extraParams = {}) {
    const scripts = this.scriptCalls?.filter((o) => o.category === category) ?? [];
    const shared = {};

    for (const s of scripts) {
      await s.execute(shared, extraParams);
    }

    return shared;
  }

  async update(data, context = {}) {
    // Avoid regular update flow for explicitly non-recursive update calls
    if (context.recursive === false) {
      return super.update(data, context);
    }
    const srcData = mergeObject(duplicate(this.data), data, { inplace: false });

    // Update class
    {
      const newLevel = data["data.level"];
      if (this.type === "class" && newLevel !== undefined) {
        const prevLevel = this.data.data.level ?? newLevel;
        if (this._prevLevel !== undefined) delete this._prevLevel;
        await this._onLevelChange(prevLevel, newLevel);
      }
    }

    // Make sure changes remains an array
    if (Object.keys(data).filter((e) => e.startsWith("data.changes.")).length > 0) {
      const changeIndexes = [];
      let subData = Object.entries(data).filter((e) => e[0].startsWith("data.changes."));
      const arr = duplicate(this.data.data.changes || []);

      // Get pre update data for changes
      subData.forEach((entry) => {
        const i = entry[0].split(".").slice(2)[0];

        // Add change update data
        if (!changeIndexes.includes(i)) {
          changeIndexes.push(i);
          const changeID = this.data.data.changes[i]._id;
          const change = this.changes.get(changeID);
          if (change) {
            const changeDataPrefix = `data.changes.${i}.`;
            const thisChangeData = subData
              .filter((o) => o[0].startsWith(changeDataPrefix))
              .reduce((cur, o) => {
                const key = o[0].slice(changeDataPrefix.length);
                cur[key] = o[1];
                return cur;
              }, {});
            const preUpdateData = change.preUpdate(thisChangeData);

            // Apply pre-update data to the data to be parsed
            for (const [k, v] of Object.entries(preUpdateData)) {
              const dataKey = `data.changes.${i}.${k}`;
              data[dataKey] = v;
            }
          }
        }
      });
      // Refresh sub-data
      subData = Object.entries(data).filter((e) => e[0].startsWith("data.changes."));

      subData.forEach((entry) => {
        const subKey = entry[0].split(".").slice(2);
        const i = subKey[0];
        const subKey2 = subKey.slice(1).join(".");

        if (!arr[i]) arr[i] = {};

        // Remove property
        if (subKey[subKey.length - 1].startsWith("-=")) {
          const obj = flattenObject(arr[i]);
          subKey[subKey.length - 1] = subKey[subKey.length - 1].slice(2);
          const deleteKeys = Object.keys(obj).filter((o) => o.startsWith(subKey.slice(1).join(".")));
          for (const k of deleteKeys) {
            if (Object.prototype.hasOwnProperty.call(obj, k)) {
              delete obj[k];
            }
          }
          arr[i] = expandObject(obj);
        }
        // Add or change property
        else {
          arr[i] = mergeObject(arr[i], expandObject({ [subKey2]: entry[1] }));
        }

        delete data[entry[0]];
      });
      linkData(srcData, data, "data.changes", arr);
    }

    // Make sure inventory contents remains an array
    if (Object.keys(data).filter((e) => e.startsWith("data.inventoryItems.")).length > 0) {
      const subData = Object.entries(data).filter((e) => e[0].startsWith("data.inventoryItems."));
      const arr = duplicate(this.data.data.inventoryItems || []);
      subData.forEach((entry) => {
        const subKey = entry[0].split(".").slice(2);
        const i = subKey[0];
        const subKey2 = subKey.slice(1).join(".");
        if (!arr[i]) arr[i] = {};

        // Remove property
        if (subKey[subKey.length - 1].startsWith("-=")) {
          const obj = flattenObject(arr[i]);
          subKey[subKey.length - 1] = subKey[subKey.length - 1].slice(2);
          const deleteKeys = Object.keys(obj).filter((o) => o.startsWith(subKey.slice(1).join(".")));
          for (const k of deleteKeys) {
            if (Object.prototype.hasOwnProperty.call(obj, k)) {
              delete obj[k];
            }
          }
          arr[i] = expandObject(obj);
        }
        // Add or change property
        else {
          arr[i] = mergeObject(arr[i], expandObject({ [subKey2]: entry[1] }));
        }

        delete data[entry[0]];
      });
      linkData(srcData, data, "data.inventoryItems", arr);
    }

    // Make sure stuff remains an array
    {
      const keepArray = [
        { key: "data.attackParts" },
        { key: "data.damage.parts" },
        { key: "data.damage.critParts" },
        { key: "data.damage.nonCritParts" },
        { key: "data.contextNotes" },
        { key: "data.scriptCalls" },
        { key: "data.attackNotes" },
        { key: "data.effectNotes" },
      ];

      for (const kArr of keepArray) {
        if (Object.keys(data).filter((e) => e.startsWith(`${kArr.key}.`)).length > 0) {
          const subData = Object.entries(data).filter((e) => e[0].startsWith(`${kArr.key}.`));
          const arr = duplicate(getProperty(this.data, kArr.key) || []);
          const keySeparatorCount = (kArr.key.match(/\./g) || []).length;
          subData.forEach((entry) => {
            const subKey = entry[0].split(".").slice(keySeparatorCount + 1);
            const i = subKey[0];
            const subKey2 = subKey.slice(1).join(".");
            if (!arr[i]) arr[i] = {};

            // Single entry array
            if (!subKey2) {
              arr[i] = entry[1];
            }
            // Remove property
            else if (subKey[subKey.length - 1].startsWith("-=")) {
              const obj = flattenObject(arr[i]);
              subKey[subKey.length - 1] = subKey[subKey.length - 1].slice(2);
              const deleteKeys = Object.keys(obj).filter((o) => o.startsWith(subKey.slice(1).join(".")));
              for (const k of deleteKeys) {
                if (Object.prototype.hasOwnProperty.call(obj, k)) {
                  delete obj[k];
                }
              }
              arr[i] = expandObject(obj);
            }
            // Add or change property
            else {
              arr[i] = mergeObject(arr[i], expandObject({ [subKey2]: entry[1] }));
            }

            delete data[entry[0]];
          });

          linkData(srcData, data, kArr.key, arr);
        }
      }
    }

    // Remove non-array conditionals data
    {
      const subData = Object.keys(data).filter((e) => e.startsWith("data.conditionals."));
      if (subData.length > 0) subData.forEach((s) => delete data[s]);
    }

    // Update weight from base weight
    if (srcData.data.baseWeight !== undefined) {
      const baseWeight = srcData.data.baseWeight || 0;
      const weightReduction = Math.max(0, 1 - (srcData.data.weightReduction || 0) / 100);

      let contentsWeight = (srcData.data.inventoryItems || []).reduce((cur, i) => {
        return cur + (getProperty(i, "data.weight") || 0) * (getProperty(i, "data.quantity") || 0);
      }, 0);
      contentsWeight += this._calculateCoinWeight(srcData);
      contentsWeight = Math.round(contentsWeight * weightReduction * 10) / 10;

      linkData(srcData, data, "data.weight", baseWeight + contentsWeight);
    }
    // Update price from base price
    if (data["data.basePrice"] != null) {
      linkData(srcData, data, "data.price", getProperty(srcData, "data.basePrice") || 0);
    }
    if (data["data.unidentified.basePrice"] != null) {
      linkData(srcData, data, "data.unidentified.price", getProperty(srcData, "data.unidentified.basePrice") || 0);
    }

    // Update name
    if (data["data.identifiedName"]) linkData(srcData, data, "name", data["data.identifiedName"]);
    else if (data["name"]) linkData(srcData, data, "data.identifiedName", data["name"]);

    // Update weight according metric system (lb vs kg)
    if (data["data.weightConverted"] != null) {
      linkData(srcData, data, "data.weight", convertWeightBack(data["data.weightConverted"]));
    }

    // Set weapon subtype
    if (data["data.weaponType"] != null && data["data.weaponType"] !== getProperty(this.data, "data.weaponType")) {
      const type = data["data.weaponType"];
      const subtype = data["data.weaponSubtype"] || getProperty(this.data, "data.weaponSubtype") || "";
      const keys = Object.keys(CONFIG.PF1.weaponTypes[type]).filter((o) => !o.startsWith("_"));
      if (!subtype || !keys.includes(subtype)) {
        linkData(srcData, data, "data.weaponSubtype", keys[0]);
      }
    }

    // Set equipment subtype and slot
    if (
      data["data.equipmentType"] != null &&
      data["data.equipmentType"] !== getProperty(this.data, "data.equipmentType")
    ) {
      // Set subtype
      const type = data["data.equipmentType"];
      const subtype = data["data.equipmentSubtype"] || getProperty(this.data, "data.equipmentSubtype") || "";
      let keys = Object.keys(CONFIG.PF1.equipmentTypes[type]).filter((o) => !o.startsWith("_"));
      if (!subtype || !keys.includes(subtype)) {
        linkData(srcData, data, "data.equipmentSubtype", keys[0]);
      }

      // Set slot
      const slot = data["data.slot"] || getProperty(this.data, "data.slot") || "";
      keys = Object.keys(CONFIG.PF1.equipmentSlots[type]);
      if (!slot || !keys.includes(slot)) {
        linkData(srcData, data, "data.slot", keys[0]);
      }
    }

    // Try to convert dictionary flags to numbers
    if (data["data.flags.dictionary"] !== undefined) {
      const flags = data["data.flags.dictionary"];

      for (const f of flags) {
        let value = f[1];
        // Try to convert value to a number
        if (typeof value === "string" && value.match(/^[0-9]+(?:\.[0-9]+)?$/)) {
          const newValue = parseFloat(value);
          if (!Number.isNaN(newValue)) {
            value = newValue;
          }
          f[1] = value;
        }
      }
    }

    // Make sure charges doesn't exceed max charges, and vice versa
    {
      let charges = 0;
      let maxCharges = 0;
      let target = "value";

      if (this.type === "spell") {
        if (data["data.preparation.maxAmount"] != null) target = "max";
        charges = data["data.preparation.preparedAmount"];
        maxCharges = data["data.preparation.maxAmount"];
      } else {
        if (data["data.uses.max"] != null) target = "max";
        charges = data["data.uses.value"];
        maxCharges = data["data.uses.max"];
      }

      if (target === "value" && charges > maxCharges) maxCharges = charges;
      else if (target === "max" && maxCharges < charges) charges = maxCharges;

      const link = getProperty(this, "links.charges");
      if (!link) {
        if (this.type === "spell") {
          linkData(srcData, data, "data.preparation.preparedAmount", charges);
          linkData(srcData, data, "data.preparation.maxAmount", maxCharges);
        } else {
          linkData(srcData, data, "data.uses.value", charges);
          linkData(srcData, data, "data.uses.max", maxCharges);
        }
      } else {
        // Update charges for linked items
        if (data["data.uses.value"] != null) {
          if (link && getProperty(link, "links.charges") == null) {
            await link.update({ "data.uses.value": data["data.uses.value"] });
          }
        }
      }
    }

    this.memorizeVariables();

    const diff = diffObject(flattenObject(this.data), data);
    // Filter diff for arrays that haven't changed. Single level depth with speed as priority
    for (const d in diff) {
      if (!(diff[d] instanceof Array)) continue;
      const origData = getProperty(this.data, d) || [];
      if (diff[d].length !== origData.length) continue;
      const anyDiff = diff[d].some((obj, idx) => {
        if (!isObjectEmpty(diffObject(obj, origData[idx]))) return true;
      });
      if (!anyDiff && !(diff[d] instanceof Array)) delete diff[d];
    }

    if (Object.keys(diff).length && !context.skipUpdate) {
      if (this.parentItem == null) {
        await super.update(diff, context);
      } else {
        // Determine item index to update in parent
        const parentInventory = this.parentItem.data.data.inventoryItems || [];
        const parentItem = parentInventory.find((o) => o._id === this.id);
        const idx = parentInventory.indexOf(parentItem);

        if (idx >= 0) {
          // Replace keys to suit parent item
          for (const [k, v] of Object.entries(diff)) {
            delete diff[k];
            diff[`data.inventoryItems.${idx}.${k}`] = v;
          }

          // Set parent weight
          const contentsWeight = parentInventory.reduce((cur, i) => {
            if (i._id === this.id)
              return cur + (getProperty(srcData, "data.weight") || 0) * (getProperty(srcData, "data.quantity") || 0);
            return cur + (getProperty(i, "data.weight") || 0) * (getProperty(i, "data.quantity") || 0);
          }, 0);
          diff["data.weight"] = (getProperty(this.parentItem.data, "data.baseWeight") || 0) + contentsWeight;

          // Update parent item
          await this.parentItem.update(diff);
          if (context.render !== false) await this.render();
        }
      }
    } else if (context.skipUpdate) {
      diff["_id"] = this.id;
    }

    // Update tokens and the actor using this item
    const actor = this.parent;
    if (actor) {
      // Update actor
      {
        let effectUpdates = {};
        // Update token effects
        if (diff["data.hideFromToken"] != null) {
          const fx = actor.effects.find((fx) => fx.data.origin === this.uuid);
          if (fx) {
            effectUpdates[fx.id] = effectUpdates[fx.id] || {
              "flags.pf1.show": !diff["data.hideFromToken"],
            };
          }
        }

        // Update effects
        effectUpdates = Object.entries(effectUpdates).reduce((cur, o) => {
          const obj = o[1];
          obj._id = o[0];
          cur.push(obj);
          return cur;
        }, []);
        if (effectUpdates.length) await actor.updateEmbeddedDocuments("ActiveEffect", effectUpdates);
      }

      // Update tokens
      const promises = [];
      const tokens = canvas.tokens.placeables.filter((token) => token.actor?.id === actor.id);
      for (const token of tokens) {
        const tokenUpdateData = {};

        // Update tokens with this item as a resource bar
        if (diff["data.uses.value"] != null) {
          for (const barKey of ["bar1", "bar2"]) {
            const bar = token.document.getBarAttribute(barKey);
            if (bar && bar.attribute === `resources.${this.data.data.tag}`) {
              tokenUpdateData[`${barKey}.value`] = diff["data.uses.value"];
            }
          }
        }

        if (!isObjectEmpty(tokenUpdateData)) {
          promises.push(token.document.update(tokenUpdateData));
        }
      }
      if (promises.length) await Promise.all(promises);
    }
  }

  memorizeVariables() {
    const memKeys = this.memoryVariables;
    this._memoryVariables = {};
    for (const k of memKeys) {
      if (hasProperty(this.data, k)) {
        this._memoryVariables[k] = getProperty(this.data, k);
      }
    }
  }

  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);

    if (userId === game.user.id) {
      // Call 'toggle' script calls
      {
        let state = null;
        if (this.data.type === "buff") state = getProperty(changed, "data.active");
        if (this.data.type === "feat") state = getProperty(changed, "data.disabled") === true ? false : true;
        if (state != null) {
          this.executeScriptCalls("toggle", { state });
        }
      }

      // Call 'equip' script calls
      {
        const equipped = getProperty(changed, "data.equipped");
        if (equipped != null) {
          this.executeScriptCalls("equip", { equipped });
        }
      }

      // Call 'changeQuantity' script calls
      if (this._memoryVariables?.["data.quantity"] !== undefined) {
        const quantity = {
          previous: this._memoryVariables["data.quantity"],
          new: getProperty(this.data, "data.quantity"),
        };
        if (quantity.new != null && quantity.new !== quantity.previous) {
          this.executeScriptCalls("changeQuantity", { quantity });
        }
      }

      // Call 'changeLevel' script calls
      if (this._memoryVariables?.["data.level"] !== undefined) {
        const level = {
          previous: parseInt(this._memoryVariables["data.level"]),
          new: parseInt(getProperty(this.data, "data.level")),
        };
        for (const [k, v] of Object.entries(level)) {
          if (Number.isNaN(v)) level[k] = null;
        }
        if (level.new !== undefined && level.new !== level.previous) {
          this.executeScriptCalls("changeLevel", { level });
        }
      }
    }

    // Forget memory variables
    this._memoryVariables = null;
  }

  _updateContentsWeight(data, { srcData = null } = {}) {
    if (!srcData) srcData = duplicate(this.data);

    let result = getProperty(srcData, "data.baseWeight") || 0;

    result += this.items.reduce((cur, i) => {
      return cur + (getProperty(i, "data.weight") || 0);
    }, 0);

    linkData(srcData, data, "data.weight", result);
  }

  _updateMaxUses() {
    // No actor? No charges!
    if (!this.parent) return;

    // No charges? No charges!
    if (!["day", "week", "charges"].includes(getProperty(this.data, "data.uses.per"))) return;

    const rollData = this.getRollData();

    if (hasProperty(this.data, "data.uses.maxFormula")) {
      const maxFormula = getProperty(this.data, "data.uses.maxFormula");
      if (maxFormula !== "" && !formulaHasDice(maxFormula)) {
        const roll = RollPF.safeRoll(maxFormula, rollData);
        setProperty(this.data, "data.uses.max", roll.total);
      } else if (formulaHasDice(maxFormula)) {
        const msg = game.i18n
          .localize("PF1.WarningNoDiceAllowedInFormula")
          .format(game.i18n.localize("PF1.ChargePlural"), this.name);
        console.warn(msg);
        ui.notifications.warn(msg);
      }
    }
  }

  // Determines the starting data for an ActiveEffect based off this item
  getRawEffectData() {
    return {
      label: this.name,
      icon: this.img,
      origin: this.uuid,
      disabled: !this.isActive,
      duration: {},
    };
  }

  // Fetches all this item's script calls of a specified category
  getScriptCalls(category) {
    return this.scriptCalls?.filter((s) => s.category === category) ?? [];
  }

  /* -------------------------------------------- */

  /**
   * Roll the item to Chat, creating a chat card which contains follow up attack or damage roll options
   *
   * @param altChatData
   * @param {Object} options
   * @param {boolean} options.addDC
   * @param {string|undefined} options.rollMode Roll mode override.
   * @returns {Promise|undefined}
   */
  async roll(altChatData = {}, { addDC = true, rollMode } = {}) {
    const actor = this.parent;
    if (actor && !actor.isOwner) {
      const msg = game.i18n.localize("PF1.ErrorNoActorPermissionAlt").format(actor.name);
      console.warn(msg);
      return ui.notifications.warn(msg);
    }

    const allowed = Hooks.call("itemUse", this, "description", { altChatData, addDC });
    if (allowed === false) return;

    // Basic template rendering data
    const token = this.parent.token;
    const saveType = getProperty(this.data, "data.save.type");
    const saveDC = this.getDC();
    const templateData = {
      actor: this.parent,
      tokenId: token ? token.uuid : null,
      item: this.data,
      data: this.getChatData(),
      labels: this.labels,
      hasAttack: this.hasAttack,
      hasMultiAttack: this.hasMultiAttack,
      hasAction: this.hasAction || this.isCharged,
      isHealing: this.isHealing,
      hasDamage: this.hasDamage,
      hasRange: this.hasRange,
      hasEffect: this.hasEffect,
      isVersatile: this.isVersatile,
      hasSave: this.hasSave && addDC,
      isSpell: this.data.type === "spell",
      description: this.fullDescription,
      rollData: this.getRollData(),
      save: {
        dc: saveDC,
        type: saveType,
        label: game.i18n
          .localize("PF1.SavingThrowButtonLabel")
          .format(CONFIG.PF1.savingThrows[saveType], saveDC.toString()),
      },
      hasExtraProperties: false,
      extraProperties: [],
    };

    // Add combat info
    if (game.combat) {
      const combatProps = [];
      // Add round info
      combatProps.push(game.i18n.localize("PF1.CombatInfo_Round").format(game.combat.round));

      if (combatProps.length > 0) {
        templateData.extraProperties.push({ header: game.i18n.localize("PF1.CombatInfo_Header"), value: combatProps });
        templateData.hasExtraProperties = true;
      }
    }

    // Roll spell failure chance
    if (templateData.isSpell && this.parent != null && this.parent.spellFailure > 0) {
      const spellbook = getProperty(this.parent.data, `data.attributes.spells.spellbooks.${this.data.data.spellbook}`);
      if (spellbook && spellbook.arcaneSpellFailure) {
        templateData.spellFailure = RollPF.safeRoll("1d100").total;
        templateData.spellFailureSuccess = templateData.spellFailure > this.parentActor.spellFailure;
      }
    }

    // Render the chat card template
    const templateType = ["consumable"].includes(this.data.type) ? this.data.type : "item";
    const template = `systems/pf1/templates/chat/${templateType}-card.hbs`;

    // Determine metadata
    const metadata = {};
    metadata.item = this.id;

    // Basic chat message data
    const chatData = flattenObject(
      mergeObject(
        {
          user: game.user.id,
          type: CONST.CHAT_MESSAGE_TYPES.OTHER,
          speaker: ChatMessage.getSpeaker({ actor: this.parent }),
          flags: {
            core: {
              canPopout: true,
            },
            pf1: {
              metadata,
            },
          },
        },
        altChatData
      )
    );

    // Create the chat message
    return createCustomChatMessage(template, templateData, chatData);
  }

  /* -------------------------------------------- */
  /*  Chat Cards																	*/
  /* -------------------------------------------- */

  getChatData(htmlOptions, rollData = null) {
    const data = duplicate(this.data.data);
    const labels = this.labels;

    if (!rollData) rollData = this.getRollData();

    htmlOptions = mergeObject(htmlOptions || {}, rollData);

    // Rich text description
    if (this.showUnidentifiedData) {
      data.description.value = TextEditor.enrichHTML(data.description.unidentified, { rollData: htmlOptions });
    } else {
      data.description.value = TextEditor.enrichHTML(data.description.value, { rollData: htmlOptions });
    }

    // General equipment properties
    const props = [];
    if (Object.prototype.hasOwnProperty.call(data, "equipped") && ["weapon", "equipment"].includes(this.data.type)) {
      props.push(data.equipped ? game.i18n.localize("PF1.Equipped") : game.i18n.localize("PF1.NotEquipped"));
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
            rangeValue = convertDistance(RollPF.safeRoll(data.range.value || "0", rollData).total, data.range.units);
            break;
          case "spec":
            rangeValue = convertDistance(RollPF.safeRoll(data.range.value || "0", rollData).total);
            break;
        }
        dynamicLabels.range =
          rangeValue[0] > 0
            ? game.i18n.localize("PF1.RangeNote").format(`${rangeValue[0]} ${CONFIG.PF1.measureUnits[rangeValue[1]]}`)
            : null;
      }

      // Add Difficulty Modifier (DC) label
      props.push(labels.save);
      const saveDesc = this.data.data.save.description;
      if (saveDesc.length > 0) props.push(saveDesc);

      // Duration
      if (data.duration != null) {
        if (!["inst", "perm"].includes(data.duration.units) && typeof data.duration.value === "string") {
          const duration = RollPF.safeRoll(data.duration.value || "0", rollData).total;
          dynamicLabels.duration = [duration, CONFIG.PF1.timePeriods[data.duration.units]].filterJoin(" ");
        }
      }

      // Item type specific properties
      const fn = this[`_${this.data.type}ChatData`];
      if (fn) fn.bind(this)(data, labels, props);

      // Ability activation properties
      if (Object.prototype.hasOwnProperty.call(data, "activation")) {
        props.push(labels.target, labels.activation, dynamicLabels.range, dynamicLabels.duration);
      }
    }

    // Get per item type chat data
    this.getTypeChatData(data, labels, props);

    // Filter properties and return
    data.properties = props.filter((p) => !!p);
    return data;
  }

  /**
   * Per item type chat data.
   *
   * @param data
   * @param labels
   * @param props
   */
  getTypeChatData(data, labels, props) {
    // Charges as used by most item types, except spells
    if (this.isCharged && !this.data.data.atWill) {
      props.push(`${game.i18n.localize("PF1.ChargePlural")}: ${this.charges}/${this.maxCharges}`);
    }
  }

  /* -------------------------------------------- */
  /*  Item Rolls - Attack, Damage, Saves, Checks  */
  /* -------------------------------------------- */

  /**
   * @param {Object} options
   * @param {Event} options.ev
   * @param {boolean} options.skipDialog
   * @param {boolean} options.chatMessage
   * @param {string|undefined} options.rollMode Roll mode override
   */
  async use({ ev = null, skipDialog = false, chatMessage = true, rollMode } = {}) {
    if (this.hasAction) {
      return this.useAttack({ ev, skipDialog, chatMessage, rollMode });
    }

    // Use
    const useScriptCalls = this.scriptCalls.filter((o) => o.category === "use");
    let shared;
    if (useScriptCalls.length > 0) {
      const data = { chatMessage };

      shared = await this.executeScriptCalls("use", { attacks: [], template: undefined, data });
      if (shared.reject) return shared;
      if (shared.hideChat !== true) await this.roll();
    }
    // Show a chat card if this item doesn't have 'use' type script call(s)
    else {
      if (chatMessage) return this.roll(undefined, { rollMode });
      else return { descriptionOnly: true }; // nothing to show for printing description
    }

    // Deduct charges
    if (this.isCharged) {
      if (this.charges < this.chargeCost) {
        if (this.isSingleUse) {
          const msg = game.i18n.localize("PF1.ErrorNoQuantity");
          console.warn(msg);
          return ui.notifications.warn(msg);
        }
        const msg = game.i18n.localize("PF1.ErrorInsufficientCharges").format(this.name);
        console.warn(msg);
        return ui.notifications.warn(msg);
      }
      if (this.autoDeductCharges) {
        await this.addCharges(-this.chargeCost);
      }
    }

    return shared;
  }

  parseFormulaicAttacks({ formula = null } = {}) {
    if (!this.parentActor) return;

    const exAtkCountFormula = formula ?? (this.data.data.formulaicAttacks?.count?.formula || "");
    let extraAttacks = 0,
      xaroll;
    const rollData = this.getRollData();
    if (exAtkCountFormula.length > 0) {
      xaroll = RollPF.safeRoll(exAtkCountFormula, rollData);
      extraAttacks = Math.min(50, Math.max(0, xaroll.total)); // Arbitrarily clamp attacks
    }
    if (xaroll?.err) {
      const msg = game.i18n.localize("PF1.ErrorItemFormula").format(this.name, this.actor?.name);
      console.warn(msg, xaroll.err, exAtkCountFormula);
      ui.notifications.warn(msg);
    }

    // Test bonus attack formula
    const exAtkBonusFormula = this.data.data.formulaicAttacks?.bonus || "";
    try {
      if (exAtkBonusFormula.length > 0) {
        rollData["attackCount"] = 1;
        RollPF.safeRoll(exAtkBonusFormula, rollData);
      }
    } catch (err) {
      const msg = game.i18n.localize("PF1.ErrorItemFormula").format(this.name, this.actor?.name);
      console.warn(msg, err, exAtkBonusFormula);
      ui.notifications.warn(msg);
    }

    // Update item
    setProperty(this.data, "data.formulaicAttacks.count.value", extraAttacks);

    return extraAttacks;
  }

  /**
   *
   * @param {Object} options
   * @param {Event} options.ev
   * @param {boolean} options.skipDialog
   * @param {boolean} options.chatMessage
   * @param {string} options.dice Die roll override.
   * @param {string|undefined} options.rollMode Roll mode override.
   */
  async useAttack({ ev = null, skipDialog = false, chatMessage = true, dice = "1d20", rollMode } = {}) {
    if (ev && ev.originalEvent) ev = ev.originalEvent;

    // Prepare variables
    const shared = {
      event: ev,
      ammoLinks: [],
      ammoAvailable: Number.POSITIVE_INFINITY,
      ammoRequired: 0,
      ammoUsed: 0,
      rollData: {},
      skipDialog,
      chatMessage,
      dice,
      fullAttack: true,
      attackBonus: [],
      damageBonus: [],
      attacks: [],
      chatAttacks: [],
      rollMode: game.settings.get("core", "rollMode"),
      useMeasureTemplate: this.hasTemplate && game.settings.get("pf1", "placeMeasureTemplateOnQuickRolls"),
      conditionals: null,
      conditionalPartsCommon: {},
      casterLevelCheck: false,
      concentrationCheck: false,
      scriptData: {},
    };

    const _callFn = (fnName, ...args) => {
      return game.pf1.ItemAttack[fnName].call(this, shared, ...args);
    };

    // Check requirements for item
    let reqErr = await _callFn("checkRequirements");
    if (reqErr > 0) return { err: game.pf1.ItemAttack.ERR_REQUIREMENT, code: reqErr };

    // Call itemUse hook and determine whether the item can be used based off that
    const allowed = Hooks.call("itemUse", this, "attack", { ev, skipDialog, dice });
    if (allowed === false) return;

    // Get new roll data
    shared.rollData = await _callFn("getRollData");

    // Show attack dialog, if appropriate
    if (!skipDialog) {
      const result = await _callFn("createAttackDialog");

      // Stop if result is a boolean (i.e. when closed is clicked on the dialog)
      if (typeof result !== "object") return;

      // Alter roll data
      shared.fullAttack = result.fullAttack;
      await _callFn("alterRollData", result.html);
    }

    // Generate attacks
    const baseAttacks = await _callFn("generateAttacks");
    shared.attacks = shared.fullAttack ? [...baseAttacks, ...shared.attacks] : baseAttacks;
    // Handle conditionals
    await _callFn("handleConditionals");

    // Check attack requirements, post-dialog
    reqErr = await _callFn("checkAttackRequirements");
    if (reqErr > 0) return { err: game.pf1.ItemAttack.ERR_REQUIREMENT, code: reqErr };

    // Generate chat attacks
    await _callFn("generateChatAttacks");

    // Prompt measure template
    let measureResult;
    if (shared.useMeasureTemplate) {
      measureResult = await _callFn("promptMeasureTemplate");
      if (!measureResult.result) return;
    }

    // Override roll mode if present.
    if (rollMode) shared.rollMode = rollMode;

    // Call script calls
    await _callFn("executeScriptCalls");
    if (shared.scriptData?.reject) {
      await measureResult?.delete();
      return;
    }

    // Handle Dice So Nice
    await _callFn("handleDiceSoNice");

    // Subtract uses
    if (shared.ammoUsed > 0) await _callFn("subtractAmmo", shared.ammoUsed);
    if (shared.rollData.chargeCost < 0 || shared.rollData.chargeCost > 0)
      await this.addCharges(-shared.rollData.chargeCost);

    // Retrieve message data
    await _callFn("getMessageData");

    // Post message
    let result;
    if (shared.scriptData?.hideChat !== true) {
      result = await _callFn("postMessage");
    } else return;

    // Deselect targets
    if (game.settings.get("pf1", "clearTargetsAfterAttack")) {
      for (const t of game.user.targets) {
        t.setTarget(false);
      }
    }

    return result;
  }

  /**
   * Finds, filters and alters changes relevant to a context, and returns the result (as an array)
   *
   * @param {string} [context="mattack"] - The given context. Either "mattack", "rattack", "wdamage", "sdamage".
   * @returns {ItemChange[]} The resulting changes.
   */
  getContextChanges(context = "attack") {
    let result = this.actor.changes;

    switch (context) {
      case "mattack":
      case "rattack": {
        const subTargetList = ["attack", context];
        result = result.filter((c) => {
          if (!subTargetList.includes(c.subTarget)) return false;
          return true;
        });
        // Add masterwork bonus
        if (getProperty(this.data, "data.masterwork") === true && !getProperty(this.data, "data.enh")) {
          result.push(
            ItemChange.create({
              formula: "1",
              operator: "add",
              target: "attack",
              subTarget: "attack",
              modifier: "enh",
              value: 1,
              flavor: game.i18n.localize("PF1.Masterwork"),
            })
          );
        }
        // Add enhancement bonus
        if (getProperty(this.data, "data.enh")) {
          const enh = getProperty(this.data, "data.enh");
          result.push(
            ItemChange.create({
              formula: enh.toString(),
              operator: "add",
              target: "attack",
              subTarget: "attack",
              modifier: "enh",
              value: enh,
              flavor: game.i18n.localize("PF1.EnhancementBonus"),
            })
          );
        }
        break;
      }
      case "wdamage":
      case "sdamage": {
        const subTargetList = ["damage", context];
        result = result.filter((c) => {
          if (!subTargetList.includes(c.subTarget)) return false;
          return true;
        });
        // Add enhancement bonus
        if (getProperty(this.data, "data.enh")) {
          const enh = getProperty(this.data, "data.enh");
          result.push(
            ItemChange.create({
              formula: enh.toString(),
              operator: "add",
              target: "attack",
              subTarget: "attack",
              modifier: "enh",
              value: enh,
              flavor: game.i18n.localize("PF1.EnhancementBonus"),
            })
          );
        }
        break;
      }
      case "damage": {
        result = result.filter((c) => c.subTarget === "damage");
        break;
      }
    }

    return result;
  }

  /**
   * Place an attack roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.d20Roll logic for the core implementation
   *
   * @param root0
   * @param root0.data
   * @param root0.extraParts
   * @param root0.bonus
   * @param root0.primaryAttack
   */
  async rollAttack({ data = null, extraParts = [], bonus = null, primaryAttack = true } = {}) {
    const rollData = duplicate(data ?? this.getRollData());
    const itemData = rollData.item;

    rollData.item.primaryAttack = primaryAttack;

    const isRanged = ["rwak", "rsak", "rcman"].includes(itemData.actionType);
    const isCMB = ["mcman", "rcman"].includes(itemData.actionType);

    // Determine size bonus
    rollData.sizeBonus = !isCMB
      ? CONFIG.PF1.sizeMods[rollData.traits.size]
      : CONFIG.PF1.sizeSpecialMods[rollData.traits.size];

    // Add misc bonuses/penalties
    rollData.item.proficiencyPenalty = -4;

    // Determine ability score modifier
    const abl = itemData.ability.attack;

    // Define Roll parts
    let parts = [];

    this.parentActor.sourceDetails["data.attributes.attack.shared"]
      ?.reverse()
      .forEach((s) => parts.push(`${s.value}[${s.name}]`));

    // CMB specific modifiers
    if (isCMB) {
      this.parentActor.sourceDetails["data.attributes.cmb.bonus"]
        ?.reverse()
        .forEach((s) => parts.push(`${s.value}[${s.name}]`));
    }

    // Add size bonus
    if (rollData.sizeBonus !== 0) parts.push(`@sizeBonus[${game.i18n.localize("PF1.Size")}]`);

    // Add ability modifier
    if (abl != "" && rollData.abilities[abl] != null && rollData.abilities[abl].mod !== 0) {
      parts.push(`@abilities.${abl}.mod[${CONFIG.PF1.abilities[abl]}]`);
    }
    // Add bonus parts
    parts = parts.concat(extraParts);
    // Add attack bonus
    if (typeof itemData.attackBonus === "string" && !["", "0"].includes(itemData.attackBonus)) {
      parts.push(itemData.attackBonus);
    }
    // Backwards compatibility
    else if (typeof itemData.attackBonus === "number") {
      rollData.item.attackBonus = itemData.attackBonus;
      parts.push(`@item.attackBonus[${game.i18n.localize("PF1.AttackRollBonus")}]`);
    }

    // Add change bonus
    const changes = this.getContextChanges(isRanged ? "rattack" : "mattack");
    let changeBonus = [];
    {
      // Get attack bonus
      changeBonus = getHighestChanges(
        changes.filter((c) => {
          c.applyChange(this.actor);
          return !["set", "="].includes(c.operator);
        }),
        { ignoreTarget: true }
      ).reduce((cur, c) => {
        cur.push({
          value: c.value,
          source: c.flavor,
        });
        return cur;
      }, []);
    }
    for (const c of changeBonus) {
      parts.push(`${c.value}[${RollPF.cleanFlavor(c.source)}]`);
    }

    // Add proficiency penalty
    if (this.data.type === "attack" && !itemData.proficient) {
      parts.push(`@item.proficiencyPenalty[${game.i18n.localize("PF1.ProficiencyPenalty")}]`);
    }
    // Add secondary natural attack penalty
    if (this.data.data.attackType === "natural" && primaryAttack === false) {
      const penalty = -5;
      parts.push(`${penalty}[${game.i18n.localize("PF1.SecondaryAttack")}]`);
    }
    // Add bonus
    if (bonus) {
      rollData.bonus = RollPF.safeRoll(bonus, rollData).total;
      parts.push(`@bonus[${game.i18n.localize("PF1.SituationalBonus")}]`);
    }

    if ((rollData.d20 ?? "") === "") rollData.d20 = "1d20";

    const roll = await RollPF.create([rollData.d20, ...parts.filter((p) => !!p)].join("+"), rollData).evaluate();
    return roll;
  }

  /* -------------------------------------------- */

  /**
   * Only roll the item's effect.
   *
   * @param root0
   * @param root0.critical
   * @param root0.primaryAttack
   */
  rollEffect({ critical = false, primaryAttack = true } = {}) {
    const rollData = this.getRollData();

    if (!this.hasEffect) {
      throw new Error("You may not make an Effect Roll with this Item.");
    }

    // Determine critical multiplier
    rollData.critMult = 1;
    if (critical) rollData.critMult = this.data.data.ability.critMult;
    // Determine ability multiplier
    if (this.data.data.ability.damageMult != null) rollData.ablMult = this.data.data.ability.damageMult;
    if (this.data.data.attackType === "natural" && primaryAttack === false && rollData.ablMult > 0)
      rollData.ablMult = 0.5;

    // Create effect string
    const effectNotes = this.parent.getContextNotes("attacks.effect").reduce((cur, o) => {
      o.notes
        .reduce((cur2, n) => {
          cur2.push(...n.split(/[\n\r]+/));
          return cur2;
        }, [])
        .forEach((n) => {
          cur.push(n);
        });
      return cur;
    }, []);
    effectNotes.push(...this.data.data.effectNotes);
    let effectContent = "";
    for (const fx of effectNotes) {
      if (fx.length > 0) {
        effectContent += `<span class="tag">${fx}</span>`;
      }
    }

    if (effectContent.length === 0) return "";

    const inner = TextEditor.enrichHTML(effectContent, { rollData: rollData });
    return `<div class="flexcol property-group"><label>${game.i18n.localize(
      "PF1.EffectNotes"
    )}</label><div class="flexrow tag-list">${inner}</div></div>`;
  }

  /**
   * Place an attack roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.d20Roll logic for the core implementation
   *
   * @param options
   */
  async rollFormula(options = {}) {
    const itemData = this.data.data;
    if (!itemData.formula) {
      throw new Error(game.i18n.localize("PF1.ErrorNoFormula").format(this.name));
    }

    // Define Roll Data
    const rollData = this.parent.getRollData();
    rollData.item = itemData;
    const title = `${this.name} - ${game.i18n.localize("PF1.OtherFormula")}`;

    const roll = await RollPF.create(itemData.formula, rollData).evaluate();
    return roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.parent }),
      flavor: itemData.chatFlavor || title,
      rollMode: game.settings.get("core", "rollMode"),
    });
  }

  /**
   * Place a damage roll using an item (weapon, feat, spell, or equipment)
   * Rely upon the DicePF.damageRoll logic for the core implementation
   *
   * @param root0
   * @param root0.data
   * @param root0.critical
   * @param root0.extraParts
   * @param root0.conditionalParts
   * @param root0.primaryAttack
   */
  async rollDamage({
    data = null,
    critical = false,
    extraParts = [],
    conditionalParts = {},
    primaryAttack = true,
  } = {}) {
    const rollData = duplicate(data ?? this.getRollData());

    if (!this.hasDamage) {
      throw new Error("You may not make a Damage Roll with this Item.");
    }

    // Determine critical multiplier
    rollData.critMult = 1;
    if (critical) rollData.critMult = this.data.data.ability.critMult;
    // Determine ability multiplier
    if (rollData.ablMult == null) rollData.ablMult = this.data.data.ability.damageMult;
    if (this.data.data.attackType === "natural" && primaryAttack === false && rollData.ablMult > 0)
      rollData.ablMult = 0.5;

    // Define Roll parts
    let parts = this.data.data.damage.parts.map((p) => {
      return { base: p[0], extra: [], damageType: p[1], type: "normal" };
    });
    // Add conditionals damage
    conditionalParts["damage.normal"]?.forEach((p) => {
      const [base, damageType, isExtra] = p;
      isExtra ? parts[0].extra.push(base) : parts.push({ base, extra: [], damageType, type: "normal" });
    });
    // Add critical damage parts
    if (critical === true) {
      if (getProperty(this.data, "data.damage.critParts") != null) {
        parts = parts.concat(
          this.data.data.damage.critParts.map((p) => {
            return { base: p[0], extra: [], damageType: p[1], type: "crit" };
          })
        );
      }
      // Add conditional critical damage parts
      conditionalParts["damage.crit"]?.forEach((p) => {
        const [base, damageType, isExtra] = p;
        isExtra ? parts[0].extra.push(base) : parts.push({ base, extra: [], damageType, type: "crit" });
      });
    }
    // Add non-critical damage parts
    if (critical === false) {
      if (getProperty(this.data, "data.damage.nonCritParts") != null) {
        parts = parts.concat(
          this.data.data.damage.nonCritParts.map((p) => {
            return { base: p[0], extra: [], damageType: p[1], type: "nonCrit" };
          })
        );
      }
      // Add conditional non-critical damage parts
      conditionalParts["damage.nonCrit"]?.forEach((p) => {
        const [base, damageType, isExtra] = p;
        isExtra ? parts[0].extra.push(base) : parts.push({ base, extra: [], damageType, type: "nonCrit" });
      });
    }

    if (!this.isHealing) {
      const isSpell = ["msak", "rsak", "spellsave"].includes(this.data.data.actionType);
      const isWeapon = ["mwak", "rwak"].includes(this.data.data.actionType);
      const changes = this.getContextChanges(isSpell ? "sdamage" : isWeapon ? "wdamage" : "damage");
      let changeBonus = [];
      {
        // Get damage bonus
        changeBonus = getHighestChanges(
          changes.filter((c) => {
            c.applyChange(this.actor);
            return !["set", "="].includes(c.operator);
          }),
          { ignoreTarget: true }
        ).reduce((cur, c) => {
          if (c.value)
            cur.push({
              value: c.value,
              source: c.flavor,
            });
          return cur;
        }, []);
      }
      for (const c of changeBonus) {
        parts[0].extra.push(`${c.value}[${c.source}]`);
      }

      // Add broken penalty
      if (this.data.data.broken) {
        const label = game.i18n.localize("PF1.Broken");
        parts[0].extra.push(`-2[${label}]`);
      }
    }

    // Determine ability score modifier
    const abl = this.data.data.ability.damage;
    if (typeof abl === "string" && abl !== "") {
      // Determine ability score bonus
      rollData.ablDamage = Math.floor(rollData.abilities[abl].mod * rollData.ablMult);
      if (rollData.abilities[abl].mod < 0) rollData.ablDamage = rollData.abilities[abl].mod;

      // Determine ability score label
      const ablLabel = CONFIG.PF1.abilities[abl];

      // Add ability score
      parts[0].extra.push(`@ablDamage[${ablLabel}]`);
    }

    // Create roll
    const rolls = [];
    for (let a = 0; a < parts.length; a++) {
      const part = parts[a];
      let rollParts = [];
      if (a === 0) rollParts = [...part.extra, ...extraParts];
      const roll = {
        roll: await RollPF.create([part.base, ...rollParts].join(" + "), rollData).evaluate(),
        damageType: part.damageType,
        type: part.type,
      };
      rolls.push(roll);
    }

    return rolls;
  }

  /* -------------------------------------------- */

  /**
   * Use a consumable item
   *
   * @param options
   */
  async useConsumable(options = { chatMessage: true }) {
    const itemData = this.data.data;
    let parts = itemData.damage.parts;
    const data = this.getRollData();

    const allowed = Hooks.call("itemUse", this, "consumable", options);
    if (allowed === false) return;

    // Add effect string
    let effectStr = "";
    if (typeof itemData.effectNotes === "string" && itemData.effectNotes.length) {
      effectStr = DicePF.messageRoll({
        data: data,
        msgStr: itemData.effectNotes,
      });
    }

    parts = parts.map((obj) => {
      return obj[0];
    });
    // Submit the roll to chat
    if (effectStr === "") {
      await RollPF.create(parts.join(" + ")).toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.parentActor }),
        flavor: game.i18n.localize("PF1.UsesItem").format(this.name),
      });
    } else {
      const chatTemplate = "systems/pf1/templates/chat/roll-ext.hbs";
      const chatTemplateData = { hasExtraText: true, extraText: effectStr };
      // Execute the roll
      const roll = await RollPF.create(parts.join("+"), data).evaluate();

      // Create roll template data
      const rollData = mergeObject(
        {
          user: game.user._id,
          formula: roll.formula,
          tooltip: await roll.getTooltip(),
          total: roll.total,
        },
        chatTemplateData || {}
      );

      // Create chat data
      const chatData = {
        user: game.user._id,
        type: CONST.CHAT_MESSAGE_TYPES.CHAT,
        rollMode: game.settings.get("core", "rollMode"),
        sound: CONFIG.sounds.dice,
        speaker: ChatMessage.getSpeaker({ actor: this.parent }),
        flavor: game.i18n.localize("PF1.UsesItem").format(this.name),
        description: this.fullDescription,
        roll: roll,
        content: await renderTemplate(chatTemplate, rollData),
      };
      // Handle different roll modes
      ChatMessage.applyRollMode(chatData, chatData.rollMode);

      // Send message
      if (options.chatMessage) ChatMessage.create(chatData);

      return roll;
    }
  }

  /* -------------------------------------------- */

  /**
   * @returns {object} An object with data to be used in rolls in relation to this item.
   */
  getRollData() {
    const result = this.parent != null && this.parent.data ? this.parent.getRollData() : {};

    result.item = this.data.data;

    // Add dictionary flag
    if (this.data.data.tag) {
      result.item.dFlags = getProperty(result, `dFlags.${this.data.data.tag}`);
    }

    // Set aura strength
    setProperty(result, "item.auraStrength", this.auraStrength);

    result.dc = this.hasSave ? this.getDC(result) : 0;

    this._rollData = result.item;

    Hooks.callAll("pf1.getRollData", this, result, true);

    return result;
  }

  /* -------------------------------------------- */

  static chatListeners(html) {
    html.on("click", ".card-buttons button", this._onChatCardButton.bind(this));
    html.on("click", ".item-name", this._onChatCardToggleContent.bind(this));
  }

  /* -------------------------------------------- */

  static async _onChatCardButton(event) {
    event.preventDefault();

    // Extract card data
    const button = event.currentTarget;
    button.disabled = true;
    const card = button.closest(".chat-card");
    const messageId = card.closest(".message").dataset.messageId;
    const message = game.messages.get(messageId);
    const action = button.dataset.action;

    // Validate permission to proceed with the roll
    const isTargetted = ["save", "applyDamage"].includes(action);
    if (!(isTargetted || game.user.isGM || message.isAuthor)) return;

    // Get the Actor from a synthetic Token
    const actor = await this._getChatCardActor(card);
    if (!actor) {
      if (action === "applyDamage") {
        await this._onChatCardAction(action, { button: button });
        button.disabled = false;
      }
      return;
    }

    // Get the Item
    const item = actor.items.get(card.dataset.itemId);

    // Perform action
    if (!(await this._onChatCardAction(action, { button: button, item: item }))) {
      button.disabled = false;
    }
  }

  static async _onChatCardAction(action, { button = null, item = null } = {}) {
    // Get card targets
    // const targets = isTargetted ? this._getChatCardTargets(card) : [];

    // Consumable usage
    if (action === "consume") await item.useConsumable({ event });
    // Apply damage
    else if (action === "applyDamage") {
      let asNonlethal = [...button.closest(".chat-message")?.querySelectorAll(".tag")]
        .map((o) => o.innerText)
        .includes(game.i18n.localize("PF1.Nonlethal"));
      if (button.dataset.tags?.split(" ").includes("nonlethal")) asNonlethal = true;

      const value = button.dataset.value;
      if (!isNaN(parseInt(value))) ActorPF.applyDamage(parseInt(value), { asNonlethal });
    }
    // Recover ammunition
    else if (["recoverAmmo", "forceRecoverAmmo"].includes(action)) {
      if (!item) return;

      const ammoLinks = await item.getLinkedItems("ammunition", true);
      let recovered = false;
      let failed = false;
      const promises = [];

      for (const l of ammoLinks) {
        let chance = 100;
        if (action === "recoverAmmo") {
          chance = l.linkData.recoverChance;
        }

        if (chance >= Math.random() * 100) {
          recovered = true;
          promises.push(l.item.addCharges(1));
        } else {
          failed = true;
        }
      }

      // Disable button
      if (button) {
        button.disabled = true;
        if (recovered && !failed) {
          button.style.backgroundColor = "#00AA00";
        } else if (!recovered && failed) {
          button.style.backgroundColor = "#AA0000";
        } else if (recovered && failed) {
          button.style.backgroundColor = "#0000AA";
        }
      }

      await Promise.all(promises);

      return true;
    } else if (action === "concentration") {
      item.parentActor.rollConcentration(item.data.data.spellbook);
    } else if (action === "caster-level-check") {
      item.parentActor.rollCL(item.data.data.spellbook);
    }

    return false;
  }

  /* -------------------------------------------- */

  /**
   * Handle toggling the visibility of chat card content when the name is clicked
   *
   * @param {Event} event   The originating click event
   * @private
   */
  static _onChatCardToggleContent(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const card = header.closest(".chat-card");
    const content = card.querySelector(".card-content");
    content.style.display = content.style.display === "none" ? "block" : "none";

    // Update chat popout size
    const popout = header.closest(".chat-popout");
    if (popout) {
      popout.style.height = "auto";
    }
  }

  /**
   * Get the Actor which is the author of a chat card
   *
   * @param {HTMLElement} card    The chat card being used
   * @returns {Actor|null}         The Actor Document or null
   * @private
   */
  static async _getChatCardActor(card) {
    // Case 1 - a synthetic actor from a Token
    const tokenUuid = card.dataset.tokenId;
    if (tokenUuid) {
      return (await fromUuid(tokenUuid))?.actor;
    }

    // Case 2 - use Actor ID directory
    const actorId = card.dataset.actorId;
    return game.actors.get(actorId) || null;
  }

  /* -------------------------------------------- */

  /**
   * Get the Actor which is the author of a chat card
   *
   * @param {HTMLElement} card    The chat card being used
   * @returns {Array.<Actor>}      The Actor Document or null
   * @private
   */
  static _getChatCardTargets(card) {
    const character = game.user.character;
    const controlled = canvas.tokens.controlled;
    const targets = controlled.reduce((arr, t) => (t.actor ? arr.concat([t.actor]) : arr), []);
    if (character && controlled.length === 0) targets.push(character);
    if (!targets.length) throw new Error(`You must designate a specific Token as the roll target`);
    return targets;
  }

  /**
   * @param {string} linkType - The type of link.
   * @param {string} dataType - Either "compendium", "data" or "world".
   * @param {object} targetItem - The target item to link to.
   * @param {string} itemLink - The link identifier for the item.
   * @returns {boolean} Whether a link to the item is possible here.
   */
  canCreateItemLink(linkType, dataType, targetItem, itemLink) {
    const actor = this.parent;
    const sameActor = actor && targetItem.actor && targetItem.actor.id === actor.id;

    // Don't create link to self
    const itemId = itemLink.split(".").slice(-1)[0];
    if (itemId === this.id) return false;

    // Don't create existing links
    const links = getProperty(this.data, `data.links.${linkType}`) || [];
    if (links.filter((o) => o.id === itemLink).length) return false;

    const targetLinks = getProperty(targetItem.data, `data.links.${linkType}`);
    if (["children", "charges", "ammunition"].includes(linkType) && sameActor) {
      if (linkType === "charges") {
        // Prevent the closing of charge link loops
        if (targetLinks.length > 0) {
          ui.notifications.warn(
            game.i18n.localize("PF1.WarningCannotCreateChargeLink").format(this.name, targetItem.name)
          );
          return false;
        } else if (targetItem.links.charges != null) {
          // Prevent the linking of one item to multiple resource pools
          ui.notifications.warn(
            game.i18n
              .localize("PF1.WarningCannotCreateChargeLink2")
              .format(this.name, targetItem.name, targetItem.links.charges.name)
          );
          return false;
        }
      }
      return true;
    }

    if (linkType === "classAssociations" && dataType === "compendium") return true;

    return false;
  }

  /**
   * @param {string} linkType - The type of link.
   * @param {string} dataType - Either "compendium", "data" or "world".
   * @param {object} targetItem - The target item to link to.
   * @param {string} itemLink - The link identifier for the item.
   * @returns {Array} An array to insert into this item's link data.
   */
  generateInitialLinkData(linkType, dataType, targetItem, itemLink) {
    const result = {
      id: itemLink,
      dataType: dataType,
      name: targetItem.name,
      img: targetItem.data.img,
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
   * Creates a link to another item.
   *
   * @param {string} linkType - The type of link.
   * e.g. "children", "charges", "classAssociations" or "ammunition".
   * @param {string} dataType - Either "compendium", "data" or "world".
   * @param {object} targetItem - The target item to link to.
   * @param {string} itemLink - The link identifier for the item.
   * e.g. "world.NExqvEMCMbDuDxv5" (world item), "pf1.feats.NExqvEMCMbDuDxv5" (compendium item) or
   * "NExqvEMCMbDuDxv5" (item on same actor)
   * @returns {boolean} Whether a link was created.
   */
  async createItemLink(linkType, dataType, targetItem, itemLink) {
    if (this.canCreateItemLink(linkType, dataType, targetItem, itemLink)) {
      const updateData = {};
      const _links = duplicate(getProperty(this.data, `data.links.${linkType}`) || []);
      const link = this.generateInitialLinkData(linkType, dataType, targetItem, itemLink);
      _links.push(link);
      updateData[`data.links.${linkType}`] = _links;

      // Call link creation hook
      await this.update(updateData);
      Hooks.callAll("createItemLink", this, link, linkType);

      /**
       * @TODO This is a really shitty way of re-rendering the actor sheet, so I should change this method at some point,
       * but the premise is that the actor sheet should show data for newly linked items, and it won't do it immediately for some reason
       */
      window.setTimeout(() => {
        if (this.parent) this.parent.sheet.render();
      }, 50);

      return true;
    } else if (linkType === "children" && dataType !== "data") {
      const itemData = targetItem.toObject();
      delete itemData._id;

      // Default to spell-like tab until a selector is designed in the Links tab or elsewhere
      if (getProperty(itemData, "type") === "spell") setProperty(itemData, "data.spellbook", "spelllike");

      const newItemData = await this.parent.createEmbeddedDocuments("Item", [itemData]);
      const newItem = this.parent.items.get(newItemData._id);

      await this.createItemLink("children", "data", newItem, newItem._id);
    }

    return false;
  }

  async getLinkedItems(type, extraData = false) {
    const items = getProperty(this.data, `data.links.${type}`);
    if (!items) return [];

    const result = [];
    for (const l of items) {
      const item = await this.getLinkItem(l, extraData);
      if (item) result.push(item);
    }

    return result;
  }

  async getAllLinkedItems() {
    const result = [];

    for (const items of Object.values(getProperty(this.data, "data.links"))) {
      for (const l of items) {
        const item = await this.getLinkItem(l);
        if (item) result.push(item);
      }
    }

    return result;
  }

  /**
   * Removes all link references to an item.
   *
   * @param {string} id - The id of the item to remove links to.
   */
  async removeItemLink(id) {
    const updateData = {};
    for (const [k, linkItems] of Object.entries(getProperty(this.data, "data.links") || {})) {
      const items = duplicate(linkItems);
      for (let a = 0; a < items.length; a++) {
        const item = items[a];
        if (item.id === id) {
          items.splice(a, 1);
          a--;
        }
      }

      if (linkItems.length > items.length) {
        updateData[`data.links.${k}`] = items;
      }
    }

    if (Object.keys(updateData).length) {
      return this.update(updateData);
    }
  }

  async getLinkItem(l, extraData = false) {
    const id = l.id.split(".");
    let item;

    // Compendium entry
    if (l.dataType === "compendium") {
      const pack = game.packs.get(id.slice(0, 2).join("."));
      if (!pack) return null;
      item = await pack.getDocument(id[2]);
    }
    // World entry
    else if (l.dataType === "world") {
      item = game.items.get(id[1]);
    }
    // Same actor's item
    else if (this.parent != null && this.parent.items != null) {
      item = this.parent.items.find((o) => o.id === id[0]);
    }

    // Package extra data
    if (extraData) {
      item = { item: item, linkData: l };
    }

    return item;
  }

  async updateLinkItems() {
    // Update link items
    const linkGroups = getProperty(this.data, "data.links") || {};
    for (const links of Object.values(linkGroups)) {
      for (const l of links) {
        const i = await this.getLinkItem(l);
        if (i == null) {
          l.name = l.name + (l.name?.indexOf("[x]") > -1 ? "" : " [x]");
          l.img = CONST.DEFAULT_TOKEN;
          continue;
        }
        l.name = i.name;
        l.img = i.img;
      }
    }
  }

  _cleanLink(oldLink, linkType) {
    if (!this.parent) return;

    const otherItem = this.parent.items.find((o) => o.id === oldLink.id);
    if (linkType === "charges" && otherItem && hasProperty(otherItem, "links.charges")) {
      delete otherItem.links.charges;
    }
  }

  /**
   * Generates lists of change subtargets this item can have.
   *
   * @param {string} target - The target key, as defined in CONFIG.PF1.buffTargets.
   * @returns {object.<string, string>} A list of changes
   */
  getChangeSubTargets(target) {
    const result = {};
    // Add specific skills
    if (target === "skill") {
      if (this.parent == null) {
        for (const [s, skl] of Object.entries(CONFIG.PF1.skills)) {
          result[`skill.${s}`] = skl;
        }
      } else {
        const actorSkills = mergeObject(duplicate(CONFIG.PF1.skills), this.parent.data.data.skills);
        for (const [s, skl] of Object.entries(actorSkills)) {
          if (!skl.subSkills) {
            if (skl.custom) result[`skill.${s}`] = skl.name;
            else result[`skill.${s}`] = CONFIG.PF1.skills[s];
          } else {
            for (const [s2, skl2] of Object.entries(skl.subSkills)) {
              result[`skill.${s}.subSkills.${s2}`] = `${CONFIG.PF1.skills[s]} (${skl2.name})`;
            }
          }
        }
      }
    }
    // Add static subtargets
    else if (hasProperty(CONFIG.PF1.buffTargets, target)) {
      for (const [k, v] of Object.entries(CONFIG.PF1.buffTargets[target])) {
        if (!k.startsWith("_") && !k.startsWith("~")) result[k] = v;
      }
    }

    return result;
  }

  /**
   * Generates a list of targets this modifier can have.
   *
   * @param {ItemPF} item - The item for which the modifier is to be created.
   * @returns {object.<string, string>} A list of targets
   */
  getConditionalTargets() {
    const result = {};
    if (this.hasAttack) result["attack"] = game.i18n.localize(CONFIG.PF1.conditionalTargets.attack._label);
    if (this.hasDamage) result["damage"] = game.i18n.localize(CONFIG.PF1.conditionalTargets.damage._label);
    if (this.type === "spell" || this.hasSave)
      result["effect"] = game.i18n.localize(CONFIG.PF1.conditionalTargets.effect._label);
    // Only add Misc target if subTargets are available
    if (Object.keys(this.getConditionalSubTargets("misc")).length > 0) {
      result["misc"] = game.i18n.localize(CONFIG.PF1.conditionalTargets.misc._label);
    }
    return result;
  }

  /**
   * Generates lists of conditional subtargets this attack can have.
   *
   * @param {string} target - The target key, as defined in CONFIG.PF1.conditionTargets.
   * @returns {object.<string, string>} A list of conditionals
   */
  getConditionalSubTargets(target) {
    const result = {};
    // Add static targets
    if (hasProperty(CONFIG.PF1.conditionalTargets, target)) {
      for (const [k, v] of Object.entries(CONFIG.PF1.conditionalTargets[target])) {
        if (!k.startsWith("_") && !k.startsWith("~")) result[k] = v;
      }
    }
    // Add subtargets depending on attacks
    if (["attack", "damage"].includes(target)) {
      // Add specific attacks
      if (this.hasAttack) {
        result["attack.0"] = `${game.i18n.localize("PF1.Attack")} 1`;
      } else {
        delete result["rapidShotDamage"];
      }
      if (this.hasMultiAttack) {
        for (const [k, v] of Object.entries(this.data.data.attackParts)) {
          result[`attack.${Number(k) + 1}`] = v[1];
        }
      }
    }
    // Add subtargets affecting effects
    if (target === "effect") {
      if (this.hasSave) result["dc"] = game.i18n.localize("PF1.DC");
    }
    // Add misc subtargets
    if (target === "misc") {
      // Add charges subTarget with specific label
      if (this.isCharged && this.type !== "spell") result["charges"] = game.i18n.localize("PF1.ChargeCost");
    }
    return result;
  }

  /* Generates lists of conditional modifier bonus types applicable to a formula.
   * @param {string} target - The target key as defined in CONFIG.PF1.conditionTargets.
   * @returns {Object.<string, string>} A list of bonus types.
   * */
  getConditionalModifierTypes(target) {
    const result = {};
    if (target === "attack" || target === "damage") {
      // Add bonusModifiers from CONFIG.PF1.bonusModifiers
      for (const [k, v] of Object.entries(CONFIG.PF1.bonusModifiers)) {
        result[k] = v;
      }
    }
    if (target === "damage") {
      for (const [k, v] of Object.entries(CONFIG.PF1.damageTypes)) {
        result[k] = v;
      }
    }
    return result;
  }

  /* Generates a list of critical applications for a given formula target.
   * @param {string} target - The target key as defined in CONFIG.PF1.conditionalTargets.
   * @returns {Object.<string, string>} A list of critical applications.
   * */
  getConditionalCritical(target) {
    let result = {};
    // Attack bonuses can only apply as critical confirm bonus
    if (target === "attack") {
      result = { ...result, normal: "PF1.Normal", crit: "PF1.CriticalConfirmBonus" };
    }
    // Damage bonuses can be multiplied or not
    if (target === "damage") {
      result = { ...result, normal: "PF1.Normal" };
      if (this.hasAttack) {
        result = { ...result, crit: "PF1.CritDamageBonusFormula", nonCrit: "PF1.NonCritDamageBonusFormula" };
      }
    }
    return result;
  }

  async addChange() {
    const change = new ItemChange({}, this);
    return change;
  }

  /**
   * @param options
   * @param options.inLowestDenomination
   * @returns {number} The total amount of currency this item contains, in gold pieces
   */
  getTotalCurrency({ inLowestDenomination = false } = {}) {
    return 0;
  }

  /**
   * Returns the displayed value of an item according to multiple options
   *
   * @param {object} [options] - Various optional parameters affecting value calculations
   * @param {boolean} [options.recursive] - Whether the value of contained items should be included
   * @param {number} [options.sellValue] - The sell value multiplier
   * @param {boolean} [options.inLowestDenomination] - Whether the value should be returned in the lowest denomination
   * @param {boolean} [options.forceUnidentified] - Override whether the value should use the unidentified price
   * @returns {number} The item's value
   */
  getValue({ recursive = true, sellValue = 0.5, inLowestDenomination = false, forceUnidentified = false } = {}) {
    // Add item's contained currencies
    let result = this.getTotalCurrency({ inLowestDenomination });

    const getActualValue = (identified = true) => {
      let value = 0;
      if (identified) value = this.data.data.price;
      else value = this.data.data.unidentified.price;

      // Add charge price
      if (identified) value += (this.data.data.uses?.pricePerUse ?? 0) * (this.data.data.uses?.value ?? 0);

      return inLowestDenomination ? value * 100 : value;
    };

    const quantity = getProperty(this.data, "data.quantity") || 0;

    // Add item's price
    result += getActualValue(forceUnidentified ? false : !this.showUnidentifiedData) * quantity;

    // Modify sell value
    if (!(this.data.type === "loot" && this.data.data.subType === "tradeGoods")) result *= sellValue;

    return result;
  }

  /**
   * Converts currencies of the given category to the given currency type
   *
   * @param {string} type - Either 'pp', 'gp', 'sp' or 'cp'. Converts as much currency as possible to this type.
   */
  convertCurrency(type = "pp") {
    const totalValue = this.getTotalCurrency();
    const values = [0, 0, 0, 0];
    switch (type) {
      case "pp":
        values[0] = Math.floor(totalValue / 10);
        values[1] = Math.max(0, Math.floor(totalValue) - values[0] * 10);
        values[2] = Math.max(0, Math.floor(totalValue * 10) - values[0] * 100 - values[1] * 10);
        values[3] = Math.max(0, Math.floor(totalValue * 100) - values[0] * 1000 - values[1] * 100 - values[2] * 10);
        break;
      case "gp":
        values[1] = Math.floor(totalValue);
        values[2] = Math.max(0, Math.floor(totalValue * 10) - values[1] * 10);
        values[3] = Math.max(0, Math.floor(totalValue * 100) - values[1] * 100 - values[2] * 10);
        break;
      case "sp":
        values[2] = Math.floor(totalValue * 10);
        values[3] = Math.max(0, Math.floor(totalValue * 100) - values[2] * 10);
        break;
      case "cp":
        values[3] = Math.floor(totalValue * 100);
        break;
    }

    const updateData = {};
    updateData[`data.currency.pp`] = values[0];
    updateData[`data.currency.gp`] = values[1];
    updateData[`data.currency.sp`] = values[2];
    updateData[`data.currency.cp`] = values[3];
    return this.update(updateData);
  }

  _calculateCoinWeight(data) {
    const coinWeightDivisor = game.settings.get("pf1", "coinWeight");
    if (!coinWeightDivisor) return 0;
    return (
      Object.values(getProperty(data, "data.currency") || {}).reduce((cur, amount) => {
        return cur + amount;
      }, 0) / coinWeightDivisor
    );
  }

  /**
   * Sets a boolean flag on this item.
   *
   * @param {string} flagName - The name/key of the flag to set.
   * @returns {Promise<boolean>} Whether something was changed.
   */
  async addItemBooleanFlag(flagName) {
    flagName = String(flagName);
    const flags = getProperty(this.data, "data.flags.boolean") || [];

    if (flags.filter((f) => f[0] === flagName).length === 0) {
      await this.update({ "data.flags.boolean": flags.concat([[flagName]]) });
      return true;
    }

    return false;
  }

  /**
   * Removes a boolean flag from this item.
   *
   * @param {string} flagName - The name/key of the flag to remove.
   * @returns {Promise<boolean>} Whether something was changed.
   */
  async removeItemBooleanFlag(flagName) {
    let flags = getProperty(this.data, "data.flags.boolean") || [];

    if (flags.filter((f) => f[0] === flagName).length > 0) {
      flags = flags.filter((f) => f[0] !== flagName);
      await this.update({ "data.flags.boolean": flags });
      return true;
    }

    return false;
  }

  /**
   * @param {string} flagName - The name/key of the flag on this item.
   * @returns {boolean} Whether the flag was found on this item.
   */
  hasItemBooleanFlag(flagName) {
    const flags = getProperty(this.data, "data.flags.boolean") || [];

    return flags.map((f) => f[0]).includes(flagName);
  }

  /**
   * Sets a dictionary flag value on this item.
   *
   * @param {string} flagName - The name/key of the flag to set.
   * @param {number|string} value - The flag's new value.
   * @returns {Promise<boolean>} Whether something was changed.
   */
  async setItemDictionaryFlag(flagName, value) {
    flagName = String(flagName);
    const flags = duplicate(getProperty(this.data, "data.flags.dictionary") || []);

    let doUpdate = false;
    let foundFlag = false;
    for (const f of flags) {
      if (f[0] === flagName) {
        foundFlag = true;
        if (f[1] !== value) {
          f[1] = value;
          doUpdate = true;
        }
      }
    }
    if (!foundFlag) {
      flags.push([flagName, value]);
      doUpdate = true;
    }

    if (doUpdate) {
      await this.update({ "data.flags.dictionary": flags });
      return true;
    }

    return false;
  }

  /**
   * Removes a dictionary flag from this item.
   *
   * @param {string} flagName - The name/key of the flag to remove.
   * @returns {Promise<boolean>} Whether something was changed.
   */
  async removeItemDictionaryFlag(flagName) {
    const flags = duplicate(getProperty(this.data, "data.flags.dictionary") || []);

    let doUpdate = false;
    for (let a = 0; a < flags.length; a++) {
      const f = flags[a];
      if (f[0] === flagName) {
        flags.splice(a, 1);
        a--;
        doUpdate = true;
      }
    }

    if (doUpdate) {
      await this.update({ "data.flags.dictionary": flags });
      return true;
    }

    return false;
  }

  /**
   * @param {string} flagName - The name/key of the flag to get.
   * @returns {object} The value stored in the flag.
   */
  getItemDictionaryFlag(flagName) {
    const flags = getProperty(this.data, "data.flags.dictionary") || [];

    const flag = flags.find((f) => {
      return f[0] === flagName;
    });
    return flag ? flag[1] : undefined;
  }

  /**
   * @returns {number[]} Simple array describing the individual guaranteed attacks.
   */
  get attackArray() {
    const itemData = this.data.data,
      rollData = this.getRollData(),
      attacks = [0];

    const appendAttack = (formula) => {
      const bonus = RollPF.safeRoll(formula, rollData).total;
      if (Number.isFinite(bonus)) attacks.push(bonus);
    };

    // Static extra attacks
    const extraAttacks = itemData.attackParts.map((n) => n[0]?.toString().trim()).filter((n) => n?.length > 0);
    for (const formula of extraAttacks) appendAttack(formula);

    // Formula-based extra attacks
    const fmAtk = itemData.formulaicAttacks?.count?.formula?.trim();
    if (fmAtk?.length > 0) {
      const fmAtkBonus = itemData.formulaicAttacks?.bonus?.formula?.trim() ?? "0";
      const count = RollPF.safeRoll(fmAtk, rollData);
      for (let i = 0; i < count.total; i++) {
        rollData.formulaicAttack = i + 1;
        appendAttack(fmAtkBonus);
      }
    }

    // Conditional modifiers
    const condBonuses = new Array(attacks.length).fill(0);
    itemData.conditionals
      .filter((c) => c.default && c.modifiers.find((sc) => sc.target === "attack"))
      .forEach((c) => {
        c.modifiers.forEach((cc) => {
          const bonusRoll = RollPF.safeRoll(cc.formula, rollData);
          if (bonusRoll.total == 0) return;
          if (cc.subTarget?.match(/^attack\.(\d+)$/)) {
            const atk = parseInt(RegExp.$1, 10);
            if (atk in condBonuses) condBonuses[atk] += bonusRoll.total;
          }
        });
      });

    const sources = this.attackSources;
    const totalBonus = sources.reduce((f, s) => f + s.value, 0);

    return attacks.map((a, i) => a + totalBonus + condBonuses[i]);
  }

  /**
   * @returns {object[]} Array of value and label pairs for attack bonus sources on the main attack.
   */
  get attackSources() {
    const sources = [];

    const actorData = this.parentActor?.data.data,
      itemData = this.data.data;

    if (!actorData) return sources;
    const rollData = this.getRollData();

    // Attack type identification
    const isMelee =
      ["mwak", "msak", "mcman"].includes(this.data.data.actionType) ||
      ["melee", "reach"].includes(this.data.data.range.units);
    const isRanged =
      ["rwak", "rsak", "rcman"].includes(this.data.data.actionType) || this.data.data.weaponSubtype === "ranged";
    const isManeuver = ["mcman", "rcman"].includes(this.data.data.actionType);

    const describePart = (value, label, sort = 0) => {
      sources.push({ value, label, sort });
    };

    // BAB is last for some reason, array is reversed to try make it the first.
    const srcDetails = (s) => s?.reverse().forEach((d) => describePart(d.value, d.name, -10));

    // Unreliable melee/ranged identification
    const sizeBonus = !isManeuver
      ? CONFIG.PF1.sizeMods[rollData.traits.size]
      : CONFIG.PF1.sizeSpecialMods[rollData.traits.size];

    // Add size bonus
    if (sizeBonus != 0) describePart(sizeBonus, game.i18n.localize("PF1.Size"), -20);

    srcDetails(this.parentActor.sourceDetails["data.attributes.attack.shared"]);
    if (isManeuver) srcDetails(this.parentActor.sourceDetails["data.attributes.cmb.bonus"]);
    srcDetails(this.parentActor.sourceDetails["data.attributes.attack.general"]);

    const changeSources = [];
    if (isRanged) changeSources.push("rattack");
    if (isMelee) changeSources.push("mattack");
    const effectiveChanges = getHighestChanges(
      this.parentActor.changes.filter((c) => changeSources.includes(c.subTarget)),
      { ignoreTarget: true }
    );
    effectiveChanges.forEach((ic) => describePart(ic.value, ic.flavor, -800));

    if (itemData.ability.attack) {
      const ablMod = getProperty(actorData, `abilities.${itemData.ability.attack}.mod`) ?? 0;
      describePart(ablMod, CONFIG.PF1.abilities[itemData.ability.attack], -50);
    }

    // Attack bonus formula
    const bonusRoll = RollPF.safeRoll(itemData.attackBonus ?? "0", rollData);
    if (bonusRoll.total != 0)
      describePart(bonusRoll.total, bonusRoll.flavor ?? game.i18n.localize("PF1.AttackRollBonus"), -100);

    // Masterwork or enhancement bonus
    // Only add them if there's no larger enhancement bonus from some other source
    const virtualEnh = itemData.enh ?? (itemData.masterwork ? 1 : 0);
    if (!effectiveChanges.find((i) => i.modifier === "enh" && i.value > virtualEnh)) {
      if (Number.isFinite(itemData.enh) && itemData.enh != 0) {
        describePart(itemData.enh, game.i18n.localize("PF1.EnhancementBonus"), -300);
      } else if (itemData.masterwork) {
        describePart(1, game.i18n.localize("PF1.Masterwork"), -300);
      }
    }

    // Add proficiency penalty
    if (!itemData.proficient) {
      describePart(-4, game.i18n.localize("PF1.ProficiencyPenalty"), -500);
    }

    // Broken condition
    if (itemData.broken) {
      describePart(-2, game.i18n.localize("PF1.Broken"), -500);
    }

    // Add secondary natural attack penalty
    if (!itemData.primaryAttack && itemData.attackType === "natural") {
      describePart(-5, game.i18n.localize("PF1.SecondaryAttack"), -400);
    }

    // Conditional modifiers
    itemData.conditionals
      .filter((c) => c.default && c.modifiers.find((sc) => sc.target === "attack"))
      .forEach((c) => {
        c.modifiers.forEach((cc) => {
          if (cc.subTarget === "allAttack") {
            const bonusRoll = RollPF.safeRoll(cc.formula, rollData);
            if (bonusRoll.total == 0) return;
            describePart(bonusRoll.total, c.name, -5000);
          }
        });
      });

    return sources.sort((a, b) => b.sort - a.sort);
  }

  /**
   * Generic damage source retrieval
   */
  get damageSources() {
    const isSpell = ["msak", "rsak", "spellsave"].includes(this.data.data.actionType);
    const isWeapon = ["mwak", "rwak"].includes(this.data.data.actionType);
    const changes = this.getContextChanges(isSpell ? "sdamage" : isWeapon ? "wdamage" : "damage");
    const highest = getHighestChanges(changes, { ignoreTarget: true });
    return highest;
  }

  /**
   * Generic damage source retrieval, includes default conditionals and other item specific modifiers.
   */
  get allDamageSources() {
    const conds = this.data.data.conditionals
      .filter((c) => c.default)
      .filter((c) => c.modifiers.find((m) => m.target === "damage"));
    const rollData = this.getRollData();

    const mods = Object.keys(CONFIG.PF1.bonusModifiers);

    // Turn relevant conditionals into structure accepted by getHighestChanges
    const fakeCondChanges = [];
    for (const c of conds) {
      for (const m of c.modifiers) {
        if (m.target !== "damage") continue;
        const roll = RollPF.safeRoll(m.formula, rollData);
        if (roll.err) continue;
        const isModifier = mods.includes(m.type);
        fakeCondChanges.push({
          flavor: c.name,
          value: roll.total,
          modifier: isModifier ? m.type : "untyped", // Turn unrecognized types to untyped
          type: isModifier ? undefined : m.type, // Preserve damage type if present
          formula: m.formula,
        });
      }
    }

    const allChanges = [...this.damageSources, ...fakeCondChanges];

    // Add special cases specific to the item
    // Broken
    if (this.data.data.broken) {
      allChanges.push({
        flavor: game.i18n.localize("PF1.Broken"),
        value: -2,
        modifier: "untyped",
        formula: "-2",
      });
    }

    return getHighestChanges(allChanges, { ignoreTarget: true });
  }

  /**
   * @param {...any} args
   * @deprecated
   */
  static toConsumable(...args) {
    console.warn("ItemPF.toConsumable() is deprecated in favor of ItemSpellPF.toConsumable()");
    return CONFIG.Item.documentClasses.spell.toConsumable(...args);
  }
}
