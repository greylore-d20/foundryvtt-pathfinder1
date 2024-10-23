import { ItemPhysicalPF } from "./item-physical.mjs";

/**
 * Weapon item
 */
export class ItemWeaponPF extends ItemPhysicalPF {
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

    labels.subType = weaponTypes[wType]._label;
    labels.childType = weaponTypes[wType][wSubtype];

    labels.properties = [
      ...Object.entries(this.system.properties ?? {})
        .filter(([_, enabled]) => enabled)
        .map(([id]) => pf1.config.weaponProperties[id] || id),
    ];

    return labels;
  }

  /** @inheritDoc */
  getTypeChatData(data, labels, props, rollData, { actionId = null, chatcard = false } = {}) {
    super.getTypeChatData(data, labels, props, rollData, { actionId, chatcard });

    if (this.showUnidentifiedData) return;

    if (labels.weaponSubtype) props.push(labels.weaponSubtype);
  }

  /** @inheritDoc */
  getProficiency(weapon = true) {
    if (!weapon) throw new Error("Weapons do not support non-weapon proficiency");

    return this.isProficient;
  }

  /** @inheritDoc */
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
