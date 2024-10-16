/**
 * Script Call
 */
export class ItemScriptCall extends foundry.abstract.DataModel {
  constructor(data, options) {
    if (options instanceof foundry.abstract.DataModel) {
      foundry.utils.logCompatibilityWarning("ItemScriptCall second constructor parameter is no longer plain parent.", {
        since: "PF1 vNEXT",
        until: "PF1 vNEXT+1",
      });
      options = { parent: options };
    }
    super(data, options);
  }

  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      _id: new fields.StringField({
        required: true,
        blank: false,
        readonly: true,
        initial: () => foundry.utils.randomID(8),
      }),
      name: new fields.StringField({ required: true, initial: () => game.i18n.localize("PF1.ScriptCalls.NewName") }),
      img: new fields.FilePathField({ required: false, blank: false, categories: ["IMAGE"] }),
      type: new fields.StringField({
        required: true,
        blank: false,
        nullable: false,
        initial: "script",
        choices: ["script", "macro"],
      }),
      value: new fields.StringField({ required: true, nullable: false, blank: true }),
      category: new fields.StringField({ required: false }),
      hidden: new fields.BooleanField({ initial: false, required: false }),
    };
  }

  static migrateData(data) {
    if (data.type == "macro") {
      data.name = "";
      data.img = "";
    }
  }

  /** @deprecated */
  get data() {
    foundry.utils.logCompatibilityWarning(
      "ItemScriptCall.data is deprecated in favor of directly accessing the data.",
      {
        since: "PF1 vNEXT",
        until: "PF1 vNEXT+1",
      }
    );
    return this;
  }

  /** @deprecated */
  static get defaultData() {
    foundry.utils.logCompatibilityWarning("ItemScriptCall.defaultData is deprecated with no replacement.", {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });
    return new this().toObject();
  }

  /** @override */
  _initialize(options = {}) {
    super._initialize(options);

    this._safePrepareData();
  }

  /**
   * Safely prepare data
   *
   * @internal
   */
  _safePrepareData() {
    try {
      this.prepareData();
    } catch (err) {
      console.error(err, this, { parent: this.parent });
    }
  }

  prepareData() {
    if (this.type === "macro") {
      const macro = fromUuidSync(this.value);
      this.name = macro?.name || `${game.i18n.localize("PF1.Unknown")} (${game.i18n.localize("DOCUMENT.Macro")})`;
      this.img = macro?.img || "icons/svg/hazard.svg";
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

    if (!(parent instanceof pf1.documents.item.ItemPF))
      throw new Error("Can not create script calls outside of items.");

    // Prepare data
    data = data.map((dataObj) => new ItemScriptCall(dataObj, { parent }).toObject());
    const newScriptCallData = parent.toObject().system.scriptCalls || [];
    newScriptCallData.push(...data);

    // TODO: Ensure new script calls don't have ID conflicts

    // Update parent
    await parent.update({ "system.scriptCalls": newScriptCallData });

    // Return results
    return data.map((o) => parent.scriptCalls.get(o._id));
  }

  /** @type {string} */
  get id() {
    return this._id;
  }

  /** @type {boolean} */
  get hide() {
    return this.hidden && !game.user.isGM;
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
      const idx = this.parent.system.scriptCalls.findIndex((o) => o._id === this.id);
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
  async edit({ editable = true } = {}) {
    // For Macros
    if (this.type === "macro") {
      const macro = await fromUuid(this.value);
      if (!macro) return void ui.notifications.error(game.i18n.format("PF1.Error.NoMacroID", { id: this.value }));

      macro.sheet.render(true, { focus: true, editable });
    }
    // For regular script calls
    else {
      const scriptEditor = new pf1.applications.ScriptEditor({
        command: this.value,
        name: this.name,
        parent: this.parent,
        script: this.id,
        scriptCall: true,
      }).render(true, { editable });

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
    const action = shared.action ?? null;
    const token = actor?.token?.object ?? actor?.getActiveTokens(false, false)[0];

    const scm = await this.getDelegate();
    if (!scm) return;

    // Create temporary macro for handling execution context and other utility
    return scm.execute({ item, actor, token, shared, action, ...extraParams });
  }
}
