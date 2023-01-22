import { DicePF, formulaHasDice } from "../../dice/dice.mjs";
import { ItemBasePF } from "./item-base.mjs";
import { createCustomChatMessage } from "../../utils/chat.mjs";
import {
  createTag,
  linkData,
  convertDistance,
  calculateRange,
  keepUpdateArray,
  diffObjectAndArray,
} from "../../utils/lib.mjs";
import { ItemChange } from "../../components/change.mjs";
import { ItemAction } from "../../components/action.mjs";
import { getHighestChanges } from "../actor/utils/apply-changes.mjs";
import { RollPF } from "../../dice/roll.mjs";
import { ActionUse } from "@actionUse/action-use.mjs";
import { callOldNamespaceHook, callOldNamespaceHookAll } from "@utils/hooks.mjs";

/**
 * Override and extend the basic :class:`Item` implementation
 */
export class ItemPF extends ItemBasePF {
  constructor(...args) {
    super(...args);

    if (this.links === undefined)
      /**
       * An object containing links to other items.
       *
       * @type {object}
       */
      this.links = {};

    if (this._rollData === undefined)
      /**
       * Cached {@link ItemPF.getRollData}
       *
       * @type {null|object}
       * @private
       */
      this._rollData = null;

    if (this.actions === undefined && this.actions instanceof Array)
      /**
       * A {@link Collection} of {@link ItemAction}s.
       *
       * @type {Collection<ItemAction>}
       */
      this.actions = new Collection();
  }

  static isInventoryItem(type) {
    return ["weapon", "equipment", "consumable", "loot", "container"].includes(type);
  }

  _preCreate(data, options, user) {
    super._preCreate(data, options, user);

    // Ensure unique Change IDs
    const actor = this.parentActor;
    if (actor && data?.system?.changes?.length > 0) {
      const changes = data.system.changes;
      let updated = false;
      for (const c of changes) {
        let i = 0;
        // Forcibly seek unused ID.
        while (actor.changes.get(c._id) !== undefined || !c._id) {
          updated = true;
          // Revert to default ID generation if too many iterations have passed. Just let it break if even more has passed.
          if (i > 10_000) break;
          else if (i++ > 1_000) c._id = foundry.utils.randomID();
          else c._id = ItemChange.defaultData._id;
        }
      }
      if (updated) this.updateSource({ "system.changes": changes });
    }

    let updates = {};
    if (typeof this.preCreateData === "function") {
      updates = this.preCreateData(data, options, user);
    }

    if (Object.keys(updates).length) return this.updateSource(updates);
  }

  /**
   * Meant to be overridden.
   *
   * @param data
   * @param options
   * @param user
   * @returns {object} Update data to replace with.
   */
  preCreateData(data, options, user) {
    return {};
  }

  /**
   * @returns {string[]} The keys of data variables to memorize between updates, for e.g. determining the difference in update.
   */
  get memoryVariables() {
    return ["system.quantity", "system.level", "system.inventoryItems"];
  }

  get isPhysical() {
    return this.constructor.isInventoryItem(this.type);
  }

  /**
   * The item's subtype, or `null` if the item has no subtype
   *
   * @type {string|null}
   */
  get subType() {
    return this.system.subType ?? null;
  }

  get firstAction() {
    if (!this.system.actions?.length) return undefined;
    return this.actions.get(this.system.actions[0]._id);
  }

  /**
   * Returns `true` if any of this item's actions have an attack, see {@link ItemAction#hasAttack}.
   *
   * @type {boolean}
   */
  get hasAttack() {
    return this.actions?.some((o) => o.hasAttack) ?? false;
  }

  /**
   * Returns `true` if any of this item's actions have a damage roll, see {@link ItemAction#hasDamage}.
   *
   * @type {boolean}
   */
  get hasDamage() {
    return this.actions?.some((o) => o.hasDamage) ?? false;
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

  get hasAction() {
    return this.system.actions?.length > 0;
  }

  get isSingleUse() {
    return this.system.uses?.per === "single";
  }

  get isCharged() {
    return this.isSingleUse || ["day", "week", "charges"].includes(this.system.uses?.per);
  }

  get charges() {
    // No actor? No charges!
    if (!this.parentActor) return 0;

    // Get linked charges
    const link = this.links?.charges;
    if (link) return link.charges;

    // Get own charges
    if (this.isSingleUse) return this.system.quantity;
    return this.system.uses?.value ?? 0;
  }

  get autoDeductCharges() {
    return this.getDefaultChargeCost() > 0;
  }

  /**
   * Get default charge cost for all actions.
   *
   * @param options
   * @param options.rollData
   * @returns {number} Number for default cost.
   */
  getDefaultChargeCost({ rollData } = {}) {
    rollData ??= this.getRollData();
    const formula = this.getDefaultChargeFormula();
    return RollPF.safeRoll(formula, rollData).total;
  }

  getDefaultChargeFormula() {
    return this.system.uses?.autoDeductChargesCost || "1";
  }

  get maxCharges() {
    // No actor? No charges!
    if (!this.parentActor) return 0;

    // Get linked charges
    const link = this.links?.charges;
    if (link) return link.maxCharges;

    // Get own charges
    if (this.isSingleUse) return this.system.quantity;
    return this.system.uses?.max ?? 0;
  }

  /**
   * Returns total duration in seconds or null.
   *
   * @returns {number|null} Seconds or null.
   */
  get totalDurationSeconds() {
    return this.system.duration?.totalSeconds ?? null;
  }

  get auraStrength() {
    const cl = getProperty(this, "system.cl") || 0;
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
    if (getProperty(this, "system.identified") === false && getProperty(this, "system.unidentified.name"))
      return getProperty(this, "system.unidentified.name");
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
    return this.system.description.value;
  }

  /**
   * @returns {ActiveEffect} An active effect associated with this item.
   */
  get effect() {
    return this.actor.effects.find((effect) => {
      if (!effect.origin) return false;
      // BUG: If origin is from another actor (duplicated actor), this can cause false positives/negatives.
      return /\.Item\.(?<itemId>[^.]+)/.exec(effect.origin)?.groups.itemId === this.id;
    });
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

  /**
   * An array containing all action types from this item's actions.
   *
   * @see {@link config.itemActionTypes}
   * @type {string[]}
   */
  get actionTypes() {
    const actionTypes = this.actions?.map((action) => action.data.actionType).filter(Boolean) ?? [];
    return [...new Set(actionTypes)];
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
    if (getProperty(this, "system.uses.per") === "single" && getProperty(this, "system.quantity") == null) return;

    const prevValue = this.isSingleUse ? getProperty(this, "system.quantity") : getProperty(this, "system.uses.value");

    if (this.isSingleUse) await this.update({ "system.quantity": prevValue + value });
    else await this.update({ "system.uses.value": prevValue + value });
  }

  /* -------------------------------------------- */

  /**
   * Should the item show unidentified data
   *
   * @type {boolean}
   */
  get showUnidentifiedData() {
    return !game.user.isGM && getProperty(this, "system.identified") === false;
  }

  /* -------------------------------------------- */
  /*	Data Preparation														*/
  /* -------------------------------------------- */

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    super.prepareData();
    const itemData = this.system;
    const data = itemData;
    const C = CONFIG.PF1;
    const labels = {};

    this.prepareLinks();

    // Update changes
    if (this.system.changes instanceof Array) {
      this.changes = this._prepareChanges(this.system.changes);
    }

    // Update actions
    if (this.system.actions instanceof Array) {
      this.actions = this._prepareActions(this.system.actions);
    }

    // Update script calls
    if (this.system.scriptCalls instanceof Array) {
      this.scriptCalls = this._prepareScriptCalls(this.system.scriptCalls);
    }

    // Update contained items
    if (this.system.inventoryItems instanceof Array) {
      this.items = this._prepareInventory(this.system.inventoryItems);
    }
    this.prepareWeight();

    if (!this.actor) {
      this.prepareDerivedItemData();
    }

    return itemData;
  }

  /**
   * Prepare this item's {@link ItemWeightData}
   */
  prepareWeight() {
    const itemData = this.system;

    // HACK: Migration shim. Allows unmigrated items to have their weight correct.
    {
      const weight = itemData.weight;
      if (weight === undefined || Number.isFinite(weight)) {
        const sourceData = this._source.system,
          sourceWeight = sourceData.baseWeight ?? sourceData.weight ?? 0;
        itemData.weight = { value: sourceWeight };
      }
    }

    const weight = itemData.weight;

    // Make sure there is a weight value
    weight.value ??= 0;
    weight.total ??= 0;

    // Determine actual item weight, including sub-items
    const weightReduction = (100 - (itemData.weightReduction ?? 0)) / 100;
    weight.total = (this.items ?? []).reduce((cur, o) => {
      return cur + o.system.weight.total * weightReduction;
    }, weight.value * itemData.quantity);

    // Add contained currency (mainly containers)
    weight.currency ??= 0;
    weight.total += weight.currency;

    // Convert weight according metric system (lb vs kg)
    let usystem = game.settings.get("pf1", "weightUnits"); // override
    if (usystem === "default") usystem = game.settings.get("pf1", "units");
    weight.converted = {
      value: pf1.utils.convertWeight(weight.value),
      total: pf1.utils.convertWeight(weight.total),
    };
    weight.units = usystem === "metric" ? game.i18n.localize("PF1.Kgs") : game.i18n.localize("PF1.Lbs");
    itemData.priceUnits = game.i18n.localize("PF1.CurrencyGP").toLowerCase();
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    // Physical items
    if (this.isPhysical) {
      // Sync name
      if (this.system.identifiedName === undefined) this.system.identifiedName = this.name;
      if (this.showUnidentifiedData) {
        // Set unidentified name for players
        const unidentifiedName = this.system.unidentified.name;
        if (unidentifiedName) this.system.name = unidentifiedName;
        // Set unidentified description for players
        this.system.description.value = this.system.description.unidentified;
      }
    }
  }

  prepareBaseData() {
    // Set visible name
    if (this.showUnidentifiedData) {
      this.name = this.system.unidentified?.name || this._source.name;
    } else {
      this.name = this.system.identifiedName || this._source.name;
    }

    const itemData = this.system;

    // Initialize tag for items that have tagged template
    const itemTemplate = game.system.template.Item;
    const taggedTypes = itemTemplate.types.filter((t) => itemTemplate[t].templates?.includes("tagged"));
    if (itemData.useCustomTag !== true && taggedTypes.includes(this.type)) {
      itemData.tag = createTag(this.name);
    }
  }

  prepareDerivedItemData() {
    // Update maximum uses
    this._updateMaxUses();
  }

  /**
   * Returns labels for this item
   *
   * @param {object} [options={}] - Additional options
   * @param {string} [options.actionId] - ID of one of this item's actions to get labels for; defaults to first action
   * @returns {Record<string, string>} This item's labels
   */
  getLabels({ actionId } = {}) {
    const labels = {};
    const itemData = this.system;

    // Equipped label
    const checkYes = '<i class="fas fa-check"></i>';
    const checkNo = '<i class="fas fa-times"></i>';
    labels.equipped = "";
    if (itemData.equipped === true) labels.equipped = checkYes;
    else labels.equipped = checkNo;

    // Carried label
    labels.carried = "";
    if (itemData.carried === true) labels.carried = checkYes;
    else labels.carried = checkNo;

    // Identified label
    labels.identified = "";
    if (itemData.identified === true) labels.identified = checkYes;
    else labels.identified = checkNo;

    // Slot label
    if (itemData.slot) {
      // Add equipment slot
      const equipmentType = this.system.subType || null;
      if (equipmentType != null) {
        const equipmentSlot = this.system.slot || null;
        labels.slot = equipmentSlot == null ? null : CONFIG.PF1.equipmentSlots[equipmentType]?.[equipmentSlot];
      } else labels.slot = null;
    }

    const action = actionId ? this.actions.get(actionId) : this.firstAction;
    return { ...labels, ...(action?.getLabels() ?? {}) };
  }

  prepareLinks() {
    if (!this.links) return;

    for (const [k, i] of Object.entries(this.links)) {
      switch (k) {
        case "charges": {
          const uses = i.system.uses;
          if (!uses) break;
          for (const [k, v] of Object.entries(uses)) {
            if (["autoDeductCharges", "autoDeductChargesCost"].includes(k)) continue;
            this.system.uses[k] = v;
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
      } else change = new pf1.components.ItemChange(c, this);
      collection.set(c._id || change.data._id, change);
    }
    return collection;
  }

  _prepareActions(actions) {
    const prior = this.actions;
    const collection = new Collection();
    for (const o of actions) {
      let action = null;
      if (prior && prior.has(o._id)) {
        action = prior.get(o._id);
        action.data = o;
        action.prepareData();
      } else action = new pf1.components.ItemAction(o, this);
      collection.set(o._id || action.data._id, action);
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
      } else scriptCall = new pf1.components.ItemScriptCall(s, this);
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
        item.updateSource(o);
        item.reset();
      } else {
        item = new CONFIG.Item.documentClass(o);
        item.parentItem = this;
      }

      collection.set(o._id || item.id, item);
    }
    return collection;
  }

  /**
   * Executes all script calls on this item of a specified category.
   *
   * @param {string} category - The category of script calls to call.
   * @param {Object<string, object>} [extraParams={}] - A dictionary of extra parameters to pass as variables for use in the script.
   * @returns {Promise.<object>} The shared object between calls which may have been given data.
   */
  async executeScriptCalls(category, extraParams = {}) {
    const scripts = this.scriptCalls?.filter((o) => o.category === category) ?? [];
    const shared = {};
    if (extraParams.attackData) {
      shared.attackData = extraParams.attackData;
      delete extraParams.attackData;
    }

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
    const baseData = this.toObject();
    const srcData = mergeObject(baseData, data, { inplace: false });

    // Make sure stuff remains an array
    {
      const keepPaths = [
        "system.attackNotes",
        "system.effectNotes",
        "system.contextNotes",
        "system.scriptCalls",
        "system.actions",
        "system.inventoryItems",
        "system.changes",
      ];

      for (const path of keepPaths) {
        keepUpdateArray(this, data, path);
        linkData(srcData, data, path, data[path]);
      }
    }

    // Update price from base price
    if (data["system.basePrice"] != null) {
      linkData(srcData, data, "system.price", getProperty(srcData, "system.basePrice") || 0);
    }
    if (data["system.unidentified.basePrice"] != null) {
      linkData(srcData, data, "system.unidentified.price", getProperty(srcData, "system.unidentified.basePrice") || 0);
    }

    // Update name
    if (data["system.identifiedName"]) linkData(srcData, data, "name", data["system.identifiedName"]);
    else if (data["name"]) linkData(srcData, data, "system.identifiedName", data["name"]);

    // Make sure charges doesn't exceed max charges, and vice versa
    if (this.isCharged) {
      let charges = 0;
      let maxCharges = 0;
      let target = "value";

      if (this.type === "spell") {
        if (data["system.preparation.maxAmount"] != null) target = "max";
        charges = data["system.preparation.preparedAmount"] ?? this.charges;
        maxCharges = data["system.preparation.maxAmount"] ?? this.maxCharges;
      } else {
        if (data["system.uses.max"] != null) target = "max";
        charges = data["system.uses.value"] ?? this.charges;
        maxCharges = data["system.uses.max"] ?? this.maxCharges;
      }

      if (target === "value" && charges > maxCharges) maxCharges = charges;
      else if (target === "max" && maxCharges < charges) charges = maxCharges;

      const link = getProperty(this, "links.charges");
      if (!link) {
        if (this.type === "spell") {
          if (charges !== undefined) linkData(srcData, data, "system.preparation.preparedAmount", charges);
          if (maxCharges !== undefined) linkData(srcData, data, "system.preparation.maxAmount", maxCharges);
        } else {
          if (charges !== undefined) linkData(srcData, data, "system.uses.value", charges);
          if (maxCharges !== undefined) linkData(srcData, data, "system.uses.max", maxCharges);
        }
      } else {
        // Update charges for linked items
        if (data["system.uses.value"] != null) {
          if (link && getProperty(link, "links.charges") == null) {
            await link.update({ "system.uses.value": data["system.uses.value"] });
          }
        }
      }
    }

    this.memorizeVariables();

    const diff = diffObject(flattenObject(this.toObject()), data);
    // Filter diff for undefined values. Single value depth with speed as priority
    for (const [k, v] of Object.entries(diff)) {
      if (v === undefined) delete diff[k];
    }

    if (Object.keys(diff).length && !context.skipUpdate) {
      if (this.parentItem == null) {
        await super.update(diff, context);
      } else {
        // Determine item index to update in parent
        const parentInventory = this.parentItem.system.inventoryItems || [];
        const parentItem = parentInventory.find((o) => o._id === this.id);
        const idx = parentInventory.indexOf(parentItem);

        if (idx >= 0) {
          // Replace keys to suit parent item
          for (const [k, v] of Object.entries(diff)) {
            delete diff[k];
            diff[`system.inventoryItems.${idx}.${k}`] = v;
          }

          // Update parent item
          await this.parentItem.update(diff);
        }
      }
    } else if (context.skipUpdate) {
      diff["_id"] = this.id;
    }

    // Update tokens and the actor using this item
    const actor = this.parent;
    if (actor) {
      // Update tokens
      const promises = [];
      const tokens = canvas?.tokens?.placeables?.filter((token) => token.actor?.id === actor.id) ?? [];
      for (const token of tokens) {
        const tokenUpdateData = {};

        // Update tokens with this item as a resource bar
        if (diff["system.uses.value"] != null) {
          for (const barKey of ["bar1", "bar2"]) {
            const bar = token.document.getBarAttribute(barKey);
            if (bar && bar.attribute === `resources.${this.system.tag}`) {
              tokenUpdateData[`${barKey}.value`] = diff["system.uses.value"];
            }
          }
        }

        if (!foundry.utils.isEmpty(tokenUpdateData)) {
          promises.push(token.document.update(tokenUpdateData));
        }
      }
      if (promises.length) await Promise.all(promises);
    }
  }

  memorizeVariables() {
    if (this._memoryVariables != null) return;

    const memKeys = this.memoryVariables;
    this._memoryVariables = {};
    for (const k of memKeys) {
      if (hasProperty(this, k)) {
        this._memoryVariables[k] = deepClone(getProperty(this, k));
      }
    }

    // Memorize variables recursively on container items
    for (const item of this.items ?? []) {
      item.memorizeVariables();
    }
  }

  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);

    if (userId === game.user.id) {
      // Call 'toggle' script calls
      {
        let state = null;
        if (this.type === "buff") state = getProperty(changed, "system.active");
        if (this.type === "feat" && hasProperty(changed, "system.disabled"))
          state = getProperty(changed, "system.disabled") === true ? false : true;
        if (state != null) {
          this.executeScriptCalls("toggle", { state });
        }
      }

      // Call 'equip' script calls
      {
        const equipped = getProperty(changed, "system.equipped");
        if (equipped != null) {
          this.executeScriptCalls("equip", { equipped });
        }
      }

      // Call 'changeQuantity' script calls
      if (this._memoryVariables?.["system.quantity"] !== undefined) {
        const quantity = {
          previous: this._memoryVariables["system.quantity"],
          new: getProperty(this, "system.quantity"),
        };
        if (quantity.new != null && quantity.new !== quantity.previous) {
          this.executeScriptCalls("changeQuantity", { quantity });
        }
      }

      // Call 'changeLevel' script calls
      if (this._memoryVariables?.["system.level"] !== undefined) {
        const level = {
          previous: parseInt(this._memoryVariables["system.level"]),
          new: parseInt(getProperty(this, "system.level")),
        };
        for (const [k, v] of Object.entries(level)) {
          if (Number.isNaN(v)) level[k] = null;
        }
        if (level.new !== undefined && level.new !== level.previous) {
          this.executeScriptCalls("changeLevel", { level });
        }
      }
    }

    // Call _onUpdate for changed items
    for (let a = 0; a < (changed.system?.inventoryItems ?? []).length; a++) {
      const itemUpdateData = changed.system?.inventoryItems[a];
      const memoryItemData = this._memoryVariables?.["system.inventoryItems"]?.[a];
      if (!memoryItemData) continue;

      const diffData = diffObjectAndArray(memoryItemData, itemUpdateData, { keepLength: true });
      if (!foundry.utils.isEmpty(diffData)) {
        const item = this.items.get(memoryItemData._id);
        item._onUpdate(diffData, options, userId);
      }
    }

    // Forget memory variables
    this._memoryVariables = null;
  }

  _updateMaxUses() {
    // No actor? No charges!
    if (!this.parentActor) return;

    // No charges? No charges!
    if (!["day", "week", "charges"].includes(getProperty(this, "system.uses.per"))) return;

    const rollData = this.getRollData();

    if (this.system.uses) {
      const maxFormula = this.system.uses.maxFormula;
      if (!maxFormula) {
        this.system.uses.max = 0;
      } else if (!formulaHasDice(maxFormula)) {
        const roll = RollPF.safeRoll(maxFormula, rollData);
        this.system.uses.max = roll.total;
      } else {
        ui.notifications.warn(
          game.i18n.format("PF1.WarningNoDiceAllowedInFormula", {
            context: game.i18n.localize("PF1.ChargePlural"),
            item: this.name,
          })
        );
      }
    }
  }

  // Determines the starting data for an ActiveEffect based off this item
  getRawEffectData() {
    return {
      label: this.name,
      icon: this.img,
      origin: this.uuid,
      flags: { pf1: { origin: { item: this.id } } },
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
   * Display the chat card for an Item as a message in chat
   *
   * @deprecated Use {@link displayCard} instead.
   * @param {object} [altChatData={}] - Optional data that will be merged into the chat data object.
   * @returns {Promise<ChatMessage | void>}
   */
  async roll(altChatData = {}) {
    foundry.utils.logCompatibilityWarning(`ActorPF#roll has been deprecated in favor of ActorPF#displayCard`, {
      since: "PF1 0.82.0",
      until: "PF1 0.83.0",
    });
    return this.displayCard(altChatData);
  }

  /**
   * Display the chat card for an Item as a message in chat
   *
   * @param {object} [altChatData={}] - Optional data that will be merged into the chat data object.
   * @returns {Promise<ChatMessage | void>}
   */
  async displayCard(altChatData = {}) {
    const actor = this.parent;
    if (actor && !actor.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.ErrorNoActorPermissionAlt", { name: actor.name }));
    }

    // Basic template rendering data
    const token = this.parentActor?.token;
    const rollData = this.getRollData();
    const itemChatData = this.getChatData({ rollData });
    const identified = Boolean(rollData.item?.identified ?? true);

    const templateData = {
      actor: this.parent,
      tokenId: token ? token.uuid : null,
      item: this.toObject(),
      labels: this.getLabels(),
      hasAttack: this.hasAttack,
      hasMultiAttack: this.hasMultiAttack,
      hasAction: this.hasAction,
      isVersatile: this.isVersatile,
      isSpell: this.type === "spell",
      name: (identified ? rollData.identifiedName : rollData.item.unidentified?.name) || this.name,
      description: identified ? itemChatData.identifiedDescription : itemChatData.unidentifiedDescription,
      rollData: rollData,
      hasExtraProperties: false,
      extraProperties: [],
    };

    const pfFlags = {};

    // If the item is unidentified, store data for GM info box containing identified info
    if (identified === false) {
      pfFlags.identifiedInfo = {
        identified,
        name: rollData.identifiedName || this.name,
        description: itemChatData.identifiedDescription,
      };
    }

    // Add combat info
    if (game.combat) {
      const combatProps = [];
      // Add round info
      combatProps.push(game.i18n.format("PF1.CombatInfo_Round", { round: game.combat.round }));

      if (combatProps.length > 0) {
        templateData.extraProperties.push({
          header: game.i18n.localize("PF1.CombatInfo_Header"),
          value: combatProps,
          css: "combat-properties",
        });
        templateData.hasExtraProperties = true;
      }
    }

    // Roll spell failure chance
    if (templateData.isSpell && this.parent != null && this.parent.spellFailure > 0 && this.system.components.somatic) {
      const spellbook = getProperty(this.parent, `system.attributes.spells.spellbooks.${this.system.spellbook}`);
      if (spellbook && spellbook.arcaneSpellFailure) {
        templateData.spellFailure = RollPF.safeRoll("1d100").total;
        templateData.spellFailureSuccess = templateData.spellFailure > this.parentActor.spellFailure;
      }
    }

    // Render the chat card template
    const templateType = ["consumable"].includes(this.type) ? this.type : "item";
    const template = `systems/pf1/templates/chat/${templateType}-card.hbs`;

    // Determine metadata
    pfFlags.metadata = {};
    pfFlags.metadata.item = this.id;

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
            pf1: pfFlags,
          },
        },
        altChatData
      )
    );

    if (Hooks.call("pf1DisplayCard", this, { template, templateData, chatData }) === false) return;

    // Create the chat message
    return createCustomChatMessage(template, templateData, chatData);
  }

  /* -------------------------------------------- */
  /*  Chat Cards																	*/
  /* -------------------------------------------- */

  /**
   * Generates {@link ChatData} for this item, either in a default configuration or for a specific action.
   *
   * @param {EnrichmentOptions} [enrichOptions] - Options affecting how descriptions are enriched.
   *                                              `rollData` defaults to {@link ItemAction#getRollData}/{@link ItemPF#getRollData}.
   *                                              `secrets` defaults to {@link Item#isOwner}.
   * @param {object} [options] - Additional options affecting the chat data generation
   * @param {string} [options.actionId] - The ID of an action on this item to generate chat data for,
   *                                      defaults to {@link ItemPF.firstAction}
   * @returns {ChatData} The chat data for this item (+action)
   */
  getChatData(enrichOptions = {}, options = {}) {
    /** @type {ChatData} */
    const data = {};
    const { actionId = null } = options;
    const action = actionId ? this.actions.get(actionId) : this.firstAction;
    const labels = this.getLabels({ actionId });

    enrichOptions.rollData ??= action ? action.getRollData() : this.getRollData();
    enrichOptions.secrets ??= this.isOwner;
    enrichOptions.async = false; // @TODO: Work on making this async, somehow

    const itemData = enrichOptions.rollData?.item ?? this.system;
    const actionData = enrichOptions.rollData?.action ?? action?.data ?? {};

    // Rich text descriptions
    data.identifiedDescription = TextEditor.enrichHTML(itemData.description.value, enrichOptions);
    if (itemData.shortDescription) {
      data.identifiedDescription = `${data.identifiedDescription}${TextEditor.enrichHTML(
        itemData.shortDescription,
        enrichOptions
      )}`;
    }
    data.unidentifiedDescription = TextEditor.enrichHTML(itemData.description.unidentified, enrichOptions);
    data.description = this.showUnidentifiedData ? data.unidentifiedDescription : data.identifiedDescription;
    data.actionDescription = TextEditor.enrichHTML(actionData.description, enrichOptions);

    // General equipment properties
    const props = [];
    if (Object.prototype.hasOwnProperty.call(itemData, "equipped") && ["weapon", "equipment"].includes(this.type)) {
      props.push(itemData.equipped ? game.i18n.localize("PF1.Equipped") : game.i18n.localize("PF1.NotEquipped"));
    }

    if (!this.showUnidentifiedData) {
      // Gather dynamic labels
      const dynamicLabels = {};
      dynamicLabels.range = labels.range || "";
      dynamicLabels.level = labels.sl || "";
      // Range
      if (actionData.range != null) {
        const range = action.getRange({ type: "max" }),
          units = actionData.range.units === "mi" ? "mi" : "ft";
        const distanceValues = convertDistance(range, units);
        dynamicLabels.range =
          range > 0 ? game.i18n.format("PF1.RangeNote", { distance: range, units: distanceValues[1] }) : null;
      }

      // Add Difficulty Modifier (DC) label
      props.push(labels.save);
      const saveDesc = actionData.save?.description;
      if (saveDesc?.length > 0) props.push(saveDesc);

      // Duration
      if (actionData.duration != null) {
        if (!["inst", "perm"].includes(actionData.duration.units) && typeof actionData.duration.value === "string") {
          const duration = RollPF.safeRoll(actionData.duration.value || "0", enrichOptions.rollData).total;
          dynamicLabels.duration = [duration, CONFIG.PF1.timePeriods[actionData.duration.units]].filterJoin(" ");
        }
      }

      // Ability activation properties
      if (actionData.activation?.type) {
        props.push(labels.target, labels.activation, dynamicLabels.range, dynamicLabels.duration);
      }
    }

    // Get per item type chat data
    this.getTypeChatData(data, labels, props, enrichOptions.rollData);

    // Filter properties and return
    data.properties = props.filter((p) => !!p);
    return data;
  }

  /**
   * Per item type chat data.
   *
   * @param {ChatData} data - A partial of a chat data object that can be modified to add per item type data.
   * @param {Object<string, string>} labels - The labels for this item.
   * @param {string[]} props - Additional property strings
   * @param {object} rollData - A rollData object to be used for checks
   */
  getTypeChatData(data, labels, props, rollData) {
    // Charges as used by most item types, except spells
    if (this.isCharged) {
      props.push(`${game.i18n.localize("PF1.ChargePlural")}: ${this.charges}/${this.maxCharges}`);
    }
  }

  /* -------------------------------------------- */
  /*  Item Rolls - Attack, Damage, Saves, Checks  */
  /* -------------------------------------------- */

  /**
   * @deprecated Use {@link use ItemPF#use} instead.
   * @param options
   * @returns {Promise<*>}
   */
  useAttack(options) {
    foundry.utils.logCompatibilityWarning("ItemPF#useAttack has been deprecated in favor of ItemPF#use", {
      since: "PF1 0.82.0",
      until: "PF1 0.83.0",
    });
    return this.use(options);
  }

  /**
   * Use an attack, using {@link SharedActionData}
   *
   * @see {@link SharedActionData}
   * @param {string} [actionID=""] - The ID of the action to use, defaults to the first action
   * @param {Event | null} [ev=null] - The event that triggered the use, if any
   * @param {boolean} [skipDialog=false] - Whether to skip the dialog for this action
   * @param {boolean} [chatMessage=true] - Whether to send a chat message for this action
   * @param {string} [dice="1d20"] - The base dice to roll for this action
   * @param {string} [rollMode] - The roll mode to use for the chat message
   * @returns {Promise<SharedActionData | void | ChatMessage | *>}
   */
  async use({ actionID = "", ev = null, skipDialog = false, chatMessage = true, dice = "1d20", rollMode } = {}) {
    // Old use method
    if (!this.hasAction) {
      // Use
      const useScriptCalls = this.scriptCalls.filter((o) => o.category === "use");
      let shared;
      if (useScriptCalls.length > 0) {
        shared = await this.executeScriptCalls("use", {
          attackData: { event: ev, skipDialog, chatMessage, rollMode },
        });
        if (shared.reject) return shared;
        if (shared.hideChat !== true) await this.displayCard();
      }
      // Show a chat card if this item doesn't have 'use' type script call(s)
      else {
        if (chatMessage) return this.displayCard({ rollMode });
        else return { descriptionOnly: true }; // nothing to show for printing description
      }

      // Deduct charges
      if (this.isCharged) {
        if (this.charges < this.chargeCost) {
          if (this.isSingleUse) {
            return void ui.notifications.warn(game.i18n.localize("PF1.ErrorNoQuantity"));
          }
          return void ui.notifications.warn(game.i18n.format("PF1.ErrorInsufficientCharges", { name: this.name }));
        }
        if (this.autoDeductCharges) {
          await this.addCharges(-this.chargeCost);
        }
      }

      return shared;
    }

    if (ev && ev.originalEvent) ev = ev.originalEvent;

    /** @type {ItemAction | undefined} */
    let action;
    if (!actionID && this.system.actions.length > 1 && skipDialog === false) {
      const app = new pf1.applications.ActionChooser(this);
      app.render(true);
      return;
    } else if (actionID || this.system.actions.length === 1 || skipDialog) {
      action = this.actions.get(actionID || this.system.actions[0]._id);
    } else {
      console.error("This item does not have an action associated with it.");
      return;
    }

    // Prepare variables
    /** @type {SharedActionData} */
    const shared = {
      event: ev,
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
      useMeasureTemplate: action.hasTemplate && game.settings.get("pf1", "placeMeasureTemplateOnQuickRolls"),
      conditionals: null,
      conditionalPartsCommon: {},
      casterLevelCheck: false,
      concentrationCheck: false,
      scriptData: {},
    };

    // Prevent reassigning the ActionUse's item and action
    Object.defineProperties(shared, {
      action: { value: action, writable: false, enumerable: true },
      item: { value: this, writable: false, enumerable: true },
    });

    const actionUse = new ActionUse(shared);

    // Check requirements for item
    let reqErr = await actionUse.checkRequirements();
    if (reqErr > 0) return { err: pf1.actionUse.ERR_REQUIREMENT, code: reqErr };

    // Get new roll data
    shared.rollData = await actionUse.getRollData();

    // Show attack dialog, if appropriate
    if (!skipDialog) {
      const result = await actionUse.createAttackDialog();

      // Stop if result is a boolean (i.e. when closed is clicked on the dialog)
      if (typeof result !== "object") return;

      // Alter roll data
      shared.fullAttack = result.fullAttack;
      shared.attacks = result.attacks;
      await actionUse.alterRollData(result.html);
    } else {
      shared.attacks = await actionUse.generateAttacks();
      await actionUse.alterRollData();
    }

    // Filter out attacks without ammo usage
    if (shared.action.data.usesAmmo) {
      shared.attacks = shared.attacks.filter((o) => o.ammo != null);
      if (shared.attacks.length === 0) {
        ui.notifications.error(game.i18n.localize("PF1.AmmoDepleted"));
        return;
      }
    }

    // Limit attacks to 1 if not full rounding
    if (!shared.fullAttack) shared.attacks = shared.attacks.slice(0, 1);
    // Handle conditionals
    await actionUse.handleConditionals();

    // Check attack requirements, post-dialog
    reqErr = await actionUse.checkAttackRequirements();
    if (reqErr > 0) return { err: pf1.actionUse.ERR_REQUIREMENT, code: reqErr };

    // Generate chat attacks
    await actionUse.generateChatAttacks();

    // Prompt measure template
    let measureResult;
    if (shared.useMeasureTemplate && canvas.scene) {
      measureResult = await actionUse.promptMeasureTemplate();
      if (!measureResult.result) return;
    }

    // Override roll mode if present.
    if (rollMode) shared.rollMode = rollMode;

    // Call itemUse hook and determine whether the item can be used based off that
    let allowed = Hooks.call("pf1PreActionUse", actionUse);
    allowed = callOldNamespaceHook("itemUse", "pf1PreUseAttack", allowed, this, "attack", {
      ev,
      skipDialog,
      dice,
      shared,
    });
    if (allowed === false) {
      await measureResult?.delete();
      return;
    }

    // Call script calls
    await actionUse.executeScriptCalls();
    if (shared.scriptData?.reject) {
      await measureResult?.delete();
      return;
    }

    // Handle Dice So Nice
    await actionUse.handleDiceSoNice();

    // Subtract uses
    await actionUse.subtractAmmo();
    if (shared.rollData.chargeCost < 0 || shared.rollData.chargeCost > 0)
      await this.addCharges(-shared.rollData.chargeCost);
    if (shared.action.isSelfCharged)
      await shared.action.update({ "uses.self.value": shared.action.data.uses.self.value - 1 });

    // Retrieve message data
    await actionUse.getMessageData();

    // Post message
    let result;
    if (shared.scriptData?.hideChat !== true) {
      result = await actionUse.postMessage();
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
    let result = this.parentActor.changes;

    switch (context) {
      case "mattack":
      case "rattack": {
        const subTargetList = ["attack", context];
        result = result.filter((c) => {
          if (!subTargetList.includes(c.subTarget)) return false;
          return true;
        });
        break;
      }
      case "wdamage":
      case "sdamage": {
        const subTargetList = ["damage", context];
        result = result.filter((c) => {
          if (!subTargetList.includes(c.subTarget)) return false;
          return true;
        });
        break;
      }
      case "damage": {
        result = result.filter((c) => c.subTarget === "damage");
        break;
      }
    }

    return result;
  }

  /* -------------------------------------------- */

  /**
   * @returns {object} An object with data to be used in rolls in relation to this item.
   */
  getRollData() {
    const parentActor = this.parentActor;
    const result = parentActor ? parentActor.getRollData() : {};

    result.item = deepClone(this.system);

    // Add dictionary flag
    if (this.system.tag) {
      result.item.dFlags = getProperty(result, `dFlags.${this.system.tag}`);
    }

    // Set aura strength
    setProperty(result, "item.auraStrength", this.auraStrength);

    result.dc = this.hasSave ? this.getDC(result) : 0;

    this._rollData = result.item;

    if (Hooks.events["pf1GetRollData"]?.length > 0) Hooks.callAll("pf1GetRollData", this, result);
    callOldNamespaceHookAll("pf1.getRollData", "pf1GetRollData", this, result, true);

    return result;
  }

  /* -------------------------------------------- */

  static chatListeners(html) {
    html.on("click", ".card-buttons button, .inline-action", this._onChatCardButton.bind(this));
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

    // Apply damage
    if (action === "applyDamage") {
      let asNonlethal = [...(button.closest(".chat-message")?.querySelectorAll(".tag") ?? [])]
        .map((o) => o.innerText)
        .includes(game.i18n.localize("PF1.Nonlethal"));
      if (button.dataset.tags?.split(" ").includes("nonlethal")) asNonlethal = true;

      const value = button.dataset.value;
      if (!isNaN(parseInt(value))) CONFIG.Actor.documentClasses.default.applyDamage(parseInt(value), { asNonlethal });
    }
    // Recover ammunition
    else if (["recoverAmmo", "forceRecoverAmmo"].includes(action)) {
      if (!item) return;
      if (!item.isOwner) return;

      // Check for recovery state
      const attackIndex = button.closest(".chat-attack").dataset.index;
      const card = game.messages.get(button.closest(".chat-message").dataset.messageId);
      const ammoId = button.closest(".ammo")?.dataset.ammoId || button.dataset.ammoId;
      const recoveryData = card.getFlag("pf1", "ammoRecovery");
      const ammoRecovery = recoveryData?.[attackIndex]?.[ammoId];
      if (ammoRecovery?.failed || ammoRecovery?.recovered) return;

      let recovered = false;
      let failed = false;
      const promises = [];

      // Find ammo item
      const ammoItem = item.actor.items.get(ammoId);
      if (!ammoItem) return;
      let chance = 100;
      if (action === "recoverAmmo") {
        chance = 50; // @TODO: Allow user to set chance to something else, somehow
      }

      // (Try to) recover ammo
      if (chance >= Math.random() * 100) {
        recovered = true;
        promises.push(ammoItem.addCharges(1));
      } else {
        failed = true;
      }

      // Update chat card
      if (recovered || failed) {
        if (attackIndex) {
          promises.push(card.setFlag("pf1", "ammoRecovery", { [attackIndex]: { [ammoId]: { failed, recovered } } }));
        }
      }

      await Promise.all(promises);

      return true;
    } else if (action === "concentration") {
      item.parentActor.rollConcentration(item.system.spellbook);
    } else if (action === "caster-level-check") {
      item.parentActor.rollCL(item.system.spellbook);
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
    const links = getProperty(this, `system.links.${linkType}`) || [];
    if (links.filter((o) => o.id === itemLink).length) return false;

    const targetLinks = getProperty(targetItem, `system.links.${linkType}`);
    if (["children", "charges", "ammunition"].includes(linkType) && sameActor) {
      if (linkType === "charges") {
        // Prevent the closing of charge link loops
        if (targetLinks.length > 0) {
          ui.notifications.warn(
            game.i18n.format("PF1.WarningCannotCreateChargeLink", { source: this.name, target: targetItem.name })
          );
          return false;
        } else if (targetItem.links.charges != null) {
          // Prevent the linking of one item to multiple resource pools
          ui.notifications.warn(
            game.i18n.format("PF1.WarningCannotCreateChargeLink2", {
              source: this.name,
              target: targetItem.name,
              deeptarget: targetItem.links.charges.name,
            })
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
      img: targetItem.img,
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
      const _links = duplicate(getProperty(this, `system.links.${linkType}`) || []);
      const link = this.generateInitialLinkData(linkType, dataType, targetItem, itemLink);
      _links.push(link);
      updateData[`system.links.${linkType}`] = _links;

      // Call link creation hook
      await this.update(updateData);
      callOldNamespaceHookAll("createItemLink", "pf1CreateItemLink", this, link, linkType);
      Hooks.callAll("pf1CreateItemLink", this, link, linkType);

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
      if (getProperty(itemData, "type") === "spell") setProperty(itemData, "system.spellbook", "spelllike");

      const newItemData = await this.parent.createEmbeddedDocuments("Item", [itemData]);
      const newItem = this.parent.items.get(newItemData._id);

      await this.createItemLink("children", "data", newItem, newItem._id);
    }

    return false;
  }

  async getLinkedItems(type, extraData = false) {
    const items = this.system.links?.[type];
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

    for (const items of Object.values(getProperty(this, "system.links"))) {
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
    for (const [k, linkItems] of Object.entries(getProperty(this, "system.links") || {})) {
      const items = duplicate(linkItems);
      for (let a = 0; a < items.length; a++) {
        const item = items[a];
        if (item.id === id) {
          items.splice(a, 1);
          a--;
        }
      }

      if (linkItems.length > items.length) {
        updateData[`system.links.${k}`] = items;
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
      item = this.parent.items.get(id[0]);
    }

    // Package extra data
    if (extraData) {
      item = { item: item, linkData: l };
    }

    return item;
  }

  async updateLinkItems() {
    // Update link items
    const linkGroups = getProperty(this, "system.links") || {};
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

    const otherItem = this.parent.items.get(oldLink.id);
    if (linkType === "charges" && otherItem && hasProperty(otherItem, "links.charges")) {
      delete otherItem.links.charges;
    }
  }

  /**
   * Generates lists of change subtargets this item can have.
   *
   * @param {string} target - The target key, as defined in CONFIG.PF1.buffTargets.
   * @returns {Object<string, string>} A list of changes
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
        const actorSkills = mergeObject(duplicate(CONFIG.PF1.skills), this.parent.data.skills);
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

  async addChange() {
    const change = new ItemChange({}, this);
    return change;
  }

  /**
   * Returns the currency this item contains
   *
   * @param {object} [options] - Additional options affecting how the value is returned
   * @param {boolean} [options.inLowestDenomination=false] - Whether to return the value in copper, or in gold (default)
   * @returns {number} The total amount of currency this item contains, in gold pieces
   */
  getTotalCurrency({ inLowestDenomination = false } = {}) {
    return 0;
  }

  /**
   * Returns the displayed value of an item according to multiple options
   *
   * @param {object} [options] - Various optional parameters affecting value calculations
   * @param {boolean} [options.recursive=true] - Whether the value of contained items should be included
   * @param {number} [options.sellValue=0.5] - The sell value multiplier
   * @param {boolean} [options.inLowestDenomination=false] - Whether the value should be returned in the lowest denomination
   * @param {boolean} [options.forceUnidentified=false] - Override whether the value should use the unidentified price
   * @returns {number} The item's value
   */
  getValue({ recursive = true, sellValue = 0.5, inLowestDenomination = false, forceUnidentified = false } = {}) {
    let result = 0;

    const getActualValue = (identified = true) => {
      let value = 0;
      if (identified) value = this.system.price;
      else value = this.system.unidentified.price;

      // Add charge price
      if (identified) value += (this.system.uses?.pricePerUse ?? 0) * (this.system.uses?.value ?? 0);

      if (inLowestDenomination) value *= 100;
      if (this.system.broken) value *= 0.75; // TODO: Make broken value configurable
      return value;
    };

    const quantity = getProperty(this, "system.quantity") || 0;

    // Add item's price
    result += getActualValue(forceUnidentified ? false : !this.showUnidentifiedData) * quantity;

    // Modify sell value
    if (!(this.type === "loot" && this.system.subType === "tradeGoods")) result *= sellValue;

    // Add item's contained currencies at full value
    result += this.getTotalCurrency({ inLowestDenomination });

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
    updateData[`system.currency.pp`] = values[0];
    updateData[`system.currency.gp`] = values[1];
    updateData[`system.currency.sp`] = values[2];
    updateData[`system.currency.cp`] = values[3];
    return this.update(updateData);
  }

  _calculateCoinWeight(data) {
    const coinWeightDivisor = game.settings.get("pf1", "coinWeight");
    if (!coinWeightDivisor) return 0;
    return (
      Object.values(getProperty(data, "currency") || {}).reduce((cur, amount) => {
        return cur + amount;
      }, 0) / coinWeightDivisor
    );
  }

  /**
   * Sets a boolean flag on this item.
   *
   * @param {string} flagName - The name/key of the flag to set.
   * @param {object} context Update context
   * @returns {Promise<boolean>} Whether something was changed.
   */
  async addItemBooleanFlag(flagName, context = {}) {
    flagName = String(flagName).slugify({ strict: true });
    const flags = this.system.flags?.boolean ?? {};

    if (Array.isArray(flags)) throw new Error(`${this.name} [${this.id}] requires migration.`);

    if (flags[flagName] === undefined) {
      await this.update({ [`system.flags.boolean.${flagName}`]: true }, context);
      return true;
    }

    return false;
  }

  /**
   * Removes a boolean flag from this item.
   *
   * @param {string} flagName - The name/key of the flag to remove.
   * @param {object} context Update context
   * @returns {Promise<boolean>} Whether something was changed.
   */
  async removeItemBooleanFlag(flagName, context = {}) {
    const flags = getProperty(this, "system.flags.boolean") ?? {};

    if (flags[flagName] !== undefined) {
      await this.update({ [`system.flags.boolean.-=${flagName}`]: null }, context);
      return true;
    }

    return false;
  }

  /**
   * @param {string} flagName - The name/key of the flag on this item.
   * @returns {boolean} Whether the flag was found on this item.
   */
  hasItemBooleanFlag(flagName) {
    const flags = getProperty(this, "system.flags.boolean") ?? {};
    return flags[flagName] === true;
  }

  /**
   * Get all item boolean flags as array.
   *
   * @returns {string[]}
   */
  getItemBooleanFlags() {
    const flags = getProperty(this, "system.flags.boolean") ?? {};
    return Object.keys(flags);
  }

  /**
   * Sets a dictionary flag value on this item.
   *
   * @param {string} flagName - The name/key of the flag to set.
   * @param {number|string} value - The flag's new value.
   * @param {object} context Update context
   * @returns {Promise<boolean>} Whether something was changed.
   */
  async setItemDictionaryFlag(flagName, value, context = {}) {
    flagName = String(flagName).slugify({ strict: true });
    const flags = this.system.flags?.dictionary ?? {};

    if (flags[flagName] !== value) {
      await this.update({ [`system.flags.dictionary.${flagName}`]: value }, context);
      return true;
    }

    return false;
  }

  /**
   * Removes a dictionary flag from this item.
   *
   * @param {string} flagName - The name/key of the flag to remove.
   * @param {object} context Update context
   * @returns {Promise<boolean>} Whether something was changed.
   */
  async removeItemDictionaryFlag(flagName, context = {}) {
    const flags = getProperty(this, "system.flags.dictionary") ?? {};

    if (flags[flagName] !== undefined) {
      await this.update({ [`system.flags.dictionary.-=${flagName}`]: null }, context);
      return true;
    }

    return false;
  }

  /**
   * @param {string} flagName - The name/key of the flag to get.
   * @returns {object} The value stored in the flag.
   */
  getItemDictionaryFlag(flagName) {
    const flags = getProperty(this, "system.flags.dictionary") || {};
    return flags[flagName];
  }

  /**
   * Get all item dictionary flags as array of objects.
   *
   * @returns {object[]}
   */
  getItemDictionaryFlags() {
    const flags = getProperty(this, "system.flags.dictionary") || {};
    return flags;
  }

  /**
   * Get attack array for specific action.
   *
   * @param {string} actionId Action identifier.
   * @returns {number[]} Simple array describing the individual guaranteed attacks.
   */
  getAttackArray(actionId) {
    const action = this.actions.get(actionId),
      actionData = action?.data,
      rollData = action?.getRollData(),
      attacks = [0];
    if (!actionData) return attacks;

    const appendAttack = (formula) => {
      const bonus = RollPF.safeRoll(formula, rollData).total;
      if (Number.isFinite(bonus)) attacks.push(bonus);
    };

    // Static extra attacks
    const extraAttacks = actionData.attackParts.map((n) => n[0]?.toString().trim()).filter((n) => n?.length > 0);
    for (const formula of extraAttacks) appendAttack(formula);

    // Formula-based extra attacks
    const fmAtk = actionData.formulaicAttacks?.count?.formula?.trim();
    if (fmAtk?.length > 0) {
      const fmAtkBonus = actionData.formulaicAttacks?.bonus?.formula?.trim() || "0";
      const count = RollPF.safeRoll(fmAtk, rollData);
      for (let i = 0; i < count.total; i++) {
        rollData.formulaicAttack = i + 1;
        appendAttack(fmAtkBonus);
      }
      delete rollData.formulaicAttack;
    }

    // Conditional modifiers
    const condBonuses = new Array(attacks.length).fill(0);
    actionData.conditionals
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

    const sources = this.getAttackSources(actionId);
    const totalBonus = sources.reduce((f, s) => f + s.value, 0);

    return attacks.map((a, i) => a + totalBonus + condBonuses[i]);
  }

  /**
   * Get default action's attack array.
   *
   * @returns {number[]} Simple array describing the individual guaranteed attacks.
   */
  get attackArray() {
    return this.getAttackArray(this.firstAction.id);
  }

  /**
   * Attack sources for a specific action.
   *
   * @param actionId
   * @returns {object[]} Array of value and label pairs for attack bonus sources on the main attack.
   */
  getAttackSources(actionId) {
    const action = this.actions.get(actionId);
    if (!action) return;

    const sources = [];

    const actorData = this.parentActor?.system,
      itemData = this.system,
      actionData = action.data;

    if (!actorData || !actionData) return sources;
    const rollData = action.getRollData();

    // Attack type identification
    const isMelee =
      ["mwak", "msak", "mcman"].includes(actionData.actionType) || ["melee", "reach"].includes(actionData.range.units);
    const isRanged =
      ["rwak", "rsak", "rcman"].includes(actionData.actionType) || this.system.weaponSubtype === "ranged";
    const isManeuver = ["mcman", "rcman"].includes(actionData.actionType);

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

    srcDetails(this.parentActor.sourceDetails["system.attributes.attack.shared"]);
    if (isManeuver) srcDetails(this.parentActor.sourceDetails["system.attributes.cmb.bonus"]);
    srcDetails(this.parentActor.sourceDetails["system.attributes.attack.general"]);

    const changeSources = [];
    if (isRanged) changeSources.push("rattack");
    if (isMelee) changeSources.push("mattack");
    const effectiveChanges = getHighestChanges(
      this.parentActor.changes.filter((c) => changeSources.includes(c.subTarget)),
      { ignoreTarget: true }
    );
    effectiveChanges.forEach((ic) => describePart(ic.value, ic.flavor, -800));

    if (actionData.ability.attack) {
      const ablMod = getProperty(actorData, `abilities.${actionData.ability.attack}.mod`) ?? 0;
      describePart(ablMod, CONFIG.PF1.abilities[actionData.ability.attack], -50);
    }

    // Attack bonus formula
    const bonusRoll = RollPF.safeRoll(actionData.attackBonus || "0", rollData);
    if (bonusRoll.total != 0)
      describePart(bonusRoll.total, bonusRoll.flavor ?? game.i18n.localize("PF1.AttackRollBonus"), -100);

    // Masterwork or enhancement bonus
    // Only add them if there's no larger enhancement bonus from some other source
    const virtualEnh = action.enhancementBonus ?? (itemData.masterwork ? 1 : 0);
    if (!effectiveChanges.find((i) => i.modifier === "enh" && i.value > virtualEnh)) {
      if (Number.isFinite(action.enhancementBonus) && action.enhancementBonus !== 0) {
        describePart(action.enhancementBonus, game.i18n.localize("PF1.EnhancementBonus"), -300);
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
    if (actionData.naturalAttack.primaryAttack !== true && itemData.subType === "natural") {
      const attackBonus = actionData.naturalAttack?.secondary?.attackBonus || "-5";
      const secondaryModifier = RollPF.safeTotal(`${attackBonus}`, rollData);
      describePart(secondaryModifier, game.i18n.localize("PF1.SecondaryAttack"), -400);
    }

    // Conditional modifiers
    actionData.conditionals
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
   * Return attack sources for default action.
   *
   * @returns {object[]} Array of value and label pairs for attack bonus sources on the main attack.
   */
  get attackSources() {
    return this.getAttackSources(this.firstAction.id);
  }

  /**
   * Generic damage source retrieval
   *
   * @deprecated
   */
  get damageSources() {
    foundry.utils.logCompatibilityWarning("ItemPF.damageSources is deprecated, use ItemAction.damageSources instead", {
      since: "PF1 0.82.2",
      until: "PF1 0.83.0",
    });
    return this.firstAction?.damageSources ?? [];
  }

  getAllDamageSources(actionId) {
    const action = this.actions.get(actionId);
    if (!action) return;

    const conds = action.data.conditionals
      .filter((c) => c.default)
      .filter((c) => c.modifiers.find((m) => m.target === "damage"));
    const rollData = action.getRollData();

    if (!rollData) return [];

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

    const allChanges = [...action.damageSources, ...fakeCondChanges];

    // Add enhancement bonus
    if (action.enhancementBonus) {
      allChanges.push({
        flavor: game.i18n.localize("PF1.EnhancementBonus"),
        value: action.enhancementBonus,
        modifier: "enh",
        formula: action.enhancementBonus.toString(),
      });
    }

    // Add special cases specific to the item
    // Broken
    if (this.system.broken) {
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
   * Generic damage source retrieval, includes default conditionals and other item specific modifiers.
   */
  get allDamageSources() {
    return this.getAllDamageSources(this.firstAction.id);
  }

  /**
   * @param {boolean} active
   * @param {object} context Optional update context
   * @returns Update promise if item type supports the operation.
   */
  setActive(active, context) {
    throw new Error(`Item type ${this.type} does not support ItemPF#setActive`);
  }
}

/**
 * @typedef {object} ItemWeightData
 * An item's `weight` data. The only property to be stored is `value`, from which all other values are derived.
 * @see {@link ItemPF.prepareWeight} for generation
 * @remarks A weight property is considered "effective" if it is the value that is added to its parent's weight.
 *          An item with a weight of 10 lbs in a container with 50% weight reduction would increase
 *          the container's effective `weight.total` by 5 lbs, but increases the container's `weight.contents` weight by 10 lbs.
 * @property {number} value - The weight of a single item instance, in lbs
 * @property {number} total - The effective total weight of the item (including quantity and contents), in lbs
 * @property {number} [currency] - Effective weight of contained currency for containers, in lbs
 * @property {number} [contents] - Weight of contained items and currency, in lbs
 * @property {object} converted - Weight of this item, converted to the current unit system
 * @property {number} converted.value - The weight of a single item instance, in world units
 * @property {number} converted.total - The effective total weight of the item (including quantity and contents), in world units
 * @property {number} [converted.contents] - Weight of contained items and currency, in world units
 */

/**
 * @typedef {object} ChatData
 * Data required to render an item's summary or chat card, including descriptions and properties/tags/labels
 * @property {string} description - The item's enriched description as appropriate for the current user
 * @property {string} identifiedDescription - The item's full enriched description when identified
 * @property {string} unidentifiedDescription - The item's enriched description when unidentified
 * @property {string} [actionDescription] - The enriched description of a specific action
 * @property {string[]} properties - Additional properties/labels for the item and the action
 */

/**
 * @typedef {object} SharedActionData
 * A common data object used to store and share data between stages of an action's usage.
 * @property {Event | null} event - The event that triggered the action. Defaults to `null`.
 * @property {object} rollData - The singular rollData object used for all rolls in the action
 * @property {boolean} skipDialog - Whether the user-facing dialog should get skipped. Defaults to `false`.
 * @property {boolean} chatMessage - Whether a chat message should be created at the end of the action's usage. Defaults to `true`.
 * @property {string} dice - The base dice used for the action's attack rolls. Defaults to `"1d20"`.
 * @property {boolean} fullAttack - Whether the action is a full attack. Defaults to `true`.
 * @property {string[]} attackBonus - Bonus values to be added to the attack roll formula
 * @property {string[]} damageBonus - Bonus values to be added to the damage roll formula
 * @property {object[]} attacks - Array of attacks
 * @property {import("@actionUse/chat-attack.mjs").ChatAttack[]} chatAttacks - Array of chat attacks for this action's use
 * @property {string} rollMode - The roll mode to be used for the creation of the chat message. Defaults to the `core.rollMode` setting.
 * @property {boolean} useMeasureTemplate - Whether to use a measure template
 * @property {object[] | null} conditionals
 * @property {object} conditionalPartsCommon
 * @property {boolean} casterLevelCheck
 * @property {boolean} concentrationCheck
 * @property {object} scriptData
 * @property {ItemAction} action - The {@link ItemAction} this use is based on
 * @property {ItemPF} item - The {@link ItemPF} this use is based on
 * @property {object} chatData - Data to be passed to {@link ChatMessage.create}, excluding `content` rendered using {@link templateData} and {@link template}.
 * @property {string} [chatTemplate] - The template to be used for the creation of the chat message.
 * @property {object} templateData - Data used to render the chat card, passed to {@link foundry.utils.renderTemplate}.
 */
