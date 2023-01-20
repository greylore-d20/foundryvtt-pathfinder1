import { CompendiumBrowser } from "./compendium-browser.mjs";
import { PackFilter } from "./filters/common.mjs";
import * as classFilters from "./filters/class.mjs";

export class ClassBrowser extends CompendiumBrowser {
  static typeName = "PF1.Classes";
  static filterClasses = [
    PackFilter,
    classFilters.ClassTypeFilter,
    classFilters.ClassHitDieFilter,
    classFilters.ClassBaseAttackBonusFilter,
    classFilters.ClassSkillPointsFilter,
    classFilters.ClassFortitudeFilter,
    classFilters.ClassReflexFilter,
    classFilters.ClassWillFilter,
  ];
}
