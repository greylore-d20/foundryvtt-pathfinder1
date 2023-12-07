import { Registry, RegistryEntry } from "./base-registry.mjs";

const fields = foundry.data.fields;

/**
 * A single condition entry in the {@link Condition} registry.
 *
 * @group Conditions
 */
export class Condition extends RegistryEntry {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      texture: new fields.StringField({ required: true, initial: "" }),
      track: new fields.StringField({
        required: false,
        blank: true,
        initial: "",
        choices: Conditions.TRACKS,
      }),
      mechanics: new fields.SchemaField(
        {
          changes: new fields.ArrayField(
            new fields.SchemaField({
              formula: new fields.StringField({}),
              subTarget: new fields.StringField({}),
              modifier: new fields.StringField({}),
            })
          ),
          flags: new fields.ArrayField(new fields.StringField({})),
        },
        {
          required: false,
          nullable: true,
          initial: null,
        }
      ),
    };
  }
}
/**
 * The singleton registry of condition types.
 * At runtime this registry is accessible as `pf1.registry.conditions`.
 *
 * @group Conditions
 * @see {@link Registry}
 * @see {@link Condition}
 * @augments {Registry<Condition>}
 */
export class Conditions extends Registry {
  /** @inheritdoc */
  static model = Condition;

  /**
   * An array of allowed tracks of condition advancement.
   */
  static TRACKS = /** @type {const} */ (["fear", "lethargy"]);

  /** @inheritdoc */
  static _defaultData = [
    {
      _id: "bleed",
      name: "PF1.CondBleed",
      texture: "systems/pf1/icons/conditions/bleed.png",
    },
    {
      _id: "blind",
      name: "PF1.CondBlind",
      texture: "systems/pf1/icons/conditions/blind.png",
      mechanics: {
        changes: [
          {
            formula: -2,
            subTarget: "ac",
            modifier: "penalty",
          },
        ],
        flags: ["loseDexToAC"],
      },
    },
    {
      _id: "confused",
      name: "PF1.CondConfused",
      texture: "systems/pf1/icons/conditions/confused.png",
    },
    {
      _id: "cowering",
      name: "PF1.CondCowering",
      texture: "systems/pf1/icons/conditions/screaming.png",
      mechanics: {
        changes: [
          {
            formula: -2,
            subTarget: "ac",
            modifier: "penalty",
          },
        ],
      },
    },
    {
      _id: "dazed",
      name: "PF1.CondDazed",
      texture: "systems/pf1/icons/conditions/dazed.png",
    },
    {
      _id: "dazzled",
      name: "PF1.CondDazzled",
      texture: "systems/pf1/icons/conditions/dazzled.png",
      mechanics: {
        changes: [
          {
            formula: -1,
            subTarget: "attack",
            modifier: "penalty",
          },
        ],
      },
    },
    {
      _id: "deaf",
      name: "PF1.CondDeaf",
      texture: "systems/pf1/icons/conditions/deaf.png",
      mechanics: {
        changes: [
          {
            formula: -4,
            subTarget: "init",
            modifier: "penalty",
          },
        ],
      },
    },
    {
      _id: "entangled",
      name: "PF1.CondEntangled",
      texture: "systems/pf1/icons/conditions/entangled.png",
      mechanics: {
        changes: [
          {
            formula: -4,
            subTarget: "dex",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "attack",
            modifier: "penalty",
          },
        ],
      },
    },
    {
      _id: "exhausted",
      name: "PF1.CondExhausted",
      texture: "systems/pf1/icons/conditions/exhausted.png",
      mechanics: {
        changes: [
          {
            formula: -6,
            subTarget: "str",
            modifier: "penalty",
          },
          {
            formula: -6,
            subTarget: "dex",
            modifier: "penalty",
          },
        ],
      },
      track: "lethargy",
    },
    {
      _id: "fatigued",
      name: "PF1.CondFatigued",
      texture: "systems/pf1/icons/conditions/fatigued.png",
      mechanics: {
        changes: [
          {
            formula: -2,
            subTarget: "str",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "dex",
            modifier: "penalty",
          },
        ],
      },
      track: "lethargy",
    },
    {
      _id: "frightened",
      name: "PF1.CondFrightened",
      texture: "systems/pf1/icons/conditions/frightened.png",
      mechanics: {
        changes: [
          {
            formula: -2,
            subTarget: "attack",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "allSavingThrows",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "skills",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "allChecks",
            modifier: "penalty",
          },
        ],
      },
      track: "fear",
    },
    {
      _id: "grappled",
      name: "PF1.CondGrappled",
      texture: "systems/pf1/icons/conditions/grappled.png",
      mechanics: {
        changes: [
          {
            formula: -4,
            subTarget: "dex",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "attack",
            modifier: "penalty",
          },
        ],
      },
    },
    {
      _id: "helpless",
      name: "PF1.CondHelpless",
      texture: "systems/pf1/icons/conditions/helpless.png",
      mechanics: {
        changes: [
          {
            formula: 0,
            subTarget: "dex",
            modifier: "untypedPerm",
            operator: "set",
            priority: 1001,
            continuous: true,
          },
        ],
      },
    },
    {
      _id: "incorporeal",
      name: "PF1.CondIncorporeal",
      texture: "systems/pf1/icons/conditions/incorporeal.png",
      mechanics: {
        changes: [
          {
            formula: 0,
            subTarget: "nac",
            modifier: "base",
            operator: "set",
            priority: -10,
          },
          {
            formula: "max(1, @abilities.cha.mod)",
            operator: "add",
            subTarget: "ac",
            modifier: "deflection",
          },
        ],
      },
    },
    {
      _id: "invisible",
      name: "PF1.CondInvisible",
      texture: "systems/pf1/icons/conditions/invisible.png",
    },
    {
      _id: "nauseated",
      name: "PF1.CondNauseated",
      texture: "systems/pf1/icons/conditions/nauseated.png",
    },
    {
      _id: "panicked",
      name: "PF1.CondPanicked",
      texture: "systems/pf1/icons/conditions/fear.png",
      mechanics: {
        changes: [
          {
            formula: -2,
            subTarget: "attack",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "allSavingThrows",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "skills",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "allChecks",
            modifier: "penalty",
          },
        ],
      },
      track: "fear",
    },
    {
      _id: "paralyzed",
      name: "PF1.CondParalyzed",
      texture: "systems/pf1/icons/conditions/paralyzed.png",
      mechanics: {
        changes: [
          {
            formula: 0,
            subTarget: "dex",
            modifier: "untypedPerm",
            operator: "set",
            priority: 1001,
            continuous: true,
          },
          {
            formula: 0,
            subTarget: "str",
            modifier: "untypedPerm",
            operator: "set",
            priority: 1001,
            continuous: true,
          },
        ],
      },
    },
    {
      _id: "pinned",
      name: "PF1.CondPinned",
      texture: "systems/pf1/icons/conditions/pinned.png",
      mechanics: {
        changes: [
          {
            formula: "min(0, @abilities.dex.mod)",
            subTarget: "dexMod",
            modifier: "untyped",
            operator: "set",
            priority: 1001,
            continuous: true,
          },
          {
            formula: -4,
            subTarget: "ac",
            modifier: "penalty",
          },
          {
            formula: -4,
            subTarget: "cmd",
            modifier: "penalty",
          },
        ],
        flags: ["loseDexToAC"],
      },
    },
    {
      _id: "prone",
      name: "PF1.CondProne",
      texture: "systems/pf1/icons/conditions/prone.png",
      mechanics: {
        changes: [
          {
            formula: -4,
            subTarget: "mattack",
            modifier: "penalty",
          },
        ],
      },
    },
    {
      _id: "shaken",
      name: "PF1.CondShaken",
      texture: "systems/pf1/icons/conditions/shaken.png",
      mechanics: {
        changes: [
          {
            formula: -2,
            subTarget: "attack",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "allSavingThrows",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "skills",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "allChecks",
            modifier: "penalty",
          },
        ],
      },
      track: "fear",
    },
    {
      _id: "sickened",
      name: "PF1.CondSickened",
      texture: "systems/pf1/icons/conditions/sickened.png",
      mechanics: {
        changes: [
          {
            formula: -2,
            subTarget: "attack",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "wdamage",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "allSavingThrows",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "skills",
            modifier: "penalty",
          },
          {
            formula: -2,
            subTarget: "allChecks",
            modifier: "penalty",
          },
        ],
      },
    },
    {
      _id: "sleep",
      name: "PF1.CondSleep",
      texture: "systems/pf1/icons/conditions/sleep.png",
      mechanics: {
        changes: [
          {
            formula: 0,
            subTarget: "dex",
            modifier: "untypedPerm",
            operator: "set",
            priority: 1001,
            continuous: true,
          },
        ],
      },
    },
    {
      _id: "staggered",
      name: "PF1.CondStaggered",
      texture: "systems/pf1/icons/conditions/staggered.png",
    },
    {
      _id: "stunned",
      name: "PF1.CondStunned",
      texture: "systems/pf1/icons/conditions/stunned.png",
      mechanics: {
        changes: [
          {
            formula: -2,
            subTarget: "ac",
            modifier: "penalty",
          },
        ],
      },
    },
    {
      _id: "squeezing",
      name: "PF1.CondSqueezing",
      texture: "systems/pf1/icons/conditions/squeezing.png",
      mechanics: {
        changes: [
          {
            formula: -4,
            subTarget: "ac",
            modifier: "penalty",
          },
          {
            formula: -4,
            subTarget: "attack",
            modifier: "penalty",
          },
        ],
      },
    },
  ];

  /**
   * Get all conditions that have belong to a given track
   *
   * @param {string} track - The given track to check for
   * @returns {string[]} - An array of all conditions in the given track
   */
  conditionsInTrack(track) {
    return this.contents.filter((condition) => condition.track === track).map((condition) => condition.id);
  }

  /**
   * Get all tracks and their conditions
   *
   * @returns {string[][]}
   */
  trackedConditions() {
    return this.tracks.map((track) => this.conditionsInTrack(track));
  }

  /**
   * The condition tracks
   *
   * @type {string[]}
   */
  get tracks() {
    return this.constructor.TRACKS;
  }
}

/**
 * {@inheritDoc Conditions}
 *
 * @group Conditions
 * @type {Conditions}
 */
export let conditions;
