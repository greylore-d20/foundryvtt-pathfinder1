import { BaseRegistryObject } from "./_base.js";

export const registerDamageTypes = function () {
  const cls = game.pf1.documentComponents.DamageType;
  // --------------------------------------------------------- //
  // Register normal Pathfinder 1e damage types                //
  // --------------------------------------------------------- //
  // Slashing
  game.pf1.registry.registerDamageType(
    "pf1",
    new cls({
      _id: "slashing",
      name: "PF1.DamageTypeSlashing",
      img: "icons/skills/melee/strike-sword-gray.webp",
    })
  );
  // Piercing
  game.pf1.registry.registerDamageType(
    "pf1",
    new cls({
      _id: "piercing",
      name: "PF1.DamageTypePiercing",
      img: "icons/skills/ranged/arrow-flying-gray-brown.webp",
    })
  );
  // Bludgeoning
  game.pf1.registry.registerDamageType(
    "pf1",
    new cls({
      _id: "bludgeoning",
      name: "PF1.DamageTypeBludgeoning",
      img: "icons/skills/melee/strike-hammer-destructive-blue.webp",
    })
  );

  // Fire
  game.pf1.registry.registerDamageType(
    "pf1",
    new cls({
      _id: "fire",
      name: "PF1.DamageTypeFire",
      img: "icons/magic/fire/projectile-fireball-smoke-strong-orange.webp",
    })
  );
  // Cold
  game.pf1.registry.registerDamageType(
    "pf1",
    new cls({
      _id: "cold",
      name: "PF1.DamageTypeCold",
      img: "icons/magic/water/barrier-ice-crystal-wall-faceted.webp",
    })
  );
  // Electric
  game.pf1.registry.registerDamageType(
    "pf1",
    new cls({
      _id: "electric",
      name: "PF1.DamageTypeElectricity",
      img: "icons/magic/lightning/bolt-strike-blue.webp",
    })
  );
  // Acid
  game.pf1.registry.registerDamageType(
    "pf1",
    new cls({
      _id: "acid",
      name: "PF1.DamageTypeAcid",
      img: "icons/magic/acid/dissolve-drip-droplet-smoke.webp",
    })
  );
  // Sonic
  game.pf1.registry.registerDamageType(
    "pf1",
    new cls({
      _id: "sonic",
      name: "PF1.DamageTypeSonic",
      img: "icons/magic/sonic/explosion-impact-shock-wave.webp",
    })
  );
  // Force
  game.pf1.registry.registerDamageType(
    "pf1",
    new cls({
      _id: "force",
      name: "PF1.DamageTypeForce",
      img: "icons/magic/lightning/orb-ball-purple.webp",
    })
  );
  // Negative Energy
  game.pf1.registry.registerDamageType(
    "pf1",
    new cls({
      _id: "negative",
      name: "PF1.DamageTypeNegative",
      img: "icons/magic/unholy/beam-impact-purple.webp",
    })
  );
  // Positive Energy
  game.pf1.registry.registerDamageType(
    "pf1",
    new cls({
      _id: "positive",
      name: "PF1.DamageTypePositive",
      img: "icons/magic/light/beam-explosion-orange.webp",
    })
  );

  // --------------------------------------------------------- //
  // Register normal Pathfinder 1e damage type modifiers       //
  // --------------------------------------------------------- //
  // Precision Damage
  game.pf1.registry.registerDamageType(
    "pf1",
    new cls({
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
    new cls({
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
  static get _baseSource() {
    return mergeObject(super._baseSource, {
      img: "icons/svg/explosion.svg",
    });
  }

  static get name() {
    return "Damage Type";
  }

  get isModifier() {
    return this._source.flags?.modifier === true;
  }
}
