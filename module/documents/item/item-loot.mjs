import { ItemPhysicalPF } from "./item-physical.mjs";

export class ItemLootPF extends ItemPhysicalPF {
  get extraType() {
    return this.system.extraType;
  }

  /**
   * @internal
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    if (!changed.system) return;

    // Reset loot extra type when loot subtype is changed
    if (
      changed.system?.subType !== undefined &&
      changed.system?.subType !== this.system.subType &&
      changed.system?.extraType === undefined
    ) {
      changed.system.extraType = "";
    }
  }

  /**
   * @internal
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

  getLabels({ actionId, rollData } = {}) {
    const labels = super.getLabels();

    if (!this.showUnidentifiedData) {
      labels.subType = pf1.config.lootTypes[this.subType];
    }

    return labels;
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
