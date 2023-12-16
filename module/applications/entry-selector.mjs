export class EntrySelector extends FormApplication {
  constructor(object, options) {
    super(object, options);

    if (options.title) this.subtitle = game.i18n.localize(options.title);

    // Prepare data and convert it into format compatible with the editor
    this.isFlag = this.options.flag === true;
    this.isBoolean = this.options.boolean === true;
    this.isFlat = this.options.flat === true;
    const data = foundry.utils.deepClone(
      foundry.utils.getProperty(this.object, this.attribute) ?? (this.isFlag ? {} : [])
    );

    this.originalEntries = data;
    this.entries = this.isFlag ? (this.isBoolean ? Object.keys(data).map((d) => [d]) : Object.entries(data)) : data;
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "pf1", "entry"],
      template: "systems/pf1/templates/apps/entry-selector.hbs",
      width: 320,
      height: "auto",
      closeOnSubmit: false,
      submitOnClose: false,
    };
  }

  get id() {
    // BUG?: Hypothetical: Behaves poorly on container items?
    return `entry-selector-item-${this.object.uuid}-${this.options.name}`;
  }

  get title() {
    const item = this.object;
    const actor = item.actor;
    const title = this.subtitle ?? game.i18n.localize("PF1.Application.EntrySelector.Title");
    if (item) {
      if (actor) {
        return game.i18n.format("PF1.Application.EntrySelector.TitleOwned", {
          item: item.name,
          actor: actor.name,
          title,
        });
      } else {
        return game.i18n.format("PF1.Application.EntrySelector.TitleIsolated", { item: item.name, title });
      }
    } else {
      return title;
    }
  }

  get attribute() {
    return this.options.name;
  }

  get fields() {
    return this.options.fields.split(";");
  }

  get dtypes() {
    return this.options.dtypes.split(";");
  }

  get dataCount() {
    return this.fields.length;
  }

  getData() {
    const entries = this.entries.map((entry) =>
      this.isFlat ? [entry, this.dtypes[entry]] : entry.map((o2, a) => [o2, this.dtypes[a]])
    );

    return {
      entries: entries,
      fields: this.fields,
      isFlat: this.isFlat,
    };
  }

  activateListeners(html) {
    if (!this.isEditable) return;

    html.find(".entry-control").click(this._onEntryControl.bind(this));

    html.find('tr td input[type="text"]').change(this._onEntryChange.bind(this));

    html.find('button[type="submit"]').click(this._submitAndClose.bind(this));
  }

  async _updateObject(event, formData) {
    const updateData = {};

    if (this.isFlag) {
      // Convert editor data for flags
      const newKeys = new Set(); // Needed for deletion detection
      const entries = this.entries.forEach(([key, value]) => {
        newKeys.add(key);
        updateData[`${this.attribute}.${key}`] = this.isBoolean ? true : value;
      });
      // Handle deletions
      const oldKeys = Object.keys(this.originalEntries);
      oldKeys.forEach((key) => {
        if (!newKeys.has(key)) updateData[`${this.attribute}.-=${key}`] = null;
      });
    } else {
      updateData[this.attribute] = this.entries;
    }

    return this.object.update(updateData);
  }

  async _onEntryControl(event) {
    event.preventDefault();
    const a = event.currentTarget;

    if (a.classList.contains("add-entry")) {
      if (this.isFlat) {
        const dataType = this.dtypes[a];
        if (dataType === "Number") this.entries.push(0);
        else this.entries.push("");
      } else {
        const obj = [];
        for (let a = 0; a < this.dataCount; a++) {
          const dataType = this.dtypes[a];
          if (dataType === "Number") obj.push(0);
          else obj.push("");
        }
        this.entries.push(obj);
      }
      return this.render();
    }

    if (a.classList.contains("delete-entry")) {
      const tr = a.closest("tr");
      const index = parseInt(tr.dataset.index);
      this.entries.splice(index, 1);
      return this.render();
    }
  }

  async _onEntryChange(event) {
    const a = event.currentTarget;

    const tr = a.closest("tr.entry");
    const index = parseInt(tr.dataset.index);
    const index2 = parseInt(a.dataset.index);
    const value = a.value;

    if (a.dataset.dtype === "Number") {
      let v = parseFloat(value);
      if (isNaN(v)) v = 0;
      if (this.isFlat) this.entries[index] = Math.floor(v * 100) / 100;
      else this.entries[index][index2] = Math.floor(v * 100) / 100;
    } else {
      if (this.isFlat) this.entries[index] = value;
      else this.entries[index][index2] = value;
    }
  }

  async _submitAndClose(event) {
    event.preventDefault();
    await this._onSubmit(event);
    this.close();
  }

  /**
   * Opens selector for chosen with with options or re-opens previously open app if such is found.
   *
   * @param {Item} item Item passed to constructor
   * @param {object} options Options passed to constructor
   */
  static open(item, options) {
    const app = new this(item, options);

    const old = Object.values(ui.windows).find((oldApp) => oldApp instanceof this && oldApp.id === app.id);
    if (old) old.render(false, { focus: true });
    else app.render(true, { focus: true });
  }
}
