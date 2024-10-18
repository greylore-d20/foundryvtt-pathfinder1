import { getSkipActionPrompt } from "@documents/settings.mjs";

export class ActionSelector extends Application {
  /**
   * @param {object} options - Application options
   * @param {ItemPF} optikons.item - The item for which to choose an action
   */
  constructor(options = {}) {
    if (!(options.item instanceof Item)) throw new Error("Must provide item as part of options.");
    super(options);

    this.item = options.item;
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      template: "systems/pf1/templates/apps/action-select.hbs",
      classes: [...options.classes, "pf1", "action-selector"],
      width: 400,
    };
  }

  get title() {
    return game.i18n.format("PF1.Application.ActionSelector.Title", {
      actor: this.item.actor.name,
      item: this.item.name,
    });
  }

  async getData() {
    return {
      actions: this.item.actions,
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".action").on("click", this._onClickAction.bind(this));
  }

  _onClickAction(event) {
    event.preventDefault();

    this.resolve(event.currentTarget.dataset?.action);
    this.close();
  }

  close(...args) {
    this.resolve(null);
    super.close(...args);
  }

  /**
   * @param {object} options - Options
   * @param {ItemPF} options.item - Item to select action for.
   * @param {object} renderOptions - Options passed to application rendering
   * @returns {Promise<ChatMessage|object|undefined>} - Result of ItemPF.use() for selected action
   */
  static async open(options = {}, renderOptions = {}) {
    return new Promise((resolve) => {
      const selector = new this(options);
      selector.resolve = resolve;
      selector.render(true, { focus: true, ...renderOptions });
    });
  }
}
