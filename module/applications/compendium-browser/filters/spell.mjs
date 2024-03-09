import { BOOLEAN_OPERATOR, CheckboxFilter } from "./checkbox.mjs";

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
  static indexField = "system.descriptors.value";
  static type = "spell";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(pf1.config.spellDescriptors);
  }
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
    const choices = this.constructor.getChoicesFromConfig(pf1.config.spellLevels);
    choices.forEach((choice) => {
      choice.key = Number(choice.key);
    });
    this.choices = choices;
  }

  /** @override */
  applyFilter(entry) {
    const activeLearnedAtFilters = this.compendiumBrowser.filters.filter(
      (filter) => filter.active && filter.constructor.indexField.startsWith("system.learnedAt.")
    );

    // Fall back to checking whether _anything_ can learn the spell at that level
    if (activeLearnedAtFilters.length === 0) return super.applyFilter(entry);

    // Otherwise, check whether active filters match the spell's learnedAt
    const testMethod = this.booleanOperator === BOOLEAN_OPERATOR.OR ? "some" : "every";
    const activeLevelChoices = this.choices.filter((choice) => choice.active);

    // Require either any of the active filters to match if OR, or all filters to return a match if AND
    return activeLearnedAtFilters[testMethod]((filter) => {
      /** @type {Record<string, number>} */
      const learnedAt = foundry.utils.getProperty(entry, filter.constructor.indexField) ?? {};
      const activeLearnedAtChoices = filter.choices.filter((choice) => choice.active);
      // Require either one of the classes etc. to match if OR, or all classes etc. to match if AND
      return activeLearnedAtChoices[testMethod]((learnedAtChoice) => {
        const learnedAtLevel = learnedAt[learnedAtChoice.key];
        return activeLevelChoices[testMethod]((levelChoice) => levelChoice.key === learnedAtLevel);
      });
    });
  }
}
