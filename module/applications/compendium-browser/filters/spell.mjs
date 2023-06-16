import { CheckboxFilter } from "./checkbox.mjs";

export class SpellSchoolFilter extends CheckboxFilter {
  static label = "PF1.SpellSchool";
  static indexField = "system.school";
  static type = "spell";

  /** @override */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(pf1.config.spellSchools);
  }
}

export class SpellSubSchoolFilter extends CheckboxFilter {
  static label = "PF1.SubSchool";
  static indexField = "system.subschool";
  static type = "spell";
}

export class SpellDescriptorFilter extends CheckboxFilter {
  static label = "PF1.Descriptor";
  static indexField = "system.types";
  static type = "spell";
}

export class SpellLearnedByClassFilter extends CheckboxFilter {
  static label = "PF1.Classes";
  static indexField = "system.learnedAt.class";
  static type = "spell";
}

export class SpellLearnedByDomainFilter extends CheckboxFilter {
  static label = "PF1.Domain";
  static indexField = "system.learnedAt.domain";
  static type = "spell";
}

export class SpellLearnedBySubdomainFilter extends CheckboxFilter {
  static label = "PF1.SubDomain";
  static indexField = "system.learnedAt.subDomain";
  static type = "spell";
}

export class SpellLearnedByBloodlineFilter extends CheckboxFilter {
  static label = "PF1.Bloodline";
  static indexField = "system.learnedAt.bloodline";
  static type = "spell";
}

export class SpellLevelFilter extends CheckboxFilter {
  static label = "PF1.SpellLevel";
  static indexField = "system.level";
  static type = "spell";

  /** @override */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(pf1.config.spellLevels);
  }
}
