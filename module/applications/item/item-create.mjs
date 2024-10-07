/**
 * Derivate of Foundry's Item.createDialog() functionality.
 */
export class ItemCreateDialog extends FormApplication {
  /**
   * @param {object} [data] - Initial item data
   * @param {object} [options] - Optional configuration
   * @param {Function} [options.resolve] - Resolve callback
   * @param {*} [options.pack=null] - Pack reference given to Item.create()
   * @param {*} [options.parent=null] - Parent reference given to Item.create()
   * @param {object} [options.options] - FormApplication options
   * @param {Array<string>} options.types - Array of types to limit the choices to.
   */
  constructor(data = {}, { resolve, pack = null, parent = null, types = null, options = {} } = {}) {
    super(data, options);

    this.resolve = resolve;
    this.pack = pack;
    this.parent = parent;
    this.types = types;

    this._updateCreationData(data);
  }

  get title() {
    return game.i18n.format("DOCUMENT.Create", { type: game.i18n.localize("DOCUMENT.Item") });
  }

  get template() {
    return "systems/pf1/templates/widgets/item-create.hbs";
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      closeOnSubmit: false,
      submitOnChange: true,
      submitOnClose: false,
      height: "auto",
      classes: [...options.classes, "pf1", "create-document", "create-item"],
    };
  }

  get initialData() {
    return this.object;
  }

  /** @type {object} */
  createData = {};

  getSubtypes(type) {
    switch (type) {
      case "class":
        return pf1.config.classTypes;
      case "race":
        return null;
      case "attack":
        return pf1.config.attackTypes;
      case "feat":
        return pf1.config.featTypes;
      case "weapon":
        return Object.entries(pf1.config.weaponTypes).reduce((all, [key, value]) => {
          all[key] = value._label;
          return all;
        }, {});
      case "equipment":
        return Object.entries(pf1.config.equipmentTypes).reduce((all, [key, value]) => {
          all[key] = value._label;
          return all;
        }, {});
      case "consumable":
        return pf1.config.consumableTypes;
      case "loot":
        return pf1.config.lootTypes;
      case "spell":
        return null;
      case "buff":
        return pf1.config.buffTypes;
      case "implant":
        return pf1.config.implantTypes;
      case "container":
        return null;
      default:
        return null;
    }
  }

  getData() {
    const lang = game.settings.get("core", "language");

    let collection;
    if (!this.parent) {
      if (this.pack) collection = game.packs.get(this.pack);
      else collection = game.items;
    }

    // TODO: Visualize folder tree better
    const folders = Object.fromEntries(
      (collection?._formatFolderSelectOptions() ?? []).map(({ id, name }) => [id, name])
    );

    const createData = this.createData;

    let subtypes = this.getSubtypes(createData.type);
    if (!subtypes && createData.system?.subType !== undefined) delete createData.system.subType;
    if (subtypes) {
      subtypes = Object.fromEntries(
        Object.entries(subtypes).sort(([key0, label0], [key1, label1]) => label0.localeCompare(label1, lang))
      );
    }

    const types = Object.fromEntries(
      Object.entries(CONFIG.Item.typeLabels).sort(([key0, label0], [key1, label1]) =>
        label0.localeCompare(label1, lang)
      )
    );
    delete types.base; // base is Foundry's unusable default
    if (this.types) {
      for (const type of Object.keys(types)) {
        if (!this.types.includes(type)) delete types[type];
      }
    }

    return {
      folders,
      name: createData.name,
      defaultName: Item.implementation.defaultName(),
      folder: createData.folder,
      hasFolders: Object.keys(folders).length > 0,
      type: createData.type,
      types,
      subtype: createData.system?.subType || null,
      subtypes,
    };
  }

  /**
   * @param {JQuery} jq jQuery HTML instance
   */
  activateListeners(jq) {
    super.activateListeners(jq);

    this.form.querySelector("button.create-document").addEventListener("click", this._createItem.bind(this));
  }

  _updateObject(event, formData) {
    const data = foundry.utils.expandObject(formData);

    this._updateCreationData(data);

    this.render();
  }

  _updateCreationData(data = {}) {
    // Fill in default type if missing
    data.type ||= CONFIG.Item.defaultType || game.documentTypes.Item[1];
    // If type does not match restrictions, assume first type is correct
    if (this.types && !this.types.includes(data.type)) data.type = this.types[0];

    this.createData = foundry.utils.mergeObject(this.initialData, data, { inplace: false });
    this.createData.system ??= {};

    // Clean up data
    if (!data.folder && !this.initialData.folder) delete this.createData.folder;

    const subtypes = this.getSubtypes(this.createData.type);
    if (!subtypes) delete this.createData.system.subType;

    return this.createData;
  }

  /**
   * @param {Event} event
   */
  async _createItem(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    await this.submit({ preventRender: true });

    let createData = this._updateCreationData(this.createData);
    createData.name ||= Item.implementation.defaultName();
    createData = new Item.implementation(createData).toObject();

    const options = {};
    if (this.pack) options.pack = this.pack;
    if (this.parent) options.parent = this.parent;
    options.renderSheet = true;

    const promise = Item.implementation.create(createData, options);

    this.resolve?.(promise);
    this.close();
  }

  close(options = {}) {
    this.resolve?.(null);
    return super.close(options);
  }

  /**
   * Wait for dialog to the resolved.
   *
   * @param {object} [data] Initial data to pass to the constructor.
   * @param {object} [options] Options to pass to the constructor.
   * @returns {Promise<Item|null>} Created item or null.
   */
  static waitPrompt(data, options = {}) {
    return new Promise((resolve) => {
      options.resolve = resolve;
      new this(data, options).render(true, { focus: true });
    });
  }
}
