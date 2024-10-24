/**
 * @typedef {object} Widget_CategorizedItemPicker~Item
 * @property {string} key - The key of the item.
 * @property {string} [label] - The label of the item.
 * @property {string} [icon] - The icon of the item.
 */

/**
 * @typedef {object} Widget_CategorizedItemPicker~Category
 * @property {string} key - The key of the category.
 * @property {string} label - The label of the category.
 * @property {Widget_CategorizedItemPicker~Item[]} items - All the items associated with this category.
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Item picker widget.
 */
export class Widget_CategorizedItemPicker extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["pf1-v2", "widget", "categorized-item-picker"],
    window: {
      minimizable: false,
      resizable: true,
    },
    position: {
      width: 480,
      height: 480,
    },
    sheetConfig: false,
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/widgets/categorized-item-picker.hbs",
    },
  };

  constructor(options, categories, callback, selected) {
    super(options);

    /**
     * Objects containing category and item data.
     *
     * @type {Widget_CategorizedItemPicker~Category[]}
     */
    this.categories = categories;

    /**
     * Previously selected category and item
     *
     * @type {object}
     * @property {string} category Selected category.
     * @property {string} item Selected item in that category.
     */
    this.selected = selected;

    /**
     * Callback fired when an item has been selected.
     *
     * @type {Function}
     */
    this.callback = callback;

    /**
     * Track hidden elements of the sheet.
     *
     * @property
     * @type {Object<string, string>}
     */
    this._hiddenElems = {};
  }

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    const categories = [];

    for (const cat of this.categories) {
      cat.hidden = cat.validity.item === false;
      if (cat.hidden) continue;
      cat.active = cat.key === this.selected?.category;

      const categoryItems = [];
      for (const item of cat.items) {
        if (item.validity.item === false) continue;

        // Mark items as invalid if the category is invalid
        if (!cat.validity.valid) {
          item.validity.category = false;
          item.validity.valid = false;
        }

        categoryItems.push({
          category: cat.key,
          active: this.selected?.item === item.key,
          ...item,
        });
      }

      // Has any valid choices
      cat.hasChoices = categoryItems.some((i) => i.validity.valid);
      cat.hasVisibleChoices = categoryItems.some((i) => i.validity.item !== false);

      if (!cat.hasVisibleChoices || !cat.hasChoices) continue;

      cat.items = categoryItems;
      categories.push(cat);
    }

    return {
      categories,
    };
  }

  /* -------------------------------------------- */

  /**
   * Attach event listeners to the rendered application form.
   *
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */
  _onRender(context, options) {
    // Click an item
    this.element.querySelectorAll(".item").forEach((el) => el.addEventListener("click", this._onClickItem.bind(this)));

    // Cancel widget
    window.setTimeout(() => {
      if (this._cancelCallback) document.removeEventListener("click", this._cancelCallback);
      this._cancelCallback = this._onCancel.bind(this);
      document.addEventListener("click", this._cancelCallback);
    }, 10);
  }

  /* -------------------------------------------- */

  /**
   * Handle click on an item.
   *
   * @param {Event} event
   * @private
   */
  _onClickItem(event) {
    event.preventDefault();
    const a = event.currentTarget;

    const result = a.dataset.value;
    this.callback(result);
    this.close();
  }

  /* -------------------------------------------- */

  /**
   * Handle click outside the widget.
   *
   * @param {Event} event
   * @private
   */
  _onCancel(event) {
    event.preventDefault();

    // Don't cancel if this widget was clicked
    let node = event.target;
    if (node === this.element) return;
    while (node.parentNode) {
      if (node === this.element) return;
      node = node.parentNode;
    }

    this.close();
  }

  /* -------------------------------------------- */

  /**
   * Close the widget
   *
   * @param args
   * @returns {Promise<void>}
   */
  async close(...args) {
    document.removeEventListener("click", this._cancelCallback);
    return super.close(...args);
  }
}

Hooks.on("renderWidget_CategorizedItemPicker", (app, html, data) => {
  html.querySelector(".pre-select")?.scrollIntoView({ block: "nearest" });
});
