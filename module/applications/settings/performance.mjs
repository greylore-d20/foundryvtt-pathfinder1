export class PerformanceModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      reachLimit: new fields.NumberField({ integer: true, min: 0, initial: 60 }),
    };
  }
}

export class PerformanceConfig extends FormApplication {
  /** @override */
  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      title: game.i18n.localize("PF1.Application.Performance.Title"),
      id: "performance-config",
      template: "systems/pf1/templates/settings/performance.hbs",
      classes: [...options.classes, "pf1", "performance-config"],
      submitOnChange: false,
      closeOnSubmit: true,
      submitOnClose: false,
      width: 520,
      height: "auto",
    };
  }

  getData() {
    const settings = game.settings.get("pf1", "performance");
    return {
      ...settings,
      model: settings.constructor.defineSchema(),
    };
  }

  activateListeners(jq) {
    super.activateListeners(jq);

    const [html] = jq;

    const reachLabel = html.querySelector("span.reach-limit");
    html
      .querySelector("input[name='settings.reachLimit']")
      .addEventListener("input", (event) => (reachLabel.textContent = event.target.value), { passive: true });

    html.querySelector("button[type='reset']").addEventListener("click", (event) => {
      event.preventDefault();
      game.settings.set("pf1", "performance", {}).then(() => this.close());
    });
  }

  _updateObject(event, formData) {
    formData = foundry.utils.expandObject(formData);
    console.table(formData.settings);
    game.settings.set("pf1", "performance", formData.settings);
  }
}
