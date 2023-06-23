import { ItemPhysicalPF } from "./item-physical.mjs";

export class ItemConsumablePF extends ItemPhysicalPF {
  /**
   * @internal
   * @override
   * @param {object} context
   * @param {User} user
   */
  async _preDelete(context, user) {
    if (user.isSelf) {
      if (this.system.quantity > 0) {
        this.executeScriptCalls("changeQuantity", { quantity: { previous: this.system.quantity, new: 0 } });
      }
    }

    await super._preDelete(context, user);
  }

  adjustContained() {
    super.adjustContained();

    this.system.carried = true;
  }

  /** @type {boolean} - If the item can be equipped currently */
  get canEquip() {
    return !this.inContainer;
  }

  getLabels({ actionId, rollData } = {}) {
    const labels = super.getLabels({ actionId, rollData });

    labels.subType = pf1.config.consumableTypes[this.subType];

    return labels;
  }
}
