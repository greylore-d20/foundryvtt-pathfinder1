const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DamageTypeSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: DamageTypeSelector._updateObject,
      closeOnSubmit: true,
    },
    classes: ["pf1-v2", "damage-type-selector"],
    window: {
      title: "PF1.DamageType",
      minimizable: true,
      resizable: false,
    },
    position: {
      width: 720,
    },
    actions: {
      toggleDamageType: DamageTypeSelector._toggleDamageType,
    },
    sheetConfig: false,
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/damage-type-selector.hbs",
      scrollable: [".damage-type-categories", ".damage-modifiers"],
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  /**
   * @internal
   * @type {DamageTypes}
   */
  damage;

  /**
   * @param {object} object - Parent object
   * @param {string} path - Path to damage data in object
   * @param {DamageTypes} data - Damage data
   * @param {object} options - Application options
   */
  constructor(object, path, data, options = {}) {
    options.object = object;
    options.path = path;
    super(options);
    this.damage = foundry.utils.deepClone(data) || { values: [] };
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
    options.id = `DamageTypeSelector-${options.object.id}-${options.path.replaceAll(".", "_")}`;
    return options;
  }

  /* -------------------------------------------- */

  get damageCategorySortOrder() {
    return ["physical", "energy", "misc"];
  }

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    const damageTypes = pf1.registry.damageTypes
      .filter((damageType) => !damageType.isModifier)
      .map((dt) => ({ ...dt, id: dt.id, enabled: this.damage.values.includes(dt.id) }));

    const sortOrder = this.damageCategorySortOrder;

    return {
      damage: this.damage,
      damageTypes,
      damageModifiers: pf1.registry.damageTypes
        .filter((o) => o.isModifier)
        .map((dm) => ({ ...dm, id: dm.id, enabled: this.damage.values.includes(dm.id) })),
      // Damage type categories
      damageCategories: damageTypes
        .reduce((cur, o) => {
          let categoryObj = cur.find((o2) => o2.key === o.category);
          if (!categoryObj) {
            categoryObj = { key: o.category, label: `PF1.DamageTypeCategory.${o.category}`, types: [] };
            cur.push(categoryObj);
          }
          categoryObj.types.push(o);
          return cur;
        }, [])
        .sort((a, b) => {
          const idxA = sortOrder.indexOf(a.key);
          const idxB = sortOrder.indexOf(b.key);
          if (idxA === -1 && idxB >= 0) return 1;
          if (idxB === -1 && idxA >= 0) return -1;
          if (idxA > idxB) return 1;
          if (idxA < idxB) return -1;
          return 0;
        }),
      buttons: [{ type: "submit", label: "PF1.Save", icon: "far fa-save" }],
    };
  }

  /* -------------------------------------------- */

  /**
   * Update internal data snapshot on form change
   *
   * @param formConfig
   * @param event
   * @override
   * @internal
   * @this {DamageTypeSelector&AbstractListSelector}
   * @returns {Promise<void>}
   */
  async _onChangeForm(formConfig, event) {
    event.preventDefault();
    const elem = event.target;
    const dataPath = elem.name;

    let value = elem.value;
    if (elem.type === "checkbox") value = elem.checked;

    switch (elem.dataset.dtype) {
      case "Boolean":
        value = Boolean(value);
        break;
      case "Number":
        value = Number(value);
        break;
    }

    foundry.utils.setProperty(this.damage, dataPath, value);
  }

  /* -------------------------------------------- */

  /**
   * @internal
   * @param {Event} event
   */
  static _toggleDamageType(event) {
    event.preventDefault();
    const a = event.target.closest("[data-action]");
    const dt = a.dataset.id;

    if (this.damage.values.includes(dt)) this.damage.values.splice(this.damage.values.indexOf(dt), 1);
    else this.damage.values.push(dt);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * @override
   * @param {Event} event
   * @param {object} formData
   */
  static async _updateObject(event, formData) {
    return this.options.object.update({ [this.options.path]: this.damage });
  }
}

/**
 * @typedef {object} DamageTypes
 * @property {string[]} values - Damage type IDs
 * @property {string} custom - Semicolon deliminated list of custom damage type.
 */
