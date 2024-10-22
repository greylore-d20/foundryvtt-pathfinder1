/**
 * Compacting Mixin
 *
 * @param {T} Base
 * @returns {T} - Enriched class
 */
export const CompactingMixin = (Base) => {
  return class CommonModel extends Base {
    /** @override */
    toObject(source = true, clean = true) {
      const data = super.toObject(source);

      if (clean) this.constructor.pruneData(data);

      return data;
    }

    /**
     * Prune data
     *
     * @abstract
     * @protected
     * @param {object} data
     */
    static pruneData(data) {}
  };
};
