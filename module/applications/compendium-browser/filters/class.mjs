import { CheckboxFilter } from "./checkbox.mjs";

export class ClassTypeFilter extends CheckboxFilter {
  static label = "PF1.ClassType";
  static type = "class";
  static indexField = "system.subType";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(pf1.config.classTypes);
  }
}

export class ClassHitDieFilter extends CheckboxFilter {
  static label = "PF1.HitDie";
  static type = "class";
  static indexField = "system.hd";
}

export class ClassBaseAttackBonusFilter extends CheckboxFilter {
  static label = "PF1.BAB";
  static type = "class";
  static indexField = "system.bab";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(pf1.config.classBAB);
  }
}

export class ClassSkillPointsFilter extends CheckboxFilter {
  static label = "PF1.SkillsPerLevel";
  static type = "class";
  static indexField = "system.skillsPerLevel";
}

class ClassSavingThrowFilter extends CheckboxFilter {
  static type = "class";
  static savingThrow = "";
  static get label() {
    return pf1.config.savingThrows[this.savingThrow] ?? "";
  }
  static get indexField() {
    return `system.savingThrows.${this.savingThrow}.value`;
  }

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(pf1.config.classSavingThrows);
    this.choices.set("none", { label: game.i18n.localize("PF1.None"), key: "none" });
  }

  /** @inheritDoc */
  applyFilter(entry) {
    const result = super.applyFilter(entry);
    const value = foundry.utils.getProperty(entry, this.constructor.indexField);
    const noneFilterResult = this.choices.get("none").active && value === "";
    return result || noneFilterResult;
  }
}

export class ClassFortitudeFilter extends ClassSavingThrowFilter {
  static savingThrow = "fort";
}

export class ClassReflexFilter extends ClassSavingThrowFilter {
  static savingThrow = "ref";
}

export class ClassWillFilter extends ClassSavingThrowFilter {
  static savingThrow = "will";
}
