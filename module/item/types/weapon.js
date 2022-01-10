import { ItemPF } from "../entity.js";

export class ItemWeaponPF extends ItemPF {
  get isActive() {
    return this.data.data.equipped;
  }
}
