import { ItemPF } from "../entity.js";

export class ItemBuffPF extends ItemPF {
  get isActive() {
    return this.data.data.active;
  }
}
