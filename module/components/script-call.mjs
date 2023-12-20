import { ScriptEditor } from "../applications/script-editor.mjs";

/**
 * Script Call
 */
export class ItemScriptCall {
  constructor(data, parent) {
    this.data = foundry.utils.mergeObject(this.constructor.defaultData, data);
    this.parent = parent;

    if (this.type === "macro") {
      const macro = fromUuidSync(this.value);
      this.data.name = macro?.name || `${game.i18n.localize("PF1.Unknown")} (${game.i18n.localize("DOCUMENT.Macro")})`;
      this.data.img = macro?.img || "icons/svg/hazard.svg";
    }
  }

  /**
   * Creates a script call.
   *
   * @param {object[]} data - Data to initialize the script call(s) with.
   * @param {object} context - An object containing context information.
   * @param {ItemPF} [context.parent] - The parent entity to create the script call within.
   * @returns The resulting script calls, or an empty array if nothing was created.
   */
  static async create(data, context) {
    const { parent } = context;

    if (parent instanceof pf1.documents.item.ItemPF) {
      // Prepare data
      data = data.map((dataObj) => foundry.utils.mergeObject(this.defaultData, dataObj));
      const newScriptCallData = foundry.utils.deepClone(parent.system.scriptCalls || []);
      newScriptCallData.push(...data);

      // Update parent
      await parent.update({ "system.scriptCalls": newScriptCallData });

      // Return results
      return data.map((o) => parent.scriptCalls.get(o._id));
    }

    return [];
  }

  static get defaultData() {
    return {
      _id: foundry.utils.randomID(16),
      name: game.i18n.localize("PF1.ScriptCalls.NewName"),
      img: "icons/svg/dice-target.svg",
      type: "script",
      value: "",
      category: "",
      hidden: false,
    };
  }

  /** @type {string} */
  get id() {
    return this.data._id;
  }

  /** @type {string} */
  get type() {
    return this.data.type;
  }

  /** @type {string} */
  get value() {
    return this.data.value;
  }

  /** @type {string} */
  get category() {
    return this.data.category;
  }

  /** @type {string} */
  get name() {
    return this.data.name;
  }

  /** @type {string} */
  get img() {
    return this.data.img;
  }

  /** @type {boolean} */
  get hidden() {
    return this.data.hidden;
  }

  /** @type {boolean} */
  get hide() {
    return this.hidden && !game.user.isGM;
  }

  /**
   * @deprecated
   * @returns {string}
   */
  async getScriptBody() {
    foundry.utils.logCompatibilityWarning("ItemScriptCall.getScriptBody() has been deprecated with no replacement.", {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });
    return this.type === "script" ? this.value : (await fromUuid(this.value))?.command ?? "";
  }

  /**
   * Get macro delegate for executing this script call with.
   *
   * @returns {Macro}
   */
  async getDelegate() {
    if (this.type === "script") {
      return new Macro({
        type: "script",
        command: this.value,
        name: this.name,
      });
    } else {
      return fromUuid(this.value);
    }
  }

  async update(data, options = {}) {
    if (this.parent != null) {
      const rawChange = this.parent.system.scriptCalls.find((o) => o._id === this.id);
      const idx = this.parent.system.scriptCalls.indexOf(rawChange);
      if (idx >= 0) {
        data = Object.entries(data).reduce((cur, o) => {
          cur[`system.scriptCalls.${idx}.${o[0]}`] = o[1];
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
      if (!macro) return void ui.notifications.error(game.i18n.format("PF1.ErrorNoMacroID", { id: this.value }));

      macro.sheet.render(true, { focus: true });
    }
    // For regular script calls
    else {
      const scriptEditor = new ScriptEditor({
        command: this.value,
        name: this.name,
        parent: this.parent,
        script: this.id,
        scriptCall: true,
      }).render(true);

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
   * @param {Object<string, object>} extraParams - A dictionary containing extra parameters to pass on to the call.
   * @returns {*} - Script return value if any
   */
  async execute(shared, extraParams = {}) {
    // Add variables to the evaluation scope
    const item = this.parent;
    const actor = item.actor;
    const token = actor?.token?.object ?? actor.getActiveTokens(false, false)[0];

    const scm = await this.getDelegate();
    if (!scm) return;

    // Create temporary macro for handling execution context and other utility
    return scm.execute({ item, actor, token, shared, ...extraParams });
  }
}
