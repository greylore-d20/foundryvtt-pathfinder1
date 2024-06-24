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
      texture: "systems/pf1/icons/conditions/bleed.png",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.L6DTocj1PbOtuspU",
      showInAction: false,
      showInDefense: false,
    },
    {
      _id: "blind",
      name: "PF1.Condition.blind",
      texture: "systems/pf1/icons/conditions/blind.png",
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
      texture: "systems/pf1/icons/conditions/confused.png",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.J2yma0xciBKRUh9t",
      showInDefense: false,
    },
    {
      _id: "cowering",
      name: "PF1.Condition.cowering",
      texture: "systems/pf1/icons/conditions/screaming.png",
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
      texture: "systems/pf1/icons/conditions/dazed.png",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.2A6Gk60pLDKR2zT0",
      showInAction: false,
    },
    {
      _id: "dazzled",
      name: "PF1.Condition.dazzled",
      texture: "systems/pf1/icons/conditions/dazzled.png",
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
      _id: "deaf",
      name: "PF1.Condition.deaf",
      texture: "systems/pf1/icons/conditions/deaf.png",
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
      _id: "entangled",
      name: "PF1.Condition.entangled",
      texture: "systems/pf1/icons/conditions/entangled.png",
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
      texture: "systems/pf1/icons/conditions/exhausted.png",
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
      texture: "systems/pf1/icons/conditions/fatigued.png",
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
      _id: "frightened",
      name: "PF1.Condition.frightened",
      texture: "systems/pf1/icons/conditions/frightened.png",
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
      texture: "systems/pf1/icons/conditions/grappled.png",
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
      texture: "systems/pf1/icons/conditions/helpless.png",
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
      texture: "systems/pf1/icons/conditions/incorporeal.png",
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
      texture: "systems/pf1/icons/conditions/invisible.png",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.Wr2ZWUZcyVWQ4GtX",
      showInDefense: false,
    },
    {
      _id: "nauseated",
      name: "PF1.Condition.nauseated",
      texture: "systems/pf1/icons/conditions/nauseated.png",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.ySiyyK1BMAyKPY4I",
    },
    {
      _id: "panicked",
      name: "PF1.Condition.panicked",
      texture: "systems/pf1/icons/conditions/fear.png",
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
      texture: "systems/pf1/icons/conditions/paralyzed.png",
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
      _id: "pinned",
      name: "PF1.Condition.pinned",
      texture: "systems/pf1/icons/conditions/pinned.png",
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
      texture: "systems/pf1/icons/conditions/prone.png",
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
      texture: "systems/pf1/icons/conditions/shaken.png",
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
      texture: "systems/pf1/icons/conditions/sickened.png",
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
      texture: "systems/pf1/icons/conditions/sleep.png",
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
      _id: "staggered",
      name: "PF1.Condition.staggered",
      texture: "systems/pf1/icons/conditions/staggered.png",
      journal: "Compendium.pf1.pf1e-rules.JournalEntry.NSqfXaj4MevUR2uJ.JournalEntryPage.TTp8q9Vb2PNAujWu",
    },
    {
      _id: "stunned",
      name: "PF1.Condition.stunned",
      texture: "systems/pf1/icons/conditions/stunned.png",
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
      _id: "squeezing",
      name: "PF1.Condition.squeezing",
      texture: "systems/pf1/icons/conditions/squeezing.png",
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
