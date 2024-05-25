import { getSkipActionPrompt } from "../documents/settings.mjs";

export class ActionChooser extends Application {
  /**
   * @param {ItemPF} item - The item for which to choose an attack
   * @param {object} [options={}] - Application options
   * @param {object} [useOptions={}] - Use options
   */
  constructor(item, options = {}, useOptions = {}) {
    super(options);

    this.useOptions = useOptions;
    this.item = item;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "systems/pf1/templates/apps/action-chooser.hbs",
      classes: ["pf1", "action-chooser"],
      width: 400,
    });
  }

  get title() {
    return game.i18n.format("PF1.Application.ActionChooser.Title", {
      actor: this.item.actor.name ?? "",
      item: this.item.name,
    });
  }

  async getData() {
    const result = await super.getData();

    result.item = this.item.toObject();
    result.actions = this.item.system.actions;

    return result;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".action").on("click", this._onClickAction.bind(this));
  }

  _onClickAction(event) {
    event.preventDefault();

    const actionId = event.currentTarget.dataset?.action;
    const result = this.item.use({ ...this.useOptions, actionId, skipDialog: getSkipActionPrompt() });
    this.resolve?.(result);
    this.close();
  }

  close(...args) {
    this.resolve?.();
    super.close(...args);
  }

  /**
   * @param {ItemPF} item
   * @param {object} options
   * @param {object} renderOptions - Options passed to application rendering
   * @returns {Promise<ChatMessage|object|undefined>} - Result of ItemPF.use() for selected action
   */
  static async open(item, options = {}, renderOptions = {}) {
    return new Promise((resolve) => {
      const selector = new this(item, undefined, options);
      selector.resolve = resolve;
      selector.render(true, { focus: true, ...renderOptions });
    });
  }
}
