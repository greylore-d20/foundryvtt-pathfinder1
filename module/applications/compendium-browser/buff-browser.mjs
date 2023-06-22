import { CompendiumBrowser } from "./compendium-browser.mjs";
import * as commonFilters from "./filters/common.mjs";
import * as buffFilters from "./filters/buff.mjs";

export class BuffBrowser extends CompendiumBrowser {
  static documentName = "Item";
  static typeName = "PF1.Buffs";
  static filterClasses = [commonFilters.PackFilter, buffFilters.BuffTypeFilter, commonFilters.TagFilter];
}
