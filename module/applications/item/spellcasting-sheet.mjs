import { ItemSheetPF } from "./item-sheet.mjs";

export class SpellcastingSheet extends ItemSheetPF {
  get template() {
    return "systems/pf1/templates/items/spellcasting.hbs";
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "spellcasting"],
      height: "auto",
      width: 520,
    };
  }

  getData() {
    return super.getData();
  }
}
