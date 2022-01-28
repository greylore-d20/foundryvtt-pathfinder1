import { ItemPF } from "../entity.js";

export class ItemAttackPF extends ItemPF {
  getConditionalTargets() {
    const result = super.getConditionalTargets();

    result["size"] = game.i18n.localize(CONFIG.PF1.conditionalTargets.size._label);

    return result;
  }

  get subType() {
    return this.data.data.attackType;
  }
}
