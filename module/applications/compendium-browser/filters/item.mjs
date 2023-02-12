import { PF1 } from "@config";
import { CheckboxFilter } from "./checkbox.mjs";
import { NumberRangeFilter } from "./number-range.mjs";

export class ItemTypeFilter extends CheckboxFilter {
  static label = "PF1.Type";
  static indexField = "type";
  static types = ["weapon", "equipment", "consumable", "container", "loot"];

  /** @inheritDoc */
  prepareChoices() {
    this.choices = new foundry.utils.Collection(
      [
        { key: "weapon", label: game.i18n.localize("PF1.ItemTypeWeapon") },
        { key: "equipment", label: game.i18n.localize("PF1.ItemTypeEquipment") },
        { key: "consumable", label: game.i18n.localize("PF1.ItemTypeConsumable") },
        { key: "container", label: game.i18n.localize("ITEM.TypeContainer") },
        { key: "loot", label: game.i18n.localize("PF1.Misc") },
      ].map((choice) => [choice.key, choice])
    );
  }
}

export class WeaponTypeFilter extends CheckboxFilter {
  static label = "PF1.WeaponType";
  static indexField = "system.subType";
  static type = "weapon";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.weaponTypes);
  }
}

export class WeaponSubtypeFilter extends CheckboxFilter {
  static label = "PF1.WeaponSubtype";
  static indexField = "system.weaponSubtype";
  static type = "weapon";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.weaponTypes, { innerSet: true });
  }
}

export class WeaponPropertyFilter extends CheckboxFilter {
  static label = "PF1.WeaponProperties";
  static indexField = "system.properties";
  static type = "weapon";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.weaponProperties);
  }
}

export class WeaponGroupFilter extends CheckboxFilter {
  static label = "PF1.WeaponGroups";
  static indexField = "system.weaponGroups.value";
  static type = "weapon";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.weaponGroups);
  }
}

export class EquipmentSubtypeFilter extends CheckboxFilter {
  static label = "PF1.EquipmentSubtype";
  static indexField = "system.equipmentSubtype";
  static type = "equipment";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.equipmentTypes, { innerSet: true });
  }
}

export class ItemSlotFilter extends CheckboxFilter {
  static label = "PF1.Slot";
  static indexField = "system.slot";
  static type = "equipment";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.equipmentSlots, { innerSet: true });
  }
}

export class ConsumableTypeFilter extends CheckboxFilter {
  static label = "PF1.ConsumableType";
  static indexField = "system.subType";
  static type = "consumable";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.consumableTypes);
  }
}

export class MiscItemTypeFilter extends CheckboxFilter {
  static label = "PF1.Misc";
  static indexField = "system.subType";
  static type = "loot";

  /** @inheritDoc */
  prepareChoices() {
    this.choices = this.constructor.getChoicesFromConfig(PF1.lootTypes);
  }
}

export class ItemPriceFilter extends NumberRangeFilter {
  static label = "PF1.Price";
  static indexField = "system.price";
}

export class ItemCasterLevelFilter extends NumberRangeFilter {
  static label = "PF1.CasterLevel";
  static indexField = "system.cl";
}
