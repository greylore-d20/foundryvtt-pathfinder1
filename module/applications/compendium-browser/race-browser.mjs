import { CompendiumBrowser } from "./compendium-browser.mjs";
import { PackFilter } from "./filters/common.mjs";
import * as raceFilters from "./filters/race.mjs";

export class RaceBrowser extends CompendiumBrowser {
  static typeName = "PF1.Races";
  static filterClasses = [PackFilter, raceFilters.CreatureTypeFilter, raceFilters.CreatureSubTypeFilter];

  static _mapEntry(entry, pack) {
    const result = super._mapEntry(entry, pack);
    result.system.subTypes = [...new Set(entry.system.subTypes.flat())];
    return result;
  }
}
