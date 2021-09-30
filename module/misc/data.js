/**
 * @class
 * A desciptor for damage caused by an action.
 */
export class Data_DamageType {
  constructor(data = {}) {
    /**
     * @typedef {object} Data_DamageType_Data
     * @property {string[]} keys - The IDs of the damage types associated with this data descriptor.
     * @property {string[]} modifiers - The IDs of the damage type modifiers associated with this data descriptor.
     * @property {boolean} logicalOperator - All damage types will apply if true (and), a single damage type (of choice) is applied if false (or).
     * @property {string} rule - The rule to use for applying damage with this damage type.
     */
    /**
     * @property {Data_DamageType_Data} data
     * The data for this descriptor.
     */
    this.data = mergeObject(this.constructor.defaultData, data);
  }

  static get defaultData() {
    return {
      keys: [],
      modifiers: [],
      logicalOperator: true,
      rule: "highest",
    };
  }

  get isNonlethal() {
    return this.modifiers.includes("dt-nonlethal");
  }

  get isPrecision() {
    return this.modifiers.includes("dt.precision");
  }
}
