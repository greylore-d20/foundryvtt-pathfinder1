import { ItemPF } from "../entity.js";

export class ItemAttackPF extends ItemPF {
  getConditionalTargets() {
    const result = super.getConditionalTargets();

    result["size"] = game.i18n.localize(CONFIG.PF1.conditionalTargets.size._label);

    return result;
  }

  prepareData() {
    super.prepareData();

    const weaponGroups = this.data.data.weaponGroups || { value: [], custom: "" };

    weaponGroups.selected = weaponGroups.value.reduce((obj, t) => {
      obj[t] = CONFIG.PF1.weaponGroups[t];
      return obj;
    }, {});

    // Add custom entry
    if (weaponGroups.custom) {
      weaponGroups.custom
        .split(CONFIG.PF1.re.traitSeparator)
        .forEach((c, i) => (weaponGroups.selected[`custom${i + 1}`] = c.trim()));
    }

    weaponGroups.cssClass = isObjectEmpty(weaponGroups.selected) ? "inactive" : "";
  }

  get subType() {
    return this.data.data.attackType;
  }
}
