export class DamageTypeSelector extends FormApplication {
  constructor(object, dataPath, options = {}) {
    super(object, options);
    this._dataPath = dataPath;
    this._data = deepClone(getProperty(object.data, this._dataPath));
    if (!this._data) this._data = [];
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      width: 720,
      height: 580,
      template: "systems/pf1/templates/apps/damage-type-selector.hbs",
      closeOnSubmit: true,
    });
  }
  get title() {
    return game.i18n.localize("PF1.DamageType");
  }
  get id() {
    return `action-${this.object.id}_${this._dataPath}`;
  }

  get damageCategorySortOrder() {
    return ["physical", "energy", "misc"];
  }

  async getData(options) {
    const data = await super.getData(options);

    const damageTypes = game.pf1.registry.getDamageTypes();
    data.damageTypes = damageTypes.filter((o) => !o.isModifier).map((o) => o.toObject());

    // Add damage type categories
    data.damageCategories = data.damageTypes.reduce((cur, o) => {
      let categoryObj = cur.find((o2) => o2.key === o.category);
      if (!categoryObj) {
        categoryObj = { key: o.category, label: `PF1.DamageTypeCategory.${o.category}`, data: [] };
        cur.push(categoryObj);
      }
      categoryObj.data.push(o);
      return cur;
    }, []);
    // Sort damage type categories
    {
      const sortOrder = this.damageCategorySortOrder;
      data.damageCategories = data.damageCategories.sort((a, b) => {
        const idxA = sortOrder.indexOf(a.key);
        const idxB = sortOrder.indexOf(b.key);
        if (idxA === -1 && idxB >= 0) return 1;
        if (idxB === -1 && idxA >= 0) return -1;
        if (idxA > idxB) return 1;
        if (idxA < idxB) return -1;
        return 0;
      });
    }

    data.damageModifiers = damageTypes.filter((o) => o.isModifier).map((o) => o.toObject());
    data.data = this._data;

    return data;
  }

  activateListeners(html) {
    html.find(`.damage-type`).on("click", this._toggleDamageType.bind(this));
    html.find(`*[name]`).on("change", this._onChangeData.bind(this));
  }

  _onChangeData(event) {
    event.preventDefault();
    const elem = event.currentTarget;
    const dataPath = elem.name;

    let value = elem.value;
    console.log(elem);
    if (elem.type === "checkbox") value = elem.checked;

    switch (elem.dataset.dtype) {
      case "Boolean":
        value = Boolean(value);
        break;
      case "Number":
        value = Number(value);
        break;
    }

    setProperty(this._data, dataPath, value);
  }

  _toggleDamageType(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const dt = a.dataset.id;

    if (this._data.values.includes(dt)) this._data.values.splice(this._data.values.indexOf(dt), 1);
    else this._data.values.push(dt);
    this.render();
  }

  async _updateObject(event, formData) {
    formData = expandObject(formData);
    const result = this._data;

    return this.object.update({ [this._dataPath]: result });
  }
}
