import { CompendiumBrowser } from "./compendium-browser.mjs";
import { PackFilter } from "./filters/common.mjs";
import * as featFilter from "./filters/feat.mjs";

export class FeatBrowser extends CompendiumBrowser {
  static typeName = "PF1.Feats";
  static filterClasses = [PackFilter, featFilter.FeatTypeFilter, featFilter.FeatTagFilter, featFilter.FeatClassFilter];

  /** @override */
  static _mapEntry(entry, pack) {
    const result = super._mapEntry(entry, pack);
    result.system.tags = [...new Set(entry.system.tags?.flat(2) ?? [])];
    result.system.associations.classes = [...new Set(entry.system.associations?.classes?.flat(2) ?? [])];
    return result;
  }
}
