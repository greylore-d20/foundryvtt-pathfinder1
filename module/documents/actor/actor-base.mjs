/**
 * Base actor class with minimal functionality.
 *
 * Provides only caching of .itemTypes and nothing else.
 */
export class ActorBasePF extends Actor {
  constructor(...args) {
    super(...args);

    this._itemTypes ??= null;
  }

  /**
   * Resets internal itemTypes cache.
   *
   * @override
   */
  prepareBaseData() {
    super.prepareBaseData();

    // Reset item types cache
    this._itemTypes = null;
  }

  /**
   * Cached result of .itemTypes
   *
   * @internal
   */
  _itemTypes;

  /**
   * Cached override
   *
   * @override
   */
  get itemTypes() {
    this._itemTypes ??= super.itemTypes;
    return this._itemTypes;
  }
}
