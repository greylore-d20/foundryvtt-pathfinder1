import { ItemPhysicalPF } from "./item-physical.mjs";

/**
 * Loot item
 *
 * Ammunition, gear, trade goods, etc.
 */
export class ItemLootPF extends ItemPhysicalPF {
  /** @type {string} */
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
    if (context.diff === false || context.recursive === false) return; // Don't diff if we were told not to diff

    // Reset loot extra type when loot subtype is changed
    if (
      changed.system?.subType !== undefined &&
      changed.system?.subType !== this.system.subType &&
      changed.system?.extraType === undefined
    ) {
      changed.system.extraType = "";
    }
  }

  /** @inheritDoc */
  getLabels({ actionId, rollData } = {}) {
    const labels = super.getLabels({ actionId, rollData });

    if (!this.showUnidentifiedData) {
      labels.subType = pf1.config.lootTypes[this.subType];
    }

    return labels;
  }

  /** @inheritDoc */
  get isActive() {
    const hp = this.system.hp?.value || 0;
    if (hp <= 0) return false; // Destroyed
    if (this.system.quantity <= 0) return false;
    if (pf1.config.unequippableLoot.includes(this.subType)) return true;
    return this.system.equipped ?? false;
  }

  /**
   * Make ammo count inherently as single use.
   *
   * @inheritDoc
   */
  get isSingleUse() {
    return this.subType === "ammo" || super.isSingleUse;
  }
}
