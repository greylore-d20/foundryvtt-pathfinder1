/**
 * DataModel that performs automatic data preparation
 *
 * Calls {@link prepareData()} on initialization and on {@link reset()}
 */
export class PreparedModel extends foundry.abstract.DataModel {
  /**
   * @override
   * @protected
   * @param {object} options - Constructor options
   */
  _initialize(options = {}) {
    super._initialize(options);

    this._safePrepareData();
  }

  /**
   * Safely prepare data
   *
   * @internal
   */
  _safePrepareData() {
    try {
      this.prepareData();
    } catch (err) {
      console.error(err, this, { parent: this.parent });
    }
  }

  /**
   * Prepare data after initialization or reset.
   *
   * @abstract
   * @protected
   */
  prepareData() {}
}
