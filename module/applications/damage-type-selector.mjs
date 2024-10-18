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
   * @type {string}
   */
  path;
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
    super(options);
    this.object = object;
    this.path = path;
    this.damage = foundry.utils.deepClone(data) || { values: [] };
  }

  /* -------------------------------------------- */

  get id() {
    return `damage-types-${this.object.id}-${this.path.replaceAll(".", "_")}`;
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
   * Attach event listeners to the rendered application form.
   *
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */
  _onRender(context, options) {
    this.element
      .querySelectorAll(`.damage-type`)
      .forEach((el) => el.addEventListener("click", this._toggleDamageType.bind(this)));
    this.element
      .querySelectorAll(`*[name]`)
      .forEach((el) => el.addEventListener("click", this._onChangeData.bind(this)));
  }

  /* -------------------------------------------- */

  /**
   * @internal
   * @param {Event} event
   */
  _onChangeData(event) {
    event.preventDefault();
    const elem = event.currentTarget;
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
  _toggleDamageType(event) {
    event.preventDefault();
    const a = event.currentTarget;
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
    return this.object.update({ [this.path]: this.damage });
  }
}

/**
 * @typedef {object} DamageTypes
 * @property {string[]} values - Damage type IDs
 * @property {string} custom - Semicolon deliminated list of custom damage type.
 */
