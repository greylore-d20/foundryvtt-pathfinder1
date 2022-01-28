/**
 * Polymorphic base class.
 * Should be fairly empty, only containing functionality that all actors should have regardless of type.
 */
export class ActorBasePF extends Actor {
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
      const cls = CONFIG.Actor.documentClasses[data.type] ?? CONFIG.Actor.documentClasses.default;
      if (!cls) console.warn(data.data?.type, data.type);
      return new cls(data, { ...subtyped, ...context });
    }
  }
}
