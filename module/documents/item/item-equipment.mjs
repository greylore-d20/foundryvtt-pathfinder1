import { PF1 } from "@config";
import { ItemPF } from "./item-pf.mjs";

export class ItemEquipmentPF extends ItemPF {
  async _preUpdate(update, context) {
    // Set equipment subtype and slot
    const type = update.system?.subType;
    if (type !== undefined && type !== this.subType) {
      // Set subtype
      const subtype = update.system?.equipmentSubtype ?? this.system.equipmentSubtype ?? "";
      const subtypes = Object.keys(PF1.equipmentTypes[type] ?? {}).filter((o) => !o.startsWith("_"));
      if (!subtype || !subtypes.includes(subtype)) {
        update.system.equipmentSubtype = subtypes[0];
      }

      // Set slot
      const slot = update.system?.slot ?? this.system.slot ?? "";
      const slotTypes = Object.keys(PF1.equipmentSlots[type] ?? {});
      if (!slot || !slotTypes.includes(slot)) {
        setProperty(update, "system.slot", slotTypes[0]);
      }
    }
  }

  async _preDelete(options, user) {
    if (user.id === game.user.id) {
      if (this.isActive) {
        this.executeScriptCalls("equip", { equipped: false });
      }

      if (this.system.quantity > 0) {
        this.executeScriptCalls("changeQuantity", { quantity: { previous: this.system.quantity, new: 0 } });
      }
    }

    return super._preDelete(options, user);
  }

  /** @inheritDoc */
  getLabels({ actionId } = {}) {
    const labels = super.getLabels({ actionId });
    const itemData = this.system;

    let eType = this.subType;
    const typeKeys = Object.keys(PF1.equipmentTypes);
    if (!typeKeys.includes(eType)) eType = typeKeys[0];

    let eSubtype = this.system.equipmentSubtype;
    const subtypeKeys = Object.keys(PF1.equipmentTypes[eType]).filter((o) => !o.startsWith("_"));
    if (!subtypeKeys.includes(eSubtype)) eSubtype = subtypeKeys[0];

    labels.equipmentType = PF1.equipmentTypes[eType]._label;
    labels.equipmentSubtype = PF1.equipmentTypes[eType][eSubtype];

    const ac = this.showUnidentifiedData
      ? itemData.armor.value || 0
      : (itemData.armor.value || 0) + (itemData.armor.enh || 0);
    labels.armor = ac > 0 ? `${ac} AC` : "";

    return labels;
  }

  prepareData() {
    const itemData = super.prepareData();
    const data = itemData;
    const C = PF1;

    // AC labels
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
      const shieldTypes = PF1.shieldTypes,
        armorTypes = PF1.armorTypes;

      switch (data.subType) {
        case "shield": {
          const subtype = data.equipmentSubtype;
          let shieldType = actor.equipment.shield.type;
          if (subtype === "other" && shieldType < shieldTypes.other) shieldType = shieldTypes.other;
          else if (subtype === "lightShield" && shieldType < shieldTypes.light) shieldType = shieldTypes.light;
          else if (subtype === "heavyShield" && shieldType < shieldTypes.heavy) shieldType = shieldTypes.heavy;
          else if (subtype === "towerShield" && shieldType < shieldTypes.tower) shieldType = shieldTypes.tower;
          if (actor.equipment.shield.type !== shieldType) {
            actor.equipment.shield.type = shieldType;
            actor.equipment.shield.id = this.id;
          }
          break;
        }
        case "armor": {
          const subtype = data.equipmentSubtype;
          let armorType = actor.equipment.armor.type;
          if (subtype === "lightArmor" && armorType < armorTypes.light) armorType = armorTypes.light;
          else if (subtype === "mediumArmor" && armorType < armorTypes.medium) armorType = armorTypes.medium;
          else if (subtype === "heavyArmor" && armorType < armorTypes.heavy) armorType = armorTypes.heavy;
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
