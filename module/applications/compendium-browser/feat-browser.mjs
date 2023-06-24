import { CompendiumBrowser } from "./compendium-browser.mjs";
import * as commonFilters from "./filters/common.mjs";
import * as featFilter from "./filters/feat.mjs";

export class FeatBrowser extends CompendiumBrowser {
  static typeName = "PF1.Feats";
  static filterClasses = [
    commonFilters.PackFilter,
    featFilter.FeatTypeFilter,
    featFilter.FeatClassFilter,
    commonFilters.TagFilter,
  ];

  /** @override */
  static _mapEntry(entry, pack) {
    const result = super._mapEntry(entry, pack);
    result.system.associations.classes = [...new Set(result.system.associations?.classes?.flat() ?? [])];
    return result;
  }
}
