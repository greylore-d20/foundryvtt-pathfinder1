import { AbstractListSelector } from "@app/abstract-list-selector.mjs";

/**
 * An application that allows the user to configure change flags on an item
 *
 * @augments {AbstractListSelector}
 */
export class EntrySelector extends AbstractListSelector {
  static DEFAULT_OPTIONS = {
    classes: ["entry-selector"],
    position: {
      width: 300,
    },
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/entry-selector.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  constructor(options) {
    super(options);

    if (options.title) this.subtitle = game.i18n.localize(options.title);

    // Prepare data and convert it into format compatible with the editor
    this.isFlag = this.options.flag === true;
    this.isBoolean = this.options.boolean === true;
    this.isFlat = this.options.flat === true;
    const data = foundry.utils.deepClone(
      foundry.utils.getProperty(this.document, this.attribute) ?? (this.isFlag ? {} : [])
    );

    this.originalEntries = data;
    this.entries = this.isFlag ? (this.isBoolean ? Object.keys(data).map((d) => [d]) : Object.entries(data)) : data;
  }

  /* -------------------------------------------- */

  /**
   * Return the dragdrop element type for this application
   *
   * @returns {string}
   */
  get dragDropType() {
    return "entry-" + this.options.name;
  }

  /* -------------------------------------------- */

  /**
   * Initialize the configuration for this application. Override the default ID to be unique to this
   * entry selector instance based on document and attribute that is being edited.
   *
   * @override
   * @param {ApplicationConfiguration} options    The provided configuration options for the Application
   * @returns {ApplicationConfiguration}           The final configuration values for the application
   */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    options.id = `EntrySelector-${options.name}-${options.document.uuid.replaceAll(".", "-")}`;
    return options;
  }

  /* -------------------------------------------- */

  /**
   * Configure the title of the dialog window.
   *
   * @override
   * @type {string}
   */
  get title() {
    const item = this.document;
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

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    const entries = this.entries.map((entry) =>
      this.isFlat ? [entry, this.dtypes[entry]] : entry.map((o2, a) => [o2, this.dtypes[a]])
    );

    return {
      ...(await super._prepareContext()),
      entries,
      isFlat: this.isFlat,
    };
  }

  /* -------------------------------------------- */

  /**
   * Provides default data for a new list entry
   *
   * @override
   * @param event
   * @protected
   * @returns {object}
   */
  _getNewEntry(event) {
    const a = event.currentTarget;

    if (this.isFlat) {
      const dataType = this.dtypes[a];
      if (dataType === "Number") return 0;
      return "";
    } else {
      const obj = [];
      for (let a = 0; a < this.dataCount; a++) {
        const dataType = this.dtypes[a];
        if (dataType === "Number") obj.push(0);
        else obj.push("");
      }
      return obj;
    }
  }

  /* -------------------------------------------- */

  /**
   * Update internal data snapshot on form change
   *
   * @param formConfig
   * @param event
   * @override
   * @internal
   * @override
   * @this {EntrySelector&AbstractListSelector}
   * @returns {Promise<void>}
   */
  async _onChangeForm(formConfig, event) {
    const a = event.target;

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

  /* -------------------------------------------- */

  /**
   * Provides update data for saves
   *
   * @override
   * @protected
   * @returns {object}
   */
  _getUpdateData() {
    const updateData = {};

    if (this.isFlag) {
      // Convert editor data for flags
      const newKeys = new Set(); // Needed for deletion detection
      this.entries.forEach(([key, value]) => {
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

    return updateData;
  }
}
