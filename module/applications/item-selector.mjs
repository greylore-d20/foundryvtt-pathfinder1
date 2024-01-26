/**
 * Item choice dialog.
 */
export class ItemSelector extends FormApplication {
  constructor({ actor, items, filter, empty = true, selected = null } = {}, options) {
    super(actor, options);

    this.empty = empty;
    this.selected = selected || "";
    this.filterFunc = filter;
    this.items = items ?? actor?.items;

    if (!this.items) throw new Error("No items list provided.");
  }

  get title() {
    return this.options.title || game.i18n.localize("PF1.Application.ItemSelector.Title");
  }

  get template() {
    return "systems/pf1/templates/apps/item-select.hbs";
  }

  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      classes: ["pf1", "item-selector"],
      height: "auto",
      submitOnClose: false,
      submitOnChange: true,
      closeOnSubmit: false,
      resizable: true,
    };
  }

  getData() {
    if (this.actor) this.items = this.actor.items;

    const items = this.filterFunc ? this.items.filter(this.filterFunc) : [...this.items];
    if (this.empty) {
      items.unshift({
        id: "",
        img: "icons/svg/cancel.svg",
        name: game.i18n.localize("PF1.None"),
      });
    }

    return {
      empty: this.empty,
      selected: this.selected || "",
      items,
    };
  }

  close(...args) {
    super.close(...args);
    this.resolve?.(null);
  }

  activateListeners(jq) {
    super.activateListeners(jq);

    const button = jq[0].querySelector("button.commit-select");
    if (button) {
      button.addEventListener("click", this._onSaveSelection.bind(this));
    }
  }

  _onSaveSelection(event) {
    this.resolve?.(this.selected || "");
    this.close();
  }

  _updateObject(event, formData) {
    this.selected = formData.selected;
    this.render();
  }

  /**
   * Render item selector and wait for it to resolve.
   *
   * @param {object} options - Options
   * @param {Actor} [options.actor] - Actor to find items from.
   * @param {Item[]} [options.items] - Items list. Used only if actor is undefined.
   * @param {Function} options.filter - Filter function
   * @param {boolean} [options.empty=true] - Allow empty selection.
   * @param {string} [options.selected=null] - Already selected item ID.
   * @param {object} [renderOptions] - Render options
   * @param {object} [appOptions] - Application options
   * @returns {Promise<string|null>} - Item ID or null if cancelled.
   */
  static wait({ actor, items, filter, empty = true, selected = null } = {}, appOptions, renderOptions) {
    const old = Object.values(ui.windows).find(
      (app) => app instanceof pf1.applications.ItemSelector && app.id === appOptions.id
    );
    if (old) {
      old.render(false, { focus: true });
      return null;
    }

    return new Promise((resolve) => {
      const app = new this({ actor, items, filter, empty, selected }, appOptions);
      app.resolve = resolve;
      app.render(true, renderOptions);
    });
  }
}
