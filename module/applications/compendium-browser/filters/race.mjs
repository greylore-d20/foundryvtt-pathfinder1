import { PF1 } from "@config";
import { BaseFilter } from "./base.mjs";

export class CreatureTypeFilter extends BaseFilter {
  static label = "PF1.CreatureType";
  static type = "race";
  static indexField = "system.creatureType";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.creatureTypes);
  }
}

export class CreatureSubTypeFilter extends BaseFilter {
  static label = "PF1.RaceSubtypePlural";
  static type = "race";
  static indexField = "system.subTypes";
}
