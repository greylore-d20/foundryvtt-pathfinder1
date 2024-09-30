const fields = foundry.data.fields;

/**
 * The Base Registry class, providing shared functionality for all registries in the system.
 *
 * @abstract
 * @group Base Classes
 * @template {RegistryEntry} Model
 * @augments {foundry.utils.Collection<Model>}
 */
export class Registry extends foundry.utils.Collection {
  /**
   * The class each of this registry's content is expected to be an instance of.
   *
   * @type {typeof Model}
   */
  static model = null;

  /**
   * An array of data used to initialise this registry.
   *
   * @type {object[]} An array of data used to initialise this registry.
   * @private
   */
  static _defaultData = [];

  /**
   * The class each of this registry's content is expected to be an instance of.
   *
   * @see {@link Registry.model}
   * @type {Model}
   */
  model = null;

  constructor() {
    super();
    Object.defineProperty(this, "model", { value: this.constructor.model, writable: false, enumerable: false });
    this._initialize();
  }

  /**
   * The name of the registry
   *
   * @type {string}
   */
  get name() {
    return this.constructor.name;
  }

  /**
   * Initializes the registry with its default data.
   *
   * @remarks This method is called automatically when the registry is instantiated.
   *  It should be self-reliant and not require any other setup.
   * @private
   */
  _initialize() {
    this.clear();
    for (const element of this.constructor._defaultData) {
      try {
        const content = new this.model({ ...element, namespace: "pf1" });
        super.set(content.id, content);
      } catch (error) {
        console.error(error);
      }
    }

    // Allow modules to register their own content
    Hooks.callAll(`pf1Register${this.name}`, this);
  }

  /**
   * Prepares the data of all entries in the registry.
   */
  setup() {
    for (const element of this) {
      element.prepareData();
    }
  }

  /**
   * Sets the value of a key in the registry.
   *
   * @param {string} id - ID of the value to set.
   * @param {Model} content - The value to set.
   * @returns {Registry} The registry itself, after the value has been set.
   */
  set(id, content) {
    const cls = this.model;
    if (!(content instanceof cls)) {
      throw new Error(`Registry '${this.name}' can only register ${cls.name}`);
    }
    return super.set(id, content);
  }

  /**
   * Registers a new instance of {@link Model} with the registry, using a partial of its data as the base.
   *
   * @example
   * ```js
   * pf1.registry.damageTypes.register("my-module", "my-damage-type", {
   *   name: "My Damage Type",
   *   img: "icons/svg/damage.svg",
   *   category: "physical",
   * });
   * ```
   * @param {string} namespace - The namespace for which this value is registered.
   * @param {string} id - The unique key of the value.
   * @param {object} value - A {@link Partial} of the data to use as the base for the new value.
   * @returns {Registry} The registry itself, after the value has been registered.
   */
  register(namespace, id, value) {
    if (!namespace || !id) throw new Error("Registering requires both a namespace and an ID");
    if (this.has(id)) {
      throw new Error(`Registry '${this.name}' already has a key '${id}'`);
    }
    return this.set(id, new this.model({ ...value, namespace, _id: id }));
  }

  /**
   * Unregisters a value from the registry, or if no id is provided, all values belonging to the namespace.
   *
   * @param {string} namespace - The namespace for which this value is unregistered.
   * @param {string} [id] - The unique key of the value, or `undefined` to unregister all values belonging to the namespace.
   */
  unregister(namespace, id) {
    if (!namespace) throw new Error("Unregistering requires a namespace");
    if (id) {
      const entry = this.get(id);
      if (entry && entry.namespace === namespace) this.delete(id);
      else throw new Error(`Registry '${this.name}' has no key '${id}'`);
    } else {
      for (const entry of this) {
        if (entry.namespace === namespace) this.delete(entry.id);
      }
    }
  }

  /**
   * Returns the contents of this registry as object, using ids as keys.
   *
   * @param {boolean} [source=false] - Whether to include the source data instead of its prepared data for each value.
   * @returns {{ [id: string]: object }} The data of each value in the registry, by id
   */
  toObject(source = false) {
    return Object.fromEntries(this.map((registryObject) => [registryObject.id, registryObject.toObject(source)]));
  }

  /**
   * Returns an object of the registry's contents, with the id as key and the name as value.
   *
   * @returns {{ [id: string]: string }} The names of each value in the registry, by id
   */
  getLabels() {
    return Object.fromEntries(this.map((registryObject) => [registryObject.id, registryObject.name]));
  }
}

/**
 * The Base Registry Object class, providing shared functionality for all registry objects in the system.
 * For the required data, see {@link defineSchema}.
 *
 * @abstract
 * @group Base Classes
 */
export class RegistryEntry extends foundry.abstract.DataModel {
  /** @override */
  static defineSchema() {
    return {
      _id: new fields.StringField({ required: true, blank: false, readonly: true }),
      name: new fields.StringField({ required: false, initial: "", localize: true }),
      flags: new fields.ObjectField({ required: false, initial: {} }),
      namespace: new fields.StringField({ required: true, blank: false }),
    };
  }

  /**
   * The unique key of the value.
   *
   * @type {string}
   * @readonly
   */
  get id() {
    return this._id;
  }

  /**
   * Prepares the data of the registry entry.
   */
  prepareData() {
    this.reset();

    // Localize fields marked for localization
    for (const [name, field] of Object.entries(this.constructor.schema.fields)) {
      if (field instanceof fields.StringField && field.options.localize === true)
        this[name] = game.i18n.localize(this[name]);
    }
  }
}
