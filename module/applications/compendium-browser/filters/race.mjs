import { CheckboxFilter } from "./checkbox.mjs";

export class CreatureTypeFilter extends CheckboxFilter {
  static label = "PF1.CreatureType";
  static type = "race";
  static indexField = "system.creatureType";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(pf1.config.creatureTypes);
  }
}

export class CreatureSubTypeFilter extends CheckboxFilter {
  static label = "PF1.RaceSubtypePlural";
  static type = "race";
  static indexField = "system.subTypes";
}
