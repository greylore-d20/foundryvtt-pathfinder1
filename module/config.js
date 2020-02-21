// Namespace D&D5e Configuration Values
export const PF1 = {};

PF1.re = {
  "traitSeparator": /\s*[,;]\s*/g,
};


/**
 * The set of Ability Scores used within the system
 * @type {Object}
 */
PF1.abilities = {
  "str": "PF1.AbilityStr",
  "dex": "PF1.AbilityDex",
  "con": "PF1.AbilityCon",
  "int": "PF1.AbilityInt",
  "wis": "PF1.AbilityWis",
  "cha": "PF1.AbilityCha"
};

PF1.abilitiesShort = {
  "str": "PF1.AbilityShortStr",
  "dex": "PF1.AbilityShortDex",
  "con": "PF1.AbilityShortCon",
  "int": "PF1.AbilityShortInt",
  "wis": "PF1.AbilityShortWis",
  "cha": "PF1.AbilityShortCha"
};

/**
 * The set of Saving Throws
 * @type {Object}
 */
PF1.savingThrows = {
  "fort": "PF1.SavingThrowFort",
  "ref": "PF1.SavingThrowRef",
  "will": "PF1.SavingThrowWill"
};

/**
 * The set of modifiers for Saving Throws
 * @type {Object}
 */
PF1.savingThrowMods = {
  "fort": "con",
  "ref": "dex",
  "will": "wis"
};

PF1.favouredClassBonuses = {
  "hp": "Hit Points",
  "skill": "Skills",
  "alt": "Alt"
};

/**
 * The set of Armor Classes
 * @type {Object}
 */
PF1.ac = {
  "normal": "PF1.ACNormal",
  "touch": "PF1.ACTouch",
  "flatFooted": "PF1.ACFlatFooted"
};

/**
 * The set of Armor Class modifier types
 * @type {Object}
 */
PF1.acValueLabels = {
  "normal": "PF1.ACTypeNormal",
  "touch": "PF1.ACTypeTouch",
  "flatFooted": "PF1.ACTypeFlatFooted"
};

/* -------------------------------------------- */

/**
 * Character alignment options
 * @type {Object}
 */
PF1.alignments = {
  'lg': "PF1.AlignmentLG",
  'ng': "PF1.AlignmentNG",
  'cg': "PF1.AlignmentCG",
  'ln': "PF1.AlignmentLN",
  'tn': "PF1.AlignmentTN",
  'cn': "PF1.AlignmentCN",
  'le': "PF1.AlignmentLE",
  'ne': "PF1.AlignmentNE",
  'ce': "PF1.AlignmentCE"
};

/* -------------------------------------------- */

/**
 * The set of Armor Proficiencies which a character may have
 * @type {Object}
 */
PF1.armorProficiencies = {
  "lgt": "Light Armor",
  "med": "Medium Armor",
  "hvy": "Heavy Armor",
  "shl": "Shields",
  "twr": "Tower Shields"
};

PF1.weaponProficiencies = {
  "sim": "Simple Weapons",
  "mar": "Martial Weapons"
};

/* -------------------------------------------- */

/**
 * This describes the ways that an ability can be activated
 * @type {Object}
 */
PF1.abilityActivationTypes = {
  "passive": "Passive",
  "free": "Free Action",
  "swift": "Swift Action",
  "immediate": "Immediate Action",
  "move": "Move Action",
  "standard": "Standard Action",
  "full": "Full-round Action",
  "round": "Round",
  "minute": "Minute",
  "hour": "Hour",
  "special": "Special"
};

/* -------------------------------------------- */

// Creature Sizes
PF1.actorSizes = {
  "fine": "Fine",
  "dim": "Diminutive",
  "tiny": "Tiny",
  "sm": "Small",
  "med": "Medium",
  "lg": "Large",
  "huge": "Huge",
  "grg": "Gargantuan",
  "col": "Colossal"
};

PF1.tokenSizes = {
  "fine": { w: 1, h: 1, scale: 0.2 },
  "dim": { w: 1, h: 1, scale: 0.4 },
  "tiny": { w: 1, h: 1, scale: 0.6 },
  "sm": { w: 1, h: 1, scale: 0.8 },
  "med": { w: 1, h: 1, scale: 1 },
  "lg": { w: 2, h: 2, scale: 1 },
  "huge": { w: 3, h: 3, scale: 1 },
  "grg": { w: 4, h: 4, scale: 1 },
  "col": { w: 6, h: 6, scale: 1 },
};

PF1.sizeMods = {
  "fine": 8,
  "dim": 4,
  "tiny": 2,
  "sm": 1,
  "med": 0,
  "lg": -1,
  "huge": -2,
  "grg": -4,
  "col": -8
};

PF1.sizeSpecialMods = {
  "fine": -8,
  "dim": -4,
  "tiny": -2,
  "sm": -1,
  "med": 0,
  "lg": 1,
  "huge": 2,
  "grg": 4,
  "col": 8
};

PF1.sizeFlyMods = {
  "fine": 8,
  "dim": 6,
  "tiny": 4,
  "sm": 2,
  "med": 0,
  "lg": -2,
  "huge": -4,
  "grg": -6,
  "col": -8
};

PF1.sizeStealthMods = {
  "fine": 16,
  "dim": 12,
  "tiny": 8,
  "sm": 4,
  "med": 0,
  "lg": -4,
  "huge": -8,
  "grg": -12,
  "col": -16
};

/* -------------------------------------------- */

/**
 * Classification types for item action types
 * @type {Object}
 */
PF1.itemActionTypes = {
  "mwak": "PF1.ActionMWAK",
  "rwak": "PF1.ActionRWAK",
  "msak": "PF1.ActionMSAK",
  "rsak": "PF1.ActionRSAK",
  "spellsave": "PF1.ActionSpellSave",
  "save": "PF1.ActionSave",
  "heal": "PF1.ActionHeal",
  "other": "PF1.ActionOther"
};

/* -------------------------------------------- */

PF1.itemCapacityTypes = {
  "items": "PF1.ItemContainerCapacityItems",
  "weight": "PF1.ItemContainerCapacityWeight"
};

/* -------------------------------------------- */

/**
 * Enumerate the lengths of time over which an item can have limited use ability
 * @type {Object}
 */
PF1.limitedUsePeriods = {
  "single": "Single Use",
  "unlimited": "Unlimited Use",
  "day": "Day",
  "week": "Week",
  "charges": "Charges"
};


/* -------------------------------------------- */

// Equipment Types
PF1.equipmentTypes = {
  "clothing": "Clothing",
  "light": "Light Armor",
  "medium": "Medium Armor",
  "heavy": "Heavy Armor",
  "natural": "Natural Armor",
  "shield": "Shield",
  "misc": "Misc"
};
PF1.armorTypes = PF1.equipmentTypes;

PF1.equipmentSlots = {
  "slotless": "Slotless",
  "head": "Head",
  "headband": "Headband",
  "eyes": "Eyes",
  "shoulders": "Shoulders",
  "neck": "Neck",
  "chest": "Chest",
  "body": "Body",
  "armor": "Armor",
  "belt": "Belt",
  "wrists": "Wrists",
  "hands": "Hands",
  "ring": "Ring",
  "feet": "Feet",
};


/* -------------------------------------------- */

/**
 * Enumerate the valid consumable types which are recognized by the system
 * @type {Object}
 */
PF1.consumableTypes = {
  "potion": "Potion/Oil",
  "poison": "Poison",
  "scroll": "Scroll",
  "wand": "Wand",
  "rod": "Rod",
  "trinket": "Trinket"
};

PF1.attackTypes = {
  "weapon": "Weapon",
  "natural": "Natural",
  "ability": "Class Ability",
  "racialAbility": "Racial Ability",
  "misc": "Misc",
};

PF1.featTypes = {
  "feat": "Feat",
  "classFeat": "Class Feature",
  "trait": "Trait",
  "racial": "Racial Trait",
  "misc": "Misc"
};

/* -------------------------------------------- */

/**
 * The valid currency denominations supported by the 5e system
 * @type {Object}
 */
PF1.currencies = {
  "pp": "PF1.CurrencyPP",
  "gp": "PF1.CurrencyGP",
  "sp": "PF1.CurrencySP",
  "cp": "PF1.CurrencyCP",
};

PF1.acTypes = {
  "armor": "Armor",
  "shield": "Shield",
  "natural": "Natural Armor",
};

PF1.bonusModifiers = {
  "untyped": "Untyped",
  "base": "Base",
  "enh": "Enhancement",
  "dodge": "Dodge",
  "inherent": "Inherent",
  "deflection": "Deflection",
  "morale": "Morale",
  "luck": "Luck",
  "sacred": "Sacred",
  "insight": "Insight",
  "resist": "Resistance",
  "profane": "Profane",
  "trait": "Trait",
  "racial": "Racial",
  "size": "Size",
  "competence": "Competence",
  "circumstance": "Circumstance",
  "alchemical": "Alchemical",
  "penalty": "Penalty",
};

/* -------------------------------------------- */


// Damage Types
PF1.damageTypes = {
  "bludgeoning": "Bludgeoning",
  "piercing": "Piercing",
  "slashing": "Slashing",
  "cold": "Cold",
  "fire": "Fire",
  "electric": "Electric",
  "sonic": "Sonic",
  "acid": "Acid",
  "force": "Force",
  "negative": "Negative",
  "positive": "Positive",
};

/* -------------------------------------------- */

PF1.distanceUnits = {
  "none": "PF1.None",
  "personal": "PF1.DistPersonal",
  "touch": "PF1.DistTouch",
  "close": "PF1.DistClose",
  "medium": "PF1.DistMedium",
  "long": "PF1.DistLong",
  "ft": "PF1.DistFt",
  "mi": "PF1.DistMi",
  "spec": "PF1.Special",
  "unlimited": "PF1.DistUnlimited"
};

/* -------------------------------------------- */

/**
 * This Object defines the types of single or area targets which can be applied in D&D5e
 * @type {Object}
 */
PF1.targetTypes = {
  "none": "PF1.None",
  "self": "PF1.TargetSelf",
  "creature": "PF1.TargetCreature",
  "ally": "PF1.TargetAlly",
  "enemy": "PF1.TargetEnemy",
  "object": "PF1.TargetObject",
  "space": "PF1.TargetSpace",
  "radius": "PF1.TargetRadius",
  "sphere": "PF1.TargetSphere",
  "cylinder": "PF1.TargetCylinder",
  "cone": "PF1.TargetCone",
  "square": "PF1.TargetSquare",
  "cube": "PF1.TargetCube",
  "line": "PF1.TargetLine",
  "wall": "PF1.TargetWall"
};

/* -------------------------------------------- */

/**
 * This Object defines the various lengths of time which can occur in PF1
 * @type {Object}
 */
PF1.timePeriods = {
  "inst": "PF1.TimeInst",
  "turn": "PF1.TimeTurn",
  "round": "PF1.TimeRound",
  "minute": "PF1.TimeMinute",
  "hour": "PF1.TimeHour",
  "day": "PF1.TimeDay",
  "month": "PF1.TimeMonth",
  "year": "PF1.TimeYear",
  "perm": "PF1.TimePerm",
  "spec": "PF1.Special"
};

/* -------------------------------------------- */

// Healing Types
PF1.healingTypes = {
  "healing": "Healing",
  "temphp": "Healing (Temporary)"
};

/* -------------------------------------------- */

/**
 * Character senses options
 * @type {Object}
 */
PF1.senses = {
  "bs": "PF1.SenseBS",
  "dv": "PF1.SenseDV",
  "ts": "PF1.SenseTS",
  "tr": "PF1.SenseTR",
  "ll": "PF1.SenseLL"
};


/* -------------------------------------------- */

/**
 * The set of skill which can be trained in PF1
 * @type {Object}
 */
PF1.skills = {
  "acr": "PF1.SkillAcr",
  "apr": "PF1.SkillApr",
  "art": "PF1.SkillArt",
  "blf": "PF1.SkillBlf",
  "clm": "PF1.SkillClm",
  "crf": "PF1.SkillCrf",
  "dip": "PF1.SkillDip",
  "dev": "PF1.SkillDev",
  "dis": "PF1.SkillDis",
  "esc": "PF1.SkillEsc",
  "fly": "PF1.SkillFly",
  "han": "PF1.SkillHan",
  "hea": "PF1.SkillHea",
  "int": "PF1.SkillInt",
  "kar": "PF1.SkillKAr",
  "kdu": "PF1.SkillKDu",
  "ken": "PF1.SkillKEn",
  "kge": "PF1.SkillKGe",
  "khi": "PF1.SkillKHi",
  "klo": "PF1.SkillKLo",
  "kna": "PF1.SkillKNa",
  "kno": "PF1.SkillKNo",
  "kpl": "PF1.SkillKPl",
  "kre": "PF1.SkillKRe",
  "lin": "PF1.SkillLin",
  "lor": "PF1.SkillLor",
  "per": "PF1.SkillPer",
  "prf": "PF1.SkillPrf",
  "pro": "PF1.SkillPro",
  "rid": "PF1.SkillRid",
  "sen": "PF1.SkillSen",
  "slt": "PF1.SkillSlt",
  "spl": "PF1.SkillSpl",
  "ste": "PF1.SkillSte",
  "sur": "PF1.SkillSur",
  "swm": "PF1.SkillSwm",
  "umd": "PF1.SkillUMD"
};

PF1.arbitrarySkills = [
  "art", "crf", "lor", "prf", "pro"
];


/* -------------------------------------------- */

PF1.spellPreparationModes = {
  "atwill": "At-will",
  "prepared": "Prepared Spell",
  "spontaneous": "Spontaneous Spell"
};

/* -------------------------------------------- */

/* -------------------------------------------- */

// Weapon Types
PF1.weaponTypes = {
  "simple": "Simple",
  "martial": "Martial",
  "exotic": "Exotic",
  "improv": "Improvised",
  "ammo": "Ammunition",
  "splash": "Splash Weapon"
};


/* -------------------------------------------- */

/**
 * Define the set of weapon property flags which can exist on a weapon
 * @type {Object}
 */
PF1.weaponProperties = {
  "blc": "Blocking",
  "brc": "Brace",
  "dbl": "Double",
  "dis": "Disarm",
  "fin": "Finesse",
  "frg": "Fragile",
  "imp": "Improvised",
  "lgt": "Light",
  "mnk": "Monk",
  "prf": "Performance",
  "rch": "Reach",
  "thr": "Thrown",
  "trp": "Trip",
  "two": "Two-Handed"
};


// Spell Components
PF1.spellComponents = {
  "V": "Verbal",
  "S": "Somatic",
  "M": "Material",
  "F": "Focus",
  "DF": "Divine Focus"
};

// Spell Schools
PF1.spellSchools = {
  "abj": "Abjuration",
  "con": "Conjuration",
  "div": "Divination",
  "enc": "Enchantment",
  "evo": "Evocation",
  "ill": "Illusion",
  "nec": "Necromancy",
  "trs": "Transmutation",
  "uni": "Universal",
  "sphere": "Sphere Magic",
  "misc": "Misc",
};

// Spell Levels
PF1.spellLevels = {
  0: "Cantrip/Orison",
  1: "1st Level",
  2: "2nd Level",
  3: "3rd Level",
  4: "4th Level",
  5: "5th Level",
  6: "6th Level",
  7: "7th Level",
  8: "8th Level",
  9: "9th Level"
};

/* -------------------------------------------- */

/**
 * Weapon proficiency levels
 * Each level provides a proficiency multiplier
 * @type {Object}
 */
PF1.proficiencyLevels = {
  "-4": "Not Proficient",
  0: "Proficient"
};

/* -------------------------------------------- */

PF1.conditionTypes = {
  "bleed": "Bleed",
  "blind": "Blind",
  "confuse": "Confuse",
  "daze": "Daze",
  "dazzle": "Dazzle",
  "deaf": "Deaf",
  "energyDrain": "Energy Drain",
  "fatigue": "Fatigue",
  "fear": "Fear",
  "sicken": "Sicken",
  "paralyze": "Paralyze",
  "petrify": "Petrification",
  "stun": "Stun",
  "sleep": "Sleep"
};

PF1.conditions = {
  "blind": "PF1.CondBlind",
  "dazzled": "PF1.CondDazzled",
  "deaf": "PF1.CondDeaf",
  "entangled": "PF1.CondEntangled",
  "fatigued": "PF1.CondFatigued",
  "exhausted": "PF1.CondExhausted",
  "grappled": "PF1.CondGrappled",
  "helpless": "PF1.CondHelpless",
  "paralyzed": "PF1.CondParalyzed",
  "pinned": "PF1.CondPinned",
  "fear": "PF1.CondFear",
  "sickened": "PF1.CondSickened",
  "stunned": "PF1.CondStunned",
};

PF1.buffTypes = {
  "temp": "Temporary",
  "perm": "Permanent",
  "item": "Item",
  "misc": "Misc",
};

PF1.buffTargets = {
  "ac": {
    "_label": "AC",
    "ac": "Generic",
    "aac": "Armor",
    "sac": "Shield",
    "nac": "Natural Armor",
  },
  "attack": {
    "_label": "Attack Rolls",
    "attack": "All",
    "mattack": "Melee",
    "rattack": "Ranged",
  },
  "damage": {
    "_label": "Damage",
    "damage": "All",
    "wdamage": "Weapon Damage",
    "sdamage": "Spell Damage",
  },
  "ability": {
    "_label": "Ability Score",
    "str": "Strength",
    "dex": "Dexterity",
    "con": "Constitution",
    "int": "Intelligence",
    "wis": "Wisdom",
    "cha": "Charisma",
  },
  "savingThrows": {
    "_label": "Saving Throws",
    "allSavingThrows": "All",
    "fort": "Fortitude",
    "ref": "Reflex",
    "will": "Will",
  },
  "skills": {
    "_label": "Skills",
    "skills": "All",
    "strSkills": "Strength Skills",
    "dexSkills": "Dexterity Skills",
    "conSkills": "Constitution Skills",
    "intSkills": "Intelligence Skills",
    "wisSkills": "Wisdom Skills",
    "chaSkills": "Charisma Skills",
  },
  "skill": {
    "_label": "Specific Skill",
  },
  "abilityChecks": {
    "_label": "Ability Checks",
    "allChecks": "All",
    "strChecks": "Strength Checks",
    "dexChecks": "Dexterity Checks",
    "conChecks": "Constitution Checks",
    "intChecks": "Intelligence Checks",
    "wisChecks": "Wisdom Checks",
    "chaChecks": "Charisma Checks",
  },
  "misc": {
    "_label": "Misc",
    "cmb": "CMB",
    "cmd": "CMD",
    "init": "Initiative",
    "mhp": "Maximum HP",
  },
};

PF1.contextNoteTargets = {
  "savingThrows": {
    "_label": "Saving Throws",
    "allSavingThrows": "All",
    "fort": "Fortitude",
    "ref": "Reflex",
    "will": "Will",
  },
  "skills": {
    "_label": "Skills",
    "skills": "All",
    "strSkills": "Strength Skills",
    "dexSkills": "Dexterity Skills",
    "conSkills": "Constitution Skills",
    "intSkills": "Intelligence Skills",
    "wisSkills": "Wisdom Skills",
    "chaSkills": "Charisma Skills",
  },
  "skill": {
    "_label": "Specific Skill",
  },
  "abilityChecks": {
    "_label": "Ability Checks",
    "allChecks": "All",
    "strChecks": "Strength Checks",
    "dexChecks": "Dexterity Checks",
    "conChecks": "Constitution Checks",
    "intChecks": "Intelligence Checks",
    "wisChecks": "Wisdom Checks",
    "chaChecks": "Charisma Checks",
  },
  "misc": {
    "_label": "Misc",
    "cmb": "CMB",
  },
};

// Languages
PF1.languages = {
  "common": "Common",
  "aboleth": "Aboleth",
  "abyssal": "Abyssal",
  "aklo": "Aklo",
  "aquan": "Aquan",
  "auran": "Auran",
  "boggard": "Boggard",
  "celestial": "Celestial",
  "common": "Common",
  "cyclops": "Cyclops",
  "dark": "Dark Folk",
  "draconic": "Draconic",
  "drowsign": "Drow Sign Language",
  "druidic": "Druidic",
  "dwarven": "Dwarven",
  "dziriak": "D'ziriak",
  "elven": "Elven",
  "giant": "Giant",
  "gnome": "Gnome",
  "goblin": "Goblin",
  "gnoll": "Gnoll",
  "grippli": "Grippli",
  "halfling": "Halfling",
  "ignan": "Ignan",
  "infernal": "Infernal",
  "nercil": "Necril",
  "orc": "Orc",
  "protean": "Protean",
  "sphinx": "Sphinx",
  "sylvan": "Sylvan",
  "tengu": "Tengu",
  "terran": "Terran",
  "treant": "Treant",
  "undercommon": "Undercommon",
  "vegepygmy": "Vegepygmy"
};

// Character Level XP Requirements
PF1.CHARACTER_EXP_LEVELS =  {
  slow: [
    100, 3000, 7500, 14000, 23000, 35000, 53000, 77000, 115000, 160000, 235000, 330000,
    475000, 665000, 955000, 1350000, 1900000, 2700000, 3850000, 5350000
  ],
  medium: [
    100, 2000, 5000, 9000, 15000, 23000, 35000, 51000, 75000, 105000, 155000, 220000,
    315000, 445000, 635000, 890000, 1300000, 1800000, 2550000, 3600000
  ],
  fast: [
    100, 1300, 3300, 6000, 10000, 15000, 23000, 34000, 50000, 71000, 105000, 145000,
    210000, 295000, 425000, 600000, 850000, 1200000, 1700000, 2400000
  ]
};

// Challenge Rating XP Levels
PF1.CR_EXP_LEVELS = [
  200, 400, 600, 800, 1200, 1600, 2400, 3200, 4800, 6400, 9600, 12800, 19200, 25600,
  38400, 51200, 76800, 102400, 153600, 204800, 307200, 409600, 614400, 819200, 1228800, 1638400, 2457600,
  3276800, 4915200, 6553600, 9830400
];

// Set initiative options
CONFIG.initiative.decimals = 2;
