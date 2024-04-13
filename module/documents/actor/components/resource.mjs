/**
 * Resource interface.
 */
export class Resource {
  /** @type {string} */
  get id() {
    return this._id;
  }

  /** @type {ItemPF} */
  #item;
  get item() {
    return this.#item;
  }

  /**
   * @param {number} value Value to add to the charges.
   * @returns {Promise} Update promise
   */
  async add(value) {
    return this.item.addCharges(value);
  }

  constructor(item) {
    this.#item = item;
    const tag = item.system.tag;

    Object.defineProperties(this, {
      value: {
        get() {
          return this.item.charges;
        },
        enumerable: true,
      },
      max: {
        get() {
          return this.item.maxCharges;
        },
        enumerable: true,
      },
      _id: {
        value: item.id,
        enumerable: true,
      },
      tag: {
        value: tag,
        enumerable: true,
      },
    });
  }
}
