export const DefaultData_DamageTypes = [
  {
    id: "dt-untyped",
    name: "Untyped",
    img: "icons/skills/wounds/injury-body-pain-gray.webp",
    isModifier: false,
  },
  {
    id: "dt-slashing",
    name: "Slashing",
    img: "icons/weapons/axes/axe-battle-black.webp",
    isModifier: false,
  },
  {
    id: "dt-piercing",
    name: "Piercing",
    img: "icons/weapons/polearms/spear-flared-blue.webp",
    isModifier: false,
  },
  {
    id: "dr-bludgeoning",
    name: "Bludgeoning",
    img: "icons/weapons/hammers/hammer-double-steel-embossed.webp",
    isModifier: false,
  },
  {
    id: "dt-fire",
    name: "Fire",
    img: "icons/magic/fire/blast-jet-stream-splash.webp",
    isModifier: false,
  },
  {
    id: "dt-cold",
    name: "Cold",
    img: "icons/magic/water/barrier-ice-crystal-wall-faceted.webp",
    isModifier: false,
  },
  {
    id: "dt-electricity",
    name: "Electricity",
    img: "icons/magic/lightning/bolt-blue.webp",
    isModifier: false,
  },
  {
    id: "dt-acid",
    name: "Acid",
    img: "icons/magic/acid/dissolve-pool-bubbles.webp",
    isModifier: false,
  },
  {
    id: "dt-sonic",
    name: "Sonic",
    img: "icons/magic/sonic/explosion-shock-wave-teal.webp",
    isModifier: false,
  },
  {
    id: "dt-force",
    name: "Force",
    img: "icons/magic/lightning/orb-ball-purple.webp",
    isModifier: false,
  },
  {
    id: "dt-positive",
    name: "Positive Energy",
    img: "icons/magic/light/beam-strike-orange-gold.webp",
    isModifier: false,
  },
  {
    id: "dt-negative",
    name: "Negative Energy",
    img: "icons/magic/unholy/orb-rays-blue.webp",
    isModifier: false,
  },
  {
    id: "dt-precision",
    name: "Precision",
    img: "icons/skills/targeting/target-strike-gray.webp",
    isModifier: true,
  },
  {
    id: "dt-nonlethal",
    name: "Nonlethal",
    img: "icons/skills/melee/unarmed-punch-fist.webp",
    isModifier: true,
  },
];

export const DamageType_Default = function () {
  return {
    id: randomID(16),
    name: game.i18n.localize("PF1.WorldConfig.DamageType.NewName"),
    img: "icons/svg/sword.svg",
    isModifier: false,
  };
};
