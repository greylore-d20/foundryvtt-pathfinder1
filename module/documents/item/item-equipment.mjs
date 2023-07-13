import { ItemPF } from "./item-pf.mjs";

export class ItemEquipmentPF extends ItemPF {
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

    // Set equipment subtype and slot
    const type = changed.system?.subType;
    if (type !== undefined && type !== this.subType) {
      // Set subtype
      const subtype = changed.system?.equipmentSubtype ?? this.system.equipmentSubtype ?? "";
      const subtypes = Object.keys(pf1.config.equipmentTypes[type] ?? {}).filter((o) => !o.startsWith("_"));
      if (!subtype || !subtypes.includes(subtype)) {
        changed.system.equipmentSubtype = subtypes[0];
      }

      // Set slot
      const slot = changed.system?.slot ?? this.system.slot ?? "";
      const slotTypes = Object.keys(pf1.config.equipmentSlots[type] ?? {});
      if (!slot || !slotTypes.includes(slot)) {
        setProperty(changed, "system.slot", slotTypes[0]);
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
    const itemData = this.system;

    let eType = this.subType;
    const typeKeys = Object.keys(pf1.config.equipmentTypes);
    if (!typeKeys.includes(eType)) eType = typeKeys[0];

    let eSubtype = this.system.equipmentSubtype;
    const subtypeKeys = Object.keys(pf1.config.equipmentTypes[eType]).filter((o) => !o.startsWith("_"));
    if (!subtypeKeys.includes(eSubtype)) eSubtype = subtypeKeys[0];

    labels.equipmentType = pf1.config.equipmentTypes[eType]._label;
    labels.equipmentSubtype = pf1.config.equipmentTypes[eType][eSubtype];

    const ac = this.showUnidentifiedData
      ? itemData.armor.value || 0
      : (itemData.armor.value || 0) + (itemData.armor.enh || 0);
    labels.armor = ac > 0 ? `${ac} AC` : "";

    return labels;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    const itemData = this.system;

    // AC labels
    if (itemData.armor.dex === "") itemData.armor.dex = null;
    else if (typeof itemData.armor.dex === "string" && /\d+/.test(itemData.armor.dex)) {
      itemData.armor.dex = parseInt(itemData.armor.dex);
    }
    // Add enhancement bonus
    if (itemData.armor.enh == null) itemData.armor.enh = 0;

    // Feed info back to actor
    if (itemData.equipped === true) {
      const actor = this.actor;
      // Guard against weirdness with unlinked data (data is undefined at this state), and also basic test for if this item has actor.
      if (!actor?.system || !actor?.equipment) return;

      const actorData = actor.system;
      const shieldTypes = pf1.config.shieldTypes,
        armorTypes = pf1.config.armorTypes;

      switch (itemData.subType) {
        case "shield": {
          const subtype = itemData.equipmentSubtype;
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
          const subtype = itemData.equipmentSubtype;
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
