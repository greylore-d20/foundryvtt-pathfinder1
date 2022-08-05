import { BaseRegistry, BaseRegistryObject } from "./base-registry.mjs";

export class DamageType extends BaseRegistryObject {
  /** @inheritdoc */
  static typeName = "Damage Type";

  /** @inheritdoc */
  static get _baseData() {
    return foundry.utils.mergeObject(super._baseData, {
      img: "",
      icon: "",
      color: "black",
      category: "misc",
    });
  }

  get isModifier() {
    return this.data.flags?.modifier === true;
  }
}

export class DamageTypes extends BaseRegistry {
  /** @inheritdoc */
  static contentClass = DamageType;

  /** @inheritdoc */
  static _defaultData = [
    {
      _id: "untyped",
      name: "PF1.DamageTypeUntyped",
      icon: "ra ra-uncertainty",
      category: "misc",
    },
    {
      _id: "slashing",
      name: "PF1.DamageTypeSlashing",
      icon: "ra ra-sword",
      color: "yellow",
      category: "physical",
    },
    {
      _id: "piercing",
      name: "PF1.DamageTypePiercing",
      icon: "ra ra-spear-head",
      color: "blue",
      category: "physical",
    },
    {
      _id: "bludgeoning",
      name: "PF1.DamageTypeBludgeoning",
      icon: "ra ra-large-hammer",
      color: "red",
      category: "physical",
    },
    {
      _id: "fire",
      name: "PF1.DamageTypeFire",
      icon: "ra ra-fire",
      color: "orange",
      category: "energy",
    },
    {
      _id: "cold",
      name: "PF1.DamageTypeCold",
      icon: "ra ra-frost-emblem",
      color: "aqua",
      category: "energy",
    },
    {
      _id: "electric",
      name: "PF1.DamageTypeElectricity",
      icon: "ra ra-lightning-bolt",
      color: "yellow",
      category: "energy",
    },
    {
      _id: "acid",
      name: "PF1.DamageTypeAcid",
      icon: "ra ra-acid",
      color: "lime",
      category: "energy",
    },
    {
      _id: "sonic",
      name: "PF1.DamageTypeSonic",
      icon: "ra ra-horn-call",
      color: "#00aedb",
      category: "energy",
    },
    {
      _id: "force",
      name: "PF1.DamageTypeForce",
      icon: "ra ra-doubled",
      color: "#a200ff",
      category: "misc",
    },
    {
      _id: "negative",
      name: "PF1.DamageTypeNegative",
      icon: "ra ra-skull",
      color: "#765898",
      category: "misc",
    },
    {
      _id: "positive",
      name: "PF1.DamageTypePositive",
      icon: "ra ra-sunbeams",
      color: "#f8ed62",
      category: "misc",
    },
    {
      _id: "precision",
      name: "PF1.Precision",
      icon: "ra ra-archery-target",
      flags: {
        modifier: true,
      },
    },
    {
      _id: "nonlethal",
      name: "PF1.Nonlethal",
      icon: "ra ra-hand",
      flags: {
        modifier: true,
      },
    },
  ].map((d) => ({ ...d, module: "pf1" }));
}
