import { Registry, RegistryEntry } from "./base-registry.mjs";

const fields = foundry.data.fields;

/**
 * A single damage type entry in the {@link DamageTypes} registry.
 *
 * @group Damage Types
 */
export class DamageType extends RegistryEntry {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      icon: new fields.StringField({ required: false, initial: "" }),
      category: new fields.StringField({
        required: true,
        blank: false,
        initial: "misc",
        choices: DamageTypes.CATEGORIES,
      }),
      isModifier: new fields.BooleanField({ required: false, initial: false }),
      color: new fields.StringField({ required: true, initial: "black" }),
    };
  }
}
/**
 * The singleton registry of damage types.
 * At runtime this registry is accessible as `pf1.registry.damageTypes`.
 *
 * @group Damage Types
 * @see {@link Registry}
 * @see {@link DamageType}
 * @augments {Registry<DamageType>}
 */
export class DamageTypes extends Registry {
  /** @inheritdoc */
  static model = DamageType;

  /**
   * An array of allowed categories of damage types.
   */
  static CATEGORIES = /** @type {const} */ (["physical", "energy", "misc"]);

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
      isModifier: true,
    },
    {
      _id: "nonlethal",
      name: "PF1.Nonlethal",
      icon: "ra ra-hand",
      isModifier: true,
    },
  ];
}

/**
 * {@inheritDoc DamageTypes}
 *
 * @group Damage Types
 * @type {DamageTypes}
 */
export let damageTypes;
