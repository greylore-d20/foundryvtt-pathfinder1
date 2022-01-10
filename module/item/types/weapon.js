import { ItemPF } from "../entity.js";

export class ItemWeaponPF extends ItemPF {
  prepareData() {
    const itemData = super.prepareData();
    const data = itemData.data;
    const labels = this.labels;
    const C = CONFIG.PF1;

    // Type and subtype labels
    let wType = this.data.data.weaponType;
    const typeKeys = Object.keys(C.weaponTypes);
    if (!typeKeys.includes(wType)) wType = typeKeys[0];

    let wSubtype = this.data.data.weaponSubtype;
    const subtypeKeys = Object.keys(C.weaponTypes[wType]).filter((o) => !o.startsWith("_"));
    if (!subtypeKeys.includes(wSubtype)) wSubtype = subtypeKeys[0];

    labels.weaponType = C.weaponTypes[wType]._label;
    labels.weaponSubtype = C.weaponTypes[wType][wSubtype];
  }
  get isActive() {
    return this.data.data.equipped;
  }
}
