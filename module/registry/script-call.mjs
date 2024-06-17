import { Registry, RegistryEntry } from "./base-registry.mjs";

const fields = foundry.data.fields;

/**
 * A single script call category/trigger.
 *
 * @group Script Call Categories
 */
export class ScriptCallCategory extends RegistryEntry {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      itemTypes: new fields.ArrayField(new fields.StringField({})),
      info: new fields.StringField({ required: true, blank: false, initial: "" }, { localize: true }),
    };
  }
}

/**
 * The singleton registry of script call categories/trigger events.
 * At runtime this registry is accessible as `pf1.registry.scriptCalls`.
 *
 * @group Script Call Categories
 * @see {@link Registry}
 * @see {@link ScriptCallCategory}
 * @augments {Registry<ScriptCallCategory>}
 */
export class ScriptCalls extends Registry {
  /** @inheritdoc */
  static model = ScriptCallCategory;

  /** @inheritdoc */
  static _defaultData = [
    // Use
    {
      _id: "use",
      itemTypes: ["attack", "buff", "feat", "equipment", "implant", "consumable", "spell", "weapon"],
      name: "PF1.ScriptCalls.Use.Name",
      info: "PF1.ScriptCalls.Use.Info",
    },
    // Post-Use
    {
      _id: "postUse",
      itemTypes: ["attack", "buff", "feat", "equipment", "implant", "consumable", "spell", "weapon"],
      name: "PF1.ScriptCalls.PostUse.Name",
      info: "PF1.ScriptCalls.PostUse.Info",
    },
    // Equip
    {
      _id: "equip",
      itemTypes: ["weapon", "equipment", "loot"],
      name: "PF1.ScriptCalls.Equip.Name",
      info: "PF1.ScriptCalls.Equip.Info",
    },
    // Implant
    {
      _id: "implant",
      itemTypes: ["implant"],
      name: "PF1.ScriptCalls.Implant.Name",
      info: "PF1.ScriptCalls.Implant.Info",
    },
    // Toggle
    {
      _id: "toggle",
      itemTypes: ["buff", "feat"],
      name: "PF1.ScriptCalls.Toggle.Name",
      info: "PF1.ScriptCalls.Toggle.Info",
    },
    // Change Quantity
    {
      _id: "changeQuantity",
      itemTypes: ["loot", "equipment", "weapon", "implant", "consumable", "container"],
      name: "PF1.ScriptCalls.ChangeQuantity.Name",
      info: "PF1.ScriptCalls.ChangeQuantity.Info",
    },
    // Change Level
    {
      _id: "changeLevel",
      itemTypes: ["buff", "class"],
      name: "PF1.ScriptCalls.ChangeLevel.Name",
      info: "PF1.ScriptCalls.ChangeLevel.Info",
    },
  ];
}

/**
 * {@inheritDoc ScriptCalls}
 *
 * @group Script Call Categories
 * @type {ScriptCalls}
 */
export let scriptCalls;
