import { CompactingMixin } from "@models/abstract/compacting-mixin.mjs";
import { PreparedModel } from "@models/abstract/prepared-model.mjs";
import { IDField } from "@datafields/id-field.mjs";

/**
 * Conditional modifier bundle.
 */
export class ItemConditional extends CompactingMixin(PreparedModel) {
  constructor(data, options) {
    if (options instanceof pf1.components.ItemAction) {
      foundry.utils.logCompatibilityWarning(
        "ItemConditional constructor's second parameter as parent is deprecated. Please wrap it in options object like with datamodels.",
        {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        }
      );
      options = { parent: options };
    }
    super(data, options);
  }

  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      _id: new IDField(),
      name: new fields.StringField(),
      default: new fields.BooleanField({ initial: false }),
      modifiers: new fields.ArrayField(new fields.ObjectField()), // TODO
    };
  }

  _configure(options) {
    super._configure(options);

    // Following prevent these definitions being lost on model reset()
    Object.defineProperties(this, {
      // Modifiers collection cache to avoid conflicts with stored array
      _modifiers: {
        value: new Collection(),
        writable: false,
        enumerable: false,
      },
    });
  }

  /**
   * @internal
   */
  prepareData() {
    this._prepareModifiers();
  }

  /**
   * @internal
   */
  _prepareModifiers() {
    const collection = this._modifiers;
    const prior = new Collection(collection.entries());
    collection.clear(); // TODO: Remove specific entries after the loop instead of full clear here

    for (const modData of this.modifiers) {
      let modifier = null;
      if (prior && prior.has(modData._id)) {
        modifier = prior.get(modData._id);
        modifier.updateSource(modData, { recursive: false });
      } else {
        modifier = new pf1.components.ItemConditionalModifier(modData, { parent: this });
      }

      collection.set(modifier.id, modifier);
    }

    this.modifiers = collection;
  }

  /**
   * Create new conditional
   *
   * @param {object|object[]} data - Data to create conditional(s) from.
   * @param {object} context - Context data
   * @param {ItemAction} context.parent Parent action to add the conditional to.
   * @throws {Error} - If no valid parent is defined.
   * @returns {ItemConditional[]} - Created conditionals
   */
  static async create(data, context = {}) {
    const { parent } = context;

    if (!(parent instanceof pf1.components.ItemAction))
      throw new Error("Can not create conditionals without parent ItemAction");

    if (!Array.isArray(data)) data = [data];

    // Prepare data
    data = data.map((dataObj) => new this(dataObj).toObject());
    const conditionals = parent.toObject().conditionals || [];
    conditionals.push(...data);

    // Update parent
    await parent.update({ conditionals });

    // Return results
    return data.map((o) => parent.conditionals.get(o._id));
  }

  static get defaultData() {
    foundry.utils.logCompatibilityWarning("ItemConditional.defaultData has been deprecated with no replacement.", {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    });

    return new this().toObject(true, false);
  }

  /** @type {string} */
  get id() {
    return this._id;
  }

  /**
   * Update conditional
   *
   * @param {object} updateData
   * @param {object} options
   */
  async update(updateData, options = {}) {
    if (options.dryRun) return this.updateSource(updateData, { dryRun: true });

    this.updateSource(updateData);

    const conditionals = this.parent.conditionals.map((t) => t.toObject());

    await this.parent.update({ conditionals });
  }

  /**
   * Delete conditional
   */
  async delete() {
    const conditionals = this.parent.conditionals.map((t) => t.toObject());
    conditionals.findSplice((c) => c._id === this.id);
    return this.parent.update({ conditionals });
  }

  /**
   * @internal
   * @param {object} data
   */
  static pruneData(data) {
    if (!data.default) delete data.default;
    if (!(data.modifiers?.length > 0)) delete data.modifiers;
    else {
      for (const m of data.modifiers) {
        ItemConditionalModifier.pruneData(m);
      }
    }
  }
}

/**
 * Individual modifier in a conditional bundle.
 */
export class ItemConditionalModifier extends CompactingMixin(foundry.abstract.DataModel) {
  /**
   * @param {object} data
   * @param {object} options
   */
  constructor(data, options) {
    if (options instanceof pf1.components.ItemAction) {
      foundry.utils.logCompatibilityWarning(
        "ItemConditionalModifier constructor's second parameter as parent is deprecated. Please wrap it in options object like with datamodels.",
        {
          since: "PF1 vNEXT",
          until: "PF1 vNEXT+1",
        }
      );
      options = { parent: options };
    }
    super(data, options);
  }

  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      _id: new IDField(),
      formula: new fields.StringField(),
      target: new fields.StringField(), // modifier on what?
      subTarget: new fields.StringField(), // which attack is this targeting?
      type: new fields.StringField({ initial: "untyped" }), // Bonus type
      damageType: new fields.ObjectField(), // { values: [], custom: "" },
      critical: new fields.StringField({ initial: "normal" }), // Does this target normal or critical confirm? or which kind of damage is this in relation to crits?
    };
  }

  static get defaultData() {
    foundry.utils.logCompatibilityWarning(
      "ItemConditionalModifier.defaultData has been deprecated with no replacement.",
      {
        since: "PF1 vNEXT",
        until: "PF1 vNEXT+1",
      }
    );

    return new this().toObject(true, false);
  }

  /** @type {string} */
  get id() {
    return this._id;
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
    if (!(parent instanceof pf1.components.ItemConditional))
      throw new Error("Conditional modifier's parent must be a Conditional");

    if (!Array.isArray(data)) data = [data];

    const modifiers = parent.toObject().modifiers ?? [];

    // Prepare data
    data = data.map((dataObj) => new this(dataObj).toObject());
    modifiers.push(...data);

    // Update parent
    await parent.update({ modifiers });

    // Return results
    return data.map((o) => parent.modifiers.get(o._id));
  }

  /**
   * Update modifier
   *
   * @param {object} updateData
   * @param {object} [options]
   * @returns - Updated action
   */
  async update(updateData, options = {}) {
    if (options.dryRun) return this.updateSource(updateData, { dryRun: true });

    this.updateSource(updateData);

    const modifiers = this.parent.modifiers.map((m) => m.toObject());
    return this.parent.update({ modifiers });
  }

  /**
   * Delete this individual modifier.
   *
   * @returns - Updated action
   */
  async delete() {
    const modifiers = this.parent.toObject().modifiers ?? [];
    const idx = modifiers.findIndex((m) => m._id === this.id);
    if (idx < 0) throw new Error(`Modifier not found in parent ${this.parent.name}`);

    modifiers.splice(idx, 1);
    return this.parent.update({ modifiers });
  }

  /**
   * @internal
   * @param {object} data
   */
  static pruneData(data) {
    if (!data.type) delete data.type;
    if (!data.formula) delete data.formula;
    if (!data.critical || data.critical === "normal") delete data.critical;
    if (!data.target) delete data.target;
    if (!data.subTarget) delete data.subTarget;

    if (!["attack", "damage"].includes(data.target)) {
      delete data.critical;
    }

    // Damage type is only meaningful with damage target
    if (data.target !== "damage") delete data.damageType;
    else {
      // TODO: clean damage type contents otherwise
    }
  }
}
