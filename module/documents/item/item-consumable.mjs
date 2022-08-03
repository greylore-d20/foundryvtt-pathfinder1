import { ItemPF } from "./item-pf.mjs";

export class ItemConsumablePF extends ItemPF {
  get subType() {
    return this.system.consumableType;
  }
}
