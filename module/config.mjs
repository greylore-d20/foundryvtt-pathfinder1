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
  low: { label: "PF1.Application.PointBuy.Type.low", points: 10 },
  standard: { label: "PF1.Application.PointBuy.Type.standard", points: 15 },
  high: { label: "PF1.Application.PointBuy.Type.high", points: 20 },
  epic: { label: "PF1.Application.PointBuy.Type.epic", points: 25 },
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
 * How many points are assigned per choice.
 *
 * For homebrew support.
 */
export const levelAbilityScoreMult = 1;

/**
 * At which mythic tiers you receive how many new ability points.
 */
export const tierAbilityScores = {
  2: 2,
  4: 2,
  6: 2,
  8: 2,
  10: 2,
};

/**
 * How many points are assigned per choice.
 */
export const tierAbilityScoreMult = 2;

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
 * The choices available for favoured class bonuses
 */
export const favouredClassBonuses = {
  hp: "PF1.FavouredClass.Bonuses.hp",
  skill: "PF1.FavouredClass.Bonuses.skill",
  alt: "PF1.FavouredClass.Bonuses.alt",
};

/**
 * Icons used for favoured class bonus choices
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
  lg: "PF1.Alignments.lg",
  ng: "PF1.Alignments.ng",
  cg: "PF1.Alignments.cg",
  ln: "PF1.Alignments.ln",
  tn: "PF1.Alignments.tn",
  cn: "PF1.Alignments.cn",
  le: "PF1.Alignments.le",
  ne: "PF1.Alignments.ne",
  ce: "PF1.Alignments.ce",
};

/**
 * Character alignment options in their short form
 */
export const alignmentsShort = {
  lg: "PF1.Alignments.Short.lg",
  ng: "PF1.Alignments.Short.ng",
  cg: "PF1.Alignments.Short.cg",
  ln: "PF1.Alignments.Short.ln",
  tn: "PF1.Alignments.Short.tn",
  cn: "PF1.Alignments.Short.cn",
  le: "PF1.Alignments.Short.le",
  ne: "PF1.Alignments.Short.ne",
  ce: "PF1.Alignments.Short.ce",
};

/**
 * Extra damage reduction types
 *
 * @alpha
 */
export const damageResistances = {
  lawful: "PF1.Alignments.l",
  chaotic: "PF1.Alignments.c",
  good: "PF1.Alignments.g",
  evil: "PF1.Alignments.e",
};

/* -------------------------------------------- */

/**
 * The set of Armor Proficiencies which a character may have
 */
export const armorProficiencies = {
  lgt: "PF1.Proficiency.Armor.light",
  med: "PF1.Proficiency.Armor.medium",
  hvy: "PF1.Proficiency.Armor.heavy",
  shl: "PF1.Proficiency.Armor.shield",
  twr: "PF1.Proficiency.Armor.tower",
};

/**
 * The set of broad Weapon Proficiencies a character may have
 */
export const weaponProficiencies = {
  simple: "PF1.Proficiency.Weapon.simple",
  martial: "PF1.Proficiency.Weapon.martial",
  firearm: "PF1.Proficiency.Weapon.firearm",
  siege: "PF1.Proficiency.Weapon.siege",
  heavy: "PF1.Proficiency.Weapon.heavy",
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
  0: "PF1.WoundLevel.healthy",
  1: "PF1.WoundLevel.grazed",
  2: "PF1.WoundLevel.wounded",
  3: "PF1.WoundLevel.critical",
};

/**
 * Change targets affected by Wound Thresholds.
 */
export const woundThresholdChangeTargets = [
  "~attackCore",
  "cl",
  "allSavingThrows",
  "ac",
  //"cmd", // valid target but is inherited from "ac"
  "skills",
  "allChecks",
  //"init", // inherited from allChecks
  //"abilityChecks", // inherited from allChecks
];

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

/**
 * Ability damage multipliers inherited from held options
 */
export const abilityDamageHeldMultipliers = {
  oh: 0.5,
  normal: 1,
  "2h": 1.5,
};

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
  round: "PF1.LimitedUses.Periods.round",
  minute: "PF1.LimitedUses.Periods.minute",
  hour: "PF1.LimitedUses.Periods.hour",
  day: "PF1.LimitedUses.Periods.day",
  week: "PF1.LimitedUses.Periods.week",
  charges: "PF1.LimitedUses.Periods.charges",
};

/**
 * Order of limited use periods from smallest to biggest, omitting periods with no relation to time.
 */
export const limitedUsePeriodOrder = ["round", "minute", "hour", "day", "week"];

/* -------------------------------------------- */

/**
 * The various equipment types and their subtypes
 */
export const equipmentTypes = {
  armor: {
    _label: "PF1.Subtypes.Item.equipment.armor.Single",
    lightArmor: "PF1.Subtypes.Item.equipment.armor.Types.light",
    mediumArmor: "PF1.Subtypes.Item.equipment.armor.Types.medium",
    heavyArmor: "PF1.Subtypes.Item.equipment.armor.Types.heavy",
  },
  shield: {
    _label: "PF1.Subtypes.Item.equipment.shield.Single",
    lightShield: "PF1.Subtypes.Item.equipment.shield.Types.light",
    heavyShield: "PF1.Subtypes.Item.equipment.shield.Types.heavy",
    towerShield: "PF1.Subtypes.Item.equipment.shield.Types.tower",
    other: "PF1.Subtypes.Item.equipment.shield.Types.misc",
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

export const implantTypes = {
  cybertech: "PF1.Subtypes.Item.implant.cybertech.Single",
};

/**
 * The slots implants can occupy.
 */
export const implantSlots = {
  cybertech: {
    none: "PF1.Cybertech.Slots.none",
    arm: "PF1.Cybertech.Slots.arm",
    body: "PF1.Cybertech.Slots.body",
    brain: "PF1.Cybertech.Slots.brain",
    ears: "PF1.Cybertech.Slots.ears",
    eyes: "PF1.Cybertech.Slots.eyes",
    head: "PF1.Cybertech.Slots.head",
    legs: "PF1.Cybertech.Slots.legs",
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
  animal: "PF1.Subtypes.Item.loot.animal.Plural",
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
 * Loot types that should not be equippable.
 */
export const unequippableLoot = [
  "food",
  "herb",
  "reagent",
  "treasure",
  "tradeGoods",
  "vehicle",
  "entertainment",
  "ammo",
];

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
  pharmaceutical: "PF1.Subtypes.Item.consumable.pharmaceutical.Single",
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

export const racialTraitCategories = {
  defense: "PF1.RacialTraitCategories.defense",
  featSkills: "PF1.RacialTraitCategories.featSkills",
  magical: "PF1.RacialTraitCategories.magical",
  movement: "PF1.RacialTraitCategories.movement",
  senses: "PF1.RacialTraitCategories.senses",
  offense: "PF1.RacialTraitCategories.offense",
  other: "PF1.RacialTraitCategories.other",
  weakness: "PF1.RacialTraitCategories.weakness",
};

export const raceTypes = {
  standard: "PF1.RaceTypes.standard",
  advanced: "PF1.RaceTypes.advanced",
  monstrous: "PF1.RaceTypes.monstrous",
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
 * Currency
 */
export const currency = /** @type {const} */ ({
  /**
   * Conversion rates in relation to {@link currencyBase base currency}.
   */
  rate: {
    pp: 1_000,
    gp: 100,
    sp: 10,
  },

  /**
   * Standard currency. Most things are valued in this unit.
   */
  standard: "gp",

  /**
   * Baseline currency.
   */
  base: "cp",
});

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
export const bonusTypes = {
  untyped: "PF1.ModifierType.untyped",
  untypedPerm: "PF1.ModifierType.untypedPerm",
  base: "PF1.ModifierType.base",
  enh: "PF1.ModifierType.enhancement",
  dodge: "PF1.ModifierType.dodge",
  haste: "PF1.ModifierType.haste",
  inherent: "PF1.ModifierType.inherent",
  deflection: "PF1.ModifierType.deflection",
  morale: "PF1.ModifierType.morale",
  luck: "PF1.ModifierType.luck",
  sacred: "PF1.ModifierType.sacred",
  insight: "PF1.ModifierType.insight",
  resist: "PF1.ModifierType.resistance",
  profane: "PF1.ModifierType.profane",
  trait: "PF1.ModifierType.trait",
  racial: "PF1.ModifierType.racial",
  size: "PF1.ModifierType.size",
  competence: "PF1.ModifierType.competence",
  circumstance: "PF1.ModifierType.circumstance",
  alchemical: "PF1.ModifierType.alchemical",
};

/**
 * An array of stacking bonus types by their keys for {@link bonusTypes}
 */
export const stackingBonusTypes = ["untyped", "untypedPerm", "dodge", "racial", "circumstance"];

/* -------------------------------------------- */

/* -------------------------------------------- */

/**
 * Valid options for the range of abilities and spells
 */
export const distanceUnits = {
  none: "PF1.None",
  personal: "PF1.Distance.personal",
  touch: "PF1.Distance.touch",
  melee: "PF1.Distance.melee",
  reach: "PF1.Distance.reach",
  close: "PF1.Distance.close",
  medium: "PF1.Distance.medium",
  long: "PF1.Distance.long",
  ft: "PF1.Distance.ft",
  mi: "PF1.Distance.mi",
  spec: "PF1.Special",
  seeText: "PF1.SeeText",
  unlimited: "PF1.Unlimited",
};

export const measureUnits = {
  ft: "PF1.Distance.ft",
  mi: "PF1.Distance.mi",
  m: "PF1.Distance.m",
  km: "PF1.Distance.km",
};

export const measureUnitsShort = {
  ft: "PF1.Distance.ftShort",
  mi: "PF1.Distance.miShort",
  m: "PF1.Distance.mShort",
  km: "PF1.Distance.kmShort",
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

/**
 * Duration end events
 *
 * Used by buffs to decide when exactly their duration ends.
 */
export const durationEndEvents = {
  turnStart: "PF1.Time.Turn.Start",
  initiative: "PF1.Initiative",
  turnEnd: "PF1.Time.Turn.End",
};

/* -------------------------------------------- */

/**
 * Caster types.
 *
 * Keys match options in {@link casterProgression}
 */
export const caster = {
  /**
   * Preparation types.
   */
  type: {
    prepared: {
      label: "PF1.SpellPrepPrepared",
      spontaneous: false,
      prepared: true,
    },
    spontaneous: {
      label: "PF1.SpellPrepSpontaneous",
      spontaneous: true,
      prepared: false,
    },
    hybrid: {
      label: "PF1.Arcanist",
      spontaneous: true,
      prepared: true,
    },
    prestige: {
      label: "PF1.RedMantisAssassin",
      spontaneous: true,
      prepared: false,
    },
  },
  /**
   * Progression choices.
   */
  progression: {
    high: {
      label: "PF1.High",
    },
    med: {
      label: "PF1.Medium",
    },
    low: {
      label: "PF1.Low",
    },
  },
};

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
  bs: "PF1.Sense.blindsight",
  bse: "PF1.Sense.blindsense",
  dv: "PF1.Sense.darkvision",
  ts: "PF1.Sense.tremorsense",
  tr: "PF1.Sense.trueseeing",
  ll: "PF1.Sense.lowlight",
  si: "PF1.Sense.seeInvis",
  sid: "PF1.Sense.seeInDark",
  sc: "PF1.Sense.scent",
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
  art: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.vH2PLto0QPzkG4io",
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
  lor: "Compendium.pf1.pf1e-rules.x175kVqUfLGPt8tC.JournalEntryPage.rExcBHs5GTiWLlo8",
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
 * Valid class types to grant favored class bonuses.
 *
 * @remarks
 * - Prestige is included due to Favored Prestige Class feat.
 * - NPC is also valid as it is not omitted by any rules about favored class.
 * - Only mythic paths and racial HD are omitted.
 * @see https://www.aonprd.com/Rules.aspx?ID=344
 */
export const favoredClassTypes = ["base", "prestige", "npc"];

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
  summonerUnchained: "med",
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

export const spellDescriptors = {
  acid: "PF1.SpellDescriptors.acid",
  air: "PF1.SpellDescriptors.air",
  chaotic: "PF1.SpellDescriptors.chaotic",
  cold: "PF1.SpellDescriptors.cold",
  curse: "PF1.SpellDescriptors.curse",
  darkness: "PF1.SpellDescriptors.darkness",
  death: "PF1.SpellDescriptors.death",
  disease: "PF1.SpellDescriptors.disease",
  draconic: "PF1.SpellDescriptors.draconic",
  earth: "PF1.SpellDescriptors.earth",
  electricity: "PF1.SpellDescriptors.electricity",
  emotion: "PF1.SpellDescriptors.emotion",
  evil: "PF1.SpellDescriptors.evil",
  fear: "PF1.SpellDescriptors.fear",
  fire: "PF1.SpellDescriptors.fire",
  force: "PF1.SpellDescriptors.force",
  good: "PF1.SpellDescriptors.good",
  languageDependent: "PF1.SpellDescriptors.languageDependent",
  lawful: "PF1.SpellDescriptors.lawful",
  light: "PF1.SpellDescriptors.light",
  meditative: "PF1.SpellDescriptors.meditative",
  mindAffecting: "PF1.SpellDescriptors.mindAffecting",
  pain: "PF1.SpellDescriptors.pain",
  poison: "PF1.SpellDescriptors.poison",
  ruse: "PF1.SpellDescriptors.ruse",
  shadow: "PF1.SpellDescriptors.shadow",
  sonic: "PF1.SpellDescriptors.sonic",
  water: "PF1.SpellDescriptors.water",
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
    _label: "PF1.Subtypes.Item.weapon.simple.Single",
    light: "PF1.WeaponSubtypeLight",
    "1h": "PF1.WeaponSubtypeOneHanded",
    "2h": "PF1.WeaponSubtypeTwoHanded",
    ranged: "PF1.WeaponSubtypeRanged",
  },
  martial: {
    _label: "PF1.Subtypes.Item.weapon.martial.Single",
    light: "PF1.WeaponSubtypeLight",
    "1h": "PF1.WeaponSubtypeOneHanded",
    "2h": "PF1.WeaponSubtypeTwoHanded",
    ranged: "PF1.WeaponSubtypeRanged",
  },
  exotic: {
    _label: "PF1.Subtypes.Item.weapon.exotic.Single",
    light: "PF1.WeaponSubtypeLight",
    "1h": "PF1.WeaponSubtypeOneHanded",
    "2h": "PF1.WeaponSubtypeTwoHanded",
    ranged: "PF1.WeaponSubtypeRanged",
  },
  firearm: {
    _label: "PF1.Subtypes.Item.weapon.firearm.Single",
    ranged: "PF1.WeaponSubtypeRanged",
  },
  siege: {
    _label: "PF1.Subtypes.Item.weapon.siege.Single",
    assault: "PF1.WeaponSubtypeAssault",
    indirect: "PF1.WeaponSubtypeIndirect",
    direct: "PF1.WeaponSubtypeDirect",
  },
  heavy: {
    _label: "PF1.Subtypes.Item.weapon.heavy.Single",
    ranged: "PF1.WeaponSubtypeRanged",
  },
  misc: {
    _label: "PF1.Subtypes.Item.weapon.misc.Single",
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
  axes: "PF1.WeaponGroup.axes",
  bladesHeavy: "PF1.WeaponGroup.bladesHeavy",
  bladesLight: "PF1.WeaponGroup.bladesLight",
  bows: "PF1.WeaponGroup.bows",
  close: "PF1.WeaponGroup.close",
  crossbows: "PF1.WeaponGroup.crossbows",
  double: "PF1.WeaponGroup.double",
  firearms: "PF1.WeaponGroup.firearms",
  flails: "PF1.WeaponGroup.flails",
  hammers: "PF1.WeaponGroup.hammers",
  monk: "PF1.WeaponGroup.monk",
  natural: "PF1.WeaponGroup.natural",
  polearms: "PF1.WeaponGroup.polearms",
  siegeEngines: "PF1.WeaponGroup.siegeEngines",
  spears: "PF1.WeaponGroup.spears",
  thrown: "PF1.WeaponGroup.thrown",
  tribal: "PF1.WeaponGroup.tribal",
};

/* -------------------------------------------- */

/**
 * Define the set of weapon property flags which can exist on a weapon
 */
export const weaponProperties = {
  ato: "PF1.WeaponProperty.Automatic",
  blc: "PF1.WeaponProperty.Blocking",
  brc: "PF1.WeaponProperty.Brace",
  dea: "PF1.WeaponProperty.Deadly",
  dst: "PF1.WeaponProperty.Distracting",
  dbl: "PF1.WeaponProperty.Double",
  dis: "PF1.WeaponProperty.Disarm",
  fin: "PF1.WeaponProperty.Finesse",
  frg: "PF1.WeaponProperty.Fragile",
  grp: "PF1.WeaponProperty.Grapple",
  imp: "PF1.WeaponProperty.Improvised",
  mnk: "PF1.WeaponProperty.Monk",
  nnl: "PF1.WeaponProperty.NonLethal",
  prf: "PF1.WeaponProperty.Performance",
  rch: "PF1.WeaponProperty.Reach",
  sct: "PF1.WeaponProperty.Scatter",
  sma: "PF1.WeaponProperty.SemiAutomatic",
  slf: "PF1.WeaponProperty.SlowFiring",
  snd: "PF1.WeaponProperty.Sunder",
  spc: "PF1.WeaponProperty.Special",
  thr: "PF1.WeaponProperty.Thrown",
  trp: "PF1.WeaponProperty.Trip",
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
 * Spell subschools
 */
export const spellSubschools = {
  calling: "PF1.SpellSubschools.calling",
  charm: "PF1.SpellSubschools.charm",
  compulsion: "PF1.SpellSubschools.compulsion",
  creation: "PF1.SpellSubschools.creation",
  figment: "PF1.SpellSubschools.figment",
  glamer: "PF1.SpellSubschools.glamer",
  haunted: "PF1.SpellSubschools.haunted",
  healing: "PF1.SpellSubschools.healing",
  pattern: "PF1.SpellSubschools.pattern",
  phantasm: "PF1.SpellSubschools.phantasm",
  polymorph: "PF1.SpellSubschools.polymorph",
  scrying: "PF1.SpellSubschools.scrying",
  shadow: "PF1.SpellSubschools.shadow",
  summoning: "PF1.SpellSubschools.summoning",
  teleportation: "PF1.SpellSubschools.teleportation",
};

/**
 * Dictionary of subschools per shool
 *
 * @template {keyof typeof spellSchools} school
 * @template {keyof typeof spellSubschools} subschool
 *
 * @type {Record<school, subschool[]>}
 */
export const spellSubschoolsMap = /** @type {const} */ ({
  abj: [],
  con: ["calling", "creation", "healing", "summoning", "teleportation"],
  div: ["scrying"],
  enc: ["charm", "compulsion"],
  evo: [],
  ill: ["figment", "glamer", "pattern", "phantasm", "shadow"],
  nec: ["haunted"],
  trs: ["polymorph"],
  uni: [],
  misc: Object.keys(spellSubschools),
});

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

/**
 * Condition types for condition immunities and resistances selection
 */
export const conditionTypes = {
  bleed: "PF1.Condition.bleed",
  blind: "PF1.Condition.blind",
  confuse: "PF1.Condition.confused",
  daze: "PF1.Condition.dazed",
  dazzle: "PF1.Condition.dazzled",
  deaf: "PF1.Condition.deaf",
  deathEffects: "PF1.Condition.deathEffects",
  disease: "PF1.Condition.disease",
  energyDrain: "PF1.Condition.energyDrain",
  exhausted: "PF1.Condition.exhausted",
  fatigue: "PF1.Condition.fatigued",
  fear: "PF1.Condition.fear",
  moraleEffects: "PF1.Condition.moraleEffects",
  mindAffecting: "PF1.Condition.mindAffecting",
  poison: "PF1.Condition.poison",
  sicken: "PF1.Condition.sickened",
  paralyze: "PF1.Condition.paralyzed",
  petrify: "PF1.Condition.petrified",
  polymorph: "PF1.Condition.polymorph",
  stun: "PF1.Condition.stunned",
  sleep: "PF1.Condition.sleep",
};

export const buffTypes = {
  temp: "PF1.Subtypes.Item.buff.temp.Single",
  spell: "PF1.Subtypes.Item.buff.spell.Single",
  feat: "PF1.Subtypes.Item.buff.feat.Single",
  perm: "PF1.Subtypes.Item.buff.perm.Single",
  item: "PF1.Subtypes.Item.buff.item.Single",
  misc: "PF1.Subtypes.Item.buff.misc.Single",
};

/**
 * Formula for determining extra attacks for BAB iteratives
 */
export const iterativeExtraAttacks = "min(3, ceil(@bab / 5) - 1)";

/**
 * Formula for determining attack modifier for BAB iteratives
 */
export const iterativeAttackModifier = "@attackCount * -5";

/**
 * Extra Attacks configurations
 *
 * @example
 * Custom additional option
 * ```js
 * turboMonk: {
 *   label: "Turbo Monk",
 *   iteratives: true,
 *   count: "floor(@bab / 3)",
 *   bonus: "@attackCount * -2",
 *   manual: true,
 * }
 * ```
 */
export const extraAttacks = {
  // Standard: BAB iteratives
  standard: {
    label: "PF1.ExtraAttacks.Standard",
    iteratives: true,
    manual: false,
    formula: false,
  },
  // Advanced: BAB iteratives + manual extra attacks and custom formula
  advanced: {
    label: "PF1.ExtraAttacks.Advanced",
    iteratives: true,
    manual: true,
    formula: true,
  },
  // Chained Monk's Flurry of Blows
  // Requires BAB override and class association
  flurry: {
    label: "PF1.ExtraAttacks.Flurry",
    count: "ceil(@class.level / 7)",
    bonus: "-(@attackSetCount * 5)",
    attackName: "PF1.ExtraAttacks.FlurryAttack",
    flavor: "PF1.ExtraAttacks.FlurryFlavor",
    modToAll: "-(@fullAttack * 2)",
    iteratives: true,
    manual: false,
    formula: false,
  },
  // Unchained Monk's Flurry of Blows
  // Requires class association
  unflurry: {
    label: "PF1.ExtraAttacks.UnFlurry",
    count: "floor((@class.level + 9) / 10)",
    //bonus: "0",
    flavor: "PF1.ExtraAttacks.FlurryFlavor",
    attackName: "PF1.ExtraAttacks.FlurryAttack",
    iteratives: true,
    manual: false,
    formula: false,
  },
  // Custom: No BAB iteratives but with manual extra attacks and custom formula
  custom: {
    label: "PF1.ExtraAttacks.Custom",
    iteratives: false,
    manual: true,
    formula: true,
  },
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
  critMult: {
    _label: "PF1.CriticalMultiplier",
  },
  effect: {
    _label: "PF1.Effects",
  },
  misc: {
    _label: "PF1.MiscShort",
  },
};

// Default filters to exclude secondary actors
const baseActorFilters = { actor: { exclude: ["haunt", "vehicle", "trap"] } };

/**
 * Dictionaries of change/buff targets, each with a label and a category it belongs to,
 * as well as a sort value that determines this buffTarget's priority when Changes are applied.
 */
export const buffTargets = /** @type {const} */ ({
  acpA: { label: "PF1.ACPArmor", category: "misc", sort: 10000, filters: { ...baseActorFilters } },
  acpS: { label: "PF1.ACPShield", category: "misc", sort: 11000, filters: { ...baseActorFilters } },
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
  strPen: { label: "PF1.AbilityStrPen", category: "ability", sort: 50000 },
  dexPen: { label: "PF1.AbilityDexPen", category: "ability", sort: 51000 },
  conPen: { label: "PF1.AbilityConPen", category: "ability", sort: 52000 },
  intPen: { label: "PF1.AbilityIntPen", category: "ability", sort: 53000 },
  wisPen: { label: "PF1.AbilityWisPen", category: "ability", sort: 54000 },
  chaPen: { label: "PF1.AbilityChaPen", category: "ability", sort: 55000 },
  skills: {
    label: "PF1.BuffTarAllSkills",
    category: "skills",
    sort: 50000,
    deferred: true,
    filters: { ...baseActorFilters },
  },
  unskills: {
    label: "PF1.BuffTarUntrainedSkills",
    category: "skills",
    sort: 100000,
    deferred: true,
    filters: { ...baseActorFilters },
  },
  carryStr: { label: "PF1.CarryStrength", category: "misc", sort: 60000, filters: { ...baseActorFilters } },
  carryMult: { label: "PF1.CarryMultiplier", category: "misc", sort: 61000, filters: { ...baseActorFilters } },
  strSkills: { label: "PF1.BuffTarStrSkills", category: "skills", sort: 70000 }, // TODO: Should be deferred
  dexSkills: { label: "PF1.BuffTarDexSkills", category: "skills", sort: 71000 }, // TODO: Should be deferred
  conSkills: { label: "PF1.BuffTarConSkills", category: "skills", sort: 72000 }, // TODO: Should be deferred
  intSkills: { label: "PF1.BuffTarIntSkills", category: "skills", sort: 73000 }, // TODO: Should be deferred
  wisSkills: { label: "PF1.BuffTarWisSkills", category: "skills", sort: 74000 }, // TODO: Should be deferred
  chaSkills: { label: "PF1.BuffTarChaSkills", category: "skills", sort: 75000 }, // TODO: Should be deferred
  allChecks: { label: "PF1.BuffTarAllAbilityChecks", category: "abilityChecks", sort: 80000 }, // TODO: Should be deferred
  strChecks: { label: "PF1.BuffTarStrChecks", category: "abilityChecks", sort: 81000 }, // TODO: Should be deferred
  dexChecks: { label: "PF1.BuffTarDexChecks", category: "abilityChecks", sort: 82000 }, // TODO: Should be deferred
  conChecks: { label: "PF1.BuffTarConChecks", category: "abilityChecks", sort: 83000 }, // TODO: Should be deferred
  intChecks: { label: "PF1.BuffTarIntChecks", category: "abilityChecks", sort: 84000 }, // TODO: Should be deferred
  wisChecks: { label: "PF1.BuffTarWisChecks", category: "abilityChecks", sort: 85000 }, // TODO: Should be deferred
  chaChecks: { label: "PF1.BuffTarChaChecks", category: "abilityChecks", sort: 86000 }, // TODO: Should be deferred
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
  attack: { label: "PF1.BuffTarAllAttackRolls", category: "attack", sort: 110000, deferred: true },
  wattack: { label: "PF1.BuffTarWeaponAttack", category: "attack", sort: 111000, deferred: true },
  sattack: { label: "PF1.BuffTarSpellAttack", category: "attack", sort: 112000, deferred: true },
  mattack: { label: "PF1.BuffTarMeleeAttack", category: "attack", sort: 113000, deferred: true },
  nattack: { label: "PF1.BuffTarNaturalAttack", category: "attack", sort: 114000, deferred: true },
  rattack: { label: "PF1.BuffTarRangedAttack", category: "attack", sort: 115000, deferred: true },
  tattack: { label: "PF1.BuffTarThrownAttack", category: "attack", sort: 116000, deferred: true },
  damage: { label: "PF1.BuffTarAllDamageRolls", category: "damage", sort: 120000, deferred: true },
  wdamage: { label: "PF1.WeaponDamage", category: "damage", sort: 121000, deferred: true },
  mwdamage: { label: "PF1.MeleeWeaponDamage", category: "damage", sort: 121100, deferred: true },
  rwdamage: { label: "PF1.RangedWeaponDamage", category: "damage", sort: 121200, deferred: true },
  twdamage: { label: "PF1.ThrownWeaponDamage", category: "damage", sort: 121300, deferred: true },
  rdamage: { label: "PF1.AllRangedDamage", category: "damage", sort: 122100, deferred: true },
  mdamage: { label: "PF1.AllMeleeDamage", category: "damage", sort: 122200, deferred: true },
  ndamage: { label: "PF1.NaturalAttackDamage", category: "damage", sort: 123000, deferred: true },
  sdamage: { label: "PF1.SpellDamage", category: "damage", sort: 124000, deferred: true },
  critConfirm: { label: "PF1.CriticalConfirmation", category: "attack", sort: 130000, deferred: true },
  allSavingThrows: { label: "PF1.BuffTarAllSavingThrows", category: "savingThrows", sort: 140000, deferred: true },
  fort: { label: "PF1.SavingThrowFort", category: "savingThrows", sort: 141000, deferred: true },
  ref: { label: "PF1.SavingThrowRef", category: "savingThrows", sort: 142000, deferred: true },
  will: { label: "PF1.SavingThrowWill", category: "savingThrows", sort: 143000, deferred: true },
  cmb: { label: "PF1.CMB", category: "attack", sort: 150000 },
  cmd: { label: "PF1.CMD", category: "defense", sort: 151000 },
  ffcmd: { label: "PF1.CMDFlatFooted", category: "defense", sort: 152000 },
  init: { label: "PF1.Initiative", category: "misc", sort: 160000 }, // TODO: Should be deferred
  mhp: { label: "PF1.HitPoints", category: "health", sort: 170000 },
  wounds: { label: "PF1.Wounds", category: "health", sort: 180000, filters: { ...baseActorFilters } },
  vigor: { label: "PF1.Vigor", category: "health", sort: 181000, filters: { ...baseActorFilters } },
  spellResist: { label: "PF1.SpellResistance", category: "defense", sort: 190000 },
  bonusFeats: { label: "PF1.BuffTarBonusFeats", category: "misc", sort: 200000, filters: { ...baseActorFilters } },
  bonusSkillRanks: {
    label: "PF1.BuffTarBonusSkillRanks",
    category: "skills",
    sort: 210000,
    filters: { ...baseActorFilters },
  },
  concentration: {
    label: "PF1.Concentration",
    category: "spell",
    sort: 220000,
    deferred: true,
    filters: { ...baseActorFilters },
  },
  cl: { label: "PF1.CasterLevel", category: "spell", sort: 230000 },
  dc: { label: "PF1.SpellDC", category: "spell", sort: 240000 },
  sensedv: { label: "PF1.Sense.darkvision", category: "senses", sort: 250000 },
  sensets: { label: "PF1.Sense.tremorsense", category: "senses", sort: 250100 },
  sensebse: { label: "PF1.Sense.blindsense", category: "senses", sort: 250200 },
  sensebs: { label: "PF1.Sense.blindsight", category: "senses", sort: 250300 },
  sensesc: { label: "PF1.Sense.scent", category: "senses", sort: 250400 },
  sensetr: { label: "PF1.Sense.trueseeing", category: "senses", sort: 250500 },
});

/**
 * Categories grouping related {@link BuffTarget change targets} in the selector UI.
 */
export const buffTargetCategories = /** @type {const} */ ({
  defense: { label: "PF1.Defense" },
  savingThrows: { label: "PF1.SavingThrowPlural" },
  attack: { label: "PF1.Attack" },
  damage: { label: "PF1.Damage" },
  ability: { label: "PF1.AbilityScore", filters: { ...baseActorFilters } },
  abilityChecks: { label: "PF1.BuffTarAbilityChecks", filters: { ...baseActorFilters } },
  health: { label: "PF1.Health", filters: { ...baseActorFilters } },
  skills: { label: "PF1.Skills", filters: { ...baseActorFilters } },
  skill: { label: "PF1.BuffTarSpecificSkill", filters: { ...baseActorFilters } },
  speed: { label: "PF1.Movement.Speed" },
  spell: { label: "PF1.BuffTarSpells", filters: { ...baseActorFilters } },
  misc: { label: "PF1.Misc" },
  senses: { label: "PF1.Senses" },
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
  spellEffect: { label: "PF1.BuffTarSpellEffect", category: "spell" },
  concentration: { label: "PF1.Concentration", category: "spell" },
  cl: { label: "PF1.CasterLevel", category: "spell" },
  ac: { label: "PF1.ACNormal", category: "defense" },
  cmd: { label: "PF1.CMD", category: "defense" },
  sr: { label: "PF1.SpellResistance", category: "defense" },
  init: { label: "PF1.Initiative", category: "misc" },
  // Speeds
  landSpeed: { label: "PF1.Movement.Mode.land", category: "speed" },
  climbSpeed: { label: "PF1.Movement.Mode.climb", category: "speed" },
  swimSpeed: { label: "PF1.Movement.Mode.swim", category: "speed" },
  burrowSpeed: { label: "PF1.Movement.Mode.burrow", category: "speed" },
  flySpeed: { label: "PF1.Movement.Mode.fly", category: "speed" },
  allSpeeds: { label: "PF1.BuffTarAllSpeeds", category: "speed" },
};

export const contextNoteCategories = {
  attacks: { label: "PF1.Attacks" },
  savingThrows: { label: "PF1.SavingThrowPlural" },
  skills: { label: "PF1.Skills", filters: { ...baseActorFilters } },
  skill: { label: "PF1.BuffTarSpecificSkill", filters: { ...baseActorFilters } },
  abilityChecks: { label: "PF1.BuffTarAbilityChecks" },
  spell: { label: "PF1.BuffTarSpells", filters: { ...baseActorFilters } },
  defense: { label: "PF1.Defense" },
  speed: { label: "PF1.Movement.Speed" },
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
  aberration: "PF1.CreatureTypes.aberration",
  animal: "PF1.CreatureTypes.animal",
  construct: "PF1.CreatureTypes.construct",
  dragon: "PF1.CreatureTypes.dragon",
  fey: "PF1.CreatureTypes.fey",
  humanoid: "PF1.CreatureTypes.humanoid",
  magicalBeast: "PF1.CreatureTypes.magicalBeast",
  monstrousHumanoid: "PF1.CreatureTypes.monstrousHumanoid",
  ooze: "PF1.CreatureTypes.ooze",
  outsider: "PF1.CreatureTypes.outsider",
  plant: "PF1.CreatureTypes.plant",
  undead: "PF1.CreatureTypes.undead",
  vermin: "PF1.CreatureTypes.vermin",
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
export const CHARACTER_EXP_LEVELS = {
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
export const CR_EXP_LEVELS = [
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
    "class",
    "ablMod",
    "item",
    "action",
    "level",
    "mod",
  ],
};

export const traitSelector = {
  minChoicesForSearch: 6,
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

/**
 * Sheet item section configuration.
 */
export const sheetSections = {
  classes: {
    class: {
      label: "PF1.ClassPlural",
      filters: [{ type: "class" }],
      interface: {
        types: true,
        level: true,
        create: true,
      },
      create: { type: "class", system: { subType: "base" } },
      sort: 1_000,
    },
  },
  combat: {
    weapon: {
      label: "PF1.Subtypes.Item.attack.weapon.Plural",
      filters: [{ type: "attack", subTypes: ["weapon"] }],
      interface: {
        create: true,
      },
      create: { type: "attack", system: { subType: "weapon", proficient: true } },
      sort: 1_000,
    },
    natural: {
      label: "PF1.Subtypes.Item.attack.natural.Plural",
      filters: [{ type: "attack", subTypes: ["natural"] }],
      interface: {
        create: true,
      },
      create: { type: "attack", system: { subType: "natural" } },
      sort: 2_000,
    },
    ability: {
      label: "PF1.Subtypes.Item.attack.ability.Plural",
      filters: [{ type: "attack", subTypes: ["ability"] }],
      interface: {
        create: true,
      },
      create: { type: "attack", system: { subType: "ability" } },
      sort: 3_000,
    },
    racialAbility: {
      label: "PF1.Subtypes.Item.attack.racialAbility.Plural",
      filters: [{ type: "attack", subTypes: ["racialAbility"] }],
      interface: {
        create: true,
      },
      create: { type: "attack", system: { subType: "racialAbility" } },
      sort: 4_000,
    },
    item: {
      label: "PF1.Subtypes.Item.attack.item.Plural",
      filters: [{ type: "attack", subTypes: ["item"] }],
      interface: {
        create: true,
      },
      create: { type: "attack", system: { subType: "item" } },
      sort: 5_000,
    },
    misc: {
      label: "PF1.Subtypes.Item.attack.misc.Plural",
      filters: [{ type: "attack", subTypes: ["misc"] }],
      interface: {
        create: true,
      },
      create: { type: "attack", system: { subType: "misc" } },
      sort: 6_000,
    },
  },
  inventory: {
    weapon: {
      label: "PF1.InventoryWeapons",
      filters: [{ type: "weapon" }],
      interface: {
        create: true,
        actions: true,
        equip: true,
      },
      create: { type: "weapon", system: { subType: "simple" } },
      sort: 1_000,
    },
    armor: {
      label: "PF1.ArmorOrShield",
      filters: [{ type: "equipment", subTypes: ["armor", "shield"] }],
      interface: {
        create: true,
        actions: true,
        equip: true,
        slots: true,
      },
      create: { type: "equipment", system: { subType: "armor", equipmentSubtype: "lightArmor", slot: "" } },
      sort: 2_000,
    },
    equipment: {
      label: "PF1.InventoryEquipment",
      filters: [{ type: "equipment", subTypes: ["wondrous", "other", "clothing"] }],
      interface: {
        create: true,
        actions: true,
        equip: true,
        slots: true,
      },
      create: { type: "equipment", system: { subType: "wondrous", slot: "slotless" } },
      sort: 3_000,
    },
    implants: {
      label: "PF1.InventoryImplants",
      filters: [{ type: "implant" }],
      interface: {
        create: true,
        actions: true,
        equip: true,
        slots: true,
      },
      labels: {
        equip: "PF1.Implanted",
      },
      create: { type: "implant", system: { subType: "cybertech" } },
      sort: 4_000,
    },
    consumable: {
      label: "PF1.InventoryConsumables",
      filters: [{ type: "consumable" }],
      interface: {
        create: true,
        actions: true,
        equip: false,
      },
      create: { type: "consumable" },
      sort: 5_000,
    },
    gear: {
      label: "PF1.Subtypes.Item.loot.gear.Plural",
      filters: [
        {
          type: "loot",
          subTypes: ["gear", "adventuring", "tool", "reagent", "remedy", "herb", "animal", "animalGear"],
        },
      ],
      interface: {
        create: true,
        actions: true,
        equip: () => !pf1.config.unequippableLoot.includes("gear"),
      },
      create: { type: "loot", system: { subType: "gear" } },
      sort: 6_000,
    },
    ammo: {
      label: "PF1.Subtypes.Item.loot.ammo.Plural",
      filters: [{ type: "loot", subTypes: ["ammo"] }],
      interface: {
        create: true,
        actions: false,
        equip: () => !pf1.config.unequippableLoot.includes("ammo"),
      },
      create: { type: "loot", system: { subType: "ammo" } },
      sort: 8_000,
    },
    misc: {
      label: "PF1.Subtypes.Item.loot.misc.Plural",
      filters: [{ type: "loot", subTypes: ["misc", "food", "entertainment", "vehicle"] }],
      interface: {
        create: true,
        actions: false,
        equip: true, // Misc covers more than just misc loot
      },
      create: { type: "loot", system: { subType: "misc" } },
      sort: 9_000,
    },
    tradeGoods: {
      label: "PF1.Subtypes.Item.loot.tradeGoods.Plural",
      filters: [{ type: "loot", subTypes: ["tradeGoods", "treasure"] }],
      interface: {
        create: true,
        actions: false,
        equip: () => !pf1.config.unequippableLoot.includes("tradeGoods"),
      },
      create: { type: "loot", system: { subType: "tradeGoods" } },
      sort: 15_000,
    },
    container: {
      label: "PF1.InventoryContainers",
      filters: [{ type: "container" }],
      interface: {
        create: true,
        actions: false,
        equip: true,
      },
      create: { type: "container" },
      sort: 20_000,
    },
  },
  features: {
    feat: {
      label: "PF1.Subtypes.Item.feat.feat.Plural",
      filters: [{ type: "feat", subTypes: ["feat"] }],
      interface: {
        create: true,
        actions: true,
        types: true,
      },
      create: { type: "feat", system: { subType: "feat" } },
      sort: 2_000,
    },
    classFeat: {
      label: "PF1.Subtypes.Item.feat.classFeat.Plural",
      filters: [{ type: "feat", subTypes: ["classFeat"] }],
      interface: {
        create: true,
        actions: true,
        types: true,
      },
      create: { type: "feat", system: { subType: "classFeat" } },
      sort: 1_000,
    },
    trait: {
      label: "PF1.Subtypes.Item.feat.trait.Plural",
      filters: [{ type: "feat", subTypes: ["trait"] }],
      interface: {
        create: true,
        actions: true,
        types: true,
      },
      create: { type: "feat", system: { subType: "trait" } },
      sort: 3_000,
    },
    racial: {
      label: "PF1.Subtypes.Item.feat.racial.Plural",
      filters: [{ type: "feat", subTypes: ["racial"] }],
      interface: {
        create: true,
        actions: true,
        types: true,
      },
      create: { type: "feat", system: { subType: "racial" } },
      sort: 4_000,
    },
    misc: {
      label: "PF1.Subtypes.Item.feat.misc.Plural",
      filters: [{ type: "feat", subTypes: ["misc"] }],
      interface: {
        create: true,
        actions: true,
        types: true,
      },
      create: { type: "feat", system: { subType: "misc" } },
      sort: 15_000,
    },
    template: {
      label: "PF1.Subtypes.Item.feat.template.Plural",
      filters: [{ type: "feat", subTypes: ["template"] }],
      interface: {
        create: true,
        actions: false,
      },
      create: { type: "feat", system: { subType: "template" } },
      sort: 6_000,
    },
  },
  buffs: {
    feat: {
      label: "PF1.Subtypes.Item.buff.feat.Plural",
      filters: [{ type: "buff", subTypes: ["feat"] }],
      interface: {
        create: true,
        actions: true,
      },
      create: { type: "buff", system: { subType: "feat" } },
      sort: 5_000,
    },
    item: {
      label: "PF1.Subtypes.Item.buff.item.Plural",
      filters: [{ type: "buff", subTypes: ["item"] }],
      interface: {
        create: true,
        actions: true,
      },
      create: { type: "buff", system: { subType: "item" } },
      sort: 4_000,
    },
    misc: {
      label: "PF1.Subtypes.Item.buff.misc.Plural",
      filters: [{ type: "buff", subTypes: ["misc"] }],
      interface: {
        create: true,
        actions: true,
      },
      create: { type: "buff", system: { subType: "misc" } },
      sort: 10_000,
    },
    perm: {
      label: "PF1.Subtypes.Item.buff.perm.Plural",
      filters: [{ type: "buff", subTypes: ["perm"] }],
      interface: {
        create: true,
        actions: true,
      },
      create: { type: "buff", system: { subType: "perm" } },
      sort: 6_000,
    },
    spell: {
      label: "PF1.Subtypes.Item.buff.spell.Plural",
      filters: [{ type: "buff", subTypes: ["spell"] }],
      interface: {
        create: true,
        actions: true,
      },
      create: { type: "buff", system: { subType: "spell" } },
      sort: 2_000,
    },
    temp: {
      label: "PF1.Subtypes.Item.buff.temp.Plural",
      filters: [{ type: "buff", subTypes: ["temp"] }],
      interface: {
        create: true,
        actions: true,
      },
      create: { type: "buff", system: { subType: "temp" } },
      sort: 1_000,
    },
  },
  // Spells section is not used quite like the others
  spells: {
    spell: {
      interface: {
        create: true,
      },
      create: { type: "spell", system: { school: "abj" } },
    },
  },
  // Lite sheet and secondary sheet items
  combatlite: {
    attacks: {
      label: "PF1.AbilityPlural",
      filters: [{ type: "attack" }],
      interface: {
        create: true,
        types: true,
      },
      create: { type: "attack", system: { subType: "weapon", proficient: true } },
    },
  },
  // Misc section is only informal for sheet handling of special cases
  misc: {
    race: {
      create: { type: "race" },
    },
  },
};

// Prepare sheet sections with data available later
// ... allowing module modification also.
Hooks.once("setup", () => {
  for (const [catKey, category] of Object.entries(sheetSections)) {
    for (const [sectKey, section] of Object.entries(category)) {
      section.category = catKey;
      section.id = sectKey;
      section.path = `${catKey}.${sectKey}`;

      section.label = game.i18n.localize(section.label);

      const iface = section.interface;
      if (typeof iface?.equip === "function") {
        iface.equip = iface.equip();
      }
    }
  }
});
