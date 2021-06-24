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
      hidden: false,
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
  get hidden() {
    return this.data.hidden;
  }

  async getScriptBody() {
    return this.type === "script" ? this.value : (await fromUuid(this.value))?.data.command ?? "";
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
      const macro = await fromUuid(this.value);
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
   * @param {object} shared - An object passed between script calls, and which is passed back as a result of ItemPF.executeScriptCalls.
   * @param {object.<string, object>} extraParams - A dictionary containing extra parameters to pass on to the call.
   */
  async execute(shared, extraParams = {}) {
    // Add variables to the evaluation scope
    const item = this.parent;
    const actor = item.parentActor;
    const token =
      actor?.token?.object ?? (actor ? canvas.tokens.placeables.find((t) => t.actor?.id === actor.id) : null);

    // Attempt script execution
    const body = `(async () => {
      ${await this.getScriptBody()}
    })()`;
    const fn = Function("item", "actor", "token", "shared", ...Object.keys(extraParams), body);
    try {
      return fn.call(this, item, actor, token, shared, ...Object.values(extraParams));
    } catch (err) {
      ui.notifications.error(`There was an error in your script/macro syntax. See the console (F12) for details`);
      console.error(err);
    }
  }
}
