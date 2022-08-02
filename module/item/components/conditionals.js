import { keepUpdateArray } from "../../lib.js";

export class ItemConditional {
  constructor(data, parent) {
    this.data = data;
    this.parent = parent;

    this.prepareData();
  }

  static async create(data, context = {}) {
    const { parent } = context;

    if (parent instanceof game.pf1.documentComponents.ItemAction) {
      // Prepare data
      data = data.map((dataObj) => mergeObject(this.defaultData, dataObj));
      const newConditionalData = deepClone(parent.data.conditionals || []);
      newConditionalData.push(...data);

      // Update parent
      await parent.update({ conditionals: newConditionalData });

      // Return results
      return data.map((o) => parent.conditionals.get(o._id));
    }

    return [];
  }

  static get defaultData() {
    return {
      _id: randomID(16),
      default: false,
      name: "",
      modifiers: [],
    };
  }

  get id() {
    return this.data._id;
  }

  prepareData() {
    // Update modifiers
    if (this.data.modifiers instanceof Array) {
      this.modifiers = this._prepareModifiers(this.data.modifiers);
    }
  }

  _prepareModifiers(modifiers) {
    const prior = this.modifiers;
    const collection = new Collection();
    for (const o of modifiers) {
      let modifier = null;
      if (prior && prior.has(o._id)) {
        modifier = prior.get(o._id);
        modifier.data = o;
        modifier.prepareData();
      } else modifier = new game.pf1.documentComponents.ItemConditionalModifier(o, this);
      collection.set(o._id || modifier.data._id, modifier);
    }
    return collection;
  }

  async update(updateData, options = {}) {
    const idx = this.parent.data.conditionals.indexOf(this.data);
    const prevData = deepClone(this.data);
    const newUpdateData = flattenObject(mergeObject(prevData, updateData));

    // Make sure modifiers remain in an array
    keepUpdateArray(this.data, newUpdateData, "modifiers");

    if (options.dryRun) return newUpdateData;
    await this.parent.update({ [`conditionals.${idx}`]: expandObject(newUpdateData) });
  }

  async delete() {
    const conditionals = foundry.utils.deepClone(this.parent.data.conditionals);
    conditionals.findSplice((c) => c._id === this.id);
    return this.parent.update({ conditionals });
  }
}

export class ItemConditionalModifier {
  constructor(data, parent) {
    this.data = data;
    this.parent = parent;

    this.prepareData();
  }

  static async create(data, context = {}) {
    const { parent } = context;

    if (parent instanceof game.pf1.documentComponents.ItemConditional) {
      // Prepare data
      data = data.map((dataObj) => mergeObject(this.defaultData, dataObj));
      const newConditionalModifierData = deepClone(parent.data.modifiers || []);
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
      _id: randomID(16),
      formula: "",
      target: "",
      subTarget: "",
      type: "",
      damageType: game.pf1.documentComponents.ItemAction.defaultDamageType,
      critical: "",
    };
  }

  get id() {
    return this.data._id;
  }

  prepareData() {}

  async update(updateData, options = {}) {
    const idx = this.parent.data.modifiers.indexOf(this.data);
    const prevData = deepClone(this.data);
    const newUpdateData = flattenObject(mergeObject(prevData, updateData));

    if (options.dryRun) return newUpdateData;
    await this.parent.update({ [`modifiers.${idx}`]: expandObject(newUpdateData) });
  }

  async delete() {
    const idx = this.parent.data.modifiers.indexOf(this.data);
    if (idx < 0) throw new Error(`Modifier not found in parent ${this.parent.name}`);

    const modifiers = duplicate(this.parent.data.modifiers);
    modifiers.splice(idx, 1);
    return this.parent.update({ modifiers });
  }
}
