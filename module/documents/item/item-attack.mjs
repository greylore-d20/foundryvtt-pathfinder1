import { ItemPF } from "./item-pf.mjs";

export class ItemAttackPF extends ItemPF {
  /**
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
}
