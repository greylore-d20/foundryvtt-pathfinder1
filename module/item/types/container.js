import { ItemPF } from "../entity.js";

export class ItemContainerPF extends ItemPF {
  getValue({ recursive = true, sellValue = 0.5, inLowestDenomination = false, forceUnidentified = false } = {}) {
    let result = super.getValue(...arguments);

    if (!recursive) return result;

    // Add item's content items' values
    this.items.forEach((i) => {
      result += i.getValue({ recursive: recursive, sellValue: sellValue, inLowestDenomination });
    });

    return result;
  }
}
