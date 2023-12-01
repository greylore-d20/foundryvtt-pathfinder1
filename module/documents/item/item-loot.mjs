import { ItemPhysicalPF } from "./item-physical.mjs";

export class ItemLootPF extends ItemPhysicalPF {
  get extraType() {
    return this.system.extraType;
  }

  /**
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    // Reset loot extra type when loot subtype is changed
    if (
      changed.system?.subType !== undefined &&
      changed.system?.subType !== this.system.subType &&
      changed.system?.extraType === undefined
    ) {
      setProperty(changed, "system.extraType", "");
    }
  }

  /**
   * @override
   * @param {object} context
   * @param {User} user
   */
  async _preDelete(context, user) {
    if (user.isSelf) {
      if (this.isActive) {
        this.executeScriptCalls("equip", { equipped: false });
      }

      if (this.system.quantity > 0) {
        this.executeScriptCalls("changeQuantity", { quantity: { previous: this.system.quantity, new: 0 } });
      }
    }

    await super._preDelete(context, user);
  }

  /**
   * @param {boolean} active
   * @param {object} context Optional update context
   * @returns {Promise} Update promise
   * @override
   */
  async setActive(active, context) {
    return this.update({ "system.equipped": active }, context);
  }

  get isActive() {
    if (this.subType === "gear") {
      if (this.system.hp.value <= 0) return false;
      return this.system.equipped ?? false;
    }
    return true;
  }

  /**
   * Make ammo count inherently as single use.
   *
   * @inheritdoc
   * @override
   */
  get isSingleUse() {
    return this.subType === "ammo" || super.isSingleUse;
  }

  /**
   * Simplified addCharges for items that can't have charges.
   *
   * @inheritdoc
   * @override
   */
  async addCharges(value) {
    const quantity = this.system.quantity;
    if (!Number.isFinite(quantity)) return;
    return this.update({ "system.quantity": quantity + value });
  }

  /**
   * Simplified charges
   *
   * @override
   * @type {number} Quantity
   */
  get charges() {
    return this.system.quantity ?? 0;
  }

  adjustContained() {
    super.adjustContained();

    this.system.carried = true;

    this.system.equipped = false;
  }

  /** @type {boolean} - If the item can be equipped currently */
  get canEquip() {
    return !this.inContainer;
  }
}
