/**
 * PF1 Configuration Values
 *
 * A dictionary of dictionaries providing configuration data like formulae,
 * translation keys, and other configuration values. Translations keys are
 * assumed to get replaced by their proper translation when the system is loaded.
 *
 * The PF1 object may be adjusted to influence the system's behaviour during runtime.
 * It is available as `pf1.config` as well as through `CONFIG.PF1`.
 *
 * @module
 */
export const re = {
  traitSeparator: /\s*[;]\s*/g,
};

/**
 * The set of Ability Scores used within the system
 *
 * @enum {string}
 */
export const abilities = {
  str: "PF1.AbilityStr",
  dex: "PF1.AbilityDex",
  con: "PF1.AbilityCon",
  int: "PF1.AbilityInt",
  wis: "PF1.AbilityWis",
  cha: "PF1.AbilityCha",
};

/**
 * The set of Ability Scores used within the system in short form
 */
export const abilitiesShort = {
  str: "PF1.AbilityShortStr",
  dex: "PF1.AbilityShortDex",
  con: "PF1.AbilityShortCon",
  int: "PF1.AbilityShortInt",
  wis: "PF1.AbilityShortWis",
  cha: "PF1.AbilityShortCha",
};

/**
 * The point cost to increase an ability score using Point Buy
 */
export const abilityCost = {
  7: -4,
  8: -2,
  9: -1,
  10: 0,
  11: 1,
  12: 2,
  13: 3,
  14: 5,
  15: 7,
  16: 10,
  17: 13,
  18: 17,
};

/**
 * Point buy calculator.
 */
export const pointBuy = {
  low: { label: "PF1.PointBuyCalculatorLowFantasy", points: 10 },
  standard: { label: "PF1.PointBuyCalculatorStandardFantasy", points: 15 },
  high: { label: "PF1.PointBuyCalculatorHighFantasy", points: 20 },
  epic: { label: "PF1.PointBuyCalculatorEpicFantasy", points: 25 },
};

/**
 * At which levels you receive how many new ability points.
 */
export const levelAbilityScores = {
  4: 1,
  8: 1,
  12: 1,
  16: 1,
  20: 1,
};

/**
 * Valid hit die sizes.
 */
export const hitDieSizes = [6, 8, 10, 12];

/**
 * Data for the feature associated with ability scores gained from leveling.
 */
export const levelAbilityScoreFeature = {
  img: "systems/pf1/icons/skills/affliction_10.jpg",
  name: "PF1.LevelUp.AbilityScore.Item.Name",
  system: {
    description: {
      value: "PF1.LevelUp.AbilityScore.Item.Desc",
    },
    subType: "misc",
  },
  type: "feat",
};

/**
 * The set of Saving Throws
 */
export const savingThrows = {
  fort: "PF1.SavingThrowFort",
  ref: "PF1.SavingThrowRef",
  will: "PF1.SavingThrowWill",
};

/**
 * The types of classes
 */
export const classTypes = {
  base: "PF1.Subtypes.Item.class.base.Single",
  prestige: "PF1.Subtypes.Item.class.prestige.Single",
  npc: "PF1.Subtypes.Item.class.npc.Single",
  racial: "PF1.Subtypes.Item.class.racial.Single",
  mythic: "PF1.Subtypes.Item.class.mythic.Single",
};

/**
 * Valid options for a class's BAB progression
 */
export const classBAB = {
  low: "PF1.Low",
  med: "PF1.Medium",
  high: "PF1.High",
  custom: "PF1.Custom",
};

/**
 * Valid options for a class's saving throw bonus progression
 */
export const classSavingThrows = {
  low: "PF1.Poor",
  high: "PF1.Good",
  custom: "PF1.Custom",
};

/**
 * The formulae for BAB progressions
 */
export const classBABFormulas = {
  low: "floor(@hitDice * 0.5)",
  med: "floor(@hitDice * 0.75)",
  high: "@hitDice",
  custom: "0",
};

export const classFractionalBABFormulas = {
  low: "@hitDice * 0.5", // 1/2
  med: "@hitDice * 0.75", // 3/4
  high: "@hitDice", // 1/1
  custom: "0",
};

/**
 * The formulae for saving throw progressions by class type
 */
export const classSavingThrowFormulas = {
  base: {
    low: "floor(@hitDice / 3)",
    high: "2 + floor(@hitDice / 2)",
  },
  prestige: {
    low: "floor((1 + @hitDice) / 3)",
    high: "floor((1 + @hitDice) / 2)",
  },
  npc: {
    low: "floor(@hitDice / 3)",
    high: "2 + floor(@hitDice / 2)",
  },
  racial: {
    low: "floor(@hitDice / 3)",
    high: "2 + floor(@hitDice / 2)",
  },
  mythic: {
    low: "0",
    high: "0",
  },
  custom: {
    low: "0",
    high: "0",
  },
};
export const classFractionalSavingThrowFormulas = {
  goodSaveBonus: "2",
  base: {
    low: "@hitDice / 3",
    high: "@hitDice / 2",
    goodSave: true,
  },
  prestige: {
    low: "@hitDice / 3",
    high: "@hitDice / 2",
    goodSave: true,
  },
  npc: {
    low: "@hitDice / 3",
    high: "@hitDice / 2",
    goodSave: true,
  },
  racial: {
    low: "@hitDice / 3",
    high: "@hitDice / 2",
    goodSave: true,
  },
  mythic: {
    low: "0",
    high: "0",
  },
  custom: {
    low: "0",
    high: "0",
  },
};

/**
 * Item types that can have class associations.
 *
 * TODO: Move this to item metadata.
 */
export const classAssociations = ["feat", "attack"];

/**
 * The choices available for favored class bonuses
 */
export const favouredClassBonuses = {
  hp: "PF1.FavouredClassHP",
  skill: "PF1.FavouredClassSkill",
  alt: "PF1.FavouredClassAlt",
};

/**
 * Icons used for favored class bonus choices
 */
export const favouredClassBonusIcons = {
  hp: "fa-heartbeat",
  skill: "fa-wrench",
  alt: "fa-tag",
};

/**
 * The set of Armor Classes
 */
export const ac = {
  normal: "PF1.ACNormal",
  touch: "PF1.ACTouch",
  flatFooted: "PF1.ACFlatFooted",
};

/* -------------------------------------------- */

/**
 * Character alignment options
 */
export const alignments = {
  lg: "PF1.AlignmentLG",
  ng: "PF1.AlignmentNG",
  cg: "PF1.AlignmentCG",
  ln: "PF1.AlignmentLN",
  tn: "PF1.AlignmentTN",
  cn: "PF1.AlignmentCN",
  le: "PF1.AlignmentLE",
  ne: "PF1.AlignmentNE",
  ce: "PF1.AlignmentCE",
};

/**
 * Character alignment options in their short form
 */
export const alignmentsShort = {
  lg: "PF1.AlignmentShortLG",
  ng: "PF1.AlignmentShortNG",
  cg: "PF1.AlignmentShortCG",
  ln: "PF1.AlignmentShortLN",
  tn: "PF1.AlignmentShortTN",
  cn: "PF1.AlignmentShortCN",
  le: "PF1.AlignmentShortLE",
  ne: "PF1.AlignmentShortNE",
  ce: "PF1.AlignmentShortCE",
};

/**
 * Extra damage reduction types
 *
 * @alpha
 */
export const damageResistances = {
  magic: "PF1.DamageResistance.magic",
  epic: "PF1.DamageResistance.epic",
  lawful: "PF1.AlignmentL",
  chaotic: "PF1.AlignmentC",
  good: "PF1.AlignmentG",
  evil: "PF1.AlignmentE",
};

/* -------------------------------------------- */

/**
 * The set of Armor Proficiencies which a character may have
 */
export const armorProficiencies = {
  lgt: "PF1.ArmorProfLight",
  med: "PF1.ArmorProfMedium",
  hvy: "PF1.ArmorProfHeavy",
  shl: "PF1.ArmorProfShield",
  twr: "PF1.ArmorProfTowerShield",
};

/**
 * The set of broad Weapon Proficiencies a character may have
 */
export const weaponProficiencies = {
  simple: "PF1.WeaponProfSimple",
  martial: "PF1.WeaponProfMartial",
};

/* -------------------------------------------- */

/**
 * This describes the ways that an ability can be activated.
 */
export const abilityActivationTypes = {
  nonaction: "PF1.Activation.nonaction.Single",
  passive: "PF1.Activation.passive.Single",
  free: "PF1.Activation.free.Single",
  swift: "PF1.Activation.swift.Single",
  immediate: "PF1.Activation.immediate.Single",
  move: "PF1.Activation.move.Single",
  standard: "PF1.Activation.standard.Single",
  full: "PF1.Activation.fullRound.Single",
  attack: "PF1.Activation.attack.Single",
  aoo: "PF1.Activation.aoo.Single",
  round: "PF1.Activation.round.Single",
  minute: "PF1.Activation.minute.Single",
  hour: "PF1.Activation.hour.Single",
  special: "PF1.Activation.special.Single",
};

/**
 * This describes plurals for activation types.
 */
export const abilityActivationTypesPlurals = {
  free: "PF1.Activation.free.Plural",
  swift: "PF1.Activation.swift.Plural",
  immediate: "PF1.Activation.immediate.Plural",
  move: "PF1.Activation.move.Plural",
  standard: "PF1.Activation.standard.Plural",
  full: "PF1.Activation.fullRound.Plural",
  attack: "PF1.Activation.attack.Plural",
  round: "PF1.Activation.round.Plural",
  minute: "PF1.Activation.minute.Plural",
  hour: "PF1.Activation.hour.Plural",
};

/**
 * This describes the ways that an ability can be activated when using
 * Unchained rules.
 */
export const abilityActivationTypes_unchained = {
  nonaction: "PF1.Activation.nonaction.Single",
  passive: "PF1.Activation.passive.Single",
  free: "PF1.Activation.free.Single",
  reaction: "PF1.Activation.reaction.Single",
  action: "PF1.Activation.action.Single",
  attack: "PF1.Activation.attack.Single",
  aoo: "PF1.Activation.aoo.Single",
  minute: "PF1.Activation.minute.Single",
  hour: "PF1.Activation.hour.Single",
  special: "PF1.Activation.special.Single",
};

/**
 * This describes plurals for the ways that an ability can be activated when
 * using Unchained rules.
 */
export const abilityActivationTypesPlurals_unchained = {
  passive: "PF1.Activation.passive.Plural",
  free: "PF1.Activation.free.Plural",
  reaction: "PF1.Activation.reaction.Plural",
  action: "PF1.Activation.action.Plural",
  minute: "PF1.Activation.minute.Plural",
  hour: "PF1.Activation.hour.Plural",
  special: "PF1.Activation.special.Plural",
};

/**
 * The possible conditions when using Wound Threshold rules
 */
export const woundThresholdConditions = {
  0: "PF1.WoundLevelHealthy",
  1: "PF1.WoundLevelGrazed",
  2: "PF1.WoundLevelWounded",
  3: "PF1.WoundLevelCritical",
};

/**
 * Change targets affected by Wound Thresholds.
 */
export const woundThresholdChangeTargets = ["~attackCore", "cmd", "allSavingThrows", "ac", "~skillMods", "allChecks"];

export const divineFocus = {
  0: "",
  1: "PF1.SpellComponents.DFVariants.DF",
  2: "PF1.SpellComponents.DFVariants.MDF",
  3: "PF1.SpellComponents.DFVariants.FDF",
};

/**
 * The measure template types available for actions.
 *
 * They're the same as Foundry's measure templates, so it's copy of CONFIG.MeasuredTemplate.types.
 *
 * @deprecated - Use `CONFIG.MeasuredTemplate.types` instead.
 */
export const measureTemplateTypes = CONFIG.MeasuredTemplate.types;

/* -------------------------------------------- */

/**
 * The possible creature sizes
 */
export const actorSizes = {
  fine: "PF1.ActorSize.fine",
  dim: "PF1.ActorSize.dim",
  tiny: "PF1.ActorSize.tiny",
  sm: "PF1.ActorSize.sm",
  med: "PF1.ActorSize.med",
  lg: "PF1.ActorSize.lg",
  huge: "PF1.ActorSize.huge",
  grg: "PF1.ActorSize.grg",
  col: "PF1.ActorSize.col",
};

/**
 * Armor & shield cost multipliers for different creature sizes.
 *
 * @see https://aonprd.com/Rules.aspx?Name=Armor%20for%20Unusual%20Creatures&Category=Armor
 */
export const armorCost = {
  humanoid: {
    fine: 0.5,
    dim: 0.5,
    tiny: 0.5,
    sm: 1,
    med: 1,
    lg: 2,
    huge: 4,
    grg: 8,
    col: 16,
  },
  nonhumanoid: {
    fine: 1,
    dim: 1,
    tiny: 1,
    sm: 2,
    med: 2,
    lg: 4,
    huge: 8,
    grg: 16,
    col: 32,
  },
};

/**
 * Armor weight multipliers for different creature sizes.
 *
 * The values are same for both humanoid and non-humanoid.
 *
 * @see https://aonprd.com/Rules.aspx?Name=Armor%20for%20Unusual%20Creatures&Category=Armor
 */
export const armorWeight = {
  fine: 0.1,
  dim: 0.1,
  tiny: 0.1,
  sm: 0.5,
  med: 1,
  lg: 2,
  huge: 5,
  grg: 8,
  col: 12,
};

/**
 * The possible creature sizes in their one-letter form
 */
export const sizeChart = {
  fine: "F",
  dim: "D",
  tiny: "T",
  sm: "S",
  med: "M",
  lg: "L",
  huge: "H",
  grg: "G",
  col: "C",
};

/**
 * @typedef {object} TokenSize
 * @property {number} w - Width, in cells
 * @property {number} h - Height, in cells
 * @property {number} scale - Scale ratio
 */

/**
 * The size values for Tokens according to the creature's size
 *
 * @type {Record<string,TokenSize>}
 */
export const tokenSizes = {
  fine: { w: 1, h: 1, scale: 0.45 },
  dim: { w: 1, h: 1, scale: 0.6 },
  tiny: { w: 1, h: 1, scale: 0.75 },
  sm: { w: 1, h: 1, scale: 0.9 },
  med: { w: 1, h: 1, scale: 1 },
  lg: { w: 2, h: 2, scale: 1 },
  huge: { w: 3, h: 3, scale: 1 },
  grg: { w: 4, h: 4, scale: 1 },
  col: { w: 6, h: 6, scale: 1 },
};

/**
 * The size modifier applied to creatures not of medium size
 */
export const sizeMods = {
  fine: 8,
  dim: 4,
  tiny: 2,
  sm: 1,
  med: 0,
  lg: -1,
  huge: -2,
  grg: -4,
  col: -8,
};

/**
 * The size modifier applied to creatures not of medium size
 */
export const sizeSpecialMods = {
  fine: -8,
  dim: -4,
  tiny: -2,
  sm: -1,
  med: 0,
  lg: 1,
  huge: 2,
  grg: 4,
  col: 8,
};

/**
 * The size modifier applied to fly checks of creatures not of medium size
 */
export const sizeFlyMods = {
  fine: 8,
  dim: 6,
  tiny: 4,
  sm: 2,
  med: 0,
  lg: -2,
  huge: -4,
  grg: -6,
  col: -8,
};

/**
 * The size modifier applied to stealth checks of creatures not of medium size
 */
export const sizeStealthMods = {
  fine: 16,
  dim: 12,
  tiny: 8,
  sm: 4,
  med: 0,
  lg: -4,
  huge: -8,
  grg: -12,
  col: -16,
};

/**
 * Vehicle properties based on size and type
 */
export const vehicles = {
  size: {
    lg: {
      label: "PF1.ActorSize.lg",
      space: "PF1.Vehicles.Space.Large",
    },
    huge: {
      label: "PF1.ActorSize.huge",
      space: "PF1.Vehicles.Space.Huge",
    },
    grg: {
      label: "PF1.ActorSize.grg",
      space: "PF1.Vehicles.Space.Gargantuan",
    },
    col: {
      label: "PF1.ActorSize.col",
      space: "PF1.Vehicles.Space.Colossal",
    },
  },
  type: {
    land: "PF1.Vehicles.Types.Land",
    sea: "PF1.Vehicles.Types.Sea",
    air: "PF1.Vehicles.Types.Air",
  },
};

/**
 * The possible options for a creature's maneuverability
 */
export const flyManeuverabilities = {
  clumsy: "PF1.Movement.FlyManeuverability.Quality.clumsy",
  poor: "PF1.Movement.FlyManeuverability.Quality.poor",
  average: "PF1.Movement.FlyManeuverability.Quality.average",
  good: "PF1.Movement.FlyManeuverability.Quality.good",
  perfect: "PF1.Movement.FlyManeuverability.Quality.perfect",
};

/**
 * The bonus values for a creature's maneuverability
 */
export const flyManeuverabilityValues = {
  clumsy: -8,
  poor: -4,
  average: 0,
  good: 4,
  perfect: 8,
};

/**
 * Overland speeds
 */
export const overlandSpeed = {
  imperial: {
    // Default
    // 1 mi per 10 ft
    default: {
      per: 10,
      out: 1,
      unit: "mi",
    },
  },
  metric: {
    // Metric system, used by German translation
    // 1.5 km per 3 m
    rounded: {
      per: 3,
      out: 1.5,
      unit: "km",
    },
    // Exact metric system, used by Spanish translation
    // 1.6 km per 3 m
    exact: {
      per: 3,
      out: 1.6,
      unit: "km",
    },
  },
};

/* -------------------------------------------- */

/**
 * An array of maximum carry capacities, where the index is the ability/strength score.
 */
// prettier-ignore
export const encumbranceLoads = [
  0,
  10,
  20,
  30,
  40,
  50,
  60,
  70,
  80,
  90,
  100,
  115,
  130,
  150,
  175,
  200,
  230,
  260,
  300,
  350,
  400,
  460,
  520,
  600,
  700,
  800,
  920,
  1040,
  1200,
  1400,
  1600,
];

/**
 * Encumbrance levels for light, medium, and heavy loads.
 *
 * @see {@link ActorPF._computeEncumbrance ActorPF.system.encumbrance.level}
 * @readonly
 * @enum {number}
 */
export const encumbranceLevels = {
  light: 0,
  medium: 1,
  heavy: 2,
};

/**
 * Encumbrance multipliers applied due to a creature's size for bi- and
 * quadrupedal creatures.
 */
export const encumbranceMultipliers = {
  normal: {
    fine: 0.125,
    dim: 0.25,
    tiny: 0.5,
    sm: 0.75,
    med: 1,
    lg: 2,
    huge: 4,
    grg: 8,
    col: 16,
  },
  quadruped: {
    fine: 0.25,
    dim: 0.5,
    tiny: 0.75,
    sm: 1,
    med: 1.5,
    lg: 3,
    huge: 6,
    grg: 12,
    col: 24,
  },
};

/**
 * Damage multipliers from ability score.
 */
export const abilityDamageMultipliers = [
  { value: 0.5, label: "×0.5" },
  { value: 1, label: "×1" },
  { value: 1.5, label: "×1.5" },
  { value: 2, label: "×2" },
  { value: 2.5, label: "×2.5" },
];

/* -------------------------------------------- */

/**
 * Classification types for item action types
 */
export const itemActionTypes = {
  mwak: "PF1.ActionTypes.mwak",
  rwak: "PF1.ActionTypes.rwak",
  twak: "PF1.ActionTypes.twak",
  msak: "PF1.ActionTypes.msak",
  rsak: "PF1.ActionTypes.rsak",
  mcman: "PF1.ActionTypes.mcman",
  rcman: "PF1.ActionTypes.rcman",
  spellsave: "PF1.ActionTypes.spellSave",
  save: "PF1.ActionTypes.save",
  heal: "PF1.ActionTypes.heal",
  other: "PF1.ActionTypes.other",
};

/* -------------------------------------------- */

/**
 * Enumerate the lengths of time over which an item can have limited use ability
 */
export const limitedUsePeriods = {
  single: "PF1.LimitedUses.Periods.single",
  day: "PF1.LimitedUses.Periods.day",
  week: "PF1.LimitedUses.Periods.week",
  charges: "PF1.LimitedUses.Periods.charges",
};

/* -------------------------------------------- */

/**
 * The various equipment types and their subtypes
 */
export const equipmentTypes = {
  armor: {
    _label: "PF1.Subtypes.Item.equipment.armor.Single",
    lightArmor: "PF1.EquipTypeLight",
    mediumArmor: "PF1.EquipTypeMedium",
    heavyArmor: "PF1.EquipTypeHeavy",
  },
  shield: {
    _label: "PF1.Subtypes.Item.equipment.shield.Single",
    lightShield: "PF1.EquipTypeLightShield",
    heavyShield: "PF1.EquipTypeHeavyShield",
    towerShield: "PF1.EquipTypeTowerShield",
    other: "PF1.EquipTypeOtherShield",
  },
  wondrous: {
    _label: "PF1.Subtypes.Item.equipment.wondrous.Single",
  },
  clothing: {
    _label: "PF1.Subtypes.Item.equipment.clothing.Single",
  },
  other: {
    _label: "PF1.Other",
  },
};

/**
 * The slots equipment can occupy, sorted by category
 */
export const equipmentSlots = {
  armor: {
    armor: "PF1.EquipSlots.armor",
  },
  shield: {
    shield: "PF1.EquipSlots.shield",
  },
  wondrous: {
    slotless: "PF1.EquipSlots.none",
    head: "PF1.EquipSlots.head",
    headband: "PF1.EquipSlots.headband",
    eyes: "PF1.EquipSlots.eyes",
    shoulders: "PF1.EquipSlots.shoulders",
    neck: "PF1.EquipSlots.neck",
    chest: "PF1.EquipSlots.chest",
    body: "PF1.EquipSlots.body",
    belt: "PF1.EquipSlots.belt",
    wrists: "PF1.EquipSlots.wrists",
    hands: "PF1.EquipSlots.hands",
    ring: "PF1.EquipSlots.ring",
    feet: "PF1.EquipSlots.feet",
  },
  clothing: {
    clothing: "PF1.EquipSlots.clothing",
  },
  other: {
    other: "PF1.Other",
  },
};

/**
 * The subtypes for loot items
 */
export const lootTypes = {
  gear: "PF1.Subtypes.Item.loot.gear.Plural",
  tool: "PF1.Subtypes.Item.loot.tool.Plural",
  ammo: "PF1.Subtypes.Item.loot.ammo.Plural",
  food: "PF1.Subtypes.Item.loot.food.Plural",
  herb: "PF1.Subtypes.Item.loot.herb.Plural",
  adventuring: "PF1.Subtypes.Item.loot.adventuring.Plural",
  animalGear: "PF1.Subtypes.Item.loot.animalGear.Plural",
  reagent: "PF1.Subtypes.Item.loot.reagent.Plural",
  remedy: "PF1.Subtypes.Item.loot.remedy.Plural",
  treasure: "PF1.Subtypes.Item.loot.treasure.Plural",
  tradeGoods: "PF1.Subtypes.Item.loot.tradeGoods.Plural",
  vehicle: "PF1.Subtypes.Item.loot.vehicle.Plural",
  entertainment: "PF1.Subtypes.Item.loot.entertainment.Plural",
  misc: "PF1.Subtypes.Item.loot.misc.Plural",
};

/**
 * The subtypes for ammo type loot items
 */
export const ammoTypes = {
  arrow: "PF1.AmmoType.arrow",
  bolt: "PF1.AmmoType.bolt",
  repeatingBolt: "PF1.AmmoType.repeatingBolt",
  slingBullet: "PF1.AmmoType.slingBullet",
  gunBullet: "PF1.AmmoType.gunBullet",
  dragoonBullet: "PF1.AmmoType.dragoonBullet",
  dart: "PF1.AmmoType.dart",
  siege: "PF1.AmmoType.siege",
};

/* -------------------------------------------- */

/**
 * Enumerate the valid consumable types which are recognized by the system
 */
export const consumableTypes = {
  potion: "PF1.Subtypes.Item.consumable.potion.Single",
  poison: "PF1.Subtypes.Item.consumable.poison.Single",
  drug: "PF1.Subtypes.Item.consumable.drug.Single",
  scroll: "PF1.Subtypes.Item.consumable.scroll.Single",
  wand: "PF1.Subtypes.Item.consumable.wand.Single",
  rod: "PF1.Subtypes.Item.consumable.rod.Single",
  staff: "PF1.Subtypes.Item.consumable.staff.Single",
  misc: "PF1.Misc",
};

export const attackTypes = {
  weapon: "PF1.Subtypes.Item.attack.weapon.Single",
  natural: "PF1.Subtypes.Item.attack.natural.Single",
  ability: "PF1.Subtypes.Item.attack.ability.Single",
  racialAbility: "PF1.Subtypes.Item.attack.racialAbility.Single",
  item: "PF1.Item",
  misc: "PF1.Misc",
};

export const featTypes = {
  feat: "PF1.Subtypes.Item.feat.feat.Single",
  classFeat: "PF1.Subtypes.Item.feat.classFeat.Single",
  trait: "PF1.Subtypes.Item.feat.trait.Single",
  racial: "PF1.Subtypes.Item.feat.racial.Single",
  misc: "PF1.Misc",
  template: "PF1.Subtypes.Item.feat.template.Single",
};

export const featTypesPlurals = {
  feat: "PF1.Subtypes.Item.feat.feat.Plural",
  classFeat: "PF1.Subtypes.Item.feat.classFeat.Plural",
  trait: "PF1.Subtypes.Item.feat.trait.Plural",
  racial: "PF1.Subtypes.Item.feat.racial.Plural",
  template: "PF1.Subtypes.Item.feat.template.Plural",
};

export const traitTypes = {
  combat: "PF1.Trait.combat",
  magic: "PF1.Trait.magic",
  faith: "PF1.Trait.faith",
  social: "PF1.Trait.social",
  campaign: "PF1.Trait.campaign",
  cosmic: "PF1.Trait.cosmic",
  equipment: "PF1.Trait.equipment",
  exemplar: "PF1.Trait.exemplar",
  faction: "PF1.Trait.faction",
  family: "PF1.Trait.family",
  mount: "PF1.Trait.mount",
  race: "PF1.Trait.race",
  region: "PF1.Trait.region",
  religion: "PF1.Trait.religion",
  drawback: "PF1.Trait.drawback",
};

/**
 * Ability types, each with their short and their long form
 */
export const abilityTypes = {
  na: {
    long: "PF1.AbilityTypes.na.Label",
    short: "PF1.AbilityTypes.na.Short",
  },
  ex: {
    long: "PF1.AbilityTypes.ex.Label",
    short: "PF1.AbilityTypes.ex.Short",
  },
  su: {
    long: "PF1.AbilityTypes.su.Label",
    short: "PF1.AbilityTypes.su.Short",
  },
  sp: {
    long: "PF1.AbilityTypes.sp.Label",
    short: "PF1.AbilityTypes.sp.Short",
  },
};

/* -------------------------------------------- */

/**
 * The valid currency denominations supported by the game system
 */
export const currencies = {
  pp: "PF1.Currency.Abbr.pp",
  gp: "PF1.Currency.Abbr.gp",
  sp: "PF1.Currency.Abbr.sp",
  cp: "PF1.Currency.Abbr.cp",
};

/**
 * Resultant armor types for an actor's worn armor as per their roll data
 *
 * @see {@link ActorPF.getRollData ActorRollData.armor.type}
 * @readonly
 * @enum {number}
 */
export const armorTypes = {
  none: 0,
  light: 1,
  medium: 2,
  heavy: 3,
};

/**
 * Resultant shield types for an actor's worn shield
 *
 * @see {@link ActorPF.getRollData ActorRollData.shield.type}
 * @readonly
 * @enum {number}
 */
export const shieldTypes = {
  none: 0,
  other: 1, // buckler
  light: 2,
  heavy: 3,
  tower: 4,
};

/**
 * The types of bonus modifiers
 */
export const bonusModifiers = {
  untyped: "PF1.BonusModifierUntyped",
  untypedPerm: "PF1.BonusModifierUntypedPerm",
  base: "PF1.BonusModifierBase",
  enh: "PF1.BonusModifierEnhancement",
  dodge: "PF1.BonusModifierDodge",
  haste: "PF1.BonusModifierHaste",
  inherent: "PF1.BonusModifierInherent",
  deflection: "PF1.BonusModifierDeflection",
  morale: "PF1.BonusModifierMorale",
  luck: "PF1.BonusModifierLuck",
  sacred: "PF1.BonusModifierSacred",
  insight: "PF1.BonusModifierInsight",
  resist: "PF1.BonusModifierResistance",
  profane: "PF1.BonusModifierProfane",
  trait: "PF1.BonusModifierTrait",
  racial: "PF1.BonusModifierRacial",
  size: "PF1.BonusModifierSize",
  competence: "PF1.BonusModifierCompetence",
  circumstance: "PF1.BonusModifierCircumstance",
  alchemical: "PF1.BonusModifierAlchemical",
  penalty: "PF1.BonusModifierPenalty",
};

/**
 * An array of stacking bonus modifiers by their keys for {@link bonusModifiers}
 */
export const stackingBonusModifiers = ["untyped", "untypedPerm", "dodge", "racial", "penalty", "circumstance"];

/* -------------------------------------------- */

/* -------------------------------------------- */

/**
 * Valid options for the range of abilities and spells
 */
export const distanceUnits = {
  none: "PF1.None",
  personal: "PF1.DistPersonal",
  touch: "PF1.DistTouch",
  melee: "PF1.DistMelee",
  reach: "PF1.DistReach",
  close: "PF1.DistClose",
  medium: "PF1.DistMedium",
  long: "PF1.DistLong",
  ft: "PF1.DistFt",
  mi: "PF1.DistMi",
  spec: "PF1.Special",
  seeText: "PF1.SeeText",
  unlimited: "PF1.Unlimited",
};

export const measureUnits = {
  ft: "PF1.DistFt",
  mi: "PF1.DistMi",
  m: "PF1.DistM",
  km: "PF1.DistKM",
};

export const measureUnitsShort = {
  ft: "PF1.DistFtShort",
  mi: "PF1.DistMiShort",
  m: "PF1.DistMShort",
  km: "PF1.DistKMShort",
};

export const actorStatures = {
  tall: "PF1.StatureTall",
  long: "PF1.StatureLong",
};

/* -------------------------------------------- */

/**
 * This Object defines the various lengths of time which can occur in PF1
 */
export const timePeriods = {
  inst: "PF1.Time.Period.inst.Label",
  turn: "PF1.Time.Period.turn.Label",
  round: "PF1.Time.Period.round.Label",
  minute: "PF1.Time.Period.minute.Label",
  hour: "PF1.Time.Period.hour.Label",
  day: "PF1.Time.Period.day.Label",
  month: "PF1.Time.Period.month.Label",
  year: "PF1.Time.Period.year.Label",
  perm: "PF1.Time.Period.perm.Label",
  seeText: "PF1.SeeText",
  spec: "PF1.Special",
};

/**
 * Short form labels for time periods, and valid options for buff durations.
 */
export const timePeriodsShort = {
  turn: "PF1.Time.Period.turn.Short",
  round: "PF1.Time.Period.round.Short",
  minute: "PF1.Time.Period.minute.Short",
  hour: "PF1.Time.Period.hour.Short",
};

/* -------------------------------------------- */

/**
 * This Object determines spells gained and cast per level
 */
export const casterProgression = {
  castsPerDay: {
    prepared: {
      low: [
        [Number.POSITIVE_INFINITY],
        [Number.POSITIVE_INFINITY],
        [Number.POSITIVE_INFINITY],
        [Number.POSITIVE_INFINITY, 0],
        [Number.POSITIVE_INFINITY, 1],
        [Number.POSITIVE_INFINITY, 1],
        [Number.POSITIVE_INFINITY, 1, 0],
        [Number.POSITIVE_INFINITY, 1, 1],
        [Number.POSITIVE_INFINITY, 2, 1],
        [Number.POSITIVE_INFINITY, 2, 1, 0],
        [Number.POSITIVE_INFINITY, 2, 1, 1],
        [Number.POSITIVE_INFINITY, 2, 2, 1],
        [Number.POSITIVE_INFINITY, 3, 2, 1, 0],
        [Number.POSITIVE_INFINITY, 3, 2, 1, 1],
        [Number.POSITIVE_INFINITY, 3, 2, 2, 1],
        [Number.POSITIVE_INFINITY, 3, 3, 2, 1],
        [Number.POSITIVE_INFINITY, 4, 3, 2, 1],
        [Number.POSITIVE_INFINITY, 4, 3, 2, 2],
        [Number.POSITIVE_INFINITY, 4, 3, 3, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 3, 3],
      ],
      med: [
        [Number.POSITIVE_INFINITY, 1],
        [Number.POSITIVE_INFINITY, 2],
        [Number.POSITIVE_INFINITY, 3],
        [Number.POSITIVE_INFINITY, 3, 1],
        [Number.POSITIVE_INFINITY, 4, 2],
        [Number.POSITIVE_INFINITY, 4, 3],
        [Number.POSITIVE_INFINITY, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 5, 4, 3],
        [Number.POSITIVE_INFINITY, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 5, 5, 4, 3],
        [Number.POSITIVE_INFINITY, 5, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 5, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 5, 5, 5, 4, 3],
        [Number.POSITIVE_INFINITY, 5, 5, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 5, 5, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 5, 5, 5, 5, 4, 3],
        [Number.POSITIVE_INFINITY, 5, 5, 5, 5, 5, 4],
        [Number.POSITIVE_INFINITY, 5, 5, 5, 5, 5, 5],
      ],
      high: [
        [Number.POSITIVE_INFINITY, 1],
        [Number.POSITIVE_INFINITY, 2],
        [Number.POSITIVE_INFINITY, 2, 1],
        [Number.POSITIVE_INFINITY, 3, 2],
        [Number.POSITIVE_INFINITY, 3, 2, 1],
        [Number.POSITIVE_INFINITY, 3, 3, 2],
        [Number.POSITIVE_INFINITY, 4, 3, 2, 1],
        [Number.POSITIVE_INFINITY, 4, 3, 3, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 3, 2, 1],
        [Number.POSITIVE_INFINITY, 4, 4, 3, 3, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 3, 2, 1],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 3, 3, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 3, 2, 1],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 3, 3, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 3, 2, 1],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 3, 3, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 4, 3, 2, 1],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 4, 3, 3, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 4, 4, 3, 3],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      ],
    },
    spontaneous: {
      low: [
        [Number.POSITIVE_INFINITY],
        [Number.POSITIVE_INFINITY],
        [Number.POSITIVE_INFINITY],
        [Number.POSITIVE_INFINITY, 1],
        [Number.POSITIVE_INFINITY, 1],
        [Number.POSITIVE_INFINITY, 1],
        [Number.POSITIVE_INFINITY, 1, 1],
        [Number.POSITIVE_INFINITY, 1, 1],
        [Number.POSITIVE_INFINITY, 2, 1],
        [Number.POSITIVE_INFINITY, 2, 1, 1],
        [Number.POSITIVE_INFINITY, 2, 1, 1],
        [Number.POSITIVE_INFINITY, 2, 2, 1],
        [Number.POSITIVE_INFINITY, 3, 2, 1, 1],
        [Number.POSITIVE_INFINITY, 3, 2, 1, 1],
        [Number.POSITIVE_INFINITY, 3, 2, 2, 1],
        [Number.POSITIVE_INFINITY, 3, 3, 2, 1],
        [Number.POSITIVE_INFINITY, 4, 3, 2, 1],
        [Number.POSITIVE_INFINITY, 4, 3, 2, 2],
        [Number.POSITIVE_INFINITY, 4, 3, 3, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 3, 2],
      ],
      med: [
        [Number.POSITIVE_INFINITY, 1],
        [Number.POSITIVE_INFINITY, 2],
        [Number.POSITIVE_INFINITY, 3],
        [Number.POSITIVE_INFINITY, 3, 1],
        [Number.POSITIVE_INFINITY, 4, 2],
        [Number.POSITIVE_INFINITY, 4, 3],
        [Number.POSITIVE_INFINITY, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 5, 4, 3],
        [Number.POSITIVE_INFINITY, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 5, 5, 4, 3],
        [Number.POSITIVE_INFINITY, 5, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 5, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 5, 5, 5, 4, 3],
        [Number.POSITIVE_INFINITY, 5, 5, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 5, 5, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 5, 5, 5, 5, 4, 3],
        [Number.POSITIVE_INFINITY, 5, 5, 5, 5, 5, 4],
        [Number.POSITIVE_INFINITY, 5, 5, 5, 5, 5, 5],
      ],
      high: [
        [Number.POSITIVE_INFINITY, 3],
        [Number.POSITIVE_INFINITY, 4],
        [Number.POSITIVE_INFINITY, 5],
        [Number.POSITIVE_INFINITY, 6, 3],
        [Number.POSITIVE_INFINITY, 6, 4],
        [Number.POSITIVE_INFINITY, 6, 5, 3],
        [Number.POSITIVE_INFINITY, 6, 6, 4],
        [Number.POSITIVE_INFINITY, 6, 6, 5, 3],
        [Number.POSITIVE_INFINITY, 6, 6, 6, 4],
        [Number.POSITIVE_INFINITY, 6, 6, 6, 5, 3],
        [Number.POSITIVE_INFINITY, 6, 6, 6, 6, 4],
        [Number.POSITIVE_INFINITY, 6, 6, 6, 6, 5, 3],
        [Number.POSITIVE_INFINITY, 6, 6, 6, 6, 6, 4],
        [Number.POSITIVE_INFINITY, 6, 6, 6, 6, 6, 5, 3],
        [Number.POSITIVE_INFINITY, 6, 6, 6, 6, 6, 6, 4],
        [Number.POSITIVE_INFINITY, 6, 6, 6, 6, 6, 6, 5, 3],
        [Number.POSITIVE_INFINITY, 6, 6, 6, 6, 6, 6, 6, 4],
        [Number.POSITIVE_INFINITY, 6, 6, 6, 6, 6, 6, 6, 5, 3],
        [Number.POSITIVE_INFINITY, 6, 6, 6, 6, 6, 6, 6, 6, 4],
        [Number.POSITIVE_INFINITY, 6, 6, 6, 6, 6, 6, 6, 6, 6],
      ],
    },
    hybrid: {
      high: [
        [Number.POSITIVE_INFINITY, 2],
        [Number.POSITIVE_INFINITY, 3],
        [Number.POSITIVE_INFINITY, 4],
        [Number.POSITIVE_INFINITY, 4, 2],
        [Number.POSITIVE_INFINITY, 4, 3],
        [Number.POSITIVE_INFINITY, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 3],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 3],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 3],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 3],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 4, 3],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 4, 4, 3],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 4, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 4, 4, 4, 3],
        [Number.POSITIVE_INFINITY, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      ],
    },
    prestige: {
      low: [
        [Number.POSITIVE_INFINITY, 1],
        [Number.POSITIVE_INFINITY, 2],
        [Number.POSITIVE_INFINITY, 3],
        [Number.POSITIVE_INFINITY, 3, 1],
        [Number.POSITIVE_INFINITY, 4, 2],
        [Number.POSITIVE_INFINITY, 4, 3],
        [Number.POSITIVE_INFINITY, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 4, 4, 2],
        [Number.POSITIVE_INFINITY, 5, 4, 3],
        [Number.POSITIVE_INFINITY, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 4, 3, 1],
        [Number.POSITIVE_INFINITY, 5, 4, 3, 1],
      ],
    },
  },
  spellsPreparedPerDay: {
    prepared: {
      low: [
        [null],
        [null],
        [null],
        [null, 0],
        [null, 1],
        [null, 1],
        [null, 1, 0],
        [null, 1, 1],
        [null, 2, 1],
        [null, 2, 1, 0],
        [null, 2, 1, 1],
        [null, 2, 2, 1],
        [null, 3, 2, 1, 0],
        [null, 3, 2, 1, 1],
        [null, 3, 2, 2, 1],
        [null, 3, 3, 2, 1],
        [null, 4, 3, 2, 1],
        [null, 4, 3, 2, 2],
        [null, 4, 3, 3, 2],
        [null, 4, 4, 3, 3],
      ],
      med: [
        [3, 1],
        [4, 2],
        [4, 3],
        [4, 3, 1],
        [4, 4, 2],
        [5, 4, 3],
        [5, 4, 3, 1],
        [5, 4, 4, 2],
        [5, 5, 4, 3],
        [5, 5, 4, 3, 1],
        [5, 5, 4, 4, 2],
        [5, 5, 5, 4, 3],
        [5, 5, 5, 4, 3, 1],
        [5, 5, 5, 4, 4, 2],
        [5, 5, 5, 5, 4, 3],
        [5, 5, 5, 5, 4, 3, 1],
        [5, 5, 5, 5, 4, 4, 2],
        [5, 5, 5, 5, 5, 4, 3],
        [5, 5, 5, 5, 5, 5, 4],
        [5, 5, 5, 5, 5, 5, 5],
      ],
      high: [
        [3, 1],
        [4, 2],
        [4, 2, 1],
        [4, 3, 2],
        [4, 3, 2, 1],
        [4, 3, 3, 2],
        [4, 4, 3, 2, 1],
        [4, 4, 3, 3, 2],
        [4, 4, 4, 3, 2, 1],
        [4, 4, 4, 3, 3, 2],
        [4, 4, 4, 4, 3, 2, 1],
        [4, 4, 4, 4, 3, 3, 2],
        [4, 4, 4, 4, 4, 3, 2, 1],
        [4, 4, 4, 4, 4, 3, 3, 2],
        [4, 4, 4, 4, 4, 4, 3, 2, 1],
        [4, 4, 4, 4, 4, 4, 3, 3, 2],
        [4, 4, 4, 4, 4, 4, 4, 3, 2, 1],
        [4, 4, 4, 4, 4, 4, 4, 3, 3, 2],
        [4, 4, 4, 4, 4, 4, 4, 4, 3, 3],
        [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
      ],
    },
    spontaneous: {
      low: [
        [2],
        [3],
        [4],
        [4, 2],
        [5, 3],
        [5, 4],
        [6, 4, 2],
        [6, 4, 3],
        [6, 5, 4],
        [6, 5, 4, 2],
        [6, 5, 4, 3],
        [6, 6, 5, 4],
        [6, 6, 5, 4, 2],
        [6, 6, 5, 4, 3],
        [6, 6, 6, 5, 4],
        [6, 6, 6, 5, 4],
        [6, 6, 6, 5, 4],
        [6, 6, 6, 6, 5],
        [6, 6, 6, 6, 5],
        [6, 6, 6, 6, 5],
      ],
      med: [
        [4, 2],
        [5, 3],
        [6, 4],
        [6, 4, 2],
        [6, 4, 3],
        [6, 4, 4],
        [6, 5, 4, 2],
        [6, 5, 4, 3],
        [6, 5, 4, 4],
        [6, 5, 5, 4, 2],
        [6, 6, 5, 4, 3],
        [6, 6, 5, 4, 4],
        [6, 6, 5, 5, 4, 2],
        [6, 6, 6, 5, 4, 3],
        [6, 6, 6, 5, 4, 4],
        [6, 6, 6, 5, 5, 4, 2],
        [6, 6, 6, 6, 5, 4, 3],
        [6, 6, 6, 6, 5, 4, 4],
        [6, 6, 6, 6, 5, 5, 4],
        [6, 6, 6, 6, 6, 5, 5],
      ],
      high: [
        [4, 2],
        [5, 2],
        [5, 3],
        [6, 3, 1],
        [6, 4, 2],
        [7, 4, 2, 1],
        [7, 5, 3, 2],
        [8, 5, 3, 2, 1],
        [8, 5, 4, 3, 2],
        [9, 5, 4, 3, 2, 1],
        [9, 5, 5, 4, 3, 2],
        [9, 5, 5, 4, 3, 2, 1],
        [9, 5, 5, 4, 4, 3, 2],
        [9, 5, 5, 4, 4, 3, 2, 1],
        [9, 5, 5, 4, 4, 4, 3, 2],
        [9, 5, 5, 4, 4, 4, 3, 2, 1],
        [9, 5, 5, 4, 4, 4, 3, 3, 2],
        [9, 5, 5, 4, 4, 4, 3, 3, 2, 1],
        [9, 5, 5, 4, 4, 4, 3, 3, 3, 2],
        [9, 5, 5, 4, 4, 4, 3, 3, 3, 3],
      ],
    },
    hybrid: {
      high: [
        [4, 2],
        [5, 2],
        [5, 3],
        [6, 3, 1],
        [6, 4, 2],
        [7, 4, 2, 1],
        [7, 5, 3, 2],
        [8, 5, 3, 2, 1],
        [8, 5, 4, 3, 2],
        [9, 5, 4, 3, 2, 1],
        [9, 5, 5, 4, 3, 2],
        [9, 5, 5, 4, 3, 2, 1],
        [9, 5, 5, 4, 4, 3, 2],
        [9, 5, 5, 4, 4, 3, 2, 1],
        [9, 5, 5, 4, 4, 4, 3, 2],
        [9, 5, 5, 4, 4, 4, 3, 2, 1],
        [9, 5, 5, 4, 4, 4, 3, 3, 2],
        [9, 5, 5, 4, 4, 4, 3, 3, 2, 1],
        [9, 5, 5, 4, 4, 4, 3, 3, 3, 2],
        [9, 5, 5, 4, 4, 4, 3, 3, 3, 3],
      ],
    },
    prestige: {
      low: [
        [null, 2],
        [null, 3],
        [null, 4],
        [null, 4, 2],
        [null, 4, 3],
        [null, 4, 4],
        [null, 5, 4, 2],
        [null, 5, 4, 3],
        [null, 5, 4, 4],
        [null, 5, 5, 4, 2],
        [null, 5, 5, 4, 2],
        [null, 5, 5, 4, 2],
        [null, 5, 5, 4, 2],
        [null, 5, 5, 4, 2],
        [null, 5, 5, 4, 2],
        [null, 5, 5, 4, 2],
        [null, 5, 5, 4, 2],
        [null, 5, 5, 4, 2],
        [null, 5, 5, 4, 2],
        [null, 5, 5, 4, 2],
      ],
    },
  },
};

/* -------------------------------------------- */

/**
 * Character senses options
 */
export const senses = {
  bs: "PF1.SenseBS",
  bse: "PF1.SenseBSense",
  dv: "PF1.SenseDV",
  ts: "PF1.SenseTS",
  tr: "PF1.SenseTR",
  ll: "PF1.SenseLL",
  si: "PF1.SenseSI",
  sid: "PF1.SenseSID",
  sc: "PF1.SenseSC",
};

/* -------------------------------------------- */

/**
 * The set of skill which can be trained in PF1
 */
export const skills = {
  acr: "PF1.SkillAcr",
  apr: "PF1.SkillApr",
  art: "PF1.SkillArt",
  blf: "PF1.SkillBlf",
  clm: "PF1.SkillClm",
  crf: "PF1.SkillCrf",
  dip: "PF1.SkillDip",
  dev: "PF1.SkillDev",
  dis: "PF1.SkillDis",
  esc: "PF1.SkillEsc",
  fly: "PF1.SkillFly",
  han: "PF1.SkillHan",
  hea: "PF1.SkillHea",
  int: "PF1.SkillInt",
  kar: "PF1.SkillKAr",
  kdu: "PF1.SkillKDu",
  ken: "PF1.SkillKEn",
  kge: "PF1.SkillKGe",
  khi: "PF1.SkillKHi",
  klo: "PF1.SkillKLo",
  kna: "PF1.SkillKNa",
  kno: "PF1.SkillKNo",
  kpl: "PF1.SkillKPl",
  kre: "PF1.SkillKRe",
  lin: "PF1.SkillLin",
  lor: "PF1.SkillLor",
  per: "PF1.SkillPer",
  prf: "PF1.SkillPrf",
  pro: "PF1.SkillPro",
  rid: "PF1.SkillRid",
  sen: "PF1.SkillSen",
  slt: "PF1.SkillSlt",
  spl: "PF1.SkillSpl",
  ste: "PF1.SkillSte",
  sur: "PF1.SkillSur",
  swm: "PF1.SkillSwm",
  umd: "PF1.SkillUMD",
};

/**
 * Compendium journal entries containing details about {@link skills}
 */
export const skillCompendiumEntries = {
  acr: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.gGfJO90ZuRT4sZ9X",
  apr: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.QGxoGsSIAOoe5dTW",
  art: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.x175kVqUfLGPt8tC",
  blf: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.kRK5XwVBvcMi35w2",
  clm: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.ZAwjVOTwsBpZRgw4",
  crf: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.3E8pxbjI8MD3JbfQ",
  dip: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.uB9Fy36RUjibxqvt",
  dev: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.cSdUATLHBFfw3v4s",
  dis: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.xg25z3GIpS590NDW",
  esc: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.DTNlXXg77s3178WJ",
  fly: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.iH69GIwm8BjecrPN",
  han: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.IrVgSeMcAM8rAh2B",
  hea: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.nHbYSOoe1SzqEO9w",
  int: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.KNn8uxHu23phKC0y",
  kar: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.BWeqgXSZvUQl68vt",
  kdu: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.BWeqgXSZvUQl68vt",
  ken: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.BWeqgXSZvUQl68vt",
  kge: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.BWeqgXSZvUQl68vt",
  khi: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.BWeqgXSZvUQl68vt",
  klo: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.BWeqgXSZvUQl68vt",
  kna: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.BWeqgXSZvUQl68vt",
  kno: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.BWeqgXSZvUQl68vt",
  kpl: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.BWeqgXSZvUQl68vt",
  kre: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.BWeqgXSZvUQl68vt",
  lin: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.SqLm3Deag2FpP8ty",
  lor: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.x175kVqUfLGPt8tC",
  per: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.2h6hz5AkTDxKPFxr",
  prf: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.emzBKDFNkNnC7N8u",
  pro: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.224EaK0K72NhCeRi",
  rid: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.xQbTtefpEfEaOYo7",
  sen: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.ka0VQGItdrWw3paO",
  slt: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.joza8kAIiImrPft7",
  spl: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.VRD7jxiIAxKPt6EF",
  ste: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.wRWHk7tCUHR99PzD",
  sur: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.pLdYavy4nssLEoGV",
  swm: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.xhmDhOXuBbfVcD0Q",
  umd: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.A8j7nF6qHwuGEC2E",
};

/**
 * An array of {@link skills} that can have arbitrary subskills
 */
export const arbitrarySkills = ["art", "crf", "lor", "prf", "pro"];

/**
 * An array of {@link skills} that are considered background skills.
 */
export const backgroundSkills = [
  "apr",
  "art",
  "crf",
  "han",
  "ken",
  "kge",
  "khi",
  "kno",
  "lin",
  "lor",
  "prf",
  "pro",
  "slt",
];

/**
 * Array of skills that are only shown with background skills optional rule enabled.
 */
export const backgroundOnlySkills = ["lor", "art"];

/*
 * Number of background skills per level gained from valid classes.
 */
export const backgroundSkillsPerLevel = 2;

/**
 * Valid class types to grant background skills.
 */
export const backgroundSkillClasses = ["base", "prestige"];

/**
 * Bonus modifier granted to class skills.
 */
export const classSkillBonus = 3;

/* -------------------------------------------- */

export const classCasterType = {
  sorcerer: "high",
  wizard: "high",
  cleric: "high",
  oracle: "high",
  druid: "high",
  psychic: "high",
  shaman: "high",
  witch: "high",
  alchemist: "med",
  bard: "med",
  hunter: "med",
  inquisitor: "med",
  investigator: "med",
  magus: "med",
  mesmerist: "med",
  occultist: "med",
  skald: "med",
  spiritualist: "med",
  summoner: "med",
  "unchained Summoner": "med",
  antipaladin: "low",
  bloodrager: "low",
  medium: "low",
  paladin: "low",
  ranger: "low",
};

export const spellcasting = {
  type: {
    spontaneous: "PF1.SpellPrepSpontaneous",
    prepared: "PF1.SpellPrepPrepared",
    hybrid: "PF1.Arcanist",
  },
  spells: {
    arcane: "PF1.Spellcasting.Type.Arcane",
    divine: "PF1.Spellcasting.Type.Divine",
    psychic: "PF1.Spellcasting.Type.Psychic",
    alchemy: "PF1.Spellcasting.Type.Alchemy",
  },
};

export const magicAuraByLevel = {
  spell: [
    { power: "faint", level: 1 },
    { power: "moderate", level: 4 },
    { power: "strong", level: 7 },
    { power: "overwhelming", level: 10 },
  ],
  item: [
    { power: "faint", level: 1 },
    { power: "moderate", level: 6 },
    { power: "strong", level: 12 },
    { power: "overwhelming", level: 21 },
  ],
};

export const auraStrengths = {
  1: "PF1.Aura.Strength.faint",
  2: "PF1.Aura.Strength.moderate",
  3: "PF1.Aura.Strength.strong",
  4: "PF1.Aura.Strength.overwhelming",
};

/* -------------------------------------------- */

/* -------------------------------------------- */

// Weapon Types
export const weaponTypes = {
  simple: {
    _label: "PF1.WeaponTypeSimple",
    light: "PF1.WeaponPropLight",
    "1h": "PF1.WeaponPropOneHanded",
    "2h": "PF1.WeaponPropTwoHanded",
    ranged: "PF1.WeaponSubtypeRanged",
  },
  martial: {
    _label: "PF1.WeaponTypeMartial",
    light: "PF1.WeaponPropLight",
    "1h": "PF1.WeaponPropOneHanded",
    "2h": "PF1.WeaponPropTwoHanded",
    ranged: "PF1.WeaponSubtypeRanged",
  },
  exotic: {
    _label: "PF1.WeaponTypeExotic",
    light: "PF1.WeaponPropLight",
    "1h": "PF1.WeaponPropOneHanded",
    "2h": "PF1.WeaponPropTwoHanded",
    ranged: "PF1.WeaponSubtypeRanged",
  },
  misc: {
    _label: "PF1.Misc",
    splash: "PF1.WeaponTypeSplash",
    other: "PF1.Other",
  },
};

// Weapon hold types
export const weaponHoldTypes = {
  normal: "PF1.WeaponHoldTypeNormal",
  "2h": "PF1.WeaponHoldTypeTwoHanded",
  oh: "PF1.WeaponHoldTypeOffhand",
};

/**
 * Weapon groups that a weapon can belong to
 */
export const weaponGroups = {
  axes: "PF1.WeaponGroupAxes",
  bladesHeavy: "PF1.WeaponGroupBladesHeavy",
  bladesLight: "PF1.WeaponGroupBladesLight",
  bows: "PF1.WeaponGroupBows",
  close: "PF1.WeaponGroupClose",
  crossbows: "PF1.WeaponGroupCrossbows",
  double: "PF1.WeaponGroupDouble",
  firearms: "PF1.WeaponGroupFirearms",
  flails: "PF1.WeaponGroupFlails",
  hammers: "PF1.WeaponGroupHammers",
  monk: "PF1.WeaponGroupMonk",
  natural: "PF1.WeaponGroupNatural",
  polearms: "PF1.WeaponGroupPolearms",
  siegeEngines: "PF1.WeaponGroupSiegeEngines",
  spears: "PF1.WeaponGroupSpears",
  thrown: "PF1.WeaponGroupThrown",
  tribal: "PF1.WeaponGroupTribal",
};

/* -------------------------------------------- */

/**
 * Define the set of weapon property flags which can exist on a weapon
 */
export const weaponProperties = {
  ato: "PF1.WeaponPropAutomatic",
  blc: "PF1.WeaponPropBlocking",
  brc: "PF1.WeaponPropBrace",
  dea: "PF1.WeaponPropDeadly",
  dst: "PF1.WeaponPropDistracting",
  dbl: "PF1.WeaponPropDouble",
  dis: "PF1.WeaponPropDisarm",
  fin: "PF1.WeaponPropFinesse",
  frg: "PF1.WeaponPropFragile",
  grp: "PF1.WeaponPropGrapple",
  imp: "PF1.WeaponPropImprovised",
  mnk: "PF1.WeaponPropMonk",
  nnl: "PF1.WeaponPropNonLethal",
  prf: "PF1.WeaponPropPerformance",
  rch: "PF1.WeaponPropReach",
  sct: "PF1.WeaponPropScatter",
  snd: "PF1.WeaponPropSunder",
  spc: "PF1.WeaponPropSpecial",
  thr: "PF1.WeaponPropThrown",
  trp: "PF1.WeaponPropTrip",
};

/**
 * The components required for casting a spell
 */
export const spellComponents = {
  verbal: "PF1.SpellComponents.Type.verbal.Abbr",
  somatic: "PF1.SpellComponents.Type.somatic.Abbr",
  thought: "PF1.SpellComponents.Type.thought.Abbr",
  emotion: "PF1.SpellComponents.Type.emotion.Abbr",
  material: "PF1.SpellComponents.Type.material.Abbr",
  focus: "PF1.SpellComponents.Type.focus.Abbr",
  divineFocus: "PF1.SpellComponents.Type.divineFocus.Abbr",
};

/**
 * Spell schools
 */
export const spellSchools = {
  abj: "PF1.SpellSchools.abj",
  con: "PF1.SpellSchools.con",
  div: "PF1.SpellSchools.div",
  enc: "PF1.SpellSchools.enc",
  evo: "PF1.SpellSchools.evo",
  ill: "PF1.SpellSchools.ill",
  nec: "PF1.SpellSchools.nec",
  trs: "PF1.SpellSchools.tra",
  uni: "PF1.SpellSchools.uni",
  misc: "PF1.Misc",
};

/**
 * Spell levels
 */
export const spellLevels = {
  0: "PF1.SpellLevels.0",
  1: "PF1.SpellLevels.1",
  2: "PF1.SpellLevels.2",
  3: "PF1.SpellLevels.3",
  4: "PF1.SpellLevels.4",
  5: "PF1.SpellLevels.5",
  6: "PF1.SpellLevels.6",
  7: "PF1.SpellLevels.7",
  8: "PF1.SpellLevels.8",
  9: "PF1.SpellLevels.9",
};

/* -------------------------------------------- */

export const conditionTypes = {
  bleed: "PF1.CondTypeBleed",
  blind: "PF1.CondTypeBlind",
  confuse: "PF1.CondTypeConfuse",
  daze: "PF1.CondTypeDaze",
  dazzle: "PF1.CondTypeDazzle",
  deaf: "PF1.CondTypeDeaf",
  deathEffects: "PF1.CondTypeDeathEffects",
  disease: "PF1.CondTypeDisease",
  energyDrain: "PF1.CondTypeEnergyDrain",
  fatigue: "PF1.CondTypeFatigue",
  fear: "PF1.CondTypeFear",
  mindAffecting: "PF1.CondTypeMindAffecting",
  poison: "PF1.CondTypePoison",
  sicken: "PF1.CondTypeSicken",
  paralyze: "PF1.CondTypeParalyze",
  petrify: "PF1.CondTypePetrify",
  stun: "PF1.CondTypeStun",
  sleep: "PF1.CondTypeSleep",
};

export const buffTypes = {
  temp: "PF1.Temporary",
  spell: "TYPES.Item.spell",
  feat: "TYPES.Item.feat",
  perm: "PF1.Permanent",
  item: "PF1.Item",
  misc: "PF1.Misc",
};

/**
 * Dictionaries of conditional modifier targets, each with a label and sub-categories
 */
export const conditionalTargets = {
  attack: {
    _label: "PF1.AttackRollPlural",
    allAttack: "PF1.All",
    hasteAttack: "PF1.Haste",
    rapidShotAttack: "PF1.RapidShot",
  },
  damage: {
    _label: "PF1.Damage",
    allDamage: "PF1.All",
    hasteDamage: "PF1.Haste",
    rapidShotDamage: "PF1.RapidShot",
  },
  size: {
    _label: "PF1.Size",
  },
  effect: {
    _label: "PF1.Effects",
  },
  misc: {
    _label: "PF1.MiscShort",
  },
};

/**
 * Dictionaries of change/buff targets, each with a label and a category it belongs to,
 * as well as a sort value that determines this buffTarget's priority when Changes are applied.
 */
export const buffTargets = /** @type {const} */ ({
  acpA: { label: "PF1.ACPArmor", category: "misc", sort: 10000 },
  acpS: { label: "PF1.ACPShield", category: "misc", sort: 11000 },
  mDexA: { label: "PF1.MaxDexArmor", category: "misc", sort: 20000 },
  mDexS: { label: "PF1.MaxDexShield", category: "misc", sort: 21000 },
  reach: { label: "PF1.BuffTarReach", category: "misc", sort: 50000 },
  str: { label: "PF1.AbilityStr", category: "ability", sort: 30000 },
  dex: { label: "PF1.AbilityDex", category: "ability", sort: 31000 },
  con: { label: "PF1.AbilityCon", category: "ability", sort: 32000 },
  int: { label: "PF1.AbilityInt", category: "ability", sort: 33000 },
  wis: { label: "PF1.AbilityWis", category: "ability", sort: 34000 },
  cha: { label: "PF1.AbilityCha", category: "ability", sort: 35000 },
  strMod: { label: "PF1.AbilityStrMod", category: "ability", sort: 40000 },
  dexMod: { label: "PF1.AbilityDexMod", category: "ability", sort: 41000 },
  conMod: { label: "PF1.AbilityConMod", category: "ability", sort: 42000 },
  intMod: { label: "PF1.AbilityIntMod", category: "ability", sort: 43000 },
  wisMod: { label: "PF1.AbilityWisMod", category: "ability", sort: 44000 },
  chaMod: { label: "PF1.AbilityChaMod", category: "ability", sort: 45000 },
  skills: { label: "PF1.BuffTarAllSkills", category: "skills", sort: 50000 },
  unskills: { label: "PF1.BuffTarUntrainedSkills", category: "skills", sort: 100000 },
  carryStr: { label: "PF1.CarryStrength", category: "misc", sort: 60000 },
  carryMult: { label: "PF1.CarryMultiplier", category: "misc", sort: 61000 },
  strSkills: { label: "PF1.BuffTarStrSkills", category: "skills", sort: 70000 },
  dexSkills: { label: "PF1.BuffTarDexSkills", category: "skills", sort: 71000 },
  conSkills: { label: "PF1.BuffTarConSkills", category: "skills", sort: 72000 },
  intSkills: { label: "PF1.BuffTarIntSkills", category: "skills", sort: 73000 },
  wisSkills: { label: "PF1.BuffTarWisSkills", category: "skills", sort: 74000 },
  chaSkills: { label: "PF1.BuffTarChaSkills", category: "skills", sort: 75000 },
  allChecks: { label: "PF1.BuffTarAllAbilityChecks", category: "abilityChecks", sort: 80000 },
  strChecks: { label: "PF1.BuffTarStrChecks", category: "abilityChecks", sort: 81000 },
  dexChecks: { label: "PF1.BuffTarDexChecks", category: "abilityChecks", sort: 82000 },
  conChecks: { label: "PF1.BuffTarConChecks", category: "abilityChecks", sort: 83000 },
  intChecks: { label: "PF1.BuffTarIntChecks", category: "abilityChecks", sort: 84000 },
  wisChecks: { label: "PF1.BuffTarWisChecks", category: "abilityChecks", sort: 85000 },
  chaChecks: { label: "PF1.BuffTarChaChecks", category: "abilityChecks", sort: 86000 },
  landSpeed: { label: "PF1.Movement.Mode.land", category: "speed", sort: 90000 },
  climbSpeed: { label: "PF1.Movement.Mode.climb", category: "speed", sort: 91000 },
  swimSpeed: { label: "PF1.Movement.Mode.swim", category: "speed", sort: 92000 },
  burrowSpeed: { label: "PF1.Movement.Mode.burrow", category: "speed", sort: 93000 },
  flySpeed: { label: "PF1.Movement.Mode.fly", category: "speed", sort: 94000 },
  allSpeeds: { label: "PF1.BuffTarAllSpeeds", category: "speed", sort: 95000 },
  ac: { label: "PF1.BuffTarACGeneric", category: "defense", sort: 100000 },
  aac: { label: "PF1.BuffTarACArmor", category: "defense", sort: 101000 },
  sac: { label: "PF1.BuffTarACShield", category: "defense", sort: 102000 },
  nac: { label: "PF1.BuffTarACNatural", category: "defense", sort: 103000 },
  tac: { label: "PF1.BuffTarACTouch", category: "defense", sort: 104000 },
  ffac: { label: "PF1.BuffTarACFlatFooted", category: "defense", sort: 105000 },
  bab: { label: "PF1.BAB", category: "attack", sort: 111000 },
  "~attackCore": { label: "", category: "attack", sort: 112000 },
  attack: { label: "PF1.BuffTarAllAttackRolls", category: "attack", sort: 110000 },
  mattack: { label: "PF1.BuffTarMeleeAttack", category: "attack", sort: 111000 },
  nattack: { label: "PF1.BuffTarNaturalAttack", category: "attack", sort: 112000 },
  rattack: { label: "PF1.BuffTarRangedAttack", category: "attack", sort: 113000 },
  tattack: { label: "PF1.BuffTarThrownAttack", category: "attack", sort: 114000 },
  damage: { label: "PF1.BuffTarAllDamageRolls", category: "damage", sort: 120000 },
  wdamage: { label: "PF1.WeaponDamage", category: "damage", sort: 121000 },
  mwdamage: { label: "PF1.MeleeWeaponDamage", category: "damage", sort: 121100 },
  rwdamage: { label: "PF1.RangedWeaponDamage", category: "damage", sort: 121200 },
  twdamage: { label: "PF1.ThrownWeaponDamage", category: "damage", sort: 121300 },
  rdamage: { label: "PF1.AllRangedDamage", category: "damage", sort: 122100 },
  mdamage: { label: "PF1.AllMeleeDamage", category: "damage", sort: 122200 },
  ndamage: { label: "PF1.NaturalAttackDamage", category: "damage", sort: 123000 },
  sdamage: { label: "PF1.SpellDamage", category: "damage", sort: 124000 },
  critConfirm: { label: "PF1.CriticalConfirmation", category: "attack", sort: 130000 },
  allSavingThrows: { label: "PF1.BuffTarAllSavingThrows", category: "savingThrows", sort: 140000 },
  fort: { label: "PF1.SavingThrowFort", category: "savingThrows", sort: 141000 },
  ref: { label: "PF1.SavingThrowRef", category: "savingThrows", sort: 142000 },
  will: { label: "PF1.SavingThrowWill", category: "savingThrows", sort: 143000 },
  cmb: { label: "PF1.CMB", category: "attack", sort: 150000 },
  cmd: { label: "PF1.CMD", category: "defense", sort: 151000 },
  ffcmd: { label: "PF1.CMDFlatFooted", category: "defense", sort: 152000 },
  init: { label: "PF1.Initiative", category: "misc", sort: 160000 },
  mhp: { label: "PF1.HitPoints", category: "health", sort: 170000 },
  wounds: { label: "PF1.Wounds", category: "health", sort: 180000 },
  vigor: { label: "PF1.Vigor", category: "health", sort: 181000 },
  spellResist: { label: "PF1.SpellResistance", category: "defense", sort: 190000 },
  bonusFeats: { label: "PF1.BuffTarBonusFeats", category: "misc", sort: 200000 },
  bonusSkillRanks: { label: "PF1.BuffTarBonusSkillRanks", category: "skills", sort: 210000 },
  concentration: { label: "PF1.Concentration", category: "spell", sort: 220000 },
  cl: { label: "PF1.CasterLevel", category: "spell", sort: 230000 },
});

/**
 * Categories grouping related {@link BuffTarget change targets} in the selector UI.
 */
export const buffTargetCategories = /** @type {const} */ ({
  defense: { label: "PF1.Defense" },
  savingThrows: { label: "PF1.SavingThrowPlural" },
  attack: { label: "PF1.Attack" },
  damage: { label: "PF1.Damage" },
  ability: { label: "PF1.AbilityScore" },
  abilityChecks: { label: "PF1.BuffTarAbilityChecks" },
  health: { label: "PF1.Health" },
  skills: { label: "PF1.Skills" },
  skill: { label: "PF1.BuffTarSpecificSkill" },
  speed: { label: "PF1.Movement.Speed" },
  spell: { label: "PF1.BuffTarSpells" },
  misc: { label: "PF1.Misc" },
});

export const contextNoteTargets = {
  attack: { label: "PF1.AttackRollPlural", category: "attacks" },
  critical: { label: "PF1.CriticalHitPlural", category: "attacks" },
  effect: { label: "PF1.Effects", category: "attacks" },
  melee: { label: "PF1.Melee", category: "attacks" },
  meleeWeapon: { label: "PF1.MeleeWeapon", category: "attacks" },
  meleeSpell: { label: "PF1.MeleeSpell", category: "attacks" },
  ranged: { label: "PF1.Ranged", category: "attacks" },
  rangedWeapon: { label: "PF1.RangedWeapon", category: "attacks" },
  rangedSpell: { label: "PF1.RangedSpell", category: "attacks" },
  cmb: { label: "PF1.CMB", category: "attacks" },
  allSavingThrows: { label: "PF1.BuffTarAllSavingThrows", category: "savingThrows" },
  fort: { label: "PF1.SavingThrowFort", category: "savingThrows" },
  ref: { label: "PF1.SavingThrowRef", category: "savingThrows" },
  will: { label: "PF1.SavingThrowWill", category: "savingThrows" },
  skills: { label: "PF1.BuffTarAllSkills", category: "skills" },
  strSkills: { label: "PF1.BuffTarStrSkills", category: "skills" },
  dexSkills: { label: "PF1.BuffTarDexSkills", category: "skills" },
  conSkills: { label: "PF1.BuffTarConSkills", category: "skills" },
  intSkills: { label: "PF1.BuffTarIntSkills", category: "skills" },
  wisSkills: { label: "PF1.BuffTarWisSkills", category: "skills" },
  chaSkills: { label: "PF1.BuffTarChaSkills", category: "skills" },
  allChecks: { label: "PF1.BuffTarAllAbilityChecks", category: "abilityChecks" },
  strChecks: { label: "PF1.BuffTarStrChecks", category: "abilityChecks" },
  dexChecks: { label: "PF1.BuffTarDexChecks", category: "abilityChecks" },
  conChecks: { label: "PF1.BuffTarConChecks", category: "abilityChecks" },
  intChecks: { label: "PF1.BuffTarIntChecks", category: "abilityChecks" },
  wisChecks: { label: "PF1.BuffTarWisChecks", category: "abilityChecks" },
  chaChecks: { label: "PF1.BuffTarChaChecks", category: "abilityChecks" },
  spellEffect: { label: "PF1.SpellBuffEffect", category: "spell" },
  concentration: { label: "PF1.Concentration", category: "spell" },
  cl: { label: "PF1.CasterLevel", category: "spell" },
  ac: { label: "PF1.ACNormal", category: "defense" },
  cmd: { label: "PF1.CMD", category: "defense" },
  sr: { label: "PF1.SpellResistance", category: "defense" },
  init: { label: "PF1.Initiative", category: "misc" },
};

export const contextNoteCategories = {
  attacks: { label: "PF1.Attacks" },
  savingThrows: { label: "PF1.SavingThrowPlural" },
  skills: { label: "PF1.Skills" },
  skill: { label: "PF1.BuffTarSpecificSkill" },
  abilityChecks: { label: "PF1.BuffTarAbilityChecks" },
  spell: { label: "PF1.BuffTarSpells" },
  defense: { label: "PF1.Defense" },
  misc: { label: "PF1.Misc" },
};

/**
 * A list of Golarion's languages
 */
export const languages = {
  aboleth: "PF1.Language.aboleth",
  abyssal: "PF1.Language.abyssal",
  aklo: "PF1.Language.aklo",
  ancientosiriani: "PF1.Language.ancientosiriani",
  androffan: "PF1.Language.androffan",
  aquan: "PF1.Language.aquan",
  auran: "PF1.Language.auran",
  azlanti: "PF1.Language.azlanti",
  boggard: "PF1.Language.boggard",
  catfolk: "PF1.Language.catfolk",
  celestial: "PF1.Language.celestial",
  common: "PF1.Language.common",
  cyclops: "PF1.Language.cyclops",
  dark: "PF1.Language.dark",
  draconic: "PF1.Language.draconic",
  drowsign: "PF1.Language.drowsign",
  druidic: "PF1.Language.druidic",
  dwarven: "PF1.Language.dwarven",
  dziriak: "PF1.Language.dziriak",
  elven: "PF1.Language.elven",
  giant: "PF1.Language.giant",
  gnoll: "PF1.Language.gnoll",
  gnome: "PF1.Language.gnome",
  goblin: "PF1.Language.goblin",
  grippli: "PF1.Language.grippli",
  halfling: "PF1.Language.halfling",
  hallit: "PF1.Language.hallit",
  ignan: "PF1.Language.ignan",
  infernal: "PF1.Language.infernal",
  jistka: "PF1.Language.jistka",
  kasatha: "PF1.Language.kasatha",
  kelish: "PF1.Language.kelish",
  lashunta: "PF1.Language.lashunta",
  munavri: "PF1.Language.munavri",
  necril: "PF1.Language.necril",
  orc: "PF1.Language.orc",
  orvian: "PF1.Language.orvian",
  osiriani: "PF1.Language.osiriani",
  polyglot: "PF1.Language.polyglot",
  protean: "PF1.Language.protean",
  reptoid: "PF1.Language.reptoid",
  rougarou: "PF1.Language.rougarou",
  samsaran: "PF1.Language.samsaran",
  sasquatch: "PF1.Language.sasquatch",
  shadowtongue: "PF1.Language.shadowtongue",
  shoanti: "PF1.Language.shoanti",
  skald: "PF1.Language.skald",
  sphinx: "PF1.Language.sphinx",
  strix: "PF1.Language.strix",
  sylvan: "PF1.Language.sylvan",
  syrinx: "PF1.Language.syrinx",
  taldane: "PF1.Language.taldane",
  tekritanin: "PF1.Language.tekritanin",
  tengu: "PF1.Language.tengu",
  terran: "PF1.Language.terran",
  thassilonian: "PF1.Language.thassilonian",
  tien: "PF1.Language.tien",
  treant: "PF1.Language.treant",
  triaxian: "PF1.Language.triaxian",
  undercommon: "PF1.Language.undercommon",
  vanaran: "PF1.Language.vanaran",
  varisian: "PF1.Language.varisian",
  vegepygmy: "PF1.Language.vegepygmy",
  vishkanya: "PF1.Language.vishkanya",
  vudrani: "PF1.Language.vudrani",
  yaddithian: "PF1.Language.yaddithian",
};

/**
 * Creature types
 */
export const creatureTypes = {
  aberration: "PF1.CreatureTypeAberration",
  animal: "PF1.CreatureTypeAnimal",
  construct: "PF1.CreatureTypeConstruct",
  dragon: "PF1.CreatureTypeDragon",
  fey: "PF1.CreatureTypeFey",
  humanoid: "PF1.CreatureTypeHumanoid",
  magicalBeast: "PF1.CreatureTypeMagicalBeast",
  monstrousHumanoid: "PF1.CreatureTypeMonstrousHumanoid",
  ooze: "PF1.CreatureTypeOoze",
  outsider: "PF1.CreatureTypeOutsider",
  plant: "PF1.CreatureTypePlant",
  undead: "PF1.CreatureTypeUndead",
  vermin: "PF1.CreatureTypeVermin",
};

export const spellRangeFormulas = {
  close: "25 + floor(@cl / 2) * 5",
  medium: "100 + @cl * 10",
  long: "400 + @cl * 40",
};

/**
 * An array containing the damage dice progression for size adjustments
 */
export const sizeDie = [
  "1",
  "1d2",
  "1d3",
  "1d4",
  "1d6",
  "1d8",
  "1d10",
  "2d6",
  "2d8",
  "3d6",
  "3d8",
  "4d6",
  "4d8",
  "6d6",
  "6d8",
  "8d6",
  "8d8",
  "12d6",
  "12d8",
  "16d6",
  "16d8",
];

/**
 * Arrays of Character Level XP Requirements by XP track
 */
// prettier-ignore
export const CHARACTER_EXP_LEVELS =  {
    slow: [
      0,
      3000,
      7500,
      14000,
      23000,
      35000,
      53000,
      77000,
      115000,
      160000,
      235000,
      330000,
      475000,
      665000,
      955000,
      1350000,
      1900000,
      2700000,
      3850000,
      5350000,
    ],
    medium: [
      0,
      2000,
      5000,
      9000,
      15000,
      23000,
      35000,
      51000,
      75000,
      105000,
      155000,
      220000,
      315000,
      445000,
      635000,
      890000,
      1300000,
      1800000,
      2550000,
      3600000,
    ],
    fast: [
      0,
      1300,
      3300,
      6000,
      10000,
      15000,
      23000,
      34000,
      50000,
      71000,
      105000,
      145000,
      210000,
      295000,
      425000,
      600000,
      850000,
      1200000,
      1700000,
      2400000,
    ],
};

/**
 * An array of Challenge Rating XP Levels
 */
// prettier-ignore
export const CR_EXP_LEVELS =  [
    200,
    400,
    600,
    800,
    1200,
    1600,
    2400,
    3200,
    4800,
    6400,
    9600,
    12800,
    19200,
    25600,
    38400,
    51200,
    76800,
    102400,
    153600,
    204800,
    307200,
    409600,
    614400,
    819200,
    1228800,
    1638400,
    2457600,
    3276800,
    4915200,
    6553600,
    9830400,
  ];

export const temporaryRollDataFields = {
  actor: [
    "d20",
    "attackBonus",
    "attackCount",
    "formulaicAttack",
    "damageBonus",
    "pointBlankBonus",
    "rapidShotPenalty",
    "powerAttackBonus",
    "powerAttackPenalty",
    "conditionals",
    "concentrationBonus",
    "formulaBonus",
    "dcBonus",
    "chargeCostBonus",
    "chargeCost",
    "sizeBonus",
    "bonus",
    "critMult",
    "ablMult",
    "ablDamage",
    "cl",
    "sl",
    "classLevel",
    "ablMod",
    "item",
    "action",
    "level",
    "mod",
  ],
};

export const defaultIcons = {
  items: {
    attack: "icons/svg/explosion.svg",
    buff: "icons/svg/ice-aura.svg",
    class: "icons/svg/paralysis.svg",
    consumable: "icons/svg/tankard.svg",
    container: "icons/svg/barrel.svg",
    equipment: "icons/svg/combat.svg",
    feat: "icons/svg/book.svg",
    loot: "icons/svg/item-bag.svg",
    race: "icons/svg/wing.svg",
    spell: "icons/svg/daze.svg",
    weapon: "icons/svg/sword.svg",
  },
  actors: {
    character: "icons/svg/mystery-man.svg",
    npc: "icons/svg/terror.svg",
    haunt: "icons/svg/stoned.svg",
    basic: "icons/svg/castle.svg",
    trap: "icons/svg/net.svg",
    vehicle: "icons/svg/stone-path.svg",
  },
};
