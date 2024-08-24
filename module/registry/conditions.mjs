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
              formula: new fields.StringField({ required: true }),
              target: new fields.StringField({ required: true }),
              type: new fields.StringField({ required: true }),
              operator: new fields.StringField({ required: false, initial: undefined }),
              priority: new fields.NumberField({ required: false, initial: undefined }),
              continuous: new fields.BooleanField({ required: false, initial: undefined }),
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
      journal: new fields.StringField({ nullable: true, blank: false, required: false }),
      showInDefense: new fields.BooleanField({ required: false, initial: true }),
      showInAction: new fields.BooleanField({ required: false, initial: true }),
      showInBuffsTab: new fields.BooleanField({ required: false, initial: true }),
      overlay: new fields.BooleanField({ required: false, initial: false }),
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
  static TRACKS = /** @type {const} */ (["dying", "fear", "lethargy"]);

  /**
   * @internal
   */
  static SET_TO_ZERO = {
    formula: 0,
    type: "untypedPerm",
    operator: "set",
    priority: 1001,
    continuous: true,
  };

  /** @inheritdoc */
  static _defaultData = [
    {
      _id: "bleed",
      name: "PF1.Condition.bleed",
      texture: "systems/pf1/icons/conditions/bleed.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.L6DTocj1PbOtuspU",
      showInAction: false,
      showInDefense: false,
    },
    {
      _id: "blind",
      name: "PF1.Condition.blind",
      texture: "icons/svg/blind.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.A9KUpd2bsdZZsQqj",
      mechanics: {
        changes: [
          {
            formula: -2,
            target: "ac",
            type: "untyped",
          },
        ],
        flags: ["loseDexToAC"],
      },
    },
    {
      _id: "confused",
      name: "PF1.Condition.confused",
      texture: "systems/pf1/icons/conditions/confused.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.J2yma0xciBKRUh9t",
      showInDefense: false,
    },
    {
      _id: "cowering",
      name: "PF1.Condition.cowering",
      texture: "systems/pf1/icons/conditions/cowering.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.eNW5geiJqrnAjjNu",
      mechanics: {
        changes: [
          {
            formula: -2,
            target: "ac",
            type: "untyped",
          },
        ],
        flags: ["loseDexToAC"],
      },
      showInAction: false,
    },
    {
      _id: "dazed",
      name: "PF1.Condition.dazed",
      texture: "systems/pf1/icons/conditions/dazed.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.2A6Gk60pLDKR2zT0",
      showInAction: false,
    },
    {
      _id: "dazzled",
      name: "PF1.Condition.dazzled",
      texture: "systems/pf1/icons/conditions/dazzled.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.xHUnCadQ2qYsfvV0",
      mechanics: {
        changes: [
          {
            formula: -1,
            target: "attack",
            type: "untyped",
          },
        ],
      },
      showInDefense: false,
      showInAction: false,
    },
    {
      _id: "dead",
      name: "PF1.Condition.dead",
      texture: "icons/svg/skull.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.YvycF7bsU1hPm4pX",
      track: "dying",
      showInBuffsTab: false,
      overlay: true,
    },
    {
      _id: "deaf",
      name: "PF1.Condition.deaf",
      texture: "icons/svg/deaf.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.3uIamlB0L1UZUwoF",
      mechanics: {
        changes: [
          {
            formula: -4,
            target: "init",
            type: "untyped",
          },
        ],
      },
    },
    {
      _id: "disabled",
      name: "PF1.Condition.disabled",
      texture: "systems/pf1/icons/conditions/disabled.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.dtHHibCiKZzdjyvp",
      track: "dying",
      showInDefense: false,
    },
    {
      _id: "dying",
      name: "PF1.Condition.dying",
      texture: "systems/pf1/icons/conditions/dying.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.zG6xEGMIerpbnND0",
      mechanics: {
        changes: [
          {
            ...this.SET_TO_ZERO,
            target: "dex",
          },
        ],
        flags: ["loseDexToAC"],
      },
      track: "dying",
      showInDefense: false,
    },
    {
      _id: "entangled",
      name: "PF1.Condition.entangled",
      texture: "icons/svg/net.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.oxmugd8SoxVjvRRl",
      mechanics: {
        changes: [
          {
            formula: -4,
            target: "dex",
            type: "untyped",
          },
          {
            formula: -2,
            target: "attack",
            type: "untyped",
          },
        ],
      },
    },
    {
      _id: "exhausted",
      name: "PF1.Condition.exhausted",
      texture: "systems/pf1/icons/conditions/exhausted.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.ITxxh53qgl74wWcE",
      mechanics: {
        changes: [
          {
            formula: -6,
            target: "str",
            type: "untyped",
          },
          {
            formula: -6,
            target: "dex",
            type: "untyped",
          },
        ],
      },
      track: "lethargy",
      showInDefense: false,
    },
    {
      _id: "fatigued",
      name: "PF1.Condition.fatigued",
      texture: "icons/svg/unconscious.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.AVaxTNildXRzYnQm",
      mechanics: {
        changes: [
          {
            formula: -2,
            target: "str",
            type: "untyped",
          },
          {
            formula: -2,
            target: "dex",
            type: "untyped",
          },
        ],
      },
      track: "lethargy",
      showInDefense: false,
    },
    {
      _id: "flatFooted",
      name: "PF1.Condition.flatFooted",
      texture: "systems/pf1/icons/conditions/flat-footed.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.eSvkrrl3US7RJTai",
      mechanics: {
        flags: ["loseDexToAC"],
      },
      showInAction: false,
    },
    {
      _id: "frightened",
      name: "PF1.Condition.frightened",
      texture: "systems/pf1/icons/conditions/frightened.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.uqpJ7ZMnWF5qjOTl",
      mechanics: {
        changes: [
          {
            formula: -2,
            target: "attack",
            type: "untyped",
          },
          {
            formula: -2,
            target: "allSavingThrows",
            type: "untyped",
          },
          {
            formula: -2,
            target: "skills",
            type: "untyped",
          },
          {
            formula: -2,
            target: "allChecks",
            type: "untyped",
          },
        ],
      },
      track: "fear",
      showInAction: false,
    },
    {
      _id: "grappled",
      name: "PF1.Condition.grappled",
      texture: "systems/pf1/icons/conditions/grappled.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.i4gHNAVajJWs4cFI",
      mechanics: {
        changes: [
          {
            formula: -4,
            target: "dex",
            type: "untyped",
          },
          {
            formula: -2,
            target: "attack",
            type: "untyped",
          },
        ],
      },
    },
    {
      _id: "helpless",
      name: "PF1.Condition.helpless",
      texture: "systems/pf1/icons/conditions/helpless.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.6dtCytJsNkO8Hwq4",
      mechanics: {
        changes: [
          {
            ...this.SET_TO_ZERO,
            target: "dex",
          },
        ],
        flags: ["loseDexToAC"],
      },
      showInAction: false,
    },
    {
      _id: "incorporeal",
      name: "PF1.Condition.incorporeal",
      texture: "systems/pf1/icons/conditions/incorporeal.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.acqGBiMxTbXZ47zU",
      mechanics: {
        changes: [
          {
            formula: 0,
            target: "nac",
            type: "base",
            operator: "set",
            priority: -10,
          },
          {
            formula: "max(1, @abilities.cha.mod)",
            operator: "add",
            target: "ac",
            type: "deflection",
          },
        ],
      },
      showInAction: false,
      showInDefense: false,
    },
    {
      _id: "invisible",
      name: "PF1.Condition.invisible",
      texture: "icons/svg/invisible.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.Wr2ZWUZcyVWQ4GtX",
      showInDefense: false,
    },
    {
      _id: "nauseated",
      name: "PF1.Condition.nauseated",
      texture: "systems/pf1/icons/conditions/nauseated.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.ySiyyK1BMAyKPY4I",
    },
    {
      _id: "panicked",
      name: "PF1.Condition.panicked",
      texture: "icons/svg/terror.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.nGTsTfpWcJTTU3rk",
      mechanics: {
        changes: [
          {
            formula: -2,
            target: "attack",
            type: "untyped",
          },
          {
            formula: -2,
            target: "allSavingThrows",
            type: "untyped",
          },
          {
            formula: -2,
            target: "skills",
            type: "untyped",
          },
          {
            formula: -2,
            target: "allChecks",
            type: "untyped",
          },
        ],
      },
      track: "fear",
    },
    {
      _id: "paralyzed",
      name: "PF1.Condition.paralyzed",
      texture: "systems/pf1/icons/conditions/paralyzed.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.24p2Koq4FFCLDKnj",
      mechanics: {
        changes: [
          {
            ...this.SET_TO_ZERO,
            target: "dex",
          },
          {
            ...this.SET_TO_ZERO,
            target: "str",
          },
        ],
        flags: ["loseDexToAC"],
      },
      showInAction: false,
    },
    {
      _id: "petrified",
      name: "PF1.Condition.petrified",
      texture: "systems/pf1/icons/conditions/petrified.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.ayGQWwbrhAc99pkH",
      mechanics: {
        changes: [
          {
            ...this.SET_TO_ZERO,
            target: "dex",
          },
        ],
        flags: ["loseDexToAC"],
      },
      showInAction: false,
      showInDefense: false,
    },
    {
      _id: "pinned",
      name: "PF1.Condition.pinned",
      texture: "systems/pf1/icons/conditions/pinned.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.poCq8gXdDi5leaMT",
      mechanics: {
        changes: [
          {
            formula: "min(0, @abilities.dex.mod)",
            target: "dexMod",
            type: "untyped",
            operator: "set",
            priority: 1001,
            continuous: true,
          },
          {
            formula: -4,
            target: "ac",
            type: "untyped",
          },
          {
            formula: -4,
            target: "cmd",
            type: "untyped",
          },
        ],
        flags: ["loseDexToAC"],
      },
      showInAction: false,
    },
    {
      _id: "prone",
      name: "PF1.Condition.prone",
      texture: "icons/svg/falling.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.VbagnIPQS523dwxa",
      mechanics: {
        changes: [
          {
            formula: -4,
            target: "mattack",
            type: "untyped",
          },
        ],
      },
    },
    {
      _id: "shaken",
      name: "PF1.Condition.shaken",
      texture: "systems/pf1/icons/conditions/shaken.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.XxLUswkCuXnXmA5T",
      mechanics: {
        changes: [
          {
            formula: -2,
            target: "attack",
            type: "untyped",
          },
          {
            formula: -2,
            target: "allSavingThrows",
            type: "untyped",
          },
          {
            formula: -2,
            target: "skills",
            type: "untyped",
          },
          {
            formula: -2,
            target: "allChecks",
            type: "untyped",
          },
        ],
      },
      track: "fear",
      showInAction: false,
      showInDefense: false,
    },
    {
      _id: "sickened",
      name: "PF1.Condition.sickened",
      texture: "systems/pf1/icons/conditions/sickened.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.7LwCMwrX3tchvrjW",
      mechanics: {
        changes: [
          {
            formula: -2,
            target: "attack",
            type: "untyped",
          },
          {
            formula: -2,
            target: "wdamage",
            type: "untyped",
          },
          {
            formula: -2,
            target: "allSavingThrows",
            type: "untyped",
          },
          {
            formula: -2,
            target: "skills",
            type: "untyped",
          },
          {
            formula: -2,
            target: "allChecks",
            type: "untyped",
          },
        ],
      },
      showInAction: false,
      showInDefense: false,
    },
    {
      _id: "sleep",
      name: "PF1.Condition.sleep",
      texture: "icons/svg/sleep.svg",
      journal: null,
      mechanics: {
        changes: [
          {
            ...this.SET_TO_ZERO,
            target: "dex",
          },
        ],
        flags: ["loseDexToAC"],
      },
      showInAction: false,
    },
    {
      _id: "squeezing",
      name: "PF1.Condition.squeezing",
      texture: "systems/pf1/icons/conditions/squeezing.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.jzeZ0Uf31CAMZra9",
      mechanics: {
        changes: [
          {
            formula: -4,
            target: "ac",
            type: "untyped",
          },
          {
            formula: -4,
            target: "attack",
            type: "untyped",
          },
        ],
      },
    },
    {
      _id: "stable",
      name: "PF1.Condition.stable",
      texture: "systems/pf1/icons/conditions/stable.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.krgVb43Vd62dqpYr",
      mechanics: {
        changes: [
          {
            ...this.SET_TO_ZERO,
            target: "dex",
          },
        ],
        flags: ["loseDexToAC"],
      },
      track: "dying",
      showInAction: false,
      showInDefense: false,
    },
    {
      _id: "staggered",
      name: "PF1.Condition.staggered",
      texture: "systems/pf1/icons/conditions/staggered.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.TTp8q9Vb2PNAujWu",
    },
    {
      _id: "stunned",
      name: "PF1.Condition.stunned",
      texture: "icons/svg/stoned.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.ZgsBPY0uVCVl6SGh",
      mechanics: {
        changes: [
          {
            formula: -2,
            target: "ac",
            type: "untyped",
          },
        ],
        flags: ["loseDexToAC"],
      },
      showInAction: false,
    },
    {
      _id: "unconscious",
      name: "PF1.Condition.unconscious",
      texture: "systems/pf1/icons/conditions/unconscious.svg",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.kHwbZ38VHCa1wkUF",
      mechanics: {
        changes: [
          {
            ...this.SET_TO_ZERO,
            target: "dex",
          },
        ],
        flags: ["loseDexToAC"],
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
