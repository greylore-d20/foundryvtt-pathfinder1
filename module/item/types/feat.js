import { ItemPF } from "../entity.js";

export class ItemFeatPF extends ItemPF {
  get isActive() {
    return !this.data.data.disabled;
  }
}
