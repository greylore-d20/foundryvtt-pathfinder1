export class Widget_CategorizedItemPicker extends Application {
  constructor(options, categories, callback, selected) {
    super(options);

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
     * @type {object.<string, string>}
     */
    this._hiddenElems = {};
  }

  get template() {
    return "systems/pf1/templates/widgets/categorized-item-picker.hbs";
  }

  getData(options) {
    const data = super.getData(options);

    data.categories = [];
    data.items = [];

    for (const cat of this.categories) {
      data.categories.push({
        key: cat.key,
        label: cat.label,
      });

      for (const item of cat.items) {
        data.items.push(
          mergeObject(
            {
              category: cat.key,
            },
            item
          )
        );
      }
    }

    return data;
  }

  activateListeners(html) {
    // Click an item
    html.find(".item").click(this._onClickItem.bind(this));

    // Expand/minimize category
    html.find(".category a").click(this._onClickCategory.bind(this));

    // Pre-select old category
    if (this.selected?.category) {
      html.find(`.category a[data-category="${this.selected.category}"]`).click();
      if (this.selected?.item) {
        html
          .find(`.item[data-category="${this.selected.category}"][data-value="${this.selected.item}"]`)
          .first()
          .addClass("pre-select");
      }
    }

    // Cancel widget
    window.setTimeout(() => {
      if (this._cancelCallback) document.removeEventListener("click", this._cancelCallback);
      this._cancelCallback = this._onCancel.bind(this);
      document.addEventListener("click", this._cancelCallback);
    }, 10);
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      width: 480,
      height: 480,
    });
  }

  _onClickItem(event) {
    event.preventDefault();
    const a = event.currentTarget;

    const result = a.dataset.value;
    this.callback(result);
    this.close();
  }

  _onClickCategory(event) {
    event.preventDefault();
    const a = event.currentTarget;
    const html = $(this.element);

    // Deactivate all categories
    html.find(".item-picker-categories").children().removeClass("active");

    // Activate clicked category
    $(a).closest(".category").addClass("active");

    // Hide all items
    html.find(".item-picker-items").children().hide();

    // Show items
    html.find(`.item-picker-items .item[data-category="${a.dataset.category}"]`).show();
  }

  _onCancel(event) {
    event.preventDefault();

    // Don't cancel if this widget was clicked
    let node = event.target;
    if (node === this.element[0]) return;
    while (node.parentNode) {
      if (node === this.element[0]) return;
      node = node.parentNode;
    }

    this.close();
  }

  async close(...args) {
    document.removeEventListener("click", this._cancelCallback);
    return super.close(...args);
  }
}

Hooks.on("renderWidget_CategorizedItemPicker", (app, html, data) => {
  html.find(".pre-select")[0]?.scrollIntoView({ block: "nearest" });
});
