import { ItemPF } from "./item-pf.mjs";

/**
 * Attack item
 *
 * Non-specific combat related actions. Mainly used to populate the combat tab.
 */
export class ItemAttackPF extends ItemPF {
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

    // Remove held option if type changed to natural attack
    if (changed.system.subType === "natural") {
      changed.system.held = null;
    }
  }

  /** @type {boolean} - This attack pretends to be physical item. */
  get isQuasiPhysical() {
    return ["weapon", "item"].includes(this.subType);
  }

  /**
   * {@inheritDoc ItemPhysicalPF.isBroken}
   */
  get isBroken() {
    if (!this.isQuasiPhysical) return false;
    return this.system.broken === true;
  }

  /**
   * @inheritDoc
   */
  getProficiency(weapon = true) {
    if (!weapon) throw new Error("Attacks do not support non-weapon proficiency");

    return this.isProficient;
  }

  /**
   * @inheritDoc
   */
  get isProficient() {
    if (this.system.proficient) return true;

    // Non-weapon attacks always proficient
    if (this.subType !== "weapon") return true;

    return this.actor?.hasWeaponProficiency?.(this) ?? true;
  }

  /**
   * Creates attack from provided item.
   *
   * @remarks - Only supports weapon item type.
   * @param {Item} item - Source item
   * @throws {Error} - On unsupported type
   * @returns {object} - Attack item data
   */
  static fromItem(item) {
    if (item.type !== "weapon") throw new Error(`Unsupported item type "${item.type}"`);

    const srcData = item.toObject().system;

    // Convert single-use to 1 max charge
    const uses = srcData.uses ?? {};
    if (uses.per === "single") {
      uses.per = "charges";
      uses.maxFormula = "1";
    }

    // Get attack template
    const attackItem = {
      name: item.name,
      type: "attack",
      img: item.img,
      system: {
        subType: "weapon",
        weapon: {
          category: srcData.subType,
          type: srcData.weaponSubtype,
        },
        held: srcData.held,
        masterwork: srcData.masterwork,
        proficient: srcData.proficient,
        enh: srcData.enh,
        broken: item.isBroken,
        timeworn: srcData.timeworn,
        cursed: srcData.cursed,
        artifact: srcData.artifact,
        baseTypes: srcData.baseTypes,
        tags: srcData.tags,
        weaponGroups: srcData.weaponGroups,
        actions: srcData.actions ?? [],
        material: srcData.material,
        alignments: srcData.alignments,
        attackNotes: srcData.attackNotes ?? [],
        effectNotes: srcData.effectNotes ?? [],
      },
    };

    // Ensure action IDs are correct and unique
    for (const action of attackItem.system.actions) {
      action._id = foundry.utils.randomID(16);
    }

    return attackItem;
  }

  /**
   * @override
   * @inheritDoc
   */
  getLabels({ actionId, rollData } = {}) {
    const labels = super.getLabels({ actionId, rollData });

    const itemData = this.system;
    labels.subType = pf1.config.attackTypes[this.subType];

    if (this.subType === "weapon") {
      // Type and subtype labels
      const wcat = itemData.weapon?.category || "simple";
      const wtype = itemData.weapon?.type || "light";

      labels.weapon ??= {};
      const cat = pf1.config.weaponTypes[wcat];
      labels.weapon.category = cat?._label;
      labels.weapon.type = cat?.[wtype];
    }

    return labels;
  }
}
