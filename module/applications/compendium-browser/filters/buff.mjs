import { CheckboxFilter } from "./checkbox.mjs";

export class BuffTypeFilter extends CheckboxFilter {
  static label = "PF1.Type";
  static type = "buff";
  static indexField = "system.subType";

  /** @override */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(pf1.config.buffTypes);
  }
}
