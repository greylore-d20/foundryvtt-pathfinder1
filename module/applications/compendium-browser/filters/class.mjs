import { PF1 } from "@config";
import { BaseFilter } from "./base.mjs";

export class ClassTypeFilter extends BaseFilter {
  static label = "PF1.ClassType";
  static type = "class";
  static indexField = "system.subType";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.classTypes);
  }
}

export class ClassHitDieFilter extends BaseFilter {
  static label = "PF1.HitDie";
  static type = "class";
  static indexField = "system.hd";
}

export class ClassBaseAttackBonusFilter extends BaseFilter {
  static label = "PF1.BAB";
  static type = "class";
  static indexField = "system.bab";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.classBAB);
  }
}

export class ClassSkillPointsFilter extends BaseFilter {
  static label = "PF1.SkillsPerLevel";
  static type = "class";
  static indexField = "system.skillsPerLevel";
}

class ClassSavingThrowFilter extends BaseFilter {
  static type = "class";
  static savingThrow = "";
  static get label() {
    return PF1.savingThrows[this.savingThrow] ?? "";
  }
  static get indexField() {
    return `system.savingThrows.${this.savingThrow}.value`;
  }

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.classSavingThrows);
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
