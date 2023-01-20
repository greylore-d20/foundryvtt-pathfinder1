import { BaseFilter } from "./base.mjs";

export class FeatTypeFilter extends BaseFilter {
  static label = "PF1.Type";
  static type = "feat";
  static indexField = "system.subType";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(CONFIG.PF1.featTypes);
  }
}

export class FeatTagFilter extends BaseFilter {
  static label = "PF1.Tags";
  static type = "feat";
  static indexField = "system.tags";
}

export class FeatClassFilter extends BaseFilter {
  static label = "PF1.Classes";
  static type = "feat";
  static indexField = "system.associations.classes";
}
