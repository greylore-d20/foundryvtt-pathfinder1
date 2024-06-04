import { ItemPhysicalPF } from "./item-physical.mjs";

export class ItemConsumablePF extends ItemPhysicalPF {
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
