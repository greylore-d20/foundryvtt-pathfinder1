import { CheckboxFilter } from "./checkbox.mjs";

export class FeatTypeFilter extends CheckboxFilter {
  static label = "PF1.Type";
  static type = "feat";
  static indexField = "system.subType";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(pf1.config.featTypes);
  }
}

export class FeatClassFilter extends CheckboxFilter {
  static label = "PF1.Classes";
  static type = "feat";
  static indexField = "system.associations.classes";
}
