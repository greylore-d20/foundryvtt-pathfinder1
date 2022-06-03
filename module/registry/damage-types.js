import { BaseRegistryObject } from "./_base.js";

export const registerDamageTypes = function () {
  // --------------------------------------------------------- //
  // Register normal Pathfinder 1e damage types                //
  // --------------------------------------------------------- //
  // Untyped
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "untyped",
      name: "PF1.DamageTypeUntyped",
      img: "icons/magic/control/silhouette-grow-shrink-tan.webp",
      category: "misc",
    })
  );
  // Slashing
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "slashing",
      name: "PF1.DamageTypeSlashing",
      img: "icons/skills/melee/strike-sword-steel-yellow.webp",
      category: "physical",
    })
  );
  // Piercing
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "piercing",
      name: "PF1.DamageTypePiercing",
      img: "icons/skills/ranged/arrow-flying-gray-brown.webp",
      category: "physical",
    })
  );
  // Bludgeoning
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "bludgeoning",
      name: "PF1.DamageTypeBludgeoning",
      img: "icons/skills/melee/strike-hammer-destructive-blue.webp",
      category: "physical",
    })
  );

  // Fire
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "fire",
      name: "PF1.DamageTypeFire",
      img: "icons/magic/fire/projectile-fireball-smoke-strong-orange.webp",
      category: "energy",
    })
  );
  // Cold
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "cold",
      name: "PF1.DamageTypeCold",
      img: "icons/magic/water/barrier-ice-crystal-wall-faceted.webp",
      category: "energy",
    })
  );
  // Electric
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "electric",
      name: "PF1.DamageTypeElectricity",
      img: "icons/magic/lightning/bolt-strike-blue.webp",
      category: "energy",
    })
  );
  // Acid
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "acid",
      name: "PF1.DamageTypeAcid",
      img: "icons/magic/acid/dissolve-drip-droplet-smoke.webp",
      category: "energy",
    })
  );
  // Sonic
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "sonic",
      name: "PF1.DamageTypeSonic",
      img: "icons/magic/sonic/explosion-impact-shock-wave.webp",
      category: "energy",
    })
  );
  // Force
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "force",
      name: "PF1.DamageTypeForce",
      img: "icons/magic/lightning/orb-ball-purple.webp",
      category: "misc",
    })
  );
  // Negative Energy
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "negative",
      name: "PF1.DamageTypeNegative",
      img: "icons/magic/unholy/beam-impact-purple.webp",
      category: "misc",
    })
  );
  // Positive Energy
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "positive",
      name: "PF1.DamageTypePositive",
      img: "icons/magic/light/beam-explosion-orange.webp",
      category: "misc",
    })
  );

  // --------------------------------------------------------- //
  // Register normal Pathfinder 1e damage type modifiers       //
  // --------------------------------------------------------- //
  // Precision Damage
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "precision",
      name: "PF1.Precision",
      img: "icons/skills/targeting/crosshair-ringed-gray.webp",
      flags: {
        modifier: true,
      },
    })
  );
  // Nonlethal Damage
  game.pf1.registry.registerDamageType(
    "pf1",
    new DamageType({
      _id: "nonlethal",
      name: "PF1.Nonlethal",
      img: "icons/skills/melee/unarmed-punch-fist.webp",
      flags: {
        modifier: true,
      },
    })
  );

  // -------------------------------------------------------------- //
  // Call hook for module developers to register their damage types //
  // -------------------------------------------------------------- //
  Hooks.callAll("pf1.register.damageTypes");
};

export class DamageType extends BaseRegistryObject {
  static get _baseData() {
    return mergeObject(super._baseData, {
      img: "icons/svg/explosion.svg",
      category: "misc",
    });
  }

  static get typeName() {
    return "Damage Type";
  }

  get isModifier() {
    return this.data.flags?.modifier === true;
  }
}
