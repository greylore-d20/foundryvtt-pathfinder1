import { CompendiumBrowser } from "./compendium-browser.mjs";
import * as itemFilters from "./filters/item.mjs";
import * as commonFilters from "./filters/common.mjs";

export class ItemBrowser extends CompendiumBrowser {
  static typeName = "PF1.Items";
  static filterClasses = [
    commonFilters.PackFilter,
    itemFilters.ItemTypeFilter,
    itemFilters.WeaponTypeFilter,
    itemFilters.WeaponSubtypeFilter,
    itemFilters.WeaponPropertyFilter,
    itemFilters.WeaponGroupFilter,
    itemFilters.EquipmentTypeFilter,
    itemFilters.EquipmentSubtypeFilter,
    itemFilters.ItemSlotFilter,
    itemFilters.ConsumableTypeFilter,
    itemFilters.MiscItemTypeFilter,
    itemFilters.ItemPriceFilter,
    itemFilters.ItemCasterLevelFilter,
    commonFilters.TagFilter,
  ];

  /** @override */
  static _mapEntry(entry, pack) {
    const result = super._mapEntry(entry, pack);

    // Remove equipmentSubtype if the item subtype should not have one
    const { subType, equipmentSubtype } = result.system;
    if (subType) {
      const equipmentSubtypes = Object.keys(pf1.config.equipmentTypes[subType] ?? {}).filter((o) => !o.startsWith("_"));
      if (equipmentSubtypes.length === 0) {
        // Clear equipmentSubtype if subType has no equipmentSubtypes
        result.system.equipmentSubtype = "";
      } else if (!equipmentSubtypes.includes(equipmentSubtype)) {
        // Default to first equipmentSubtype if current equipmentSubtype is invalid
        result.system.equipmentSubtype = equipmentSubtypes.at(0);
      }
    }

    return result;
  }
}
