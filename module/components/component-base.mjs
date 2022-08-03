/* ----------------------------------------- */
/*  Data Model                               */
/* ----------------------------------------- */
// TODO: Order of callbacks: _preCreate, _preCreateDocuments?, _onCreate, Hook, _onCreateDocuments?
// create - createEmbeddedDocuments - _preCreateDocumentArray(drop) - _preCreate - HookPreCreate
// SOCKET
// _preCreateEmbeddedDocuments - collection.set - parent.prepareData - _onCreate(everyone) - Hook.create(everyone) - parent._onCreateEmbeddedDocs

// TODO: Add sorting

// Necessary adjustments in Actors and Items
// TODO: Adjust update and delete to use callbacks -> use options to pass data?
// TODO: Add createEmbeddedComponent?
// TODO: Add component collection initialization to documents' `_initialize`

import DataModel from "@foundry/common/abstract/data.mjs";
import * as fields from "@foundry/common/data/fields.mjs";
import Collection from "@foundry/common/utils/collection.mjs";

import { diffObjectAndArray } from "../utils/lib.mjs";

/**
 * @typedef {object} DocumentComponentPFConstructionContext
 * @property {Document|null} [parent=null]    The parent Document of this one, if this one is embedded
 * @property {boolean} [strict=true]          Whether to validate initial data strictly?
 */

/**
 * @typedef {object} DocumentComponentPFModificationContext
 * @property {DocumentComponentParent} [parent] A parent Document within which these Documents should be embedded
 * @property {boolean} [noHook=false]           Block the dispatch of preCreate hooks for this operation
 * @property {boolean} [keepId=false]           When performing a creation operation, keep the _id of the document being created instead of generating a new one.
 * @property {boolean} [temporary=false]        Create a temporary document which is not saved to the database. Only used during creation.
 * @property {boolean} [render=true]            Automatically re-render existing applications associated with the document.
 * @property {boolean} [diff=true]              Difference each update object against current Document data to reduce the size of the transferred data. Only used during update.
 * @property {boolean} [recursive=true]         Merge objects recursively. If false, inner objects will be replaced explicitly. Use with caution!
 * @property {User} user                        The user performing the operation
 */

/**
 * The `_id` field of a {@link DocumentComponentPF}, used as a unique identifier in its {@link DocumentComponentPFCollection}
 */
export class ComponentIdField extends fields.StringField {
  /** @inheritdoc */
  static get _defaults() {
    return foundry.utils.mergeObject(super._defaults, {
      required: false,
      blank: false,
      nullable: false,
      initial: foundry.utils.randomID,
      readonly: true,
      validationError: "is not a valid PF Item Component ID string",
    });
  }

  /** @inheritdoc */
  _validateType(value) {
    return /^[a-zA-Z\d]{16}$/.test(value);
  }
}

/**
 * @typedef {object} DocumentComponentMemoryData
 * @property {DocumentComponentPF} component - The component that has been changed
 * @property {"create" | "update" | "delete"} action - The action performed on this Document
 * @property {object} [changes] - The changes made to this Document
 * @internal
 */

/**
 * An extension of the {@link Collection} class used to store {@link DocumentComponentPF}s for a {@link DocumentComponentParent}.
 */
export class DocumentComponentPFCollection extends Collection {
  /** @type {DocumentComponentParent} */
  #model;

  /**
   * A {@link Set} of {@link DocumentComponentMemoryData} objects used to track which CRUD related methods have to be called.
   *
   * @type {Set<DocumentComponentMemoryData>}
   */
  _updateMemory = new Set(); // TODO: Make private after testing to prevent external access?

  /**
   * A {@link Set} of IDs of invalid {@link DocumentComponentPF}s in this collection.
   *
   * @type {Set<string>}
   */
  invalidIds = new Set();

  /**
   * A {@link Set} containing IDs shared by multiple {@link DocumentComponentPF}s in this collection.
   * Only the first component will appear in the collection.
   *
   * @type {Set<string>}
   */
  duplicateIds = new Set();

  /**
   * @param {DocumentComponentParent} model - The parent {@link DataModel} to which this collection belongs.
   * @param {object[]} sourceArray - The source data array provided by the parent {@link DataModel}.
   * @param {typeof DocumentComponentPF} documentClass - The class of the components stored in this collection.
   */
  constructor(model, sourceArray, documentClass) {
    super();
    this.#model = model;
    Object.defineProperty(this, "_source", { value: sourceArray });
    /**
     * @type {typeof DocumentComponentPF}
     */
    Object.defineProperty(this, "documentClass", { value: documentClass });
    this.#initialize();
  }

  #initialize() {
    this.clear();
    const componentName = this.documentClass["documentName"];
    const parent = this.#model;
    const parentName = this.#model["documentName"] ?? this.#model["name"];
    for (const d of this._source) {
      if (!d._id) d._id = this._getFreeId();

      if (this.has(d._id)) {
        console.warn(`Duplicate ${componentName} ID ${d._id} in ${parentName} ${parent._id}`);
        this.duplicateIds.add(d._id);
        continue;
      }

      let doc;
      try {
        doc = new this.documentClass(d, { parent, parentName, componentName });
        this.set(doc._id, doc, { modifySource: false });
      } catch (err) {
        err.message = `Failed to initialize item component ${componentName} [${d._id}] in ${parentName} [${parent._id}]: ${err.message}`;
        console.error(err);
        this.invalidIds.add(d._id);
      }
    }
  }

  set(key, value, { modifySource = true } = {}) {
    if (modifySource && !this.has(key)) this._source.push(value._source);
    return super.set(key, value);
  }

  delete(key, { modifySource = true } = {}) {
    if (modifySource && this.has(key)) this._source.findSplice((d) => d._id === key);
    return super.delete(key);
  }

  /**
   * Updates this collection's source data so that it matches the given state.
   * Meant to be called in the parent model's data preparation so that it mirrors the parent's data.
   * Component data not included in the {@link newState} will be removed from the collection.
   *
   * @private
   * @param {object[]} newState - An array of source data objects from which this collection's {@link DocumentComponentPF}s can be created.
   * @param {object} options - Options affecting the {@link DataModel}s source update.
   */
  _update(newState, options = {}) {
    const currentIds = Array.from(this.keys());
    const updated = new Set();

    // Clear update memory to ensure only callbacks for this update are called
    this._updateMemory.clear();

    // Create or update documents within the collection
    for (const data of newState) {
      if (!data._id) data._id = this._getFreeId();
      const current = this.get(data._id);

      // Component already exists, update it
      if (current) {
        // This does not use the actual update data, but generates an effective diff on each client
        const changes = diffObjectAndArray(current._source, data);

        // Remove changes to embedded components to only call callback for changed components, not their parents
        for (const key of Object.keys(changes)) {
          if (this.documentClass.metadata.embedded.includes(key)) {
            delete changes[key];
          }
        }

        if (!foundry.utils.isEmpty(changes)) {
          this._updateMemory.add({ component: current, action: "update", changes });
        }
        current.updateSource(data, options);
      } else {
        // Component does not exist, create it
        const doc = new this.documentClass(data, { parent: this.#model });
        this.set(doc.id, doc);
        this._updateMemory.add({ component: doc, action: "create" });
      }
      updated.add(data._id);
    }

    // If the update was not recursive, remove all non-updated documents
    for (const id of currentIds) {
      if (!updated.has(id)) {
        this._updateMemory.add({ component: this.get(id), action: "delete" });
        this.delete(id);
      }
    }
  }

  // TODO: Transfer options and calling user (from the parent's onUpdate?)
  runActionCallbacks(options, user) {
    for (const { component, action, changes } of this._updateMemory) {
      if (action === "create") {
        component._onCreate(options, user.id);
        /**
         * A hook event that fires for every {@link DocumentComponentPF} creation for each user.
         *
         * @function onCreateDocumentComponentPF
         * @memberof hookEventsPF
         * @param {DocumentComponentPF} component - The component that was created
         * @param {object} options - The options provided for the creation call
         * @param {string} user - The ID of the user that performed the creation
         * @returns {void}
         */
        Hooks.callAll(`pf1.create${this.documentName}`, component, options, user.id);
      } else if (action === "update") {
        component._onUpdate(changes, options, user.id);
        /**
         * A hook event that fires for every {@link DocumentComponentPF} update for each user.
         *
         * @function onUpdateDocumentComponentPF
         * @memberof hookEventsPF
         * @param {DocumentComponentPF} component - The component that was updated
         * @param {object} changes - The changes that were made to the component
         * @param {object} options - The options provided for the update call
         * @param {string} user - The ID of the user that performed the update
         * @returns {void}
         */
        Hooks.callAll(`pf1.update${this.documentName}`, component, changes, options, user.id);
      } else if (action === "delete") {
        component._onDelete(options, user.id);
        /**
         * A hook event that fires for every {@link DocumentComponentPF} deletion for each user.
         *
         * @function onDeleteDocumentComponentPF
         * @memberof hookEventsPF
         * @param {DocumentComponentPF} component - The component that was deleted
         * @param {object} options - The options provided for the deletion call
         * @param {string} user - The ID of the user that performed the deletion
         * @returns {void}
         */
        Hooks.callAll(`pf1.delete${this.documentName}`, component, options, user.id);
      }
    }
    // Reset update memory to ensure each callback runs only once
    this._updateMemory.clear();
  }

  /**
   * Returns an array of plain data objects for this collection's {@link DocumentComponentPF}s.
   *
   * @param {boolean} [source=true] - Whether only source data should be included
   * @returns {object[]} An array of plain data objects
   */
  toObject(source = true) {
    const arr = [];
    for (const doc of this.values()) {
      arr.push(doc.toObject(source));
    }
    return arr;
  }

  /**
   * Generates a new unique ID for a {@link DocumentComponentPF} in this collection,
   * guaranteeing that it is not already in use.
   *
   * @param {number} [length=16] - The length of the ID to generate.
   * @returns {string} A new unique ID.
   * @private
   */
  _getFreeId(length = 16) {
    let id;
    do {
      id = foundry.utils.randomID(length);
    } while (this.has(id));
    return id;
  }
}

export class DocumentComponentPFCollectionField extends fields.ArrayField {
  static _validateElementType(element) {
    if (foundry.utils.isSubclass(element, DocumentComponentPF)) return element;
    throw new Error("DocumentComponentPF type validation failed");
  }

  get model() {
    return this.element.constructor;
  }

  get schema() {
    return this.element.constructor;
  }

  _cleanType(value, options) {
    return value.map((v) => this.schema.clean(v, options));
  }

  /** @override */
  initialize(model, name, value) {
    const current = model[name];

    // Re-initialize an existing collection
    if (current instanceof DocumentComponentPFCollection) {
      for (const entry of current) {
        entry._initialize();
      }
      return current;
    }

    // Create a new collection
    return new DocumentComponentPFCollection(model, value, this.element.constructor);
  }
}

/**
 * A union of all {@link DataModel}s that can be a parent of a {@link DocumentComponentPF}
 *
 * @typedef {import("../documents/actor/actor-pf.mjs").ActorPF | import("../documents/item/item-pf.mjs").ItemPF | DocumentComponentPF} DocumentComponentParent
 */

/**
 * A DocumentComponentPF class, including general methods to allow working with data structures
 * embedded into an Item in lieu of actual embedded documents.
 *
 * @abstract
 * @augments {DataModel}
 * @property {string} _id                          The unique ID of the component
 * @property {object} flags                        Flags for the component
 */
export class DocumentComponentPF extends DataModel {
  /**
   * Default metadata which applies to each instance of this Document type.
   *
   * @type {object}
   */
  static metadata = Object.freeze({
    name: "DocumentComponentPF",
    collection: "documentComponentsPF",
    label: "Document Component",
    embedded: [],
  });

  /**
   * @param {object} data - A partial of the data to initialize the component with
   * @param {DocumentComponentParent} [parent] - The parent this component is attached to
   */
  constructor(data = {}, { parent = null } = {}) {
    super(data, { parent });
    /**
     * The apps associated with this component
     *
     * @type {Object<number, Application>}
     */
    Object.defineProperty(this, "apps", { value: {}, writable: false, enumerable: false });
  }

  /** @inheritdoc */
  static defineSchema() {
    return {
      _id: new ComponentIdField(),
      sort: new fields.IntegerSortField(),
      flags: new fields.ObjectField({ required: true, nullable: false }),
    };
  }

  /**
   * The named collection to which this Document belongs, for example "actions".
   *
   * @type {string}
   */
  static get collectionName() {
    return this.metadata.collection;
  }
  /**
   * The named collection to which this Document belongs, for example "actions".
   *
   * @type {string}
   */
  get collectionName() {
    return this.constructor.collectionName;
  }

  /**
   * The canonical name of this DocumentComponent type, for example "ItemAction".
   *
   * @type {string}
   */
  static get documentName() {
    return this.metadata.name;
  }
  get documentName() {
    return this.constructor.documentName;
  }

  /**
   * The ID of this component.
   *
   * @type {string}
   */
  get id() {
    return this._id;
  }

  /**
   * The UUID of this component, allowing it to be found e.g. by {@link fromUuid} and {@link fromUuidSync}.
   *
   * @type {string|null}
   */
  get uuid() {
    // There should always be a parent, but this might be useful for future world config?
    return this.parent ? `${this.parent.uuid}.${this.documentName}.${this.id}` : null;
  }
  get isEmbedded() {
    return this.parent;
  }

  /**
   * Returns the {@link Item} this component is embedded in, or `null` if it is not embedded in an item.
   *
   * @type {Item|null}
   */
  get item() {
    if (this.parent instanceof Item) return this.parent;
    if (this.parent instanceof DocumentComponentPF) return this.parent.item;
    if (this.parent instanceof Actor) return null;
    return null;
  }

  /**
   * Returns the {@link Actor} this component is embedded in, or `null` if it is neither embedded in an actor,
   * nor in an item or component that is ultimately embedded in an actor.
   *
   * @type {Actor|null}
   */
  get actor() {
    if (this.parent instanceof Actor) return this.parent;
    if (this.parent instanceof Item) return this.parent.parentActor;
    if (this.parent instanceof DocumentComponentPF) return this.parent.actor;
    return null;
  }

  /**
   * Perform preliminary operations before a component of this type is created.
   * Pre-creation operations only occur for the client which requested the operation.
   *
   * @param {object} data - The initial data object with which the component is to be created
   * @param {options} options - Options affecting the creation
   * @param {User} user - The user who is creating the component
   * @returns {Promise<void>}
   * @protected
   */
  async _preCreate(data, options, user) {}

  /**
   * Perform follow-up operations after a component of this type is created.
   *
   * @param {object} data - The initial data object with which the component was created
   * @param {object} options - Options affecting the creation
   * @param {User} user - The user who created the component
   * @protected
   */
  _onCreate(data, options, user) {}

  /**
   * Perform follow-up operations after a set of components of this type are created.
   * This is where side effects of creation should be implemented.
   * Post-creation side effects are performed only for the client which requested the operation.
   *
   * @param {Array<this>} components - The components which were created
   * @param {DocumentComponentPFModificationContext} context - The context in which the components were created
   * @returns {Promise<void>}
   * @protected
   */
  static async _onCreateDocuments(components, context) {}

  // TODO: Add examples when components are implemented
  /**
   * Create multiple components of this type using provided input data.
   * Data is provided as an array of object where each individual object becomes one new component.
   *
   * @public
   * @param {object[]} data - An array of data objects used to create multiple components
   * @param {DocumentComponentPFModificationContext} [context={}] - Additional context affecting the creation
   * @returns {Promise<this[]>} An array of created component instances
   */
  static async createDocuments(data = [], context = {}) {
    const { parent, ...options } = context;
    // Options to be passed to the parent's update method; set render default and then
    // override some options that should not be passed to the update call to prevent possibly destructive side effects
    const updateOptions = { render: true, ...options, diff: false, recursive: true, noHook: true };
    const user = user || game.user;

    // TODO: Check whether this component type can be embedded in the parent model
    //   Example for ScriptCall: no in Actor, yes in Item

    const collection = parent[this.collectionName];

    const componentsUpdateData = collection.toObject();

    const newComponentsData = [];
    for (const componentData of data) {
      /** @type {DocumentComponentPF} */
      let component;

      if (options.keepId) {
        // Keeping non-existent ID is not an option
        if (!componentData._id) {
          console.error(`Missing _id for component ${this.documentName}: ${componentData}`);
          continue;
        }
        // Keeping duplicate ID is not an option
        if (collection.has(componentData._id)) {
          console.error(`Duplicate ID ${componentData._id}`);
          continue;
        }
      } else {
        // Ensure component gets a unique ID, accepting that provided ones are discarded
        componentData._id = collection._getFreeId();
      }

      try {
        component = new this(componentData, { parent, ...options });
      } catch (err) {
        // TODO: Determine error handling
        console.error(`Error creating component ${this.documentName} [${componentData}]: ${err}`);
        continue;
      }

      // Pre-create hook and function only run on the requesting client, so this can be done here
      await component._preCreate(data, options, user);
      /**
       * A hook event that fires before a {@link DocumentComponentPF} creation for the creating user.
       *
       * @function preCreateDocumentComponentPF
       * @memberof hookEventsPF
       * @param {DocumentComponentPF} component
       * @param {object} data
       * @param {DocumentComponentPFConstructionContext} context
       * @returns {boolean|void} Explicitly return false to prevent the creation of this component
       */
      const allowed =
        options.noHook || Hooks.call(`pf1.preCreate${this.documentName}`, component, componentData, options, user.id);
      if (allowed === false) {
        console.debug(`PF1 | ${this.documentName} creation prevented by preCreate hook`);
        continue;
      }

      // Use component's source data to mirror Foundry's behavior of using the document's data
      // instead of the plain data object for creation workflows.
      newComponentsData.push(component.toObject());
    }

    if (newComponentsData.length === 0) return [];
    componentsUpdateData.push(...newComponentsData);

    // Return component instances without calling update or prepareData
    if (options.temporary) return newComponentsData.map((data) => new this(data, { parent, ...options }));

    await parent.update({ [`system.${this.collectionName}`]: componentsUpdateData }, { ...updateOptions });

    /** @type {DocumentComponentPF[]} */
    const createdComponents = data.map((componentData) => collection.get(componentData._id));

    await this._onCreateDocuments(createdComponents, context);

    return createdComponents;
  }

  /**
   * Create a new component using provided input data.
   *
   * @see {@link DocumentComponentPF.createDocuments}
   * @public
   * @param {object} data - The data object used to create the component
   * @param {DocumentComponentPFConstructionContext} [context={}] - Additional context affecting the creation
   * @returns {Promise<DocumentComponentPF>} The created component instance
   */
  static async create(data, context = {}) {
    const createData = data instanceof Array ? data : [data];
    const created = await this.createDocuments(createData, context);
    return data instanceof Array ? created : created.shift();
  }

  /**
   * Perform preliminary operations before a component of this type is updated.
   * Pre-update operations only occur for the client which requested the operation.
   *
   * @protected
   * @param {object} data - The data object with which the component is to be updated
   * @param {object} options - Options affecting the update
   * @returns {Promise<void>}
   */
  async _preUpdate(data, options) {}

  /**
   * Perform follow-up operations after a component of this type is updated.
   * This is called on every client.
   *
   * @param {object} data - The data object with which the component was updated
   * @param {object} options - Options affecting the update
   * @param {string} user - The ID of the user who requested the update
   * @protected
   */
  _onUpdate(data, options, user) {
    for (const app of Object.values(this.apps)) {
      app.render();
    }
  }

  /**
   * Perform follow-up operations after a component of this type is updated.
   * This is where side effects of update should be implemented.
   * Post-update side effects are performed only for the client which requested the operation.
   *
   * @param {DocumentComponentPF[]} components - The components which were updated
   * @param {object[]} changes - The changes which were made to the components
   * @param {DocumentComponentPFModificationContext} context - The context in which the components were updated
   * @returns {Promise<void>}
   * @protected
   */
  static async _onUpdateDocuments(components, changes, context) {}

  /**
   * Update multiple components of this type using provided input data.
   * Data is provided as an array of object where each individual object relates to component through an `_id` property.
   *
   * @param {Array<{_id: string} & Record<string, unknown>>} data - The data objects used to update multiple components
   * @param {DocumentComponentPFModificationContext} context - Additional context affecting the update
   * @returns {Promise<DocumentComponentPF[]>} An array of updated component instances
   */
  static async updateDocuments(data = [], context = {}) {
    const { parent, ...options } = context;
    // Options to be passed to the parent's update method; set render default and then
    // override some options that should not be passed to the update call to prevent possibly destructive side effects
    const updateOptions = { render: true, ...options, diff: false, recursive: true, noHook: true };
    const user = user || game.user;

    const collection = parent[this.collectionName];
    const componentDataUpdates = collection.toObject();

    const componentChanges = [];
    for (const componentData of data) {
      if (!componentData._id) {
        throw new Error("Cannot update a component without an _id");
      }

      let changes;
      if (componentData instanceof DataModel) changes = componentData.toObject();
      else changes = foundry.utils.expandObject(componentData);
      changes = this.migrateData(changes);

      /** @type {DocumentComponentPF} */
      let component;
      try {
        component = collection.get(componentData._id, { strict: true });
      } catch (err) {
        // TODO: Determine error handling
        if (collection.invalidDocumentIds?.has(componentData._id)) component = collection.getInvalid(componentData._id);
      }

      try {
        component.validate({ changes, clean: true, strict: true, fallback: false });
      } catch (err) {
        // TODO: Determine error handling
        continue;
      }

      // TODO: Diff handling
      // Retain only the differences against the current source
      if (options.diff) {
        changes = foundry.utils.diffObject(component._source, changes, { deletionKeys: true });
        if (foundry.utils.isEmpty(changes)) continue;
        changes._id = component.id;
      }

      await component._preUpdate(changes, options);
      /**
       * A hook event that fires for every DocumentComponentPF update.
       *
       * @function preUpdateDocumentComponentPF
       * @memberof hookEventsPF
       * @param {DocumentComponentPF} component
       * @param {object} changes
       * @param {DocumentComponentPFModificationContext} context
       * @returns {boolean|void} Explicitly return false to prevent the update of this component
       */
      const allowed =
        options.noHook || Hooks.call(`pf1.preUpdate${this.documentName}`, component, changes, options, user.id);
      if (allowed === false) {
        console.debug(`PF1 | ${this.documentName} update prevented by preUpdate hook`);
        continue;
      }

      componentDataUpdates.findSplice(
        (componentData) => componentData._id === component.id,
        foundry.utils.mergeObject(component.toObject(), changes, { recursive: options.recursive })
      );
      componentChanges.push(changes);
    }

    // Update with specific options to mimic embedded document handling
    await parent.update({ [`system.${this.collectionName}`]: componentDataUpdates }, updateOptions);

    const updatedComponents = data.map((componentData) => collection.get(componentData._id));

    await this._onUpdateDocuments(updatedComponents, componentChanges, context);

    return updatedComponents;
  }

  /**
   * Update this component using provided input data.
   *
   * @param {object} data - The data object used to update the component
   * @param {DocumentComponentPFModificationContext} [context={}] - Additional context affecting the update
   * @returns {Promise<DocumentComponentPF>} The updated component instance
   */
  async update(data = {}, context = {}) {
    data._id = this.id;
    context.parent = this.parent;
    const updates = await this.constructor.updateDocuments([data], context);
    return updates.shift();
  }

  /**
   * Perform preliminary operations before a component of this type is deleted.
   * Pre-delete operations only occur for the client which requested the operation.
   *
   * @protected
   * @param {object} options - Options affecting the deletion
   * @returns {Promise<void>}
   */
  async _preDelete(options = {}) {}

  /**
   * Perform follow-up operations after a component of this type is deleted.
   * This is called on every client.
   *
   * @protected
   * @param {object} options - Options affecting the deletion
   * @param {string} user - The ID of the user who requested the deletion
   */
  _onDelete(options = {}, user) {}

  /**
   * Perform follow-up operations after a component of this type is deleted.
   * This is where side effects of deletion should be implemented.
   * Post-delete side effects are performed only for the client which requested the operation.
   *
   * @param {DocumentComponentPF[]} components - The components which were deleted
   * @param {DocumentComponentPFModificationContext} context - The context in which the components were deleted
   * @returns {Promise<void>}
   * @protected
   */
  static async _onDeleteDocuments(components, context) {}

  /**
   * Delete multiple components of this type by providing their IDs.
   *
   * @param {string[]} ids - The IDs of the components to delete
   * @param {DocumentComponentPFModificationContext} context - Additional context affecting the deletion
   * @returns {Promise<string[]>} An array of IDs of deleted components
   */
  static async deleteDocuments(ids = [], context = {}) {
    const { parent, ...options } = context;

    const collection = parent[this.collectionName];
    const parentComponentData = collection.toObject();

    /** @type {DocumentComponentPF[]} */
    const deletedComponents = [];

    for (const componentId of ids) {
      const component = collection.get(componentId);
      await component._preDelete(options);
      const allowed = options.noHook || Hooks.call(`pf1.preDelete${this.documentName}`, component, options);
      if (allowed === false) {
        console.debug(`PF1 | ${this.documentName} deletion prevented by preDelete hook`);
        continue;
      }
      deletedComponents.push(component);
      parentComponentData.findSplice((componentData) => componentData._id === component.id);
    }

    await parent.update({ [`system.${this.collectionName}`]: parentComponentData }, { ...options, noHook: true });

    await this._onDeleteDocuments(deletedComponents, context);

    return ids.filter((componentId) => !parent[this.collectionName].has(componentId));
  }

  /**
   * Delete this component.
   *
   * @param {DocumentComponentPFModificationContext} context - Additional context affecting the deletion
   * @returns {Promise<string>} The ID of the deleted component
   */
  async delete(context = {}) {
    context.parent = this.parent;
    /** @type {string[]} */
    const deleted = await this.constructor.deleteDocuments([this.id], context);
    return deleted.shift();
  }

  /**
   * Set the value of a flag on this component.
   *
   * @param {string} scope - The scope of the flag, identifying which package the flag belongs to
   * @param {string} key - The key of the flag
   * @param {*} value - The value of the flag
   * @returns {Promise<void>}
   */
  async setFlag(scope, key, value) {
    const scopes = ["world", "core", game.system.id, ...game.modules.keys()];
    if (!scopes.includes(scope)) throw new Error(`Invalid scope [${scope}] for flag ${key}`);
    key = `flags.${scope}.${key}`;
    return this.update({ [key]: value });
  }

  /**
   * Get the value of a flag on this component.
   *
   * @param {string} scope - The scope of the flag, identifying which package the flag belongs to
   * @param {string} key - The key of the flag
   * @returns {*} The value of the flag
   */
  getFlag(scope, key) {
    const scopes = ["world", "core", game.system.id, ...game.modules.keys()];
    if (!scopes.includes(scope)) throw new Error(`Invalid scope [${scope}] for flag ${key}`);
    key = `flags.${scope}.${key}`;
    return foundry.utils.getProperty(this.data, key);
  }

  /**
   * Delete a flag on this component.
   *
   * @param {string} scope - The scope of the flag, identifying which package the flag belongs to
   * @param {string} key - The key of the flag
   * @returns {Promise<void>}
   */
  async unsetFlag(scope, key) {
    const scopes = ["world", "core", game.system.id, ...game.modules.keys()];
    if (!scopes.includes(scope)) throw new Error(`Invalid scope [${scope}] for flag ${key}`);
    const head = key.split(".");
    const tail = `-=${head.pop()}`;
    key = ["flags", scope, ...head, tail].join(".");
    return this.update({ [key]: null });
  }

  /**
   * Prepare the data for this component.
   * Begin by resetting the prepared data back to its source state.
   * Next prepare any embedded components and compute any derived data elements.
   */
  prepareData() {
    this.prepareBaseData();
    this.prepareEmbeddedComponents();
    this.prepareDerivedData();
  }

  /**
   * Prepare data related to this component itself, before any embedded components are prepared.
   */
  prepareBaseData() {}

  /**
   * Prepare all embedded component instances which exist within this component.
   */
  prepareEmbeddedComponents() {
    const embeddedTypes = this.constructor.metadata.embedded;
    for (const collectionName of Object.values(embeddedTypes)) {
      for (const component of this[collectionName]) {
        component.prepareData();
      }
    }
  }

  /**
   * Apply transformations or derivations to the values of the source data object.
   * Compute data fields whose values are not stored to the database.
   */
  prepareDerivedData() {}
}
