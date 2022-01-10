import { ItemPF } from "../entity.js";

export class ItemEquipmentPF extends ItemPF {
  get isActive() {
    return this.data.data.equipped;
  }
}
