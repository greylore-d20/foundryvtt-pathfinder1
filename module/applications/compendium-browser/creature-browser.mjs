import { CompendiumBrowser } from "./compendium-browser.mjs";
import { PackFilter } from "./filters/common.mjs";
import * as creatureFilters from "./filters/creature.mjs";

export class CreatureBrowser extends CompendiumBrowser {
  static documentName = "Actor";
  static typeName = "PF1.Creatures";
  static filterClasses = [PackFilter, creatureFilters.CreatureCRFilter];
}
