import { BaseFilter } from "./base.mjs";
import { PF1 } from "@config";

export class SpellSchoolFilter extends BaseFilter {
  static label = "PF1.SpellSchool";
  static indexField = "system.school";
  static type = "spell";

  /** @override */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.spellSchools);
  }
}

export class SpellSubSchoolFilter extends BaseFilter {
  static label = "PF1.SubSchool";
  static indexField = "system.subschool";
  static type = "spell";
}

export class SpellDescriptorFilter extends BaseFilter {
  static label = "PF1.Descriptor";
  static indexField = "system.types";
  static type = "spell";
}

export class SpellLearnedByClassFilter extends BaseFilter {
  static label = "PF1.Classes";
  static indexField = "system.learnedAt.class";
  static type = "spell";
}

export class SpellLearnedByDomainFilter extends BaseFilter {
  static label = "PF1.Domain";
  static indexField = "system.learnedAt.domain";
  static type = "spell";
}

export class SpellLearnedBySubdomainFilter extends BaseFilter {
  static label = "PF1.SubDomain";
  static indexField = "system.learnedAt.subDomain";
  static type = "spell";
}

export class SpellLearnedByBloodlineFilter extends BaseFilter {
  static label = "PF1.Bloodline";
  static indexField = "system.learnedAt.bloodline";
  static type = "spell";
}

export class SpellLevelFilter extends BaseFilter {
  static label = "PF1.SpellLevel";
  static indexField = "system.level";
  static type = "spell";

  /** @override */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.spellLevels);
  }
}
