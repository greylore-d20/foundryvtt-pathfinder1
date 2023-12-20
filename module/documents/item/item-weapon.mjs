import { ItemPhysicalPF } from "./item-physical.mjs";

export class ItemWeaponPF extends ItemPhysicalPF {
  /**
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

    if (!changed.system) return;

    // Set weapon subtype if not present
    const newWeaponType = changed.system?.subType;
    if (newWeaponType != null && newWeaponType !== this.system.subType) {
      const subtype = changed.system.weaponSubtype ?? this.system.weaponSubtype ?? "";
      const keys = Object.keys(pf1.config.weaponTypes[newWeaponType]).filter((o) => !o.startsWith("_"));
      if (!subtype || !keys.includes(subtype)) {
        changed.system.weaponSubtype = keys[0];
      }
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

  /** @inheritDoc */
  getLabels({ actionId, rollData } = {}) {
    const labels = super.getLabels({ actionId, rollData });

    const { weaponTypes } = pf1.config;

    // Type and subtype labels
    let wType = this.system.subType;
    const typeKeys = Object.keys(weaponTypes);
    if (!typeKeys.includes(wType)) wType = typeKeys[0];

    let wSubtype = this.system.weaponSubtype;
    const subtypeKeys = Object.keys(weaponTypes[wType]).filter((o) => !o.startsWith("_"));
    if (!subtypeKeys.includes(wSubtype)) wSubtype = subtypeKeys[0];

    labels.weaponType = weaponTypes[wType]._label;
    labels.weaponSubtype = weaponTypes[wType][wSubtype];

    return labels;
  }

  adjustContained() {
    super.adjustContained();

    this.system.equipped = false;
    this.system.carried = true;
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

  /** @type {boolean} - If the item can be equipped currently */
  get isActive() {
    return this.system.equipped;
  }

  get canEquip() {
    return !this.inContainer;
  }

  /**
   * @inheritDoc
   */
  getProficiency(weapon = true) {
    if (!weapon) throw new Error("Weapons do not support non-weapon proficiency");

    return this.isProficient;
  }

  /** @type {boolean} - If actor is proficient with this weapon. */
  get isProficient() {
    if (this.system.proficient) return true;
    return this.actor?.hasWeaponProficiency?.(this) ?? true;
  }

  /**
   * @inheritDoc
   * @remarks
   * Not 100% RAW correct as this applies armor table to weapons,
   * but since Paizo did not provide a table for weapons
   * besides stating weapons for small are half weight, we assume they use the same table.
   *
   * @see {@link pf1.documents.item.ItemEquipmentPF.getWeightMultiplier}
   */
  getWeightMultiplier() {
    // Use same as armor, even though Paizo has only stats for halving for small and nothing else.
    return this._getArmorWeightMultiplier();
  }
}
