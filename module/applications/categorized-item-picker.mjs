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
    const classes = options.classes;
    delete options.classes;

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

    if (classes?.length) {
      this.options.classes.push(...classes);
    }
  }

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    const context = {};

    context.categories = this.categories;
    context.items = [];

    for (const cat of this.categories) {
      cat.hidden = cat.validity.item === false;
      if (cat.hidden) continue;

      for (const item of cat.items) {
        if (item.validity.item === false) continue;

        // Mark items as invalid if the category is invalid
        if (!cat.validity.valid) {
          item.validity.category = false;
          item.validity.valid = false;
        }

        context.items.push({
          category: cat.key,
          ...item,
        });
      }

      // Has any valid choices
      cat.hasChoices = context.items.some((i) => i.category === cat.key && i.validity.valid);
      cat.hasVisibleChoices = context.items.some((i) => i.category === cat.key && i.validity.item !== false);
    }

    context.categories = context.categories.filter((cat) => !cat.hidden && cat.hasVisibleChoices);

    return context;
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

    // Expand/minimize category
    this.element
      .querySelectorAll(".category")
      .forEach((el) => el.addEventListener("click", this._onClickCategory.bind(this)));

    // Pre-select old category
    if (this.selected?.category) {
      this.element.querySelector(`.category[data-category="${this.selected.category}"]`).click();
      if (this.selected?.item) {
        this.element
          .querySelector(`.item[data-category="${this.selected.category}"][data-value="${this.selected.item}"]`)
          .classList.add("pre-select");
      }
    }

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
   * Handle click on a category.
   *
   * @param {Event} event
   * @private
   */
  _onClickCategory(event) {
    event.preventDefault();
    const a = event.currentTarget;

    // Deactivate all categories
    [...this.element.querySelector(".item-picker-categories").children].forEach((el) => el.classList.remove("active"));

    // Activate clicked category
    a.closest(".category").classList.add("active");

    // Hide all items
    [...this.element.querySelector(".item-picker-items").children].forEach((el) => el.classList.add("hidden"));

    // Show items
    this.element
      .querySelectorAll(`.item-picker-items .item[data-category="${a.dataset.category}"]`)
      .forEach((el) => el.classList.remove("hidden"));
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
