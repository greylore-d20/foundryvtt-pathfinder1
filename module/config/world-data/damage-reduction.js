export const DefaultData_DamageReduction = [
  {
    id: "dr-untyped",
    name: "Untyped",
    showAs: "-",
    img: "icons/skills/wounds/injury-body-pain-gray.webp",
  },
  {
    id: "dr-slashing",
    name: "Slashing",
    showAs: "",
    img: "icons/weapons/axes/axe-battle-black.webp",
  },
  {
    id: "dr-piercing",
    name: "Piercing",
    showAs: "",
    img: "icons/weapons/polearms/spear-flared-blue.webp",
  },
  {
    id: "dr-bludgeoning",
    name: "Bludgeoning",
    showAs: "",
    img: "icons/weapons/hammers/hammer-double-steel-embossed.webp",
  },
  {
    id: "dr-magic",
    name: "Magic",
    showAs: "",
    img: "icons/magic/lightning/orb-ball-purple.webp",
  },
  {
    id: "dr-coldiron",
    name: "Cold Iron",
    showAs: "",
    img: "icons/commodities/metal/ingot-worn-steel.webp",
  },
  {
    id: "dr-silver",
    name: "Silver",
    showAs: "",
    img: "icons/commodities/metal/ingot-engraved-silver.webp",
  },
  {
    id: "dr-adamantine",
    name: "Adamantine",
    showAs: "",
    img: "icons/commodities/metal/ingot-stamped-purple.webp",
  },
  {
    id: "dr-good",
    name: "Good",
    showAs: "",
    img: "icons/magic/holy/angel-winged-humanoid-blue.webp",
  },
  {
    id: "dr-evil",
    name: "Evil",
    showAs: "",
    img: "icons/magic/unholy/hand-claw-glow-orange.webp",
  },
  {
    id: "dr-lawful",
    name: "Lawful",
    showAs: "",
    img: "icons/magic/symbols/cog-shield-white-blue.webp",
  },
  {
    id: "dr-chaotic",
    name: "Chaotic",
    showAs: "",
    img: "icons/magic/fire/projectile-fireball-purple.webp",
  },
  {
    id: "dr-epic",
    name: "Epic",
    showAs: "",
    img: "icons/magic/movement/trail-streak-pink.webp",
  },
];

export const DamageReduction_Default = function () {
  return {
    id: randomID(16),
    name: game.i18n.localize("PF1.WorldConfig.DR.NewName"),
    showAs: "",
    img: "icons/svg/statue.svg",
  };
};
