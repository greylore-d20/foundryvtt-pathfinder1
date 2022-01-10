import { ItemPF } from "../entity.js";

export class ItemLootPF extends ItemPF {
  get subType() {
    return this.data.data.subType;
  }

  get isActive() {
    if (this.subType === "gear") return this.data.data.equipped;
    return true;
  }
}
