import { ItemPF } from "../entity.js";

export class ItemConsumablePF extends ItemPF {
  get subType() {
    return this.data.data.consumableType;
  }
}
