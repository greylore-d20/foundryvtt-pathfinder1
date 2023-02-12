import { PF1 } from "@config";
import { CheckboxFilter } from "./checkbox.mjs";

export class FeatTypeFilter extends CheckboxFilter {
  static label = "PF1.Type";
  static type = "feat";
  static indexField = "system.subType";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.featTypes);
  }
}

export class FeatTagFilter extends CheckboxFilter {
  static label = "PF1.Tags";
  static type = "feat";
  static indexField = "system.tags";
}

export class FeatClassFilter extends CheckboxFilter {
  static label = "PF1.Classes";
  static type = "feat";
  static indexField = "system.associations.classes";
}
