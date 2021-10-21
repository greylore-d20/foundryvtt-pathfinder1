// Namespace PF1 Configuration Values
/**
 * PF1 Configuration Values
 *
 * A dictionary of dictionaries providing configuration data like formulae,
 * translation keys, and other configuration values. Translations keys are
 * assumed to get replaced by their proper translation when the system is loaded.
 *
 * The PF1 object may be adjusted to influence the system's behaviour during runtime.
 *
 * @global
 * @memberof CONFIG
 */
export const PF1 = {
  re: {
    traitSeparator: /\s*[;]\s*/g,
  },

  /**
   * The set of Ability Scores used within the system
   */
  abilities: {
    str: "PF1.AbilityStr",
    dex: "PF1.AbilityDex",
    con: "PF1.AbilityCon",
    int: "PF1.AbilityInt",
    wis: "PF1.AbilityWis",
    cha: "PF1.AbilityCha",
  },

  /**
   * The set of Ability Scores used within the system in short form
   */
  abilitiesShort: {
    str: "PF1.AbilityShortStr",
    dex: "PF1.AbilityShortDex",
    con: "PF1.AbilityShortCon",
    int: "PF1.AbilityShortInt",
    wis: "PF1.AbilityShortWis",
    cha: "PF1.AbilityShortCha",
  },

  /**
   * The point cost to increase an ability score using Point Buy
   */
  abilityCost: {
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
  },

  /**
   * The set of Saving Throws
   */
  savingThrows: {
    fort: "PF1.SavingThrowFort",
    ref: "PF1.SavingThrowRef",
    will: "PF1.SavingThrowWill",
  },

  /**
   * The types of classes
   */
  classTypes: {
    base: "PF1.ClassTypeBase",
    prestige: "PF1.ClassTypePrestige",
    npc: "PF1.ClassTypeNPC",
    racial: "PF1.ClassTypeRacial",
    mythic: "PF1.ClassTypeMythic",
  },

  /**
   * Valid options for a class's BAB progression
   */
  classBAB: {
    low: "PF1.Low",
    med: "PF1.Medium",
    high: "PF1.High",
  },

  /**
   * Valid options for a class's saving throw bonus progression
   */
  classSavingThrows: {
    low: "PF1.Poor",
    high: "PF1.Good",
  },

  /**
   * The formulae for BAB progressions
   */
  classBABFormulas: {
    low: "floor(@level * 0.5)",
    med: "floor(@level * 0.75)",
    high: "@level",
  },

  /**
   * The formulae for saving throw progressions by class type
   */
  classSavingThrowFormulas: {
    base: {
      low: "floor(@level / 3)",
      high: "2 + floor(@level / 2)",
    },
    prestige: {
      low: "floor((1 + @level) / 3)",
      high: "floor((1 + @level) / 2)",
    },
    npc: {
      low: "floor(@level / 3)",
      high: "2 + floor(@level / 2)",
    },
    racial: {
      low: "floor(@level / 3)",
      high: "2 + floor(@level / 2)",
    },
    mythic: {
      low: "0",
      high: "0",
    },
  },

  /**
   * The choices available for favored class bonuses
   */
  favouredClassBonuses: {
    hp: "PF1.FavouredClassHP",
    skill: "PF1.FavouredClassSkill",
    alt: "PF1.FavouredClassAlt",
  },

  /**
   * Icons used for favored class bonus choices
   */
  favouredClassBonusIcons: {
    hp: "fa-heartbeat",
    skill: "fa-wrench",
    alt: "fa-tag",
  },

  /**
   * The set of Armor Classes
   */
  ac: {
    normal: "PF1.ACNormal",
    touch: "PF1.ACTouch",
    flatFooted: "PF1.ACFlatFooted",
  },

  /**
   * The set of Armor Class modifier types
   */
  acValueLabels: {
    normal: "PF1.ACTypeNormal",
    touch: "PF1.ACTypeTouch",
    flatFooted: "PF1.ACTypeFlatFooted",
  },

  /* -------------------------------------------- */

  /**
   * Character alignment options
   */
  alignments: {
    lg: "PF1.AlignmentLG",
    ng: "PF1.AlignmentNG",
    cg: "PF1.AlignmentCG",
    ln: "PF1.AlignmentLN",
    tn: "PF1.AlignmentTN",
    cn: "PF1.AlignmentCN",
    le: "PF1.AlignmentLE",
    ne: "PF1.AlignmentNE",
    ce: "PF1.AlignmentCE",
  },

  /**
   * Character alignment options in their short form
   */
  alignmentsShort: {
    lg: "PF1.AlignmentShortLG",
    ng: "PF1.AlignmentShortNG",
    cg: "PF1.AlignmentShortCG",
    ln: "PF1.AlignmentShortLN",
    tn: "PF1.AlignmentShortTN",
    cn: "PF1.AlignmentShortCN",
    le: "PF1.AlignmentShortLE",
    ne: "PF1.AlignmentShortNE",
    ce: "PF1.AlignmentShortCE",
  },

  /* -------------------------------------------- */

  /**
   * The set of Armor Proficiencies which a character may have
   */
  armorProficiencies: {
    lgt: "PF1.ArmorProfLight",
    med: "PF1.ArmorProfMedium",
    hvy: "PF1.ArmorProfHeavy",
    shl: "PF1.ArmorProfShield",
    twr: "PF1.ArmorProfTowerShield",
  },

  /**
   * The set of broad Weapon Proficiencies a character may have
   */
  weaponProficiencies: {
    sim: "PF1.WeaponProfSimple",
    mar: "PF1.WeaponProfMartial",
  },

  /* -------------------------------------------- */

  /**
   * This describes the ways that an ability can be activated.
   */
  abilityActivationTypes: {
    passive: "PF1.ActivationTypePassive",
    free: "PF1.ActivationTypeFree",
    nonaction: "PF1.ActivationTypeNonaction",
    swift: "PF1.ActivationTypeSwift",
    immediate: "PF1.ActivationTypeImmediate",
    move: "PF1.ActivationTypeMove",
    standard: "PF1.ActivationTypeStandard",
    full: "PF1.ActivationTypeFullround",
    attack: "PF1.ActivationTypeAttack",
    aoo: "PF1.ActivationTypeAoO",
    round: "PF1.ActivationTypeRound",
    minute: "PF1.ActivationTypeMinute",
    hour: "PF1.ActivationTypeHour",
    special: "PF1.ActivationTypeSpecial",
  },

  /**
   * This describes plurals for activation types.
   */
  abilityActivationTypesPlurals: {
    free: "PF1.ActivationTypeFreePlural",
    swift: "PF1.ActivationTypeSwiftPlural",
    immediate: "PF1.ActivationTypeImmediatePlural",
    move: "PF1.ActivationTypeMovePlural",
    standard: "PF1.ActivationTypeStandardPlural",
    full: "PF1.ActivationTypeFullroundPlural",
    attack: "PF1.ActivationTypeAttackPlural",
    round: "PF1.ActivationTypeRoundPlural",
    minute: "PF1.ActivationTypeMinutePlural",
    hour: "PF1.ActivationTypeHourPlural",
  },

  /**
   * This describes the ways that an ability can be activated when using
   * Unchained rules.
   */
  abilityActivationTypes_unchained: {
    passive: "PF1.ActivationTypePassive",
    free: "PF1.ActivationTypeFree",
    nonaction: "PF1.ActivationTypeNonaction",
    reaction: "PF1.ActivationTypeReaction",
    action: "PF1.ActivationTypeAction",
    attack: "PF1.ActivationTypeAttack",
    aoo: "PF1.ActivationTypeAoO",
    minute: "PF1.ActivationTypeMinute",
    hour: "PF1.ActivationTypeHour",
    special: "PF1.ActivationTypeSpecial",
  },

  /**
   * This describes plurals for the ways that an ability can be activated when
   * using Unchained rules.
   */
  abilityActivationTypesPlurals_unchained: {
    passive: "PF1.ActivationTypePassive",
    free: "PF1.ActivationTypeFreePlural",
    reaction: "PF1.ActivationTypeReactionPlural",
    action: "PF1.ActivationTypeActionPlural",
    minute: "PF1.ActivationTypeMinutePlural",
    hour: "PF1.ActivationTypeHourPlural",
    special: "PF1.ActivationTypeSpecial",
  },

  /**
   * The possible conditions when using Wound Threshold rules
   */
  woundThresholdConditions: {
    0: "PF1.WoundLevelHealthy",
    1: "PF1.WoundLevelGrazed",
    2: "PF1.WoundLevelWounded",
    3: "PF1.WoundLevelCritical",
  },

  divineFocus: {
    0: "",
    1: "PF1.SpellComponentDivineFocusAlone",
    2: "PF1.SpellComponentDivineFocusMaterial",
    3: "PF1.SpellComponentDivineFocusFocus",
  },

  /**
   * The measure template types available e.g. for spells
   */
  measureTemplateTypes: {
    cone: "PF1.MeasureTemplateCone",
    circle: "PF1.MeasureTemplateCircle",
    ray: "PF1.MeasureTemplateRay",
    rect: "PF1.MeasureTemplateRectangle",
  },

  /* -------------------------------------------- */

  /**
   * The possible creature sizes
   */
  actorSizes: {
    fine: "PF1.ActorSizeFine",
    dim: "PF1.ActorSizeDiminutive",
    tiny: "PF1.ActorSizeTiny",
    sm: "PF1.ActorSizeSmall",
    med: "PF1.ActorSizeMedium",
    lg: "PF1.ActorSizeLarge",
    huge: "PF1.ActorSizeHuge",
    grg: "PF1.ActorSizeGargantuan",
    col: "PF1.ActorSizeColossal",
  },

  /**
   * The possible creature sizes in their one-letter form
   */
  sizeChart: {
    fine: "F",
    dim: "D",
    tiny: "T",
    sm: "S",
    med: "M",
    lg: "L",
    huge: "H",
    grg: "G",
    col: "C",
  },

  /**
   * The size values for Tokens according to the creature's size
   */
  tokenSizes: {
    fine: { w: 1, h: 1, scale: 0.45 },
    dim: { w: 1, h: 1, scale: 0.6 },
    tiny: { w: 1, h: 1, scale: 0.75 },
    sm: { w: 1, h: 1, scale: 0.9 },
    med: { w: 1, h: 1, scale: 1 },
    lg: { w: 2, h: 2, scale: 1 },
    huge: { w: 3, h: 3, scale: 1 },
    grg: { w: 4, h: 4, scale: 1 },
    col: { w: 6, h: 6, scale: 1 },
  },

  /**
   * The size modifier applied to creatures not of medium size
   */
  sizeMods: {
    fine: 8,
    dim: 4,
    tiny: 2,
    sm: 1,
    med: 0,
    lg: -1,
    huge: -2,
    grg: -4,
    col: -8,
  },

  /**
   * The size modifier applied to creatures not of medium size
   */
  sizeSpecialMods: {
    fine: -8,
    dim: -4,
    tiny: -2,
    sm: -1,
    med: 0,
    lg: 1,
    huge: 2,
    grg: 4,
    col: 8,
  },

  /**
   * The size modifier applied to fly checks of creatures not of medium size
   */
  sizeFlyMods: {
    fine: 8,
    dim: 6,
    tiny: 4,
    sm: 2,
    med: 0,
    lg: -2,
    huge: -4,
    grg: -6,
    col: -8,
  },

  /**
   * The size modifier applied to stealth checks of creatures not of medium size
   */
  sizeStealthMods: {
    fine: 16,
    dim: 12,
    tiny: 8,
    sm: 4,
    med: 0,
    lg: -4,
    huge: -8,
    grg: -12,
    col: -16,
  },

  /**
   * The possible options for a creature's maneuverability
   */
  flyManeuverabilities: {
    clumsy: "PF1.FlyManeuverabilityClumsy",
    poor: "PF1.FlyManeuverabilityPoor",
    average: "PF1.FlyManeuverabilityAverage",
    good: "PF1.FlyManeuverabilityGood",
    perfect: "PF1.FlyManeuverabilityPerfect",
  },

  /**
   * The bonus values for a creature's maneuverability
   */
  flyManeuverabilityValues: {
    clumsy: -8,
    poor: -4,
    average: 0,
    good: 4,
    perfect: 8,
  },

  /**
   * The resulting speed values when a base speed is reduced
   */
  speedReduction: {
    5: 5,
    15: 10,
    20: 15,
    30: 20,
    35: 25,
    45: 30,
    50: 35,
    60: 40,
    65: 45,
    75: 50,
    80: 55,
    90: 60,
    95: 65,
    105: 70,
    110: 75,
    120: 80,
  },

  /* -------------------------------------------- */

  /**
   * An array of maximum carry capacities, where the index is the ability/strength score.
   */
  encumbranceLoads: [
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
  ],

  /**
   * Encumbrance multipliers applied due to a creature's size for bi- and
   * quadrupedal creatures.
   */
  encumbranceMultipliers: {
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
  },

  /* -------------------------------------------- */

  /**
   * The types for Items
   */
  itemTypes: {
    equipment: "PF1.ItemTypeEquipment",
    weapon: "PF1.ItemTypeWeapon",
    loot: "PF1.ItemTypeLoot",
    consumable: "PF1.ItemTypeConsumable",
    class: "PF1.ItemTypeClass",
    buff: "PF1.ItemTypeBuff",
    spell: "PF1.ItemTypeSpell",
    feat: "PF1.ItemTypeFeat",
    attack: "PF1.ItemTypeAttack",
  },

  /**
   * Classification types for item action types
   */
  itemActionTypes: {
    mwak: "PF1.ActionMWAK",
    rwak: "PF1.ActionRWAK",
    msak: "PF1.ActionMSAK",
    rsak: "PF1.ActionRSAK",
    mcman: "PF1.ActionMCMan",
    rcman: "PF1.ActionRCMan",
    spellsave: "PF1.ActionSpellSave",
    save: "PF1.ActionSave",
    heal: "PF1.ActionHeal",
    other: "PF1.ActionOther",
  },

  /* -------------------------------------------- */

  itemCapacityTypes: {
    items: "PF1.ItemContainerCapacityItems",
    weight: "PF1.ItemContainerCapacityWeight",
  },

  /* -------------------------------------------- */

  /**
   * Enumerate the lengths of time over which an item can have limited use ability
   */
  limitedUsePeriods: {
    single: "PF1.LimitedUseSingle",
    unlimited: "PF1.Unlimited",
    day: "PF1.LimitedUseDay",
    week: "PF1.LimitedUseWeek",
    charges: "PF1.LimitedUseCharges",
  },

  /* -------------------------------------------- */

  /**
   * The various equipment types and their subtypes
   */
  equipmentTypes: {
    armor: {
      _label: "PF1.EquipTypeArmor",
      lightArmor: "PF1.EquipTypeLight",
      mediumArmor: "PF1.EquipTypeMedium",
      heavyArmor: "PF1.EquipTypeHeavy",
    },
    shield: {
      _label: "PF1.EquipTypeShield",
      lightShield: "PF1.EquipTypeLightShield",
      heavyShield: "PF1.EquipTypeHeavyShield",
      towerShield: "PF1.EquipTypeTowerShield",
      other: "PF1.EquipTypeOtherShield",
    },
    misc: {
      _label: "PF1.Misc",
      wondrous: "PF1.EquipTypeWondrousItem",
      clothing: "PF1.EquipTypeClothing",
      other: "PF1.Other",
    },
  },

  /**
   * The slots equipment can occupy, sorted by category
   */
  equipmentSlots: {
    armor: {
      armor: "PF1.EquipSlotArmor",
    },
    shield: {
      shield: "PF1.EquipSlotShield",
    },
    misc: {
      slotless: "PF1.EquipSlotSlotless",
      head: "PF1.EquipSlotHead",
      headband: "PF1.EquipSlotHeadband",
      eyes: "PF1.EquipSlotEyes",
      shoulders: "PF1.EquipSlotShoulders",
      neck: "PF1.EquipSlotNeck",
      chest: "PF1.EquipSlotChest",
      body: "PF1.EquipSlotBody",
      belt: "PF1.EquipSlotBelt",
      wrists: "PF1.EquipSlotWrists",
      hands: "PF1.EquipSlotHands",
      ring: "PF1.EquipSlotRing",
      feet: "PF1.EquipSlotFeet",
    },
  },

  /**
   * The subtypes for loot items
   */
  lootTypes: {
    gear: "PF1.LootTypeGear",
    ammo: "PF1.LootTypeAmmo",
    tradeGoods: "PF1.LootTypeTradeGoods",
    misc: "PF1.Misc",
  },

  /* -------------------------------------------- */

  /**
   * Enumerate the valid consumable types which are recognized by the system
   */
  consumableTypes: {
    potion: "PF1.ConsumableTypePotion",
    poison: "PF1.ConsumableTypePoison",
    drug: "PF1.ConsumableTypeDrug",
    scroll: "PF1.ConsumableTypeScroll",
    wand: "PF1.ConsumableTypeWand",
    staff: "PF1.ConsumableTypeStaff",
    misc: "PF1.Misc",
  },

  attackTypes: {
    weapon: "PF1.AttackTypeWeapon",
    natural: "PF1.AttackTypeNatural",
    ability: "PF1.AttackTypeAbility",
    racialAbility: "PF1.AttackTypeRacial",
    item: "PF1.Item",
    misc: "PF1.Misc",
  },

  featTypes: {
    feat: "PF1.FeatTypeFeat",
    classFeat: "PF1.FeatTypeClassFeat",
    trait: "PF1.FeatTypeTraits",
    racial: "PF1.FeatTypeRacial",
    misc: "PF1.Misc",
    template: "PF1.FeatTypeTemplate",
  },

  featTypesPlurals: {
    feat: "PF1.FeatPlural",
    classFeat: "PF1.ClassFeaturePlural",
    trait: "PF1.TraitPlural",
    racial: "PF1.RacialTraitPlural",
    template: "PF1.TemplatePlural",
  },

  /**
   * Ability types, each with their short and their long form
   */
  abilityTypes: {
    ex: {
      short: "PF1.AbilityTypeShortExtraordinary",
      long: "PF1.AbilityTypeExtraordinary",
    },
    su: {
      short: "PF1.AbilityTypeShortSupernatural",
      long: "PF1.AbilityTypeSupernatural",
    },
    sp: {
      short: "PF1.AbilityTypeShortSpell-Like",
      long: "PF1.AbilityTypeSpell-Like",
    },
  },

  /* -------------------------------------------- */

  /**
   * The valid currency denominations supported by the game system
   */
  currencies: {
    pp: "PF1.CurrencyPP",
    gp: "PF1.CurrencyGP",
    sp: "PF1.CurrencySP",
    cp: "PF1.CurrencyCP",
  },

  acTypes: {
    armor: "Armor",
    shield: "Shield",
    natural: "Natural Armor",
  },

  /**
   * The types of bonus modifiers
   */
  bonusModifiers: {
    untyped: "PF1.BonusModifierUntyped",
    untypedPerm: "PF1.BonusModifierUntypedPerm",
    base: "PF1.BonusModifierBase",
    enh: "PF1.BonusModifierEnhancement",
    dodge: "PF1.BonusModifierDodge",
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
  },

  /**
   * An array of stacking bonus modifiers by their keys for {@link bonusModifiers}
   */
  stackingBonusModifiers: ["untyped", "untypedPerm", "dodge", "racial", "penalty"],

  /* -------------------------------------------- */

  /**
   * The damage types
   */
  damageTypes: {
    bludgeoning: "PF1.DamageTypeBludgeoning",
    piercing: "PF1.DamageTypePiercing",
    slashing: "PF1.DamageTypeSlashing",
    cold: "PF1.DamageTypeCold",
    fire: "PF1.DamageTypeFire",
    electric: "PF1.DamageTypeElectricity",
    sonic: "PF1.DamageTypeSonic",
    acid: "PF1.DamageTypeAcid",
    force: "PF1.DamageTypeForce",
    negative: "PF1.DamageTypeNegative",
    positive: "PF1.DamageTypePositive",
  },

  /* -------------------------------------------- */

  /**
   * Valid options for the range of abilities and spells
   */
  distanceUnits: {
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
  },

  measureUnits: {
    ft: "PF1.DistFt",
    mi: "PF1.DistMi",
    m: "PF1.DistM",
    km: "PF1.DistKM",
  },

  measureUnitsShort: {
    ft: "PF1.DistFtShort",
    mi: "PF1.DistMiShort",
    m: "PF1.DistMShort",
    km: "PF1.DistKMShort",
  },

  actorStatures: {
    tall: "PF1.StatureTall",
    long: "PF1.StatureLong",
  },

  /* -------------------------------------------- */

  /**
   * This Object defines the types of single or area targets which can be applied in the game system.
   */
  targetTypes: {
    none: "PF1.None",
    self: "PF1.TargetSelf",
    creature: "PF1.TargetCreature",
    ally: "PF1.TargetAlly",
    enemy: "PF1.TargetEnemy",
    object: "PF1.TargetObject",
    space: "PF1.TargetSpace",
    radius: "PF1.TargetRadius",
    sphere: "PF1.TargetSphere",
    cylinder: "PF1.TargetCylinder",
    cone: "PF1.TargetCone",
    square: "PF1.TargetSquare",
    cube: "PF1.TargetCube",
    line: "PF1.TargetLine",
    wall: "PF1.TargetWall",
  },

  /* -------------------------------------------- */

  /**
   * This Object defines the various lengths of time which can occur in PF1
   */
  timePeriods: {
    inst: "PF1.TimeInst",
    turn: "PF1.TimeTurn",
    round: "PF1.TimeRound",
    minute: "PF1.TimeMinute",
    hour: "PF1.TimeHour",
    day: "PF1.TimeDay",
    month: "PF1.TimeMonth",
    year: "PF1.TimeYear",
    perm: "PF1.TimePerm",
    seeText: "PF1.SeeText",
    spec: "PF1.Special",
  },

  timePeriodsShort: {
    turn: "PF1.TimeTurnShort",
    round: "PF1.TimeRoundShort",
    minute: "PF1.TimeMinuteShort",
    hour: "PF1.TimeHourShort",
  },

  /* -------------------------------------------- */

  /**
   * This Object determines spells gained and cast per level
   */
  casterProgression: {
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
  },

  /* -------------------------------------------- */

  // Healing Types
  /**
   * Types of healing
   */
  healingTypes: {
    healing: "PF1.Healing",
    temphp: "PF1.HealingTemp",
  },

  /* -------------------------------------------- */

  /**
   * Character senses options
   */
  senses: {
    bs: "PF1.SenseBS",
    dv: "PF1.SenseDV",
    ts: "PF1.SenseTS",
    tr: "PF1.SenseTR",
    ll: "PF1.SenseLL",
  },

  /* -------------------------------------------- */

  /**
   * The set of skill which can be trained in PF1
   */
  skills: {
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
  },

  /**
   * Compendium journal entries containing details about {@link skills}
   */
  skillCompendiumEntries: {
    acr: "pf1.skills.HPsdXjjRtKNGFGRc",
    apr: "pf1.skills.W5GT9F3euC4aG9zP",
    blf: "pf1.skills.pAB2PYkZO3lsmeaC",
    clm: "pf1.skills.xvua9V5Zggkc77Gt",
    crf: "pf1.skills.L6LEhHRrn53cMuhE",
    dip: "pf1.skills.OtfbHJhIQsNzmiTN",
    dev: "pf1.skills.CCy1fajKKU3K02iQ",
    dis: "pf1.skills.lP3L1RXi9q4ha9Gu",
    esc: "pf1.skills.AOQsMtvLY4V3wFEL",
    fly: "pf1.skills.rR877UB1xVd3Z7z1",
    han: "pf1.skills.fXauAodbOBHBi7Mj",
    hea: "pf1.skills.RtBGttkocvTbySjd",
    int: "pf1.skills.ImjhcPmm02QSCbPg",
    kar: "pf1.skills.ki0QvL0K7u4YuK0O",
    kdu: "pf1.skills.ki0QvL0K7u4YuK0O",
    ken: "pf1.skills.ki0QvL0K7u4YuK0O",
    kge: "pf1.skills.ki0QvL0K7u4YuK0O",
    khi: "pf1.skills.ki0QvL0K7u4YuK0O",
    klo: "pf1.skills.ki0QvL0K7u4YuK0O",
    kna: "pf1.skills.ki0QvL0K7u4YuK0O",
    kno: "pf1.skills.ki0QvL0K7u4YuK0O",
    kpl: "pf1.skills.ki0QvL0K7u4YuK0O",
    kre: "pf1.skills.ki0QvL0K7u4YuK0O",
    lin: "pf1.skills.QXIYXqy6ivNHrDrW",
    per: "pf1.skills.YYmmxDgp0g3ltSUG",
    prf: "pf1.skills.HhV5UmaRLTjtB3Xh",
    pro: "pf1.skills.O7Utk8xKbHYDP7Ot",
    rid: "pf1.skills.mKO8Q4uMiqpMySOZ",
    sen: "pf1.skills.R8HGxGCKayOl15AO",
    slt: "pf1.skills.zK0CbvpYLZhTN5Wn",
    spl: "pf1.skills.uLZI2uWz0uB8UgBc",
    ste: "pf1.skills.T6nefKotIb5vKE9h",
    sur: "pf1.skills.TXrxgrB2sQjppZFY",
    swm: "pf1.skills.weCPHUuXi9sF5r4E",
    umd: "pf1.skills.WR5lekzyLT6T2CFH",
  },

  /**
   * An array of {@link skills} that can have arbitrary subskills
   */
  arbitrarySkills: ["art", "crf", "lor", "prf", "pro"],

  /**
   * An array of {@link skills} that are considered background skills.
   */
  backgroundSkills: ["apr", "art", "crf", "han", "ken", "kge", "khi", "kno", "lin", "lor", "prf", "pro", "slt"],

  /* -------------------------------------------- */

  /**
   * Valid options for how a spell is prepared
   */
  spellPreparationModes: {
    atwill: "PF1.SpellPrepAtWill",
    prepared: "PF1.SpellPrepPrepared",
    spontaneous: "PF1.SpellPrepSpontaneous",
  },

  classCasterType: {
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
  },

  magicAuraByLevel: {
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
  },

  auraStrengths: {
    1: "PF1.AuraStrength_Faint",
    2: "PF1.AuraStrength_Moderate",
    3: "PF1.AuraStrength_Strong",
    4: "PF1.AuraStrength_Overwhelming",
  },

  /* -------------------------------------------- */

  /* -------------------------------------------- */

  // Weapon Types
  weaponTypes: {
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
  },

  // Weapon hold types
  weaponHoldTypes: {
    normal: "PF1.WeaponHoldTypeNormal",
    "2h": "PF1.WeaponHoldTypeTwoHanded",
    oh: "PF1.WeaponHoldTypeOffhand",
  },

  /* -------------------------------------------- */

  /**
   * Define the set of weapon property flags which can exist on a weapon
   */
  weaponProperties: {
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
    snd: "PF1.WeaponPropSunder",
    thr: "PF1.WeaponPropThrown",
    trp: "PF1.WeaponPropTrip",
  },

  /**
   * The components required for casting a spell
   */
  spellComponents: {
    V: "PF1.SpellComponentVerbal",
    S: "PF1.SpellComponentSomatic",
    M: "PF1.SpellComponentMaterial",
    F: "PF1.SpellComponentFocus",
    DF: "PF1.SpellComponentDivineFocus",
  },

  /**
   * Spell schools
   */
  spellSchools: {
    abj: "PF1.SpellSchoolAbjuration",
    con: "PF1.SpellSchoolConjuration",
    div: "PF1.SpellSchoolDivination",
    enc: "PF1.SpellSchoolEnchantment",
    evo: "PF1.SpellSchoolEvocation",
    ill: "PF1.SpellSchoolIllusion",
    nec: "PF1.SpellSchoolNecromancy",
    trs: "PF1.SpellSchoolTransmutation",
    uni: "PF1.SpellSchoolUniversal",
    misc: "PF1.Misc",
  },

  /**
   * Spell levels
   */
  spellLevels: {
    0: "PF1.SpellLevel0",
    1: "PF1.SpellLevel1",
    2: "PF1.SpellLevel2",
    3: "PF1.SpellLevel3",
    4: "PF1.SpellLevel4",
    5: "PF1.SpellLevel5",
    6: "PF1.SpellLevel6",
    7: "PF1.SpellLevel7",
    8: "PF1.SpellLevel8",
    9: "PF1.SpellLevel9",
  },

  /* -------------------------------------------- */

  /**
   * Weapon proficiency levels
   * Each level provides a proficiency multiplier
   */
  proficiencyLevels: {
    "-4": "Not Proficient",
    0: "Proficient",
  },

  /* -------------------------------------------- */

  conditionTypes: {
    bleed: "PF1.CondTypeBleed",
    blind: "PF1.CondTypeBlind",
    confuse: "PF1.CondTypeConfuse",
    daze: "PF1.CondTypeDaze",
    dazzle: "PF1.CondTypeDazzle",
    deaf: "PF1.CondTypeDeaf",
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
  },

  conditions: {
    bleed: "PF1.CondBleed",
    pf1_blind: "PF1.CondBlind",
    confused: "PF1.CondConfused",
    dazzled: "PF1.CondDazzled",
    pf1_deaf: "PF1.CondDeaf",
    entangled: "PF1.CondEntangled",
    fatigued: "PF1.CondFatigued",
    exhausted: "PF1.CondExhausted",
    grappled: "PF1.CondGrappled",
    helpless: "PF1.CondHelpless",
    incorporeal: "PF1.CondIncorporeal",
    invisible: "PF1.CondInvisible",
    paralyzed: "PF1.CondParalyzed",
    pinned: "PF1.CondPinned",
    pf1_prone: "PF1.CondProne",
    staggered: "PF1.CondStaggered",
    stunned: "PF1.CondStunned",
    shaken: "PF1.CondShaken",
    frightened: "PF1.CondFrightened",
    panicked: "PF1.CondPanicked",
    sickened: "PF1.CondSickened",
    nauseated: "PF1.CondNauseated",
    dazed: "PF1.CondDazed",
    pf1_sleep: "PF1.CondSleep",
  },

  conditionTextures: {
    bleed: "systems/pf1/icons/conditions/bleed.png",
    pf1_blind: "systems/pf1/icons/conditions/blind.png",
    confused: "systems/pf1/icons/conditions/confused.png",
    dazzled: "systems/pf1/icons/conditions/dazzled.png",
    pf1_deaf: "systems/pf1/icons/conditions/deaf.png",
    entangled: "systems/pf1/icons/conditions/entangled.png",
    fatigued: "systems/pf1/icons/conditions/fatigued.png",
    exhausted: "systems/pf1/icons/conditions/exhausted.png",
    grappled: "systems/pf1/icons/conditions/grappled.png",
    helpless: "systems/pf1/icons/conditions/helpless.png",
    incorporeal: "systems/pf1/icons/conditions/incorporeal.png",
    invisible: "systems/pf1/icons/conditions/invisible.png",
    paralyzed: "systems/pf1/icons/conditions/paralyzed.png",
    pinned: "systems/pf1/icons/conditions/pinned.png",
    pf1_prone: "systems/pf1/icons/conditions/prone.png",
    sickened: "systems/pf1/icons/conditions/sickened.png",
    staggered: "systems/pf1/icons/conditions/staggered.png",
    stunned: "systems/pf1/icons/conditions/stunned.png",
    shaken: "systems/pf1/icons/conditions/shaken.png",
    frightened: "systems/pf1/icons/conditions/frightened.png",
    panicked: "systems/pf1/icons/conditions/fear.png",
    nauseated: "systems/pf1/icons/conditions/nauseated.png",
    dazed: "systems/pf1/icons/conditions/dazed.png",
    pf1_sleep: "systems/pf1/icons/conditions/sleep.png",
  },

  buffTypes: {
    temp: "PF1.Temporary",
    perm: "PF1.Permanent",
    item: "PF1.Item",
    misc: "PF1.Misc",
  },

  /**
   * Dictionaries of conditional modifier targets, each with a label and sub-categories
   */
  conditionalTargets: {
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
  },

  /**
   * Dictionaries of change/buff targets, each with a label and sub-categories
   */
  buffTargets: {
    ac: { label: "PF1.BuffTarACGeneric", category: "defense" },
    aac: { label: "PF1.BuffTarACArmor", category: "defense" },
    sac: { label: "PF1.BuffTarACShield", category: "defense" },
    nac: { label: "PF1.BuffTarACNatural", category: "defense" },
    tac: { label: "PF1.BuffTarACTouch", category: "defense" },
    ffac: { label: "PF1.BuffTarACFlatFooted", category: "defense" },
    cmd: { label: "PF1.CMD", category: "defense" },
    ffcmd: { label: "PF1.CMDFlatFooted", category: "defense" },
    spellResist: { label: "PF1.SpellResistance", category: "defense" },
    attack: { label: "PF1.BuffTarAllAttackRolls", category: "attack" },
    mattack: { label: "PF1.BuffTarMeleeAttack", category: "attack" },
    rattack: { label: "PF1.BuffTarRangedAttack", category: "attack" },
    "~attackCore": { label: "", category: "attack" },
    cmb: { label: "PF1.CMB", category: "attack" },
    bab: { label: "PF1.BAB", category: "attack" },
    critConfirm: { label: "PF1.CriticalConfirmation", category: "attack" },
    damage: { label: "PF1.BuffTarAllDamageRolls", category: "damage" },
    wdamage: { label: "PF1.WeaponDamage", category: "damage" },
    sdamage: { label: "PF1.SpellDamage", category: "damage" },
    str: { label: "PF1.AbilityStr", category: "ability" },
    dex: { label: "PF1.AbilityDex", category: "ability" },
    con: { label: "PF1.AbilityCon", category: "ability" },
    int: { label: "PF1.AbilityInt", category: "ability" },
    wis: { label: "PF1.AbilityWis", category: "ability" },
    cha: { label: "PF1.AbilityCha", category: "ability" },
    strMod: { label: "PF1.AbilityStrMod", category: "ability" },
    dexMod: { label: "PF1.AbilityDexMod", category: "ability" },
    conMod: { label: "PF1.AbilityConMod", category: "ability" },
    intMod: { label: "PF1.AbilityIntMod", category: "ability" },
    wisMod: { label: "PF1.AbilityWisMod", category: "ability" },
    chaMod: { label: "PF1.AbilityChaMod", category: "ability" },
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
    bonusSkillRanks: { label: "PF1.BuffTarBonusSkillRanks", category: "skills" },
    allChecks: { label: "PF1.BuffTarAllAbilityChecks", category: "abilityChecks" },
    strChecks: { label: "PF1.BuffTarStrChecks", category: "abilityChecks" },
    dexChecks: { label: "PF1.BuffTarDexChecks", category: "abilityChecks" },
    conChecks: { label: "PF1.BuffTarConChecks", category: "abilityChecks" },
    intChecks: { label: "PF1.BuffTarIntChecks", category: "abilityChecks" },
    wisChecks: { label: "PF1.BuffTarWisChecks", category: "abilityChecks" },
    chaChecks: { label: "PF1.BuffTarChaChecks", category: "abilityChecks" },
    allSpeeds: { label: "PF1.BuffTarAllSpeeds", category: "speed" },
    landSpeed: { label: "PF1.SpeedLand", category: "speed" },
    climbSpeed: { label: "PF1.SpeedClimb", category: "speed" },
    swimSpeed: { label: "PF1.SpeedSwim", category: "speed" },
    burrowSpeed: { label: "PF1.SpeedBurrow", category: "speed" },
    flySpeed: { label: "PF1.SpeedFly", category: "speed" },
    mhp: { label: "PF1.HitPoints", category: "health" },
    wounds: { label: "PF1.Wounds", category: "health" },
    vigor: { label: "PF1.Vigor", category: "health" },
    init: { label: "PF1.Initiative", category: "misc" },
    acpA: { label: "PF1.ACPArmor", category: "misc" },
    acpS: { label: "PF1.ACPShield", category: "misc" },
    mDexA: { label: "PF1.MaxDexArmor", category: "misc" },
    mDexS: { label: "PF1.MaxDexShield", category: "misc" },
    bonusFeats: { label: "PF1.BuffTarBonusFeats", category: "misc" },
    carryStr: { label: "PF1.CarryStrength", category: "misc" },
    carryMult: { label: "PF1.CarryMultiplier", category: "misc" },
  },

  buffTargetCategories: {
    defense: { label: "PF1.Defense" },
    savingThrows: { label: "PF1.SavingThrowPlural" },
    attack: { label: "PF1.Attack" },
    damage: { label: "PF1.Damage" },
    ability: { label: "PF1.AbilityScore" },
    abilityChecks: { label: "PF1.BuffTarAbilityChecks" },
    skills: { label: "PF1.Skills" },
    skill: { label: "PF1.BuffTarSpecificSkill" },
    speed: { label: "PF1.Speed" },
    health: { label: "PF1.Health" },
    misc: { label: "PF1.Misc" },
  },

  contextNoteTargets: {
    attack: { label: "PF1.AttackRollPlural", category: "attacks" },
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
  },

  contextNoteCategories: {
    attacks: { label: "PF1.Attacks" },
    savingThrows: { label: "PF1.SavingThrowPlural" },
    skills: { label: "PF1.Skills" },
    skill: { label: "PF1.BuffTarSpecificSkill" },
    abilityChecks: { label: "PF1.BuffTarAbilityChecks" },
    spell: { label: "PF1.BuffTarSpells" },
    defense: { label: "PF1.Defense" },
    misc: { label: "PF1.Misc" },
  },

  /**
   * A list of Golarion's languages
   */
  languages: {
    aboleth: "PF1.LanguageAboleth",
    abyssal: "PF1.LanguageAbyssal",
    aklo: "PF1.LanguageAklo",
    ancientosiriani: "PF1.LanguageAncientOsiriani",
    aquan: "PF1.LanguageAquan",
    auran: "PF1.LanguageAuran",
    azlanti: "PF1.LanguageAzlanti",
    boggard: "PF1.LanguageBoggard",
    celestial: "PF1.LanguageCelestial",
    common: "PF1.LanguageCommon",
    cyclops: "PF1.LanguageCyclops",
    dark: "PF1.LanguageDark",
    draconic: "PF1.LanguageDraconic",
    drowsign: "PF1.LanguageDrowsign",
    druidic: "PF1.LanguageDruidic",
    dwarven: "PF1.LanguageDwarven",
    dziriak: "PF1.LanguageDziriak",
    elven: "PF1.LanguageElven",
    giant: "PF1.LanguageGiant",
    gnoll: "PF1.LanguageGnoll",
    gnome: "PF1.LanguageGnome",
    goblin: "PF1.LanguageGoblin",
    grippli: "PF1.LanguageGrippli",
    halfling: "PF1.LanguageHalfling",
    hallit: "PF1.LanguageHallit",
    ignan: "PF1.LanguageIgnan",
    jistka: "PF1.LanguageJistka",
    infernal: "PF1.LanguageInfernal",
    kelish: "PF1.LanguageKelish",
    necril: "PF1.LanguageNecril",
    orc: "PF1.LanguageOrc",
    orvian: "PF1.LanguageOrvian",
    osiriani: "PF1.LanguageOsiriani",
    polyglot: "PF1.LanguagePolyglot",
    protean: "PF1.LanguageProtean",
    shadowtongue: "PF1.LanguageShadowTongue",
    shoanti: "PF1.LanguageShoanti",
    skald: "PF1.LanguageSkald",
    sphinx: "PF1.LanguageSphinx",
    sylvan: "PF1.LanguageSylvan",
    taldane: "PF1.LanguageTaldane",
    tekritanin: "PF1.LanguageTekritanin",
    tengu: "PF1.LanguageTengu",
    terran: "PF1.LanguageTerran",
    thassilonian: "PF1.LanguageThassilonian",
    tien: "PF1.LanguageTien",
    treant: "PF1.LanguageTreant",
    undercommon: "PF1.LanguageUndercommon",
    varisian: "PF1.LanguageVarisian",
    vegepygmy: "PF1.LanguageVegepygmy",
    vudrani: "PF1.LanguageVudrani",
  },

  /**
   * Creature types
   */
  creatureTypes: {
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
  },

  /**
   * An array containing the damage dice progression for size adjustments
   */
  sizeDie: [
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
  ],

  /**
   * Arrays of Character Level XP Requirements by XP track
   */
  CHARACTER_EXP_LEVELS: {
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
  },

  /**
   * An array of Challenge Rating XP Levels
   */
  CR_EXP_LEVELS: [
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
  ],

  temporaryRollDataFields: {
    actor: [
      "d20",
      "attackBonus",
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
      "level",
      "mod",
    ],
  },

  keepItemLinksOnCopy: ["classAssociations"],
};

/**
 * Non-PF1 config entries
 *
 * These keys are merged into {@link CONFIG} using {@link mergeObject}.
 */
export const CONFIG_OVERRIDES = {
  "Combat.initiative.decimals": 2,
  "debug.roll": false,
  "debug.template": false,
};
