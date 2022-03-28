import { ItemPF } from "../entity.js";

export class ItemLootPF extends ItemPF {
  get subType() {
    return this.data.data.subType;
  }

  get extraType() {
    return this.data.data.extraType;
  }

  /**
   * @param {boolean} active
   * @param {Object} context Optional update context
   * @returns {Promise} Update promise
   * @override
   */
  async setActive(active, context) {
    return this.update({ "data.equipped": active }, context);
  }

  get isActive() {
    if (this.subType === "gear") return this.data.data.equipped;
    return true;
  }
}
