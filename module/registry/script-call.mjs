import { BaseRegistry, BaseRegistryObject } from "./base-registry.mjs";

export class ScriptCall extends BaseRegistryObject {
  /** @inheritdoc */
  static typeName = "Script Call";

  /** @inheritdoc */
  static get _baseData() {
    return mergeObject(super._baseData, {
      itemTypes: [],
      name: null,
      info: null,
    });
  }
}

export class ScriptCalls extends BaseRegistry {
  /** @inheritdoc */
  static contentClass = ScriptCall;

  /** @inheritdoc */
  static _defaultData = [
    // Use
    {
      _id: "use",
      itemTypes: ["attack", "feat", "equipment", "consumable", "spell", "weapon"],
      name: "PF1.ScriptCalls.Use.Name",
      info: "PF1.ScriptCalls.Use.Info",
    },
    // Equip
    {
      _id: "equip",
      itemTypes: ["weapon", "equipment", "loot"],
      name: "PF1.ScriptCalls.Equip.Name",
      info: "PF1.ScriptCalls.Equip.Info",
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
      itemTypes: ["loot", "equipment", "weapon", "consumable", "container"],
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
  ].map((d) => ({ ...d, module: "pf1" }));
}

export const scriptCalls = new ScriptCalls();
