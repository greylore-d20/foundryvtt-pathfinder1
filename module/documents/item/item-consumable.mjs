import { ItemPF } from "./item-pf.mjs";

export class ItemConsumablePF extends ItemPF {
  get subType() {
    return this.system.consumableType;
  }

  async _preDelete(options, user) {
    if (user.id === game.user.id) {
      if (this.system.quantity > 0) {
        this.executeScriptCalls("changeQuantity", { quantity: { previous: this.system.quantity, new: 0 } });
      }
    }

    return super._preDelete(options, user);
  }
}
