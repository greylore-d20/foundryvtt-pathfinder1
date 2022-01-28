/**
 * Polymorphic base class.
 * Should be fairly empty, only containing functionality that all items should have regardless of type.
 */
export class ItemBasePF extends Item {
  /**
   * Polymorphic constructor.
   *
   * @param {Object} data ActorData
   * @param {Object} context Context data
   */
  // eslint-disable-next-line constructor-super
  constructor(data, context = {}) {
    if (context.pf1?.subtyped) {
      super(data, context);
    } else if (data.type) {
      const subtyped = { pf1: { subtyped: true } };
      const cls = CONFIG.Item.documentClasses[data.data?.type ?? data.type] ?? CONFIG.Item.documentClasses.default;
      if (!cls) console.warn(data.data?.type, data.type);
      return new cls(data, { ...subtyped, ...context });
    }
  }

  /**
   * @returns {string} Item subtype.
   */
  get subType() {
    return null;
  }
}
