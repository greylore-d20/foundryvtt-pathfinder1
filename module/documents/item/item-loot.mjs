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

    //
    if (changed.flags?.pf1?.abundant !== undefined) {
      foundry.utils.logCompatibilityWarning("flags.pf1.abundant is deprecated in favor of system.abundant", {
        since: "PF1 vNEXT",
        until: "PF1 vNEXT+1",
      });
      changed.system.abundant = changed.flags.pf1.abundant;
      delete changed.flags.pf1.abundant;
    }

    // Reset loot extra type when loot subtype is changed
    if (
      changed.system?.subType !== undefined &&
      changed.system?.subType !== this.system.subType &&
      changed.system?.extraType === undefined
    ) {
      changed.system.extraType = "";
    }
  }

  getLabels({ actionId, rollData } = {}) {
    const labels = super.getLabels();

    if (!this.showUnidentifiedData) {
      labels.subType = pf1.config.lootTypes[this.subType];
    }

    return labels;
  }

  /**
   * @inheritDoc
   */
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
