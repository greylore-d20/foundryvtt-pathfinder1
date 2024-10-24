const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ActionSelector extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["pf1-v2", "action-selector"],
    window: {
      minimizable: false,
      resizable: false,
    },
    actions: {
      click: ActionSelector._onClickAction,
    },
    position: {
      width: 390,
    },
    sheetConfig: false,
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/action-select.hbs",
    },
  };

  get item() {
    return this.document;
  }

  get title() {
    return game.i18n.format("PF1.Application.ActionSelector.Title", {
      actor: this.item.actor.name,
      item: this.item.name,
    });
  }

  async _prepareContext() {
    return {
      actions: this.item.actions,
    };
  }

  static _onClickAction(event) {
    event.preventDefault();

    const target = event.target.closest("[data-action]");
    this.resolve(target.dataset?.id);
    this.close();
  }

  close(...args) {
    this.resolve(null);
    super.close(...args);
  }

  /**
   * @param {object} options - Options
   * @param {ItemPF} options.document - Item to select action for.
   * @param {object} renderOptions - Options passed to application rendering
   * @returns {Promise<ChatMessage|object|undefined>} - Result of ItemPF.use() for selected action
   */
  static async open(options) {
    return new Promise((resolve) => {
      const selector = new this(options);
      selector.resolve = resolve;
      selector.render(true);
    });
  }
}
