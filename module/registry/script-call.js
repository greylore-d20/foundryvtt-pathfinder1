import { BaseRegistryObject } from "./_base.js";

export const registerScriptCalls = function () {
  // --------------------------------------------------------- //
  // Register item categories
  // --------------------------------------------------------- //
  // Use
  game.pf1.registry.registerItemScriptCategory(
    "pf1",
    new ScriptCall({
      _id: "use",
      itemTypes: ["attack", "feat", "equipment", "consumable", "spell", "weapon"],
      name: "PF1.ScriptCalls.Use.Name",
      info: "PF1.ScriptCalls.Use.Info",
    })
  );
  // Equip
  game.pf1.registry.registerItemScriptCategory(
    "pf1",
    new ScriptCall({
      _id: "equip",
      itemTypes: ["weapon", "equipment", "loot"],
      name: "PF1.ScriptCalls.Equip.Name",
      info: "PF1.ScriptCalls.Equip.Info",
    })
  );
  // Toggle
  game.pf1.registry.registerItemScriptCategory(
    "pf1",
    new ScriptCall({
      _id: "toggle",
      itemTypes: ["buff", "feat"],
      name: "PF1.ScriptCalls.Toggle.Name",
      info: "PF1.ScriptCalls.Toggle.Info",
    })
  );
  // Change Quantity
  game.pf1.registry.registerItemScriptCategory(
    "pf1",
    new ScriptCall({
      _id: "changeQuantity",
      itemTypes: ["loot", "equipment", "weapon", "consumable", "container"],
      name: "PF1.ScriptCalls.ChangeQuantity.Name",
      info: "PF1.ScriptCalls.ChangeQuantity.Info",
    })
  );
  // Change Level
  game.pf1.registry.registerItemScriptCategory(
    "pf1",
    new ScriptCall({
      _id: "changeLevel",
      itemTypes: ["buff", "class"],
      name: "PF1.ScriptCalls.ChangeLevel.Name",
      info: "PF1.ScriptCalls.ChangeLevel.Info",
    })
  );

  // -------------------------------------------------------------- //
  // Call hook for module developers to register their script calls //
  // -------------------------------------------------------------- //
  Hooks.callAll("pf1.register.scriptCalls");
};

export class ScriptCall extends BaseRegistryObject {
  static get _baseData() {
    return mergeObject(super._baseData, {
      itemTypes: [],
      name: null,
      info: null,
    });
  }

  static get typeName() {
    return "Script Call";
  }
}
