/**
 * The Base Registry class, providing shared functionality for all registries in the system.
 *
 * @abstract
 * @template {BaseRegistryObject} ContentClass
 * @template {BaseRegistryObjectData} ContentData
 * @augments {foundry.utils.Collection<ContentClass>}
 */
export class BaseRegistry extends foundry.utils.Collection {
  /**
   * The class each of this registry's content is expected to be an instance of.
   *
   * @type {typeof ContentClass}
   */
  static contentClass = null;

  /**
   * An array of data used to initialise this registry.
   *
   * @type {ContentData[]} An array of data used to initialise this registry.
   * @private
   */
  static _defaultData = [];

  /**
   * @param {ContentData[]} data - An array of data from which {@link ContentClass} instances will be created
   */
  constructor(data = []) {
    super();
    this._initialize(data);
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
   * The class each of this registry's content is expected to be an instance of.
   *
   * @type {ContentClass}
   */
  get contentClass() {
    return this.constructor.contentClass;
  }

  /**
   * The name of the class this registry is for.
   *
   * @type {string}
   */
  get contentName() {
    return this.contentClass.typeName;
  }

  /**
   * Initializes the registry with the data provided in the constructor.
   *
   * @private
   */
  _initialize() {
    this.clear();
    for (const element of this.constructor._defaultData) {
      let content;
      try {
        content = new this.contentClass(element);
        super.set(content.id, content);
      } catch (error) {
        console.error(error);
      }
    }

    // Allow modules to register their own content
    Hooks.callAll(`pf1.register${this.name}`, this, this.contentClass);
  }

  /**
   * Sets the value of a key in the registry.
   *
   * @param {string} id - ID of the value to set.
   * @param {ContentClass} content - The value to set.
   * @returns {BaseRegistry} The registry itself, after the value has been set.
   */
  set(id, content) {
    const cls = this.contentClass;
    if (!(content instanceof cls)) {
      throw new Error(`Registry '${this.contentName}' can only register ${cls.typeName}`);
    }
    return super.set(id, content);
  }

  /**
   * Registers a new instance of {@link ContentClass} with the registry, using a partial of its data as the base.
   *
   * @param {string} module - The module for which this value is registered.
   * @param {string} id - The unique key of the value.
   * @param {ContentData} value - A {@link Partial} of the data to use as the base for the new value.
   * @returns {BaseRegistry} The registry itself, after the value has been registered.
   */
  register(module, id, value) {
    if (!module) throw new Error("Registering requires a module name");
    if (this.has(id)) {
      throw new Error(`Registry '${this.contentName}' already has a key '${id}'`);
    }
    return this.set(id, new this.contentClass({ module, _id: id, ...value }));
  }

  /**
   * Unregisters a value from the registry, or if no id is provided, all values belonging to the module.
   *
   * @param {string} module - The module for which this value is unregistered.
   * @param {string} [id] - The unique key of the value, or `undefined` to unregister all values belonging to the module.
   */
  unregister(module, id) {
    if (!module) throw new Error("Unregistering requires a module name");
    if (id) {
      if (this.find((e) => e.data.module === module && e.id === id)) {
        this.delete(id);
      }
    } else {
      const ids = this.filter((e) => e.data.module === module).map((e) => e.id);
      for (const id of ids) {
        this.delete(id);
      }
    }
  }

  /**
   * Returns the contents of this registry as object, using ids as keys.
   *
   * @param {string} [key] - Property of {@link ContentClass} (which should resolve to a string)
   * to be used as key. Defaults to `id`.
   * @param {boolean} [dataOnly] - If `true`, only the data of the content will be returned.
   * Defaults to `true`.
   * @returns {Record<string, ContentData>} The data of each value in the registry, by id
   */
  toRecord(key = "id", dataOnly = true) {
    return this.reduce((acc, registryObject) => {
      const keyValue = getProperty(registryObject, key);
      acc[keyValue] = dataOnly ? registryObject.data : registryObject;
      return acc;
    }, {});
  }
}

/**
 * The basic interface other registry objects are based on.
 *
 * @typedef {object} BaseRegistryObjectData
 * @property {string} _id - The unique key of the value.
 * @property {string} name - The name of the value.
 * @property {object} flags - Additional flags for the value.
 * @property {string} [module] - The module for which this value is registered. Automatically assigned when using {@link BaseRegistry#register}.
 */

/**
 * The Base Registry Object class, providing shared functionality for all registry objects in the system.
 *
 * @abstract
 */
export class BaseRegistryObject {
  /**
   * @param {Partial<BaseRegistryObjectData>} src - The data to use to create the registry object
   */
  constructor(src) {
    this.data = foundry.utils.mergeObject(this.constructor._baseData, src);
  }

  static get _baseData() {
    return {
      _id: randomID(16),
      name: `New ${this.constructor.name}`,
      flags: {},
    };
  }

  /**
   * A name describing the type of this kind of registry objects.
   *
   * @type {string}
   */
  static get typeName() {
    throw new Error("A class extending BaseRegistryObject must implement typeName");
  }

  /**
   * The unique key of the registry object.
   *
   * @type {string}
   */
  get id() {
    return this.data._id;
  }

  /**
   * The name of the registry object.
   *
   * @type {string}
   */
  get name() {
    return this.data.name;
  }

  /**
   * Returns a copy of the raw data of the registry object.
   *
   * @returns {object} The raw data of the registry object.
   */
  toJSON() {
    const data = deepClone(this.data);
    if ("module" in data) delete data.module;
    return data;
  }
}
