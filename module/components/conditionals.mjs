import { keepUpdateArray } from "@utils";

/**
 * Conditional modifier bundle.
 */
export class ItemConditional {
  constructor(data, parent) {
    this.data = data;
    this.parent = parent;

    this.prepareData();
  }

  /**
   * Create new conditional
   *
   * @param {object|object[]} data - Data to create conditional(s) from.
   * @param {object} context - Context data
   * @param {ItemAction} context.parent Parent action to add the conditional to.
   * @returns {ItemConditional[]} - Created conditionals
   */
  static async create(data, context = {}) {
    const { parent } = context;

    if (!Array.isArray(data)) data = [data];

    if (parent instanceof pf1.components.ItemAction) {
      // Prepare data
      data = data.map((dataObj) => foundry.utils.mergeObject(this.defaultData, dataObj));
      const conditionals = parent.toObject().conditionals || [];
      conditionals.push(...data);

      // Update parent
      await parent.update({ conditionals });

      // Return results
      return data.map((o) => parent.conditionals.get(o._id));
    }

    return [];
  }

  static get defaultData() {
    return {
      _id: foundry.utils.randomID(16),
      default: false,
      name: "",
      modifiers: [],
    };
  }

  /** @type {string} */
  get id() {
    return this.data._id;
  }

  /** @type {string} */
  get name() {
    return this.data.name;
  }

  /**
   * @internal
   */
  prepareData() {
    // Update modifiers
    if (this.data.modifiers instanceof Array) {
      this.modifiers = this._prepareModifiers(this.data.modifiers);
    }
  }

  /**
   * @internal
   * @param modifiers
   * @returns {Collection<string,ItemConditionalModifier>}
   */
  _prepareModifiers(modifiers) {
    const prior = this.modifiers;
    const collection = new Collection();
    for (const o of modifiers) {
      let modifier = null;
      if (prior && prior.has(o._id)) {
        modifier = prior.get(o._id);
        modifier.data = o;
        modifier.prepareData();
      } else modifier = new pf1.components.ItemConditionalModifier(o, this);
      collection.set(o._id || modifier.data._id, modifier);
    }
    return collection;
  }

  /**
   * Update conditional
   *
   * @param {object} updateData
   * @param {object} options
   */
  async update(updateData, options = {}) {
    const conditionals = this.parent.toObject().conditionals || [];
    const old = conditionals.find((c) => c._id === this.id);
    const newUpdateData = foundry.utils.mergeObject(old, updateData);

    // Make sure modifiers remain in an array
    keepUpdateArray(this.data, newUpdateData, "modifiers");

    if (options.dryRun) return newUpdateData;
    await this.parent.update({ [`conditionals.${old}`]: newUpdateData });
  }

  async delete() {
    const conditionals = this.parent.toObject().conditionals || [];
    conditionals.findSplice((c) => c._id === this.id);
    return this.parent.update({ conditionals });
  }
}

/**
 * Individual modifier in a conditional bundle.
 */
export class ItemConditionalModifier {
  /**
   * @param {object} data
   * @param {ItemConditional} parent
   */
  constructor(data, parent) {
    this.data = data;
    this.parent = parent;

    this.prepareData();
  }

  /**
   * Create conditional modifier
   *
   * @param {object} data - Creation data
   * @param {object} context
   * @param {ItemConditional} context.parent - Parent conditional
   * @returns
   */
  static async create(data, context = {}) {
    const { parent } = context;

    if (!Array.isArray(data)) data = [data];

    if (parent instanceof pf1.components.ItemConditional) {
      // Prepare data
      data = data.map((dataObj) => foundry.utils.mergeObject(this.defaultData, dataObj));
      const newConditionalModifierData = foundry.utils.deepClone(parent.data.modifiers || []);
      newConditionalModifierData.push(...data);

      // Update parent
      await parent.update({ modifiers: newConditionalModifierData });

      // Return results
      return data.map((o) => parent.modifiers.get(o._id));
    }

    return [];
  }

  static get defaultData() {
    return {
      _id: foundry.utils.randomID(16),
      formula: "",
      target: "",
      subTarget: "",
      type: "",
      damageType: [],
      critical: "",
    };
  }

  /** @type {string} */
  get id() {
    return this.data._id;
  }

  /**
   * @internal
   */
  prepareData() {}

  /**
   * Update modifier
   *
   * @param {object} updateData
   * @param {object} [options]
   * @returns - Updated action
   */
  async update(updateData, options = {}) {
    const idx = this.parent.data.modifiers.indexOf(this.data);
    const prevData = foundry.utils.deepClone(this.data);
    const newUpdateData = foundry.utils.flattenObject(foundry.utils.mergeObject(prevData, updateData));

    if (options.dryRun) return newUpdateData;
    await this.parent.update({ [`modifiers.${idx}`]: foundry.utils.expandObject(newUpdateData) });
  }

  /**
   * Delete this individual modifier.
   *
   * @returns - Updated action
   */
  async delete() {
    const idx = this.parent.data.modifiers.indexOf(this.data);
    if (idx < 0) throw new Error(`Modifier not found in parent ${this.parent.name}`);

    const modifiers = foundry.utils.duplicate(this.parent.data.modifiers);
    modifiers.splice(idx, 1);
    return this.parent.update({ modifiers });
  }
}
