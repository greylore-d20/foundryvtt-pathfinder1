export class DamageTypeSelector extends FormApplication {
  constructor(object, dataPath, options = {}) {
    super(object, options);
    this._dataPath = dataPath;
    this._data = deepClone(getProperty(object.data, this._dataPath));
    if (!(this._data instanceof Array)) this._data = [];
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      width: 720,
      height: 540,
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

  async getData(options) {
    const data = await super.getData(options);

    const damageTypes = game.pf1.registry.getDamageTypes();
    data.damageTypes = damageTypes.filter((o) => !o.isModifier).map((o) => o.toObject());
    data.damageModifiers = damageTypes.filter((o) => o.isModifier).map((o) => o.toObject());
    data.data = this._data;

    return data;
  }

  activateListeners(html) {
    html.find(`.damage-type`).on("click", this._toggleDamageType.bind(this));
  }

  _toggleDamageType(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const dt = a.dataset.id;

    if (this._data.includes(dt)) this._data.splice(this._data.indexOf(dt), 1);
    else this._data.push(dt);
    this.render();
  }

  async _updateObject(event, formData) {
    formData = expandObject(formData);
    const result = this._data;

    for (const [k, v] of Object.entries(formData.damageTypes ?? {})) {
      if (v) result.push(k);
    }

    return this.object.update({ [this._dataPath]: result });
  }
}
