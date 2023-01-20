import { CompendiumBrowser } from "./compendium-browser.mjs";
import * as itemFilters from "./filters/item.mjs";
import { PackFilter } from "./filters/common.mjs";

export class ItemBrowser extends CompendiumBrowser {
  static typeName = "PF1.Items";
  static filterClasses = [
    PackFilter,
    itemFilters.ItemTypeFilter,
    itemFilters.WeaponTypeFilter,
    itemFilters.WeaponSubtypeFilter,
    itemFilters.WeaponPropertyFilter,
    itemFilters.WeaponGroupFilter,
    itemFilters.EquipmentSubtypeFilter,
    itemFilters.ItemSlotFilter,
    itemFilters.ConsumableTypeFilter,
    itemFilters.MiscItemTypeFilter,
    itemFilters.ItemPriceFilter,
    itemFilters.ItemCasterLevelFilter,
  ];
}
