import { ItemPF } from "../entity.js";

export class ItemEquipmentPF extends ItemPF {
  async _preUpdate(update, context) {
    // Set equipment subtype and slot
    const type = getProperty(update, "system.equipmentType");
    if (type !== undefined && type !== this.data.equipmentType) {
      // Set subtype
      const subtype = getProperty(update, "system.equipmentSubtype") ?? this.data.equipmentSubtype ?? "";
      let keys = Object.keys(CONFIG.PF1.equipmentTypes[type]).filter((o) => !o.startsWith("_"));
      if (!subtype || !keys.includes(subtype)) {
        setProperty(update, "system.equipmentSubtype", keys[0]);
      }

      // Set slot
      const slot = getProperty(update, "system.slot") ?? this.data.slot ?? "";
      keys = Object.keys(CONFIG.PF1.equipmentSlots[type]);
      if (!slot || !keys.includes(slot)) {
        setProperty(update, "system.slot", keys[0]);
      }
    }
  }

  get subType() {
    return this.system.equipmentType;
  }

  prepareData() {
    const itemData = super.prepareData();
    const data = itemData;
    const labels = this.labels;
    const C = CONFIG.PF1;

    // Type and subtype labels
    let eType = this.subType;
    const typeKeys = Object.keys(C.equipmentTypes);
    if (!typeKeys.includes(eType)) eType = typeKeys[0];

    let eSubtype = this.system.equipmentSubtype;
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

    // Feed info back to actor
    if (data.equipped === true) {
      const actor = this.actor;
      // Guard against weirdness with unlinked data (data is undefined at this state), and also basic test for if this item has actor.
      if (!actor?.system || !actor?.equipment) return;

      const actorData = actor.system;
      switch (data.equipmentType) {
        case "shield": {
          const subtype = data.equipmentSubtype;
          let shieldType = actor.equipment.shield.type;
          if (subtype === "other" && shieldType < 1) shieldType = 1;
          else if (subtype === "lightShield" && shieldType < 2) shieldType = 2;
          else if (subtype === "heavyShield" && shieldType < 3) shieldType = 3;
          else if (subtype === "towerShield" && shieldType < 4) shieldType = 4;
          if (actor.equipment.shield.type !== shieldType) {
            actor.equipment.shield.type = shieldType;
            actor.equipment.shield.id = this.id;
          }
          break;
        }
        case "armor": {
          const subtype = data.equipmentSubtype;
          let armorType = actor.equipment.armor.type;
          if (subtype === "lightArmor" && armorType < 1) armorType = 1;
          else if (subtype === "mediumArmor" && armorType < 2) armorType = 2;
          else if (subtype === "heavyArmor" && armorType < 3) armorType = 3;
          if (armorType !== actor.equipment.armor.type) {
            actor.equipment.armor.type = armorType;
            actor.equipment.armor.id = this.id;
          }
          break;
        }
      }
    }
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
}
