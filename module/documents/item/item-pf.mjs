import { ItemBasePF } from "./item-base.mjs";
import { createCustomChatMessage } from "../../utils/chat.mjs";
import { createTag, convertDistance, keepUpdateArray, diffObjectAndArray } from "../../utils/lib.mjs";
import { ItemChange } from "../../components/change.mjs";
import { ItemAction } from "../../components/action.mjs";
import { getHighestChanges } from "../actor/utils/apply-changes.mjs";
import { RollPF } from "../../dice/roll.mjs";
import { ActionUse } from "@actionUse/action-use.mjs";
import { getSkipActionPrompt } from "../settings.mjs";

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
       * @type {Record<string, ItemPF>}
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

  /**
   * A static object holding system-specific metadata applicable to all instances of this Document class.
   *
   * @internal
   */
  static system = Object.freeze({
    /**
     * Whether this item is a physical one, possessing properties like quantity or weight.
     *
     * @type {boolean}
     */
    isPhysical: false,
  });

  /**
   * Determine whether an item type is physical.
   *
   * @deprecated Use {@link ItemPF.isPhysical} insted.
   * @param {string} type - The item type to check
   * @returns {boolean} Whether an item of that type is physical.
   */
  static isInventoryItem(type) {
    foundry.utils.logCompatibilityWarning(`ItemPF.isInventoryItem is deprecated. Use ItemPF.isPhysical instead.`, {
      since: "PF1 v9",
      until: "PF1 v10",
    });
    return CONFIG.Item.documentClasses[type]?.isPhysical ?? false;
  }

  /**
   * @override
   * @param {object} data
   * @param {object} context
   * @param {User} user
   */
  async _preCreate(data, context, user) {
    await super._preCreate(data, context, user);

    // Set typed image
    // The test against DEFAULT_ICON is to deal with a Foundry bug with unlinked actors.
    if (data.img === undefined || data.img === Item.DEFAULT_ICON) {
      const image = pf1.config.defaultIcons.items[this.type];
      if (image) this.updateSource({ img: image });
    }

    // Ensure unique Change IDs
    const actor = this.actor;
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

    const updates = this.preCreateData(data, context, user);

    if (Object.keys(updates).length) return this.updateSource(updates);
  }

  /**
   * Meant to be overridden.
   *
   * {@inheritDoc _preCreate}
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
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    if (!changed.system) return;

    await this._chargePreUpdate(changed, context);
  }

  /**
   * Handle charge update sanity checking, constraining them to reasonable values,
   *   and propagating to parent items if charges are shared.
   *
   * @private
   * @param {object} changed
   * @param {object} context
   */
  async _chargePreUpdate(changed, context) {
    // Make sure charges doesn't exceed max charges
    const uses = changed.system.uses;
    if (uses?.value && this.isCharged) {
      const maxCharges = this.maxCharges;
      if (uses.value > maxCharges) uses.value = maxCharges;

      const link = this.links.charges;
      if (link) {
        // Update charges for linked item. This will cascade if items are linked more.
        await link.update({ "system.uses.value": uses.value }, context);
        // Remove updating current item's inherited value
        delete changed.system.uses.value;
      }
    }
  }

  /**
   * @returns {string[]} The keys of data variables to memorize between updates, for e.g. determining the difference in update.
   */
  get memoryVariables() {
    return ["quantity", "level", "inventoryItems"];
  }

  /**
   * Whether this item is physical.
   *
   * @type {boolean}
   */
  static get isPhysical() {
    return this.system.isPhysical;
  }
  /** {@inheritDoc ItemPF.isPhysical:getter} */
  get isPhysical() {
    return this.constructor.isPhysical;
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
    return this.actions?.get(this.system.actions?.[0]?._id);
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

  /**
   * @param {boolean} [weapon=true] - Get proficiency as a weapon. Armor otherwise.
   * @returns {boolean} - Whether or not the owner of the item is proficient.
   * @throws {Error} - If item type does not support proficiency.
   */
  getProficiency(weapon = true) {
    throw new Error(`Item type ${this.type} has no concept of proficiency`);
  }

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

  /** @type {boolean} Does the item has finite number of charges */
  get hasFiniteCharges() {
    return this.isSingleUse || ["charges"].includes(this.system.uses?.per);
  }

  /** @type {number} Remaining charges */
  get charges() {
    // No actor? No charges!
    if (!this.actor) return 0;

    // Get linked charges
    const link = this.links?.charges;
    if (link) return link.charges;

    // Get own charges
    if (this.isSingleUse) return this.system.quantity ?? 0;
    return this.system.uses?.value ?? 0;
  }

  /**
   * @type {boolean} True if default charge cost is non-zero
   */
  get autoDeductCharges() {
    return this.getDefaultChargeCost() != 0;
  }

  /**
   * Get default charge cost for all actions.
   *
   * @param {object} [options] Additional options
   * @param {object} [options.rollData] Roll data instance
   * @returns {number} Number for default cost.
   */
  getDefaultChargeCost({ rollData } = {}) {
    rollData ??= this.getRollData();
    const formula = this.getDefaultChargeFormula();
    return RollPF.safeRoll(formula, rollData).total;
  }

  /**
   * Default charge formula.
   *
   * @returns {string} Charge formula
   */
  getDefaultChargeFormula() {
    return this.system.uses?.autoDeductChargesCost || "1";
  }

  /**
   * @type {number} Maximum charges the item can have.
   */
  get maxCharges() {
    // Get linked charges
    const link = this.links?.charges;
    if (link) return link.maxCharges;

    // Get own charges
    if (this.isSingleUse) return this.system.quantity ?? 0;
    return this.system.uses?.max ?? 0;
  }

  /**
   * Recharges item's uses, if any.
   *
   * @param {object} options Options
   * @param {string} [options.period="day"] Recharge period. Use "any" to ignore item's configuration.
   * @param {boolean} [options.exact=false] Use exact time period. Otherwise "week" for example will also recharge items with "day" period.
   * @param {number} [options.value] Recharge to specific value, respecting maximum and minimum bounds.
   * @param {boolean} [options.maximize=false] Recharge to full regardless of recharge formula.
   * @param {boolean} [options.commit=true] Commit update directly. If false, returns the update data instead.
   * @param {object} [options.rollData] Roll data instance to use for formulas.
   * @param {object} [options.context] Update context
   * @returns {Promise<this|object|undefined>} Promise for the update, update data object, or undefined (no update needed).
   */
  async recharge({ value, period = "day", exact = false, maximize = false, commit = true, rollData, context } = {}) {
    const itemData = this.system;
    if (!itemData.uses?.per) return;

    // Cancel if charges are managed by different item.
    if (this.links.charges) return;

    // No update when period does not match usage
    if (period === "week" && !exact) {
      // Recharge "day" with "week" with inexact recharging
      if (!["day", "week"].includes(itemData.uses.per)) return;
    }
    // Otherwise test if "any" period is used
    else if (itemData.uses.per !== period && period !== "any") return;

    const updateData = { system: { uses: {} } };
    const staticValue = value !== undefined;

    // No specific value given
    if (!staticValue) {
      const formula = itemData.uses?.rechargeFormula || "";
      // Default to maximizing value
      if (!formula) maximize = true;
      else {
        rollData ??= this.getRollData();
        const roll = RollPF.safeRoll(formula, rollData, "recharge");
        value = roll.total;

        // Cancel if formula produced invalid value
        if (!Number.isFinite(value)) return;
      }
    }

    // Maximize value regardless what value is
    if (maximize) value = itemData.uses.max;

    // Clamp charge value to
    value = Math.clamped(value, 0, itemData.uses.max);

    // Cancel pointless update
    if (value === itemData.uses.value) return;

    updateData.system.uses.value = value;

    if (commit) return this.update(updateData, context);
    return updateData;
  }

  /**
   * Returns total duration in seconds or null.
   *
   * @returns {number|null} Seconds or null.
   */
  get totalDurationSeconds() {
    return this.system.duration?.totalSeconds ?? null;
  }

  /**
   * @type {number} Number from 0 to 4. 0 for no aura and 1-4 matching PF1.auraStrengths.
   */
  get auraStrength() {
    const cl = this.system.cl || 0;
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

  /**
   * @type {ActorPF|null} Parent actor
   * @deprecated Use {@link actor instead}
   */
  get parentActor() {
    foundry.utils.logCompatibilityWarning("ItemPF.parentActor is deprecated in favor of Item.actor", {
      since: "PF1 v9",
      until: "PF1 v11",
    });

    return this.actor;
  }

  get limited() {
    if (this.parentItem) return this.parentItem.limited;
    return super.limited;
  }

  get uuid() {
    if (this.parentItem) this.parentItem.uuid + `.Item.${this.id}`;
    return super.uuid;
  }

  getName(forcePlayerPerspective = false) {
    if (game.user.isGM && forcePlayerPerspective) {
      if (this.system.identified === false) return this.system.unidentified?.name || this.name;
    }
    return this.name;
  }

  testUserPermission(user, permission, { exact = false } = {}) {
    if (this.actor) return this.actor.testUserPermission(user, permission, { exact });
    if (this.parentItem) return this.parentItem.testUserPermission(user, permission, { exact });
    return super.testUserPermission(user, permission, { exact });
  }

  get permission() {
    if (this.actor) return this.actor.permission;
    return super.permission;
  }

  get fullDescription() {
    return this.system.description.value;
  }

  /**
   * Get full description.
   *
   * @param {object} options Item type dependant options for rendering the description.
   * @param {boolean} [options.chatcard=false] Instruct template to render chat card in mind.
   * @param {object} [options.data={}] Template data for rendering
   * @returns {string} Full description.
   */
  getDescription(options) {
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
   * @param {number} value The amount of charges to add.
   * @returns {Promise<this | void>} Updated document or undefined if no update is possible.
   */
  async addCharges(value) {
    // Add link charges
    const link = this.links.charges;
    if (link) return link.addCharges(value);

    // Add own charges
    if (this.isSingleUse) return this.update({ "system.quantity": (this.system.quantity ?? 0) + value });
    else return this.update({ "system.uses.value": (this.system.uses?.value ?? 0) + value });
  }

  /**
   * Linked ammunition item if any.
   *
   * @type {Item|undefined}
   */
  get defaultAmmo() {
    const ammoId = this.getFlag("pf1", "defaultAmmo");
    return this.actor?.items.get(ammoId);
  }

  /* -------------------------------------------- */

  /**
   * Should the item show unidentified data
   *
   * @type {boolean}
   */
  get showUnidentifiedData() {
    return !game.user.isGM && this.system.identified === false;
  }

  /* -------------------------------------------- */
  /*	Data Preparation														*/
  /* -------------------------------------------- */

  /**
   * Prepare this item's {@link ItemWeightData}
   */
  prepareWeight() {
    if (!this.isPhysical) return;

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
    weight.converted = {
      value: pf1.utils.convertWeight(weight.value),
      total: pf1.utils.convertWeight(weight.total),
    };
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    this.prepareLinks();

    const itemData = this.system;

    // Update changes
    if (itemData.changes instanceof Array) {
      this.changes = this._prepareChanges(itemData.changes);
    }

    // Update actions
    if (itemData.actions instanceof Array) {
      this.actions = this._prepareActions(itemData.actions);
    }

    // Update script calls
    if (itemData.scriptCalls instanceof Array) {
      this.scriptCalls = this._prepareScriptCalls(itemData.scriptCalls);
    }

    this.prepareWeight();

    if (!this.actor) {
      this.prepareDerivedItemData();
    }

    // Physical items
    if (this.isPhysical && this.showUnidentifiedData) {
      // Set unidentified description for players
      this.system.description.value = this.system.description.unidentified;
    }
  }

  prepareBaseData() {
    // Set visible name
    if (this.showUnidentifiedData) {
      this.name = this.system.unidentified?.name || this._source.name;
    } else {
      this.name = this._source.name;
    }

    this._prepareIdentifier();
  }

  /**
   * Initialize identifier
   */
  _prepareIdentifier() {
    if (!this.system.tag) {
      // TODO: remove template.json dependency
      const isTaggedType = game.template.Item[this.type]?.templates.includes("tagged") ?? false;
      if (isTaggedType) {
        this.system.tag = createTag(this.name);
      }
    }

    if (this.inContainer) this.adjustContained();
  }

  /**
   * Adjust data if the item is in container.
   *
   * @abstract
   */
  adjustContained() {}

  prepareDerivedItemData() {
    // Update maximum uses
    this._updateMaxUses();
  }

  /**
   * Returns labels for this item
   *
   * @param {object} [options={}] - Additional options
   * @param {string} [options.actionId] - ID of one of this item's actions to get labels for; defaults to first action
   * @param {object} [options.rollData] - Roll data to use.
   * @returns {Record<string, string>} This item's labels
   */
  getLabels({ actionId, rollData } = {}) {
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
    if (this.hasSlots) {
      labels.slot = pf1.config.equipmentSlots.wondrous[itemData.slot] ?? null;
    }

    const action = actionId ? this.actions.get(actionId) : this.firstAction;
    return { ...labels, ...(action?.getLabels({ rollData }) ?? {}) };
  }

  prepareLinks() {
    if (!this.links) return;

    for (const [type, item] of Object.entries(this.links)) {
      if (type === "charges") {
        // Remove cached link if stale
        const links = item.getLinkedItemsSync("charges");
        if (!links.some((i) => i.id === this.id)) {
          delete this.links.charges;
          continue;
        }

        // Copy charge data
        const uses = item.system.uses;
        if (!uses) break;
        for (const [k, v] of Object.entries(uses)) {
          if (["autoDeductCharges", "autoDeductChargesCost"].includes(k)) continue;
          this.system.uses[k] = v;
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
        change.data = mergeObject(ItemChange.defaultData, c);
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
        action.data = mergeObject(ItemAction.defaultData, o);
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
        item = new Item.implementation(o, { parent: this.actor });
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

    data = expandObject(data);

    // Make sure stuff remains an array
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
    }

    this.memorizeVariables();

    const diff = diffObject(this.toObject(), data);

    if (Object.keys(diff).length) {
      const parentItem = this.parentItem;
      if (parentItem == null) {
        return super.update(diff, context);
      } else {
        // Determine item index to update in parent
        const parentInventory = parentItem.system.inventoryItems || [];
        const idx = parentInventory.findIndex((item) => item._id === this.id);

        if (idx >= 0) {
          // Replace keys to suit parent item
          for (const [k, v] of Object.entries(diff)) {
            delete diff[k];
            diff[`system.inventoryItems.${idx}.${k}`] = v;
          }

          // Update parent item
          return parentItem.update(diff);
        }
      }
    }
  }

  memorizeVariables() {
    if (this._memoryVariables != null) return;

    const memKeys = this.memoryVariables;
    this._memoryVariables = {};
    for (const k of memKeys) {
      if (hasProperty(this.system, k)) {
        this._memoryVariables[k] = deepClone(getProperty(this.system, k));
      }
    }

    // Memorize variables recursively on container items
    for (const item of this.items ?? []) {
      item.memorizeVariables();
    }
  }

  /**
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {string} userId
   */
  _onUpdate(changed, context, userId) {
    super._onUpdate(changed, context, userId);

    if (userId === game.user.id) {
      // Call 'toggle' script calls
      {
        let state = null;
        if (this.type === "buff") state = changed.system?.active;
        else if (this.type === "feat" && changed.system?.disabled !== undefined)
          state = changed.system.disabled === true ? false : true;
        if (state != null) {
          this.executeScriptCalls("toggle", { state });
        }
      }

      // Call 'equip' script calls
      {
        const equipped = changed.system?.equipped;
        if (equipped != null) {
          this.executeScriptCalls("equip", { equipped });
        }
      }

      // Call 'changeQuantity' script calls
      const oldQuantity = this._memoryVariables?.quantity;
      if (oldQuantity !== undefined) {
        const quantity = {
          previous: oldQuantity,
          new: this.system.quantity,
        };
        if (quantity.new != null && quantity.new !== quantity.previous) {
          this.executeScriptCalls("changeQuantity", { quantity });
        }
      }

      // Call 'changeLevel' script calls
      const oldLevel = this._memoryVariables?.level;
      if (oldLevel !== undefined && changed.system?.level !== undefined) {
        const level = {
          previous: parseInt(oldLevel),
          new: parseInt(this.system.level),
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
      const memoryItemData = this._memoryVariables?.inventoryItems?.[a];
      if (!memoryItemData) continue;

      const diffData = diffObjectAndArray(memoryItemData, itemUpdateData, { keepLength: true });
      if (!foundry.utils.isEmpty(diffData)) {
        /** @type {Item} */
        const item = this.items.get(memoryItemData._id);
        if (item) item._onUpdate(diffData, context, userId);
        else {
          // BUG: Presumably item was deleted
          console.error(`Memorized item ${memoryItemData._id} not found from container`, this);
        }
      }
    }

    // Forget memory variables
    this._memoryVariables = null;
  }

  _updateMaxUses() {
    // No charges? No charges!
    if (!["day", "week", "charges"].includes(this.system.uses?.per)) return;

    const rollData = this.getRollData();

    if (this.system.uses) {
      const maxFormula = this.system.uses.maxFormula;
      if (!maxFormula) {
        this.system.uses.max = 0;
      } else {
        try {
          const isDeterministic = Roll.parse(maxFormula).every((t) => t.isDeterministic);
          if (isDeterministic) {
            const roll = RollPF.safeRoll(maxFormula, rollData, [this], { suppressError: !this.isOwner });
            this.system.uses.max = roll.total;
          } else {
            const msg = game.i18n.format("PF1.WarningNoDiceAllowedInFormula", {
              formula: maxFormula,
              context: game.i18n.localize("PF1.ChargePlural"),
            });
            ui.notifications.warn(msg, { console: false });
            console.warn(msg, this);
          }
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  /**
   * Determines the starting data for an ActiveEffect based off this item.
   */
  getRawEffectData() {
    return {
      name: this.name,
      icon: this.img,
      origin: this.getRelativeUUID(this.actor),
      duration: {},
      disabled: !this.isActive,
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
   * @param {object} [altChatData={}] - Optional data that will be merged into the chat data object.
   * @param {object} [options=[]] Additional options.
   * @param {TokenDocument} [options.token] Relevant token if any.
   * @returns {Promise<ChatMessage | void>} Chat message instance if one was created.
   */
  async displayCard(altChatData = {}, { token } = {}) {
    const actor = this.actor;
    if (actor && !actor.isOwner) {
      return void ui.notifications.warn(game.i18n.format("PF1.ErrorNoActorPermissionAlt", { name: actor.name }));
    }

    // Basic template rendering data
    token ??= actor?.token;
    const rollData = this.getRollData();
    const itemChatData = this.getChatData({ rollData });
    const identified = Boolean(rollData.item?.identified ?? true);

    const templateData = {
      actor: this.actor,
      token,
      tokenId: token?.uuid,
      item: this.toObject(),
      labels: this.getLabels({ rollData }),
      hasAttack: this.hasAttack,
      hasMultiAttack: this.hasMultiAttack,
      hasAction: this.hasAction,
      isVersatile: this.isVersatile,
      isSpell: this.type === "spell",
      name: this.getName(true),
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
        name: this._source.name,
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

    // Render the chat card template
    const templateType = ["consumable"].includes(this.type) ? this.type : "item";
    const template = `systems/pf1/templates/chat/${templateType}-card.hbs`;

    // Determine metadata
    pfFlags.metadata = {};
    pfFlags.metadata.item = this.id;

    // Basic chat message data
    const chatData = mergeObject(
      {
        user: game.user.id,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER,
        speaker: ChatMessage.implementation.getSpeaker({ actor, token, alias: token?.name }),
        flags: {
          core: {
            canPopout: true,
          },
          pf1: pfFlags,
        },
      },
      altChatData
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
   * @param {boolean} [options.chatcard=false] Is this actually for chat card.
   * @param {string} [options.actionId] - The ID of an action on this item to generate chat data for,
   *                                      defaults to {@link ItemPF.firstAction}
   * @returns {ChatData} The chat data for this item (+action)
   */
  getChatData(enrichOptions = {}, options = {}) {
    /** @type {ChatData} */
    const data = {};
    const { actionId = null } = options;
    const action = actionId ? this.actions.get(actionId) : this.firstAction;

    enrichOptions.rollData ??= action ? action.getRollData() : this.getRollData();

    const labels = this.getLabels({ actionId, rollData: enrichOptions.rollData });

    enrichOptions.secrets ??= this.isOwner;
    enrichOptions.async = false; // @TODO: Work on making this async, somehow

    enrichOptions.relativeTo = this.actor;

    const itemData = enrichOptions.rollData?.item ?? this.system;
    const actionData = enrichOptions.rollData?.action ?? action?.data ?? {};

    // Rich text descriptions
    const description = this.getDescription({ chatcard: options.chatcard });
    data.identifiedDescription = TextEditor.enrichHTML(description, enrichOptions);
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
        const range = action.getRange({ type: "max", rollData: enrichOptions.rollData }),
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
          dynamicLabels.duration = [duration, pf1.config.timePeriods[actionData.duration.units]].filterJoin(" ");
        }
      }

      // Ability activation properties
      if (labels.activation) {
        props.push(labels.target, labels.activation, dynamicLabels.range, dynamicLabels.duration);
      }

      // Enhancement Bonus
      const enhBonus = actionData.enh?.value ?? itemData.enh ?? 0;
      if (enhBonus > 0) {
        props.push(game.i18n.format("PF1.Enhancement", { bonus: enhBonus }));
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
   * Use an attack, using {@link SharedActionData}
   *
   * @see {@link SharedActionData}
   * @param {string} [actionId=""] - The ID of the action to use, defaults to the first action
   * @param {string} [actionID=""] - Deprecated in favor of `actionId`
   * @param {Event | null} [ev=null] - The event that triggered the use, if any
   * @param {boolean} [skipDialog=getSkipActionPrompt()] - Whether to skip the dialog for this action
   * @param {boolean} [chatMessage=true] - Whether to send a chat message for this action
   * @param {string} [dice="1d20"] - The base dice to roll for this action
   * @param {string} [rollMode] - The roll mode to use for the chat message
   * @param {TokenDocument} [token] Token this action is for, if any.
   * @returns {Promise<SharedActionData | void | ChatMessage | *>}
   */
  async use({
    actionId = "",
    actionID = "",
    ev = null,
    skipDialog = getSkipActionPrompt(),
    chatMessage = true,
    dice = "1d20",
    rollMode,
    token,
  } = {}) {
    rollMode ||= game.settings.get("core", "rollMode");

    if (actionID) {
      foundry.utils.logCompatibilityWarning("ItemPF.use() actionID parameter is deprecated in favor of actionId", {
        since: "PF1 vNEXT",
        until: "PF1 vNEXT+1",
      });

      actionId ||= actionID;
    }

    // Old use method
    if (!this.hasAction) {
      // Use
      const shared = await this.executeScriptCalls("use", {
        attackData: { event: ev, skipDialog, chatMessage, rollMode },
      });
      rollMode = shared.rollMode || rollMode;
      if (shared.reject) return shared;
      if (shared.hideChat !== true && chatMessage) {
        shared.descriptionOnly = true;
        await this.displayCard({ rollMode });
      }

      // Deduct charges
      if (this.isCharged) {
        const chargeCost = this.getDefaultChargeCost();
        if (this.charges < chargeCost) {
          if (this.isSingleUse) {
            return void ui.notifications.warn(game.i18n.localize("PF1.ErrorNoQuantity"));
          }
          return void ui.notifications.warn(game.i18n.format("PF1.ErrorInsufficientCharges", { name: this.name }));
        }

        await this.addCharges(-chargeCost);
      }

      return shared;
    }

    if (ev && ev.originalEvent) ev = ev.originalEvent;

    /** @type {ItemAction | undefined} */
    let action;
    if (this.system.actions.length > 0) {
      if (actionId) {
        action = this.actions.get(actionId);
      } else if (this.system.actions.length > 1 && skipDialog !== true) {
        const selector = new pf1.applications.ActionChooser(this);
        selector.useOptions = { ev, chatMessage, dice, rollMode, token };
        selector.render(true, { focus: true });
        return;
      } else {
        action = this.firstAction;
      }
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
      rollMode,
      useMeasureTemplate: action.hasTemplate && game.settings.get("pf1", "placeMeasureTemplateOnQuickRolls"),
      conditionals: null,
      conditionalPartsCommon: {},
      casterLevelCheck: false,
      concentrationCheck: false,
      scriptData: {},
    };

    // Prevent reassigning the ActionUse's item, action, and token
    Object.defineProperties(shared, {
      action: { value: action, writable: false, enumerable: true },
      item: { value: this, writable: false, enumerable: true },
      token: { value: token, writable: false, enumerable: true },
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

    // Call itemUse hook and determine whether the item can be used based off that
    if (Hooks.call("pf1PreActionUse", actionUse) === false) {
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

    actionUse.updateAmmoUsage();

    if (shared.rollData.chargeCost < 0 || shared.rollData.chargeCost > 0)
      await this.addCharges(-shared.rollData.chargeCost);
    if (shared.action.isSelfCharged)
      await shared.action.update({ "uses.self.value": shared.action.data.uses.self.value - 1 });

    // Retrieve message data
    actionUse.getMessageData();

    // Post message
    let result;
    if (shared.scriptData?.hideChat !== true) {
      result = await actionUse.postMessage();
    }

    // Deselect targets
    if (game.settings.get("pf1", "clearTargetsAfterAttack") && game.user.targets.size) {
      game.user.updateTokenTargets([]);
      // Above does not communicate targets to other users, so..
      game.user.broadcastActivity({ targets: [] });
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
    if (!this.actor) return [];
    let result = this.actor.changes;

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
    const actor = this.actor;
    const result = actor?.getRollData() ?? {};

    result.item = deepClone(this.system);

    // Add dictionary flag
    if (this.system.tag) {
      result.item.dFlags = getProperty(result, `dFlags.${this.system.tag}`);
    }

    // Set aura strength
    setProperty(result, "item.auraStrength", this.auraStrength);

    // Resize item
    if (this.system.resizing && result.size !== undefined) {
      result.item.size = result.size;
    }

    this._rollData = result.item;

    if (Hooks.events["pf1GetRollData"]?.length > 0) Hooks.callAll("pf1GetRollData", this, result);

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
    // Apply damage
    if (action === "applyDamage") {
      let asNonlethal = [...(button.closest(".chat-message")?.querySelectorAll(".tag") ?? [])]
        .map((o) => o.innerText)
        .includes(game.i18n.localize("PF1.Nonlethal"));
      if (button.dataset.tags?.split(" ").includes("nonlethal")) asNonlethal = true;

      const value = button.dataset.value;
      if (!isNaN(parseInt(value))) pf1.documents.actor.ActorPF.applyDamage(parseInt(value), { asNonlethal });
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
      if (ammoItem.getFlag("pf1", "abundant")) return; // Abundant is unrecoverable
      let chance = 100;
      if (action === "recoverAmmo") {
        chance = ammoItem.system.recoverChance ?? 50;
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
      item.actor.rollConcentration(item.system.spellbook);
    } else if (action === "caster-level-check") {
      item.actor.rollCL(item.system.spellbook);
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
   * @param {string} linkType - The type of link.
   * @param {string} dataType - Either "compendium", "data" or "world".
   * @param {object} targetItem - The target item to link to.
   * @param {string} itemLink - The link identifier for the item.
   * @returns {boolean} Whether a link to the item is possible here.
   */
  canCreateItemLink(linkType, dataType, targetItem, itemLink) {
    const actor = this.actor;
    const sameActor = actor && targetItem.actor && targetItem.actor.id === actor.id;

    // Don't create link to self
    if (itemLink === this.id) return false;

    // Don't re-create existing links
    const links = this.system.links?.[linkType] || [];
    if (links.some((o) => o.id === itemLink || o.uuid === itemLink)) return false;

    const targetLinks = targetItem.system.links?.[linkType] ?? [];
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
      name: targetItem.name,
    };

    if (dataType === "data") result.id = itemLink;
    else result.uuid = itemLink;

    if (linkType === "classAssociations") {
      result.level = 1;
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
   * e.g. UUID for items external to the actor, and item ID for same actor items.
   * @returns {boolean} Whether a link was created.
   */
  async createItemLink(linkType, dataType, targetItem, itemLink) {
    if (this.canCreateItemLink(linkType, dataType, targetItem, itemLink)) {
      const link = this.generateInitialLinkData(linkType, dataType, targetItem, itemLink);
      const itemData = this.toObject();
      const links = itemData.system.links?.[linkType] ?? [];
      links.push(link);
      const itemUpdates = [{ _id: this.id, [`system.links.${linkType}`]: links }];

      // Clear value, maxFormula and per from link target to avoid odd behaviour
      if (linkType === "charges") {
        itemUpdates.push({ _id: itemLink, system: { uses: { "-=value": null, "-=maxFormula": null, "-=per": null } } });
      }

      await this.actor.updateEmbeddedDocuments("Item", itemUpdates);

      // Call link creation hook
      Hooks.callAll("pf1CreateItemLink", this, link, linkType);

      return true;
    } else if (linkType === "children" && dataType !== "data") {
      const itemData = targetItem.toObject();
      delete itemData._id;

      // Default to spell-like tab until a selector is designed in the Links tab or elsewhere
      if (itemData.type === "spell") itemData.system.spellbook = "spelllike";

      const newItem = await this.actor.createEmbeddedDocuments("Item", [itemData]);

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

  /**
   * Retrieve list of linked items for a type, synchronously.
   * Intended mainly for fetching child or charge links quickly.
   *
   * @example
   * const childItems = item.getLinkedItemsSync("children");
   * @param {string} type Link type, e.g. "children", "charges", or "classAssociations"
   * @returns {Item[]|object[]} Linked items or their compendium index data
   */
  getLinkedItemsSync(type) {
    const links = this.system.links?.[type];
    if (!links) return [];

    const result = [];
    for (const linkData of links) {
      const item = this.getLinkedItemSync(linkData);
      if (item) result.push(item);
    }

    return result;
  }

  async getAllLinkedItems() {
    const result = [];

    for (const items of Object.values(this.system.links ?? {})) {
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
    for (const [type, linkItems] of Object.entries(this.system.links ?? {})) {
      const items = deepClone(linkItems);
      const idx = items.findIndex((item) => item.id === id || item.uuid === id);
      if (idx >= 0) {
        items.splice(idx, 1);
        updateData[`system.links.${type}`] = items;
      }
    }

    if (!foundry.utils.isEmpty(updateData)) {
      return this.update(updateData);
    }
  }

  async getLinkItem(linkData, extraData = false) {
    let item;

    // Compendium entry
    if (linkData.uuid) {
      item = await fromUuid(linkData.uuid);
    }
    // Same actor's item
    else {
      item = this.actor?.items?.get(linkData.id);
    }

    // Package extra data
    if (extraData) {
      item = { item, linkData };
    }

    return item;
  }

  /**
   * Retrieve item referred to by a link in .system.links data
   *
   * @example
   * const items = (item.system.links?.children ?? [])
   *   .map(link => item.getLinkedItemSync(link));
   * @param {object} linkData Link data
   * @returns {Item|object|undefined} Linked item, undefined, or compendium index data
   */
  getLinkedItemSync(linkData = {}) {
    const { id, uuid } = linkData;
    const actor = this.actor;
    if (uuid) return fromUuidSync(uuid, actor);
    else return actor?.items.get(id);
  }

  /**
   * Generates lists of change subtargets this item can have.
   *
   * @param {string} target - The target key, as defined in PF1.buffTargets.
   * @returns {Object<string, string>} A list of changes
   */
  getChangeSubTargets(target) {
    const result = {};
    // Add specific skills
    if (target === "skill") {
      if (!this.actor) {
        for (const [s, skl] of Object.entries(pf1.config.skills)) {
          result[`skill.${s}`] = skl;
        }
      } else {
        const actorSkills = mergeObject(duplicate(pf1.config.skills), this.actor.system.skills);
        for (const [s, skl] of Object.entries(actorSkills)) {
          if (!skl.subSkills) {
            if (skl.custom) result[`skill.${s}`] = skl.name;
            else result[`skill.${s}`] = pf1.config.skills[s];
          } else {
            for (const [s2, skl2] of Object.entries(skl.subSkills)) {
              result[`skill.${s}.subSkills.${s2}`] = `${pf1.config.skills[s]} (${skl2.name})`;
            }
          }
        }
      }
    }
    // Add static subtargets
    else if (hasProperty(pf1.config.buffTargets, target)) {
      for (const [k, v] of Object.entries(pf1.config.buffTargets[target])) {
        if (!k.startsWith("_") && !k.startsWith("~")) result[k] = v;
      }
    }

    return result;
  }

  async addChange() {
    const change = new ItemChange({}, this);
    return change;
  }

  getTotalCurrency() {
    foundry.utils.logCompatibilityWarning("ItemPF.getTotalCurrency is deprecated", {
      since: "PF1 v9",
      until: "PF1 v10",
    });

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
   * @param {boolean} [options.single=false] - Return value of singular item instead of the actual stack. Disables recursive option.
   * @returns {number} The item's value
   */
  getValue({
    recursive = true,
    sellValue = 0.5,
    inLowestDenomination = false,
    forceUnidentified = false,
    single = false,
  } = {}) {
    if (single) recursive = false;

    const getActualValue = (identified = true) => {
      let value = 0;
      if (identified) value = this.system.price;
      else value = this.system.unidentified.price;

      // Add charge price
      if (identified) value += (this.system.uses?.pricePerUse ?? 0) * (this.system.uses?.value ?? 0);

      if (inLowestDenomination) value *= 100;
      if (this.system.broken) value *= 0.75; // TODO: Make broken value configurable
      if (this.system.timeworn) {
        if (this.hasFiniteCharges && this.charges === 0) value *= 0.01;
        else value *= 0.5;
      }
      return value;
    };

    const quantity = single ? 1 : this.system.quantity || 0;

    let result = getActualValue(forceUnidentified ? false : !this.showUnidentifiedData) * quantity;

    // Modify sell value
    if (!(this.type === "loot" && this.system.subType === "tradeGoods")) result *= sellValue;

    return result;
  }

  convertCurrency(type = "pp") {
    foundry.utils.logCompatibilityWarning("ItemPF.convertCurrency is deprecated", {
      since: "PF1 v9",
      until: "PF1 v10",
    });

    return 0;
  }

  /**
   * Sets a boolean flag on this item.
   *
   * @param {string} flagName - The name/key of the flag to set.
   * @param {object} context Update context
   * @returns {Promise<boolean>} Whether something was changed.
   */
  async addItemBooleanFlag(flagName, context = {}) {
    flagName = String(flagName)
      .replace(/[^\w_-]/g, "-")
      .replace(/^-+/, "_");
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
    const flags = this.system.flags?.boolean ?? {};

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
    const flags = this.system.flags?.boolean ?? {};
    return flags[flagName] === true;
  }

  /**
   * Get all item boolean flags as array.
   *
   * @returns {string[]}
   */
  getItemBooleanFlags() {
    const flags = this.system.flags?.boolean ?? {};
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
    flagName = String(flagName)
      .replace(/[^\w_-]/g, "-")
      .replace(/^-+/, "_");
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
    const flags = this.system.flags?.dictionary ?? {};

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
    const flags = this.system.flags?.dictionary || {};
    return flags[flagName];
  }

  /**
   * Get all item dictionary flags as array of objects.
   *
   * @returns {object[]}
   */
  getItemDictionaryFlags() {
    const flags = this.system.flags?.dictionary || {};
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
   * @param {string} actionId Action ID
   * @returns {object[]|undefined} Array of value and label pairs for attack bonus sources on the main attack, or undefined if the action is missing.
   */
  getAttackSources(actionId) {
    const action = this.actions.get(actionId);
    if (!action) return;

    const sources = [];

    const actorData = this.actor?.system,
      itemData = this.system,
      actionData = action.data;

    if (!actorData || !actionData) return sources;
    const rollData = action.getRollData();

    // Attack type identification
    const isMelee =
      ["mwak", "msak", "mcman"].includes(actionData.actionType) || ["melee", "reach"].includes(actionData.range.units);
    const isRanged =
      ["rwak", "rsak", "rcman"].includes(actionData.actionType) || this.system.weaponSubtype === "ranged";
    const isManeuver = action.isCombatManeuver;

    const describePart = (value, name, modifier, sort = 0) => {
      sources.push({ value, name, modifier, sort });
    };

    // BAB is last for some reason, array is reversed to try make it the first.
    const srcDetails = (s) => s?.reverse().forEach((d) => describePart(d.value, d.name, d.modifier, -10));

    // Unreliable melee/ranged identification
    const sizeBonus = !isManeuver
      ? pf1.config.sizeMods[rollData.traits.size]
      : pf1.config.sizeSpecialMods[rollData.traits.size];

    // Add size bonus
    if (sizeBonus != 0) describePart(sizeBonus, game.i18n.localize("PF1.Size"), "size", -20);

    srcDetails(this.actor.sourceDetails["system.attributes.attack.shared"]);
    if (isManeuver) srcDetails(this.actor.sourceDetails["system.attributes.cmb.bonus"]);
    srcDetails(this.actor.sourceDetails["system.attributes.attack.general"]);

    const changeSources = [];
    if (isRanged) changeSources.push("rattack");
    if (isMelee) changeSources.push("mattack");
    const effectiveChanges = getHighestChanges(
      this.actor.changes.filter((c) => changeSources.includes(c.subTarget)),
      { ignoreTarget: true }
    );
    effectiveChanges.forEach((ic) => describePart(ic.value, ic.flavor, ic.modifier, -800));

    if (actionData.ability.attack) {
      const ablMod = actorData.abilities?.[actionData.ability.attack]?.mod ?? 0;
      describePart(ablMod, pf1.config.abilities[actionData.ability.attack], "untyped", -50);
    }

    // Attack bonus formula
    const bonusRoll = RollPF.safeRoll(actionData.attackBonus || "0", rollData);
    if (bonusRoll.total != 0)
      describePart(bonusRoll.total, bonusRoll.flavor ?? game.i18n.localize("PF1.AttackRollBonus"), "untyped", -100);

    // Masterwork or enhancement bonus
    // Only add them if there's no larger enhancement bonus from some other source
    const virtualEnh = action.enhancementBonus ?? (itemData.masterwork ? 1 : 0);
    if (!effectiveChanges.find((i) => i.modifier === "enh" && i.value > virtualEnh)) {
      if (Number.isFinite(action.enhancementBonus) && action.enhancementBonus !== 0) {
        describePart(action.enhancementBonus, game.i18n.localize("PF1.EnhancementBonus"), "enh", -300);
      } else if (itemData.masterwork) {
        describePart(1, game.i18n.localize("PF1.Masterwork"), "enh", -300);
      }
    }

    // Add proficiency penalty
    try {
      if (!this.getProficiency(true)) {
        describePart(-4, game.i18n.localize("PF1.ProficiencyPenalty"), "penalty", -500);
      }
    } catch (error) {
      // Ignore proficiency incompatibility.
    }

    // Broken condition
    if (itemData.broken) {
      describePart(-2, game.i18n.localize("PF1.Broken"), "penalty", -500);
    }

    // Add secondary natural attack penalty
    if (actionData.naturalAttack.primaryAttack !== true && itemData.subType === "natural") {
      const attackBonus = actionData.naturalAttack?.secondary?.attackBonus || "-5";
      const secondaryModifier = RollPF.safeTotal(`${attackBonus}`, rollData);
      describePart(secondaryModifier, game.i18n.localize("PF1.SecondaryAttack"), "untyped", -400);
    }

    // Conditional modifiers
    actionData.conditionals
      .filter((c) => c.default && c.modifiers.find((sc) => sc.target === "attack"))
      .forEach((c) => {
        c.modifiers.forEach((cc) => {
          if (cc.subTarget === "allAttack") {
            const bonusRoll = RollPF.safeRoll(cc.formula, rollData);
            if (bonusRoll.total == 0) return;
            describePart(bonusRoll.total, c.name, cc.type, -5000);
          }
        });
      });

    return sources.sort((a, b) => b.sort - a.sort);
  }

  /**
   * Return attack sources for default action.
   *
   * @returns {object[]|undefined} Array of value and label pairs for attack bonus sources on the main attack.
   */
  get attackSources() {
    return this.getAttackSources(this.firstAction.id);
  }

  getAllDamageSources(actionId) {
    return this.actions.get(actionId)?.allDamageSources;
  }

  /**
   * Generic damage source retrieval for default action, includes default conditionals and other item specific modifiers.
   *
   * @returns {ItemChange[]|undefined} All relevant changes, or undefined if action was not found.
   */
  get allDamageSources() {
    return this.getAllDamageSources(this.firstAction.id);
  }

  /**
   * Set item's active state.
   *
   * @abstract
   * @param {boolean} active Active state
   * @param {object} context Optional update context
   * @returns {Promise<this>} Update promise if item type supports the operation.
   * @throws Error if item does not support the operation.
   */
  setActive(active, context) {
    throw new Error(`Item type ${this.type} does not support ItemPF#setActive`);
  }

  /** @type {boolean} - Is this item in a container? */
  get inContainer() {
    return !!this.parentItem;
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
