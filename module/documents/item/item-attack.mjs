import { ItemPF } from "./item-pf.mjs";

export class ItemAttackPF extends ItemPF {
  getConditionalTargets() {
    const result = super.getConditionalTargets();

    result["size"] = game.i18n.localize(pf1.config.conditionalTargets.size._label);

    return result;
  }
}
