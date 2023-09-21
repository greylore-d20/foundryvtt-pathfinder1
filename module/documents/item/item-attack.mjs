import { ItemPF } from "./item-pf.mjs";

export class ItemAttackPF extends ItemPF {
  getProficiency(weapon = true) {
    if (!weapon) throw new Error("Attacks do not support non-weapon proficiency");

    return this.system.proficient ?? true;
  }
}
