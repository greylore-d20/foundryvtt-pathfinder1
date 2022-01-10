import { ItemPF } from "../entity.js";

export class ItemEquipmentPF extends ItemPF {
  get subType() {
    return this.data.data.equipmentType;
  }

  prepareData() {
    const itemData = super.prepareData();
    const data = itemData.data;
    const labels = this.labels;
    const C = CONFIG.PF1;

    // Type and subtype labels
    let eType = this.subType;
    const typeKeys = Object.keys(C.equipmentTypes);
    if (!typeKeys.includes(eType)) eType = typeKeys[0];

    let eSubtype = this.data.data.equipmentSubtype;
    const subtypeKeys = Object.keys(C.equipmentTypes[eType]).filter((o) => !o.startsWith("_"));
    if (!subtypeKeys.includes(eSubtype)) eSubtype = subtypeKeys[0];

    labels.equipmentType = C.equipmentTypes[eType]._label;
    labels.equipmentSubtype = C.equipmentTypes[eType][eSubtype];

    // AC labels
    const ac = (data.armor.value || 0) + (data.armor.enh || 0);
    labels.armor = ac > 0 ? `${ac} AC` : "";
    if (data.armor.dex === "") data.armor.dex = null;
    else if (typeof data.armor.dex === "string" && /\d+/.test(data.armor.dex)) {
      data.armor.dex = parseInt(data.armor.dex);
    }
    // Add enhancement bonus
    if (data.armor.enh == null) data.armor.enh = 0;
  }

  get isActive() {
    return this.data.data.equipped;
  }
}
