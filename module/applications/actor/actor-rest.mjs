const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * An application that renders a form to configure the resting behavior of an Actor
 *
 * @augments {DocumentSheetV2&HandlebarsApplicationMixin}
 * @param {ActorPF} actor     The Actor instance for which to configure resting
 */
export class ActorRestDialog extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: ActorRestDialog._rest,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    classes: ["pf1-v2", "actor-rest"],
    window: {
      minimizable: false,
      resizable: false,
    },
    position: {
      width: 500,
    },
    sheetConfig: false,
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/actor-rest.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    return {
      buttons: [{ type: "submit", label: "PF1.Rest" }],
    };
  }

  /* -------------------------------------------- */

  /**
   * Alias the document property to actor
   *
   * @type {ActorPF}
   */
  get actor() {
    return this.document;
  }

  /* -------------------------------------------- */

  /**
   * Configure the title of the actor rest window to include the Actor name
   *
   * @override
   * @type {string}
   */
  get title() {
    return `${game.i18n.localize("PF1.Rest")}: ${this.actor.name}`;
  }

  /* -------------------------------------------- */

  /**
   * Trigger the actor rest with the provided form input as options.
   *
   * @internal
   * @this {DocumentSheetV2&ActorRestDialog}
   * @param {SubmitEvent} event                                     The originating form submission event
   * @param {HTMLFormElement} form                                  The form element that was submitted
   * @param {FormDataExtended} formData                             Processed data for the submitted form
   * @param {Partial<ActorRestOptions>} formData.object             The resting configuration
   * @returns {Promise<void>}
   */
  static async _rest(event, form, formData) {
    await this.actor.performRest(formData.object);
  }
}
