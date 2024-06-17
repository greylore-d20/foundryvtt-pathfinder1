import { ItemPF } from "./item-pf.mjs";

/**
 * Abstract class for physical items.
 */
export class ItemPhysicalPF extends ItemPF {
  /**
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    if (context.diff === false || context.recursive === false) return;

    // No system changes
    if (!changed.system) return;

    await this._resetChargesOnQuantityUpdate(changed);
  }

  /**
   * @inheritDoc
   * @internal
   */
  static system = Object.freeze(foundry.utils.mergeObject(super.system, { isPhysical: true }, { inplace: false }));

  _preUpdateNumericValueGuard(system) {
    super._preUpdateNumericValueGuard(system);

    if (system.quantity !== undefined && (!Number.isSafeInteger(system.quantity) || system.quantity < 0)) {
      system.quantity = 0;
    }
    if (system.price !== undefined && !Number.isFinite(system.price)) {
      system.price = 0;
    }
    if (system.unidentified?.price !== undefined && !Number.isFinite(system.unidentified.price)) {
      system.unidentified.price = 0;
    }
    if (system.hardness !== undefined && (!Number.isSafeInteger(system.hardness) || system.hardness < 0)) {
      system.hardness = 0;
    }
    if (system.hp?.value !== undefined && !Number.isSafeInteger(system.hp.value)) {
      system.hp.value = 0;
    }
    if (system.hp?.max !== undefined && (!Number.isSafeInteger(system.hp.max) || system.hp.max < 0)) {
      system.hp.max = 0;
    }
  }

  async _preCreate(data, context, user) {
    await super._preCreate(data, context, user);

    // Items for NPC should be unidentified by default
    if (this.actor?.type === "npc" && data.system?.identified === undefined) {
      this.updateSource({ "system.identified": false });
    }
  }

  _onCreate(data, context, userId) {
    super._onCreate(data, context, userId);

    // Simulate equipping items    {
    if (this.system.equipped === true) {
      this.executeScriptCalls("equip", { equipped: true });
    }

    // Quantity change
    const quantity = this.system.quantity || 0;
    if (quantity > 0) {
      this.executeScriptCalls("changeQuantity", { quantity: { previous: 0, new: quantity } });
    }
  }

  _onUpdate(changed, context, userId) {
    super._onUpdate(changed, context, userId);

    // Call 'equip' script calls
    const equipped = changed.system?.equipped;
    if (equipped != null) {
      this.executeScriptCalls("equip", { equipped });
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
  }

  /**
   * @internal
   * @override
   * @param {object} context
   * @param {string} userId
   */
  _onDelete(context, userId) {
    super._onDelete(context, userId);

    if (game.users.get(userId)?.isSelf) {
      if (this.system.equipped === true) {
        this.executeScriptCalls("equip", { equipped: false });
      }

      if (this.system.quantity > 0) {
        this.executeScriptCalls("changeQuantity", { quantity: { previous: this.system.quantity, new: 0 } });
      }
    }
  }

  /**
   * Reset charges when quantity is changed to simulate a stack.
   *
   * - If charges are 0
   * - ... and quantity is reduced, reset to max
   *
   * @param {object} changed
   */
  async _resetChargesOnQuantityUpdate(changed) {
    // Don't care if charges are linked
    if (this.links.charges) return;

    // Only if quantity changed
    const newQuantity = changed.system.quantity;
    if (newQuantity === undefined) return;
    // Don't touch if quantity is increased or remains the same
    if ((newQuantity || 0) >= (this.system.quantity || 0)) return;

    // Avoid overwriting value if the update is modifying it.
    if (changed.system.uses?.value !== undefined) return;

    const oldUses = this.system.uses ?? {};
    if (oldUses.per && oldUses.value === 0 && oldUses.max > 0) {
      const update = await this.recharge({ period: "any", commit: false });
      if (update) {
        changed.system.uses ??= {};
        changed.system.uses.value = update.system.uses.value;
      }
    }
  }

  prepareBaseData() {
    // Set visible name
    if (this.showUnidentifiedData) {
      this.name = this.system.unidentified?.name || this._source.name;
    } else {
      this.name = this._source.name;
    }

    // Ensure some base data has values
    this.system.size ||= "med";
    this.system.weight ??= {};
    this.system.weight.value ||= 0;
    this.system.quantity ||= 0;

    super.prepareBaseData();

    const itemData = this.system;
    // Init base weight values in case they're missing.
    itemData.weight ??= {};
    itemData.weight.value ??= 0;
    itemData.weight.total = 0;
    itemData.weight.converted ??= {};
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    this.prepareWeight();

    // Physical items
    if (this.isPhysical && this.showUnidentifiedData) {
      // Set unidentified description for players
      this.system.description.value = this.system.description.unidentified;
    }
  }

  /**
   * @inheritDoc
   */
  async setActive(active, context) {
    return this.update({ "system.equipped": active }, context);
  }

  /**
   * @inheritDoc
   */
  get isActive() {
    const hp = this.system.hp?.value || 0;
    if (hp <= 0) return false; // Destroyed
    if (this.system.quantity <= 0) return false;
    return this.system.equipped ?? false;
  }

  /**
   * Determines if the item is equipped.
   *
   * @inheritDoc
   */
  get activeState() {
    return this.system.equipped || false;
  }

  /**
   * Prepare this item's {@link ItemWeightData}
   */
  prepareWeight() {
    const itemData = this.system;
    const weight = itemData.weight;

    // Adjust base weight
    // Altering weight.value directly will corrupt the weight
    const baseWeight = weight.value * this.getWeightMultiplier();

    weight.total ||= 0; // In case item subclass didn't prepare it
    weight.total += baseWeight * itemData.quantity;

    // Convert weight according metric system (lb vs kg)
    weight.converted.value = pf1.utils.convertWeight(baseWeight);
    weight.converted.total = pf1.utils.convertWeight(weight.total);
  }

  /**
   * Return weight multiplier affecting this item.
   *
   * Such as item size dictating how heavy an armor is.
   *
   * @returns {number} - Multiplier, 1 for most items regardless of size.
   */
  getWeightMultiplier() {
    return 1;
  }

  // Generic weight scaling
  // For use with getWeightMultiplier() across item types
  _getArmorWeightMultiplier() {
    // Scale weight for weapons, armor and shields
    const actorSize = this.actor?.system.traits?.size;
    const itemSize = this.system.size || "med";
    const size = this.system.resizing ? actorSize || itemSize : itemSize;
    const mult = pf1.config.armorWeight[size];
    return mult ?? 1;
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
   * @param {boolean} [options.identical=false] - Treat all items in stack as identical (same number of charges).
   * @param {boolean} [options.maximized=false] - Pretend as if the items were fresh  (full charges)
   * @returns {number} The item's value
   */
  getValue({
    recursive = true,
    sellValue = 0.5,
    inLowestDenomination = false,
    forceUnidentified = false,
    single = false,
    identical = false,
    maximized = false,
  } = {}) {
    if (single) recursive = false;

    const hasFiniteCharges = this.hasFiniteCharges;
    const maxChargesValue = hasFiniteCharges ? this.maxCharges : 0;
    const remainingCharges = hasFiniteCharges ? (maximized ? maxChargesValue : this.charges) : 0;

    const getActualValue = (identified = true, maxCharges = false) => {
      let value = 0;
      if (identified) value = this.system.price || 0;
      else value = this.system.unidentified?.price || 0;

      // Add charge price
      if (identified && hasFiniteCharges) {
        let charges = maxCharges ? maxChargesValue : remainingCharges;
        if (!Number.isFinite(charges) || charges < 0) charges = 0;
        value += (this.system.uses?.pricePerUse ?? 0) * charges;
      }

      if (inLowestDenomination) value *= 100;
      if (this.isBroken) value *= 0.75; // TODO: Make broken value configurable
      if (this.system.timeworn) {
        if (hasFiniteCharges && remainingCharges === 0) value *= 0.01;
        else value *= 0.5;
      }
      return value;
    };

    // Increase value by quantity
    const isIdentified = forceUnidentified ? false : !this.showUnidentifiedData;
    const quantity = single ? 1 : this.system.quantity || 0;
    let result = getActualValue(isIdentified);
    if (quantity > 1) {
      // If charged item, add rest of the stack as if they had full charges
      if (hasFiniteCharges && identical !== true) result += getActualValue(isIdentified, true) * (quantity - 1);
      // Otherwise just multiply
      else result *= quantity;
    }

    // Modify sell value
    if (!(this.type === "loot" && ["tradeGoods", "treasure"].includes(this.subType))) result *= sellValue;

    return result;
  }

  /**
   * @remarks
   * Checks if the item is equipped and has quantity.
   * @inheritDoc
   */
  get canUse() {
    return this.system.equipped && this.system.quantity > 0;
  }

  /**
   * @type {boolean} - Broken state
   */
  get isBroken() {
    if (this.system.broken) return true;

    const hp = this.system.hp ?? {};
    const hpMax = hp.max ?? 0;
    if (hpMax > 0) {
      const hpCur = hp.value ?? 0;
      const brokenThreshold = Math.floor(hpMax / 2);
      return hpCur <= Math.floor(hpMax / 2);
    }

    return false;
  }

  getLabels({ actionId, rollData } = {}) {
    const labels = super.getLabels({ actionId, rollData });

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

    return labels;
  }

  /**
   * @remarks
   * Identified state is the only thing that can alter the result.
   * @override
   * @inheritDoc
   */
  getName(forcePlayerPerspective = false) {
    if (game.user.isGM && forcePlayerPerspective) {
      if (this.system.identified === false) return this.system.unidentified?.name || this.name;
    }
    return this.name;
  }

  get showUnidentifiedData() {
    return !game.user.isGM && this.system.identified === false;
  }

  getRollData() {
    const result = super.getRollData();

    // Overwrite broken state
    result.item.broken = this.isBroken;

    return result;
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
