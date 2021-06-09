import { ScriptEditor } from "../../apps/script-editor.js";

export class ItemScriptCall {
  static create(data, parent) {
    const result = new this();

    result.data = mergeObject(this.defaultData, data);
    result.parent = parent;

    return result;
  }

  static get defaultData() {
    return {
      _id: randomID(16),
      name: game.i18n.localize("PF1.ScriptCalls.NewName"),
      img: "icons/svg/dice-target.svg",
      type: "script",
      value: "",
      category: "",
    };
  }

  get id() {
    return this.data._id;
  }
  get type() {
    return this.data.type;
  }
  get value() {
    return this.data.value;
  }
  get category() {
    return this.data.category;
  }
  get name() {
    return this.data.name;
  }

  get scriptBody() {
    return this.type === "script" ? this.value : game.macros.get(this.value)?.data.command ?? "";
  }

  async update(data, options = {}) {
    if (this.parent != null) {
      const rawChange = this.parent.data.data.scriptCalls.find((o) => o._id === this.id);
      const idx = this.parent.data.data.scriptCalls.indexOf(rawChange);
      if (idx >= 0) {
        data = Object.entries(data).reduce((cur, o) => {
          cur[`data.scriptCalls.${idx}.${o[0]}`] = o[1];
          return cur;
        }, {});
        return this.parent.update(data, options);
      }
    }
  }

  // Opens up the editor for this script call
  async edit() {
    // For Macros
    if (this.type === "macro") {
      const macro = game.macros.get(this.value);
      let err;
      if (macro) {
        if (macro.testUserPermission(game.user, "OBSERVER")) {
          macro.sheet.render(true);
        } else {
          err = game.i18n.format("DOCUMENT.SheetPermissionWarn", { document: macro.documentName });
        }
      } else {
        err = game.i18n.format("PF1.ErrorNoMacroID", { id: this.value });
      }

      if (err) {
        console.error(err);
        ui.notifications.error(err);
      }
    }
    // For regular script calls
    else {
      const scriptEditor = new ScriptEditor({ command: this.value, name: this.name }).render(true);
      const result = await scriptEditor.awaitResult();
      if (result) {
        return this.update({ value: result.command, name: result.name });
      }
    }
  }

  /**
   * Executes the script.
   *
   * @param {object.<string, object>} extraParams - A dictionary containing extra parameters to pass on to the call.
   */
  execute(extraParams = {}) {
    // Add variables to the evaluation scope
    const item = this.parent;
    const actor = item.parentActor;
    const token = actor.token;

    // Attempt script execution
    const body = `(async () => {
      ${this.scriptBody}
    })()`;
    const fn = Function("item", "actor", "token", ...Object.keys(extraParams), body);
    try {
      return fn.call(this, item, actor, token, ...Object.values(extraParams));
    } catch (err) {
      ui.notifications.error(`There was an error in your script/macro syntax. See the console (F12) for details`);
      console.error(err);
    }
  }
}
