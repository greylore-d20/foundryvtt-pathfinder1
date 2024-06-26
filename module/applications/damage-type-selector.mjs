export class DamageTypeSelector extends FormApplication {
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
    super(object, options);
    this.path = path;
    this.damage = foundry.utils.deepClone(data) || { values: [] };
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      width: 720,
      height: 590,
      template: "systems/pf1/templates/apps/damage-type-selector.hbs",
      scrollY: [".damage-type-categories", ".damage-modifiers"],
      closeOnSubmit: true,
    });
  }

  get title() {
    return game.i18n.localize("PF1.DamageType");
  }

  get id() {
    return `damage-types-${this.object.id}-${this.path.replaceAll(".", "_")}`;
  }

  get damageCategorySortOrder() {
    return ["physical", "energy", "misc"];
  }

  async getData() {
    const damageTypes = pf1.registry.damageTypes
      .filter((damageType) => !damageType.isModifier)
      .map((dt) => ({ ...dt, id: dt.id, enabled: this.damage.values.includes(dt.id) }));

    const sortOrder = this.damageCategorySortOrder;

    const context = {
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
    };

    return context;
  }

  /**
   * @override
   * @param {JQuery<HTMLElement>} html
   */
  activateListeners(html) {
    html.find(`.damage-type`).on("click", this._toggleDamageType.bind(this));
    html.find(`*[name]`).on("change", this._onChangeData.bind(this));
  }

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

  /**
   * @override
   * @param {Event} event
   * @param {object} formData
   */
  async _updateObject(event, formData) {
    return this.object.update({ [this.path]: this.damage });
  }
}

/**
 * @typedef {object} DamageTypes
 * @property {string[]} values - Damage type IDs
 * @property {string} custom - Semicolon deliminated list of custom damage type.
 */
