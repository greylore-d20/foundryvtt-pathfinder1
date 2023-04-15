/**
 * Polymorphic base class.
 * Should be fairly empty, only containing functionality that all items should have regardless of type.
 */
export class ItemBasePF extends Item {
  /**
   * Polymorphic constructor.
   *
   * @param {object} data ActorData
   * @param {object} context Context data
   */
  // eslint-disable-next-line constructor-super
  constructor(data, context = {}) {
    if (context.pf1?.subtyped) {
      super(data, context);
    } else {
      const subtyped = { pf1: { subtyped: true } };
      const cls = CONFIG.Item.documentClasses[data.type];
      if (!cls) console.warn("Invalid item type:", { type: data.type });
      return new cls(data, { ...subtyped, ...context });
    }
  }
}
