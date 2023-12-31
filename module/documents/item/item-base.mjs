export class ItemBasePF extends Item {
  /**
   * Item create dialog.
   *
   * @override
   * @param {object} data Initial form data
   * @param {object} [context] Additional options.
   * @param {Actor|null} [context.parent=null] Parent parameter passed to Item.create() options
   * @param {string|null} [context.pack=null] Pack ID parameter passed to Item.create() options
   * @param {object} [context.options] Dialog context options.
   * @returns {Promise<Item|null>}
   *
   * Synchronized with Foundry VTT v11.315
   */
  static async createDialog(data = {}, { parent = null, pack = null, ...options } = {}) {
    return pf1.applications.item.CreateDialog.waitPrompt(data, { parent, pack, options });
  }

  /**
   * @override
   */
  prepareData() {
    // To combat Foundry's weird out-of-order initialization bug
    if (this.actor && !this.actor._initializing) return;

    super.prepareData();
  }

  /**
   * Is the item functional.
   *
   * @abstract
   * @type {boolean}
   */
  get isActive() {
    return true;
  }

  /**
   * Is this item usable at base level, disregarding per-action details.
   *
   * @abstract
   * @type {boolean}
   */
  get canUse() {
    return this.isActive;
  }
}
