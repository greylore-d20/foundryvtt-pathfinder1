import { ItemPF } from "./item-pf.mjs";

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

  /** @type {boolean} - If actor is proficient with this weapon. */
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

    // Get attack template
    const attackItem = {
      name: item.name,
      type: "attack",
      img: item.img,
      system: {
        subType: "weapon",
        held: srcData.held,
        masterwork: srcData.masterwork,
        proficient: srcData.proficient,
        enh: srcData.enh,
        broken: srcData.broken,
        timeworn: srcData.timeworn,
        cursed: srcData.cursed,
        artifact: srcData.artifact,
        baseTypes: srcData.baseTypes,
        tags: srcData.tags,
        weaponGroups: srcData.weaponGroups,
        actions: srcData.actions ?? [],
        material: srcData.material,
        alignments: srcData.alignments,
      },
    };

    // Ensure action IDs are correct and unique
    for (const action of attackItem.system.actions) {
      action._id = foundry.utils.randomID(16);
    }

    return attackItem;
  }
}
