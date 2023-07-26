import { CompendiumBrowser } from "./compendium-browser.mjs";
import * as commonFilters from "./filters/common.mjs";
import * as spellFilter from "./filters/spell.mjs";

export class SpellBrowser extends CompendiumBrowser {
  static typeName = "PF1.Spells";
  static types = ["spell"];
  static filterClasses = [
    commonFilters.PackFilter,
    spellFilter.SpellSchoolFilter,
    spellFilter.SpellSubSchoolFilter,
    spellFilter.SpellDescriptorFilter,
    spellFilter.SpellLearnedByClassFilter,
    spellFilter.SpellLearnedByDomainFilter,
    spellFilter.SpellLearnedBySubdomainFilter,
    spellFilter.SpellLearnedByBloodlineFilter,
    spellFilter.SpellLevelFilter,
    commonFilters.TagFilter,
  ];
  /** @override */
  static _mapEntry(entry, pack) {
    const result = super._mapEntry(entry, pack);
    // HACK: This transforms the string into an array.
    // Tt's completely hardcoded for English; should be replaced with proper AI word recognition :)
    for (const key of ["subschool", "types"]) {
      result.system[key] =
        entry.system[key]
          ?.split(/,|\Wor\s/)
          .map((type) => {
            /** @type {string} */
            let typeString = type.trim();
            if (typeString.includes("see text")) return "see text";
            if (typeString.startsWith("or")) typeString = typeString.replace("or").trim();
            return typeString;
          })
          .filter((typeString) => typeString.length) ?? [];
    }

    /** @type {Record<string, Record<string, number>>} */
    const learnedAtData = entry.system.learnedAt ?? {};
    const learnedAtLevels = Object.values(learnedAtData)
      .map((learnedAtSource) => Object.values(learnedAtSource))
      .flat();
    if (entry.system.level) learnedAtLevels.push(entry.system.level);
    // NOTE: This results in `level` being a number[] instead of a number like in the source data.
    result.system.level = [...new Set(learnedAtLevels)];

    return result;
  }
}
