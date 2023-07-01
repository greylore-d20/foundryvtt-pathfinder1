import { ItemPF } from "./item-pf.mjs";

export class ItemWeaponPF extends ItemPF {
  /**
   * @inheritDoc
   * @internal
   */
  static system = Object.freeze(foundry.utils.mergeObject(super.system, { isPhysical: true }, { inplace: false }));

  /**
   * @override
   * @param {object} changed
   * @param {object} context
   * @param {User} user
   */
  async _preUpdate(changed, context, user) {
    await super._preUpdate(changed, context, user);

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
  getLabels({ actionId } = {}) {
    const labels = super.getLabels({ actionId });

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

  /** @inheritDoc */
  prepareData() {
    super.prepareData();

    this._prepareWeaponGroups();
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

  get isActive() {
    return this.system.equipped;
  }

  _prepareWeaponGroups() {
    const weaponGroups = this.system.weaponGroups || { value: [], custom: "" };

    weaponGroups.selected = weaponGroups.value.reduce((obj, t) => {
      obj[t] = pf1.config.weaponGroups[t];
      return obj;
    }, {});

    // Add custom entry
    if (weaponGroups.custom) {
      weaponGroups.custom
        .split(pf1.config.re.traitSeparator)
        .forEach((c, i) => (weaponGroups.selected[`custom${i + 1}`] = c.trim()));
    }

    weaponGroups.cssClass = foundry.utils.isEmpty(weaponGroups.selected) ? "inactive" : "";
  }
}
