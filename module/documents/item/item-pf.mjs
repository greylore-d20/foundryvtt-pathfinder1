import { ItemBasePF } from "./item-base.mjs";
import { createTag, convertDistance, keepUpdateArray } from "../../utils/lib.mjs";
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

    /**
     * An object containing links to other items.
     *
     * @type {Record<string, ItemPF>}
     */
    this.links ??= {};

    if (Array.isArray(this.system.actions)) {
      /**
       * A {@link Collection} of {@link ItemAction}s.
       *
       * @type {Collection<ItemAction>}
       */
      this.actions ??= new Collection();
    }
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
    /**
     * Whether this item receives an identifier.
     */
    hasIdentifier: true,
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

      let ids = new Set();
      while (ids.size < changes.length) ids.add(foundry.utils.randomID(8));
      ids = Array.from(ids);
      for (const c of changes) c._id = ids.pop();
      this.updateSource({ "system.changes": changes });
    }

    const updates = this.preCreateData(data, context, user);

    if (Object.keys(updates).length) this.updateSource(updates);
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
   * @param {object} data - Creation data
   * @param {object} context - Creation context options
   * @param {string} userId - Triggering user ID
   */
  _onCreate(data, context, userId) {
    super._onCreate(data, context, userId);

    const actor = this.actor;
    if (userId !== game.user.id) return;

    if (this.isActive) {
      // Simulate toggling a feature or buff on
      if (["buff", "feat"].includes(this.type)) {
        this.executeScriptCalls("toggle", { state: true });
      }
    }
  }

  /**
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    // No system data changes
    if (!changed.system) return;

    this._preUpdateNumericValueGuard(changed.system);

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
      keepUpdateArray(this, changed, path);
    }

    await this._chargePreUpdate(changed, context);
  }

  // Fake DataModel-like behaviour
  // Ensure numeric bits remain numbers
  _preUpdateNumericValueGuard(system) {
    // Nothing to do here
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
   * @override
   * @param {object} context - Delete context options
   * @param {string} userId - Triggering user
   */
  _onDelete(context, userId) {
    super._onDelete(context, userId);

    const actor = this.actor;
    if (!actor) return;

    // Remove special charge sharing links that don't clear on their own
    const links = this.getLinkedItemsSync("charges");
    if (links.length) {
      for (const link of links) {
        if (link.links?.charges) {
          delete link.links.charges;
          link.reset();
        }
      }
    }
  }

  /**
   * @returns {string[]} The keys of data variables to memorize between updates, for e.g. determining the difference in update.
   */
  get memoryVariables() {
    return ["quantity", "level"];
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

  /**
   * The item's material, or `null` if the item has no subtype
   *
   * @type {string|null}
   */
  get normalMaterial() {
    return this.system.material?.normal.value || null;
  }

  /**
   * The item's material addons, or `null` if the item has no subtype
   *
   * @type {string[]|null}
   */
  get addonMaterial() {
    return this.system.material?.addon.filter((o) => o ?? false) || null;
  }

  /**
   * The item's alignment attributes, or `null` if the item has no alignment attributes
   *
   * @type {string|null}
   */
  get alignments() {
    return this.system.alignments ?? null;
  }

  /** @type {pf1.components.ItemAction|undefined} */
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

  /**
   * @abstract
   * @type {boolean} - Is proficient using this as weapon.
   */
  get isProficient() {
    return true;
  }

  get isOwned() {
    return super.isOwned || this.parentItem != null;
  }

  get hasAction() {
    return this.system.actions?.length > 0;
  }

  get isSingleUse() {
    return this.system.uses?.per === "single";
  }

  get isCharged() {
    return this.isSingleUse || ["round", "day", "week", "charges"].includes(this.system.uses?.per);
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
   * @param {"round"|"day"|"week"|"any"} [options.period="day"] Recharge period. Use "any" to ignore item's configuration.
   * @param {boolean} [options.exact=false] Use exact time period. Otherwise "week" for example will also recharge items with "day" period.
   * @param {number} [options.value] Recharge to specific value, respecting maximum and minimum bounds.
   * @param {boolean} [options.maximize=false] Recharge to full regardless of recharge formula.
   * @param {boolean} [options.commit=true] Commit update directly. If false, returns the update data instead.
   * @param {object} [options.rollData] Roll data instance to use for formulas.
   * @param {object} [options.context] Update context
   * @returns {Promise<this|object|undefined>} Promise for the update, update data object, or undefined (no update needed).
   */
  async recharge({ value, period = "day", exact = false, maximize = false, commit = true, rollData, context } = {}) {
    const uses = this.system.uses ?? {};
    if (!uses.per) return; // Unlimited uses, recharging meaningless

    // Cancel if charges are managed by different item.
    if (this.links.charges) return;

    // No update when period does not match usage
    if (["charges", "single"].includes(uses.per)) {
      // Ignore, no constraints
    } else if (pf1.config.limitedUsePeriodOrder.includes(period) && !exact) {
      // Recharge lesser time periods when using inexact matching
      const idx = pf1.config.limitedUsePeriodOrder.indexOf(period);
      const validPeriods = pf1.config.limitedUsePeriodOrder.slice(0, idx + 1);
      if (!validPeriods.includes(uses.per)) return;
    }
    // Otherwise test if "any" period is used
    else if (uses.per !== period && period !== "any") return;

    const staticValue = value !== undefined;

    // No specific value given
    if (!staticValue) {
      const formula = uses.rechargeFormula || "";
      // Default to maximizing value
      if (!formula) maximize = true;
      else {
        rollData ??= this.getRollData();
        const roll = RollPF.safeRoll(formula, rollData, "recharge");
        value = roll.total;

        // Cancel if formula produced invalid value
        if (!Number.isFinite(value))
          return void console.warn(`Formula "${formula}" produced non-numeric value "${value}"`);
      }
    }

    // Maximize value regardless what value is
    if (maximize) value = uses.max;

    // Clamp charge value to
    value = Math.clamped(value, 0, uses.max);

    // Cancel pointless update
    if (value === uses.value) return;

    const updateData = { system: { uses: { value } } };

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
    if (this.isSingleUse && this.isPhysical) {
      return this.update({ "system.quantity": (this.system.quantity ?? 0) + value });
    } else {
      return this.update({ "system.uses.value": (this.system.uses?.value ?? 0) + value });
    }
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
    return false;
  }

  /* -------------------------------------------- */
  /*	Data Preparation														*/
  /* -------------------------------------------- */

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
      const oldActions = this.actions ?? [];
      /** @type {Map<string,pf1.components.ItemAction>} */
      this.actions = this._prepareActions(itemData.actions);

      for (const action of oldActions) {
        if (this.actions.get(action.id) !== action) {
          Object.values(action.apps).forEach((app) =>
            app.close({ pf1: { action: "delete" }, submit: false, force: true })
          );
        }
      }
    }

    // Update script calls
    if (itemData.scriptCalls instanceof Array) {
      this.scriptCalls = this._prepareScriptCalls(itemData.scriptCalls);
    }

    if (!this.actor) {
      this.prepareDerivedItemData();
    }
  }

  prepareBaseData() {
    super.prepareBaseData();
    this._prepareIdentifier();

    if (this.inContainer) this.adjustContained();
  }

  /**
   * Initialize identifier
   */
  _prepareIdentifier() {
    const isTaggedType = this.constructor.system?.hasIdentifier ?? false;
    if (isTaggedType) {
      if (!this.system.tag) {
        this.system.tag = createTag(this.name);
      }
    }
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
        change.data = foundry.utils.mergeObject(ItemChange.defaultData, c);
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
        action.data = foundry.utils.mergeObject(ItemAction.defaultData, o);
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

    data = foundry.utils.expandObject(data);

    this.memorizeVariables();

    const parentItem = this.parentItem;
    if (!parentItem) {
      return super.update(data, context);
    } else {
      // Update parent item
      context.pf1 ??= {};
      context.pf1.containerItem = this.id;
      await parentItem.update({ system: { items: { [this.id]: data } } }, context);
      return this;
    }
  }

  memorizeVariables() {
    if (this._memoryVariables != null) return;

    const memKeys = this.memoryVariables;
    this._memoryVariables = {};
    for (const k of memKeys) {
      if (foundry.utils.hasProperty(this.system, k)) {
        this._memoryVariables[k] = foundry.utils.deepClone(foundry.utils.getProperty(this.system, k));
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
          const startTime = this.effect?.duration.startTime ?? game.time.worldTime;
          this.executeScriptCalls("toggle", { state, startTime });
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

    // Forget memory variables
    this._memoryVariables = null;
  }

  _updateMaxUses() {
    const per = this.system.uses?.per;

    // No charges? No charges!
    if (!per) return;

    const maxFormula = this.system.uses.maxFormula;
    if (per === "single") {
      this.system.uses.max = 1;
    } else if (!maxFormula) {
      this.system.uses.max = 0;
    } else {
      try {
        const isDeterministic = Roll.parse(maxFormula).every((t) => t.isDeterministic);
        if (isDeterministic) {
          const rollData = this.getRollData();
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
    const itemChatData = await this.getChatData({ rollData });
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
      rollData,
      hasExtraProperties: false,
      extraProperties: [],
    };

    const pfFlags = {};

    const enrichOptions = {
      rollData,
      secrets: this.isOwner,
      async: true,
      relativeTo: this.actor,
    };

    // If the item is unidentified, store data for GM info box containing identified info
    if (identified === false) {
      pfFlags.identifiedInfo = {
        identified,
        name: this._source.name,
        description: await TextEditor.enrichHTML(itemChatData.identifiedDescription, enrichOptions),
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
    const chatData = foundry.utils.mergeObject(
      {
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
    const content = await renderTemplate(template, templateData);
    chatData.content = await TextEditor.enrichHTML(content, enrichOptions);

    // Apply roll mode
    chatData.rollMode ??= game.settings.get("core", "rollMode");
    ChatMessage.implementation.applyRollMode(chatData, chatData.rollMode);

    return ChatMessage.implementation.create(chatData);
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
  async getChatData({ chatcard = false, actionId = null, rollData = {} } = {}) {
    /** @type {ChatData} */
    const data = {};
    const action = actionId ? this.actions.get(actionId) : this.firstAction;

    rollData ??= action ? action.getRollData() : this.getRollData();
    const itemData = rollData.item ?? this.system;
    const actionData = rollData.action ?? action?.data ?? {};

    const labels = this.getLabels({ actionId, rollData });

    // Rich text descriptions
    data.identifiedDescription = this.getDescription({ chatcard });

    data.unidentifiedDescription = itemData.description.unidentified;
    data.description = this.showUnidentifiedData ? data.unidentifiedDescription : data.identifiedDescription;
    data.actionDescription = actionData.description;

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
        const range = action.getRange({ type: "max", rollData }),
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
        if (!["inst", "perm"].includes(actionData.duration.units)) {
          const duration = RollPF.safeRoll(actionData.duration.value || "0", rollData).total;
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
    this.getTypeChatData(data, labels, props, rollData);

    const harmless = actionData.save?.harmless;
    if (harmless) props.push(game.i18n.localize("PF1.Harmless"));

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
   * @param {number} [cost=null] - Cost override. Replaces charge cost or slot cost as appropriate.
   * @param {Event | null} [ev=null] - The event that triggered the use, if any
   * @param {boolean} [skipDialog=getSkipActionPrompt()] - Whether to skip the dialog for this action
   * @param {boolean} [chatMessage=true] - Whether to send a chat message for this action
   * @param {string} [dice="1d20"] - The base dice to roll for this action
   * @param {string} [rollMode] - The roll mode to use for the chat message
   * @param {TokenDocument} [token] Token this action is for, if any.
   * @throws {Error} - On some invalid inputs.
   * @returns {Promise<SharedActionData | void | ChatMessage>}
   */
  async use({
    actionId = "",
    actionID = "",
    cost = null,
    ev = null,
    skipDialog = getSkipActionPrompt(),
    chatMessage = true,
    dice = "1d20",
    rollMode,
    token,
  } = {}) {
    rollMode ||= game.settings.get("core", "rollMode");

    if (cost !== null && !Number.isSafeInteger(cost)) throw new Error(`Invalid value for cost override: ${cost}`);

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

      // Deduct charges
      if (this.isCharged) {
        const chargeCost = cost ?? this.getDefaultChargeCost();
        if (this.charges < chargeCost) {
          if (this.isSingleUse) {
            return void ui.notifications.warn(game.i18n.localize("PF1.ErrorNoQuantity"));
          }
          return void ui.notifications.warn(game.i18n.format("PF1.ErrorInsufficientCharges", { name: this.name }));
        }

        await this.addCharges(-chargeCost);
      }

      if (shared.hideChat !== true && chatMessage) {
        shared.descriptionOnly = true;
        shared.chatCard = await this.displayCard({ rollMode });
      }

      return shared;
    }

    if (ev && ev.originalEvent) ev = ev.originalEvent;

    /** @type {ItemAction | undefined} */
    let action;
    if (this.system.actions.length > 0) {
      if (actionId) {
        action = this.actions.get(actionId);
        if (!action) throw new Error(`Could not find action by ID "${actionId}"`);
      } else if (this.system.actions.length > 1 && skipDialog !== true) {
        return pf1.applications.ActionChooser.open(this, { ev, chatMessage, dice, rollMode, token });
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
      cost,
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

    return actionUse.process({ skipDialog });
  }

  /**
   * Finds, filters and alters changes relevant to a context, and returns the result (as an array)
   *
   * @remarks - Always returns empty array if no actor is present.
   * @param {"mattack"|"rattack"|"nattack"|"tattack"|"wdamage"|"sdamage"|"rwdamage"|"twdamage"|"mwdamage"|"ndamage"|"rdamage"|"tdamage"|"mdamage"} context - The given context.
   * @returns {ItemChange[]} - The matching changes.
   */
  getContextChanges(context = ["attack"]) {
    if (!this.actor) return [];
    const subTargets = this.getContextStack(context);
    return this.actor.changes.filter((c) => subTargets.has(c.subTarget));
  }

  /**
   * Retrieve stack of contexts related to the one given.
   *
   * @private
   * @param {Array<string>} contexts Context subtarget ID array.
   * @returns {Set<string>} - Modified context array.
   */
  getContextStack(contexts) {
    const result = new Set(contexts);
    for (const context of contexts) {
      switch (context) {
        case "mattack":
        case "rattack":
        case "nattack":
        case "tattack":
          result.add("attack");
          break;
        case "wdamage":
        case "sdamage":
          result.add("damage");
          break;
        case "mwdamage":
        case "rwdamage":
        case "twdamage":
          result.add("damage");
          result.add("wdamage");
          break;
      }
    }

    // Add generic ranged damage for ranged weapon damage and thrown weapon damage
    if (result.has("rwdamage") || result.has("twdamage")) {
      result.add("rdamage");
    }

    return result;
  }

  /* -------------------------------------------- */

  /**
   * @returns {object} An object with data to be used in rolls in relation to this item.
   */
  getRollData() {
    const actor = this.actor;
    const result = { ...(actor?.getRollData() ?? {}) };

    result.item = foundry.utils.deepClone(this.system);

    // Add @class
    const classTag = result.item.class;
    if (classTag) result.class = result.classes[classTag];

    // Add dictionary flag
    if (this.system.tag) {
      result.item.dFlags = foundry.utils.getProperty(result, `dFlags.${this.system.tag}`);
    }

    // Set aura strength
    foundry.utils.setProperty(result, "item.auraStrength", this.auraStrength);

    // Resize item
    if (this.system.resizing && result.size !== undefined) {
      result.item.size = result.size;
    }

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
    // BUG: "save" is never actually used?
    const isTargetted = ["save", "applyDamage"].includes(action);
    if (!(isTargetted || game.user.isGM || message.isAuthor)) return;

    if (action === "applyDamage") {
      await this._onChatCardAction(action, { button });
      button.disabled = false;
      return;
    }

    // TODO: Clarify the following. Only used for ammo recovery?

    // Get the Item
    const actor = ChatMessage.getSpeakerActor(message.speaker);
    const item = actor.items.get(card.dataset.itemId);

    // Perform action
    if (!(await this._onChatCardAction(action, { button, item }))) {
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
    ui.windows[popout?.dataset.appid]?.setPosition();
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

    // Link happens between items on same actor?
    const linkOnActor = ["children", "charges", "ammunition"].includes(linkType);
    if (linkOnActor && !actor) return false;

    // Don't create link to self
    if (itemLink === this.id) return false;

    // Don't re-create existing links
    const links = this.system.links?.[linkType] || [];
    if (links.some((o) => o.id === itemLink || o.uuid === itemLink)) return false;

    const targetLinks = targetItem.system.links?.[linkType] ?? [];
    if (linkOnActor && sameActor) {
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

    // Allow class association links only from compendiums
    if (linkType === "classAssociations" && dataType === "compendium") return true;
    if (linkType === "supplements") {
      // Allow supplement links only if not from an actor
      if (!targetItem.actor) return true;
      else ui.notifications.error(game.i18n.localize("PF1.LinkErrorNoActorSource"));
    }

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

    result.uuid = itemLink;

    if (linkType === "classAssociations") {
      result.level = 1;
    }

    // Remove name for various links
    switch (linkType) {
      case "classAssociations":
      case "supplements":
        // System packs are assumed static
        if (game.packs.get(targetItem.pack)?.metadata.packageType === "system") {
          delete result.name;
        }
        break;
      case "charges":
      case "children":
        // Actor local links
        delete result.name;
        break;
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
      const itemUpdate = { _id: this.id, [`system.links.${linkType}`]: links };
      const itemUpdates = [];

      // Clear value, maxFormula and per from link target to avoid odd behaviour
      if (linkType === "charges") {
        itemUpdates.push({
          _id: targetItem.id,
          system: { uses: { "-=value": null, "-=maxFormula": null, "-=per": null } },
        });
      }

      if (this.actor && itemUpdates.length > 0) {
        await this.actor.updateEmbeddedDocuments("Item", [itemUpdate, ...itemUpdates]);
      } else {
        await this.update(itemUpdate);
      }

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

  /**
   * Get item links of type
   *
   * @param {string} type - Link type
   * @param {boolean} includeLinkData - Include link data, return value changes from item array to object array
   * @returns {Item[]|object[]} - Linked items, or objects with linked items and additional data
   */
  async getLinkedItems(type, includeLinkData = false) {
    const items = this.system.links?.[type];
    if (!items) return [];

    const result = [];
    for (const l of items) {
      const item = await this.getLinkItem(l);
      if (item) {
        if (includeLinkData) result.push({ item, linkData: l });
        else result.push(item);
      }
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

  /**
   * Get all items linked by any means.
   *
   * @returns {Item[]}
   */
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
   * @param {object} [options={}] - Additional options
   * @param {boolean} [options.commit=true] - Commit changes to database. If false, resulting update data is returned instead.
   * @returns {Promise<Item|object|undefined>}
   */
  async removeItemLink(id, { commit = true } = {}) {
    const updateData = {};
    for (const [type, linkItems] of Object.entries(this.system.links ?? {})) {
      const items = foundry.utils.deepClone(linkItems);
      const idx = items.findIndex((item) => item.id === id || item.uuid === id);
      if (idx >= 0) {
        items.splice(idx, 1);
        updateData[`system.links.${type}`] = items;
      }
    }

    if (!foundry.utils.isEmpty(updateData)) {
      if (commit) return this.update(updateData);
      return updateData;
    }
  }

  /**
   *
   * @param {object} linkData - Link data
   * @param {boolean} [extraData=false] - Deprecated: Include link data in return value
   * @returns {Item|null} - Linked item if it exists
   */
  async getLinkItem(linkData, extraData = false) {
    const item = await fromUuid(linkData.uuid, { relative: this.actor });

    // Package extra data
    if (extraData) {
      // Deprecated: "Extra data" is just the first parameter. Caller can bundle that if they want it.
      foundry.utils.logCompatibilityWarning(
        "ItemPF.getLinkItem() extraData parameter is deprecated with no replacement",
        {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        }
      );

      return { item, linkData };
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
    const { uuid } = linkData;
    const actor = this.actor;
    return fromUuidSync(uuid, { relative: actor });
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
        const actorSkills = foundry.utils.mergeObject(
          foundry.utils.deepClone(pf1.config.skills),
          this.actor.system.skills
        );
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
    else if (foundry.utils.hasProperty(pf1.config.buffTargets, target)) {
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

  getValue() {
    foundry.utils.logCompatibilityWarning("ItemPF.getValue() is deprecated, only physical items have value", {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });

    return 0;
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

    const sources = this.getAttackSources(actionId, { rollData });
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
   * @param {object} [options={}] - Additional options
   * @param {object} [options.rollData] - Roll data instance
   * @returns {object[]|undefined} Array of value and label pairs for attack bonus sources on the main attack, or undefined if the action is missing.
   */
  getAttackSources(actionId, { rollData } = {}) {
    /** @type {pf1.components.ItemAction} */
    const action = this.actions.get(actionId);
    if (!action) return;

    const sources = [];

    const actorData = this.actor?.system,
      itemData = this.system,
      actionData = action.data;

    if (!actorData || !actionData) return sources;
    rollData ??= action.getRollData();

    const describePart = (value, name, modifier, sort = 0) => {
      if (value == 0) return;
      sources.push({ value, name, modifier, sort });
    };

    const isManeuver = action.isCombatManeuver;

    // Unreliable melee/ranged identification
    const sizeBonus = !isManeuver
      ? pf1.config.sizeMods[rollData.traits.size]
      : pf1.config.sizeSpecialMods[rollData.traits.size];

    // Add size bonus
    if (sizeBonus != 0) describePart(sizeBonus, game.i18n.localize("PF1.Size"), "size", -20);

    const changeSources = action.attackSources;

    const effectiveChanges = getHighestChanges(changeSources, { ignoreTarget: true });
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
    if (this.isBroken) {
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
 * @property {pf1.actionUse.ChatAttack[]} chatAttacks - Array of chat attacks for this action's use
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
