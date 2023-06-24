import { CompendiumBrowser } from "./compendium-browser.mjs";
import * as commonFilters from "./filters/common.mjs";
import * as raceFilters from "./filters/race.mjs";

export class RaceBrowser extends CompendiumBrowser {
  static typeName = "PF1.Races";
  static filterClasses = [
    commonFilters.PackFilter,
    raceFilters.CreatureTypeFilter,
    raceFilters.CreatureSubTypeFilter,
    commonFilters.TagFilter,
  ];
}
