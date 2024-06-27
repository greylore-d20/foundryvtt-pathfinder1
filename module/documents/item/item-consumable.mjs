import { ItemPhysicalPF } from "./item-physical.mjs";

/**
 * Consumable item
 *
 * For potions, wands, scrolls, drugs, etc.
 */
export class ItemConsumablePF extends ItemPhysicalPF {
  /**
   * @inheritDoc
   */
  adjustContained() {
    super.adjustContained();

    this.system.carried = true;
  }

  /** @type {boolean} - If the item can be equipped currently */
  get canEquip() {
    return !this.inContainer;
  }

  /**
   * @inheritDoc
   */
  getLabels({ actionId, rollData } = {}) {
    const labels = super.getLabels({ actionId, rollData });

    labels.subType = pf1.config.consumableTypes[this.subType];

    return labels;
  }
}
