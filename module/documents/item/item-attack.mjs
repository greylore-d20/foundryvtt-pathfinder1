import { ItemPF } from "./item-pf.mjs";

export class ItemAttackPF extends ItemPF {
  getConditionalTargets() {
    const result = super.getConditionalTargets();

    result["size"] = game.i18n.localize(pf1.config.conditionalTargets.size._label);

    return result;
  }

  prepareData() {
    super.prepareData();

    const weaponGroups = this.system.weaponGroups || { value: [], custom: "" };

    weaponGroups.selected = weaponGroups.value.reduce((obj, t) => {
      obj[t] = pf1.config.weaponGroups[t];
      return obj;
    }, {});

    // Add custom entry
    if (weaponGroups.custom) {
      weaponGroups.custom
        .split(pf1.config.re.traitSeparator)
        .forEach((c, i) => (weaponGroups.selected[`custom${i + 1}`] = c.trim()));
    }

    weaponGroups.cssClass = foundry.utils.isEmpty(weaponGroups.selected) ? "inactive" : "";
  }
}
