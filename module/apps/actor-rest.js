export class ActorRestDialog extends DocumentSheet {
  static get defaultOptions() {
    const options = super.defaultOptions;
    return mergeObject(options, {
      classes: ["pf1", "actor-rest"],
      template: "systems/pf1/templates/apps/actor-rest.hbs",
      width: 500,
      closeOnSubmit: true,
    });
  }

  /* -------------------------------------------- */

  /**
   * Configure the title of the special traits selection window to include the Actor name
   *
   * @type {string}
   */
  get title() {
    return `${game.i18n.localize("PF1.Rest")}: ${this.object.name}`;
  }

  /* -------------------------------------------- */

  /**
   * Update the Actor using the configured options
   * Remove/unset any flags which are no longer configured
   *
   * @param event
   * @param formData
   */
  async _updateObject(event, formData) {
    this.object.performRest({
      restoreHealth: formData["restoreHealth"],
      longTermCare: formData["longTermCare"],
      restoreDailyUses: formData["restoreDailyUses"],
      hours: formData["hours"],
    });
  }
}
