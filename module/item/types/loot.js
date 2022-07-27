import { ItemPF } from "../entity.js";

export class ItemLootPF extends ItemPF {
  get subType() {
    return this.data.data.subType;
  }

  get extraType() {
    return this.data.data.extraType;
  }

  async _preUpdate(update, options, userId) {
    await super._preUpdate(update, options, userId);

    // Reset loot extra type when loot subtype is changed
    if (
      update.data?.subType !== undefined &&
      update.data?.subType !== this.data.data.subType &&
      update.data?.extraType === undefined
    ) {
      setProperty(update, "data.extraType", "");
    }
  }

  /**
   * @param {boolean} active
   * @param {object} context Optional update context
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
