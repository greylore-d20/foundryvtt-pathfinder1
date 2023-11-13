import { getSkipActionPrompt } from "../documents/settings.mjs";

export class ActionChooser extends Application {
  /**
   * @param {ItemPF} item - The item for which to choose an attack
   * @param {any} [options]
   */
  constructor(item, options = {}) {
    super(options);

    this.useOptions = {};
    this.item = item;
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
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

  async getData(options) {
    const result = await super.getData(options);

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

    const actionID = event.currentTarget.dataset?.action;
    this.item.use({ ...this.useOptions, actionID, skipDialog: getSkipActionPrompt() });
    this.close();
  }
}
