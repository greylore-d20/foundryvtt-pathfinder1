import { BaseRegistry, BaseRegistryObject } from "./base-registry.js";

export class DamageType extends BaseRegistryObject {
  /** @inheritdoc */
  static typeName = "Damage Type";

  /** @inheritdoc */
  static get _baseData() {
    return foundry.utils.mergeObject(super._baseData, {
      img: "icons/svg/explosion.svg",
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
      img: "icons/magic/control/silhouette-grow-shrink-tan.webp",
      category: "misc",
    },
    {
      _id: "slashing",
      name: "PF1.DamageTypeSlashing",
      img: "icons/skills/melee/strike-sword-steel-yellow.webp",
      category: "physical",
    },
    {
      _id: "piercing",
      name: "PF1.DamageTypePiercing",
      img: "icons/skills/ranged/arrow-flying-gray-brown.webp",
      category: "physical",
    },
    {
      _id: "bludgeoning",
      name: "PF1.DamageTypeBludgeoning",
      img: "icons/skills/melee/strike-hammer-destructive-blue.webp",
      category: "physical",
    },
    {
      _id: "fire",
      name: "PF1.DamageTypeFire",
      img: "icons/magic/fire/projectile-fireball-smoke-strong-orange.webp",
      category: "energy",
    },
    {
      _id: "cold",
      name: "PF1.DamageTypeCold",
      img: "icons/magic/water/barrier-ice-crystal-wall-faceted.webp",
      category: "energy",
    },
    {
      _id: "electric",
      name: "PF1.DamageTypeElectricity",
      img: "icons/magic/lightning/bolt-strike-blue.webp",
      category: "energy",
    },
    {
      _id: "acid",
      name: "PF1.DamageTypeAcid",
      img: "icons/magic/acid/dissolve-drip-droplet-smoke.webp",
      category: "energy",
    },
    {
      _id: "sonic",
      name: "PF1.DamageTypeSonic",
      img: "icons/magic/sonic/explosion-impact-shock-wave.webp",
      category: "energy",
    },
    {
      _id: "force",
      name: "PF1.DamageTypeForce",
      img: "icons/magic/lightning/orb-ball-purple.webp",
      category: "misc",
    },
    {
      _id: "negative",
      name: "PF1.DamageTypeNegative",
      img: "icons/magic/unholy/beam-impact-purple.webp",
      category: "misc",
    },
    {
      _id: "positive",
      name: "PF1.DamageTypePositive",
      img: "icons/magic/light/beam-explosion-orange.webp",
      category: "misc",
    },
    {
      _id: "precision",
      name: "PF1.Precision",
      img: "icons/skills/targeting/crosshair-ringed-gray.webp",
      flags: {
        modifier: true,
      },
    },
    {
      _id: "nonlethal",
      name: "PF1.Nonlethal",
      img: "icons/skills/melee/unarmed-punch-fist.webp",
      flags: {
        modifier: true,
      },
    },
  ].map((d) => ({ ...d, module: "pf1" }));
}
