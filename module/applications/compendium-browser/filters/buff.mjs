import { BaseFilter } from "./base.mjs";
import { PF1 } from "@config";

export class BuffTypeFilter extends BaseFilter {
  static label = "PF1.Type";
  static type = "buff";
  static indexField = "system.subType";

  /** @override */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.buffTypes);
  }
}
