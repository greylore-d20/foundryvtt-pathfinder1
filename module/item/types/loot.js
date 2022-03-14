import { ItemPF } from "../entity.js";

export class ItemLootPF extends ItemPF {
  get subType() {
    return this.data.data.subType;
  }

  get extraType() {
    return this.data.data.extraType;
  }

  get isActive() {
    if (this.subType === "gear") return this.data.data.equipped;
    return true;
  }
}
