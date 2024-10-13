import { CompendiumBrowser } from "./compendium-browser.mjs";
import * as commonFilters from "./filters/common.mjs";
import * as spellFilter from "./filters/spell.mjs";

export class SpellBrowser extends CompendiumBrowser {
  static typeName = "PF1.Spells";
  static types = ["spell"];
  static filterClasses = [
    commonFilters.PackFilter,
    spellFilter.SpellSchoolFilter,
    spellFilter.SpellSubschoolFilter,
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

    const and = game.i18n.localize("PF1.JoinAnd");
    const or = game.i18n.localize("PF1.JoinOr");
    const seeText = game.i18n.localize("PF1.SeeText").toLocaleLowerCase();

    const prepareTrait = (systemPath, configPath) => {
      const value = entry.system[systemPath]?.value ?? [];
      const custom = (entry.system[systemPath]?.custom ?? [])
        .flatMap((c) =>
          c?.split(/,|\bor\b/).map((type) => {
            /** @type {string} */
            let typeString = type.trim();
            if (typeString.toLocaleLowerCase().includes(seeText)) return seeText;
            if (typeString.startsWith(and)) typeString = typeString.replace(and).trim();
            if (typeString.startsWith(or)) typeString = typeString.replace(or).trim();
            return typeString;
          })
        )
        .filter((typeString) => typeString?.length);

      const values = [...value, ...custom].map((key) => {
        const entries = Object.entries(pf1.config[configPath]);
        const match = entries.find(([k, v]) => k === key || v === key);
        return match?.[0] ?? key;
      });
      result.system[systemPath] = [...new Set(values)];
    };

    prepareTrait("descriptors", "spellDescriptors");
    prepareTrait("subschool", "spellSubschools");

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
