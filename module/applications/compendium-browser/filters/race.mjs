import { PF1 } from "@config";
import { CheckboxFilter } from "./checkbox.mjs";

export class CreatureTypeFilter extends CheckboxFilter {
  static label = "PF1.CreatureType";
  static type = "race";
  static indexField = "system.creatureType";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.creatureTypes);
  }
}

export class CreatureSubTypeFilter extends CheckboxFilter {
  static label = "PF1.RaceSubtypePlural";
  static type = "race";
  static indexField = "system.subTypes";
}
