import { ItemPF } from "./item-pf.mjs";

export class ItemWeaponPF extends ItemPF {
  async _preUpdate(update, context) {
    // Set weapon subtype if not present
    const newWeaponType = getProperty(update, "system.weaponType");
    if (newWeaponType != null && newWeaponType !== this.data.weaponType) {
      const subtype = getProperty(update, "system.weaponSubtype") ?? this.data.weaponSubtype ?? "";
      const keys = Object.keys(CONFIG.PF1.weaponTypes[newWeaponType]).filter((o) => !o.startsWith("_"));
      if (!subtype || !keys.includes(subtype)) {
        setProperty(update, "system.weaponSubtype", keys[0]);
      }
    }
  }

  prepareData() {
    super.prepareData();
    const labels = this.labels;
    const { weaponTypes } = CONFIG.PF1;

    // Type and subtype labels
    let wType = this.system.weaponType;
    const typeKeys = Object.keys(weaponTypes);
    if (!typeKeys.includes(wType)) wType = typeKeys[0];

    let wSubtype = this.system.weaponSubtype;
    const subtypeKeys = Object.keys(weaponTypes[wType]).filter((o) => !o.startsWith("_"));
    if (!subtypeKeys.includes(wSubtype)) wSubtype = subtypeKeys[0];

    labels.weaponType = weaponTypes[wType]._label;
    labels.weaponSubtype = weaponTypes[wType][wSubtype];

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
      obj[t] = CONFIG.PF1.weaponGroups[t];
      return obj;
    }, {});

    // Add custom entry
    if (weaponGroups.custom) {
      weaponGroups.custom
        .split(CONFIG.PF1.re.traitSeparator)
        .forEach((c, i) => (weaponGroups.selected[`custom${i + 1}`] = c.trim()));
    }

    weaponGroups.cssClass = foundry.utils.isEmpty(weaponGroups.selected) ? "inactive" : "";
  }
}
