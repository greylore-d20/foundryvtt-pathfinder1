import { ItemPhysicalPF } from "./item-physical.mjs";

export class ItemEquipmentPF extends ItemPhysicalPF {
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
      } else {
        // Clear otherwise
        changed.system.equipmentSubtype = "";
      }

      // Set slot
      const slot = changed.system?.slot ?? this.system.slot ?? "";
      const slotTypes = Object.keys(pf1.config.equipmentSlots[type] ?? {});
      if (!slot || !slotTypes.includes(slot)) {
        changed.system.slot = slotTypes[0];
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

    const subtypeLabels = pf1.config.equipmentTypes[eType];
    labels.equipmentType = subtypeLabels._label;
    labels.equipmentSubtype = subtypeLabels[eSubtype] ?? subtypeLabels._label;

    const ac = this.showUnidentifiedData
      ? itemData.armor.value || 0
      : (itemData.armor.value || 0) + (itemData.armor.enh || 0);
    labels.armor = ac > 0 ? `${ac} AC` : "";

    if (this.subType === "armor") {
      labels.slot = pf1.config.equipmentSlots.armor.armor;
    } else if (this.subType === "shield") {
      labels.slot = pf1.config.equipmentSlots.shield.shield;
    } else if (this.subType === "clothing") {
      labels.slot = pf1.config.equipmentSlots.clothing.clothing;
    }

    return labels;
  }

  /**
   * Adjust item while in container.
   */
  adjustContained() {
    super.adjustContained();

    // Everything in containers count as carried
    this.system.carried = true;

    // Auto-unequip
    if (!this.canEquip) this.system.equipped = false;
  }

  /** @type {boolean} - If the item can be equipped currently */
  get canEquip() {
    // Always true if not in container
    if (!this.inContainer) return true;

    switch (this.subType) {
      case "armor":
      case "shield":
      case "clothing":
        return false;
      case "wondrous":
      case "other":
        return this.system.slot === "slotless";
    }
    return true;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    const itemData = this.system;

    // Add enhancement bonus
    itemData.armor.enh ??= 0;

    // Feed info back to actor
    if (itemData.equipped !== false) {
      this.applyEquippedEffects();
    }
  }

  /**
   * Apply effects of equipping this item.
   */
  applyEquippedEffects() {
    const itemData = this.system;

    if (!this.isActive) return;

    const actor = this.actor;
    // Guard against weirdness with unlinked data (data is undefined at this state), and also basic test for if this item has actor.
    if (!actor?.system || !actor?.equipment) return;

    switch (this.subType) {
      case "shield": {
        const shieldTypes = pf1.config.shieldTypes;
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
        const armorTypes = pf1.config.armorTypes;
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
    if (this.system.hp.value <= 0) return false;
    return this.system.equipped ?? false;
  }

  /**
   * Does the equipment subtype use slots.
   *
   * @type {boolean}
   */
  get hasSlots() {
    return ["wondrous", "other"].includes(this.subType);
  }

  getProficiency(weapon = true) {
    if (weapon) return this.system.proficient ?? true;

    const subType = this.subType;
    if (!["armor", "shield"].includes(subType)) throw new Error(`"${subType}" does not support proficiency`);

    const actor = this.actor;
    if (!actor) return true; // No actor, so always proficient

    // Item type to proficiency maps
    const proficiencyMaps = {
      armor: {
        lightArmor: "lgt",
        mediumArmor: "med",
        heavyArmor: "hvy",
      },
      shield: {
        other: "shl", // buckler
        lightShield: "shl",
        heavyShield: "shl",
        towerShield: "twr",
      },
    };

    const proficiencyType = proficiencyMaps[subType][this.system.equipmentSubtype];

    return actor.hasArmorProficiency(this, proficiencyType);
  }

  /**
   * @see {@link https://aonprd.com/Rules.aspx?Name=Armor%20for%20Unusual%20Creatures&Category=Armor}
   *
   * @inheritdoc
   * @remarks
   * Only armor and shields get anything besides 1.
   */
  getWeightMultiplier() {
    if (!["armor", "shield"].includes(this.subType)) return 1;

    return this._getArmorWeightMultiplier();
  }
}
