import { ItemPF } from "./item-pf.mjs";

export class ItemLootPF extends ItemPF {
  get extraType() {
    return this.system.extraType;
  }

  async _preUpdate(update, options, userId) {
    await super._preUpdate(update, options, userId);

    // Reset loot extra type when loot subtype is changed
    if (
      update.system?.subType !== undefined &&
      update.system?.subType !== this.system.subType &&
      update.system?.extraType === undefined
    ) {
      setProperty(update, "system.extraType", "");
    }
  }

  async _preDelete(options, user) {
    if (user.id === game.user.id) {
      if (this.isActive) {
        this.executeScriptCalls("equip", { equipped: false });
      }

      if (this.system.quantity > 0) {
        this.executeScriptCalls("changeQuantity", { quantity: { previous: this.system.quantity, new: 0 } });
      }
    }

    return super._preDelete(options, user);
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
    if (this.subType === "gear") return this.system.equipped;
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
}
