export class IntegrationModel extends foundry.abstract.DataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
      diceSoNice: new fields.BooleanField({ initial: true }),
      dragRuler: new fields.BooleanField({ initial: true }),
      enhancedTerrainLayer: new fields.BooleanField({ initial: true }),
    };
  }
}

export class IntegrationConfig extends FormApplication {
  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      title: game.i18n.localize("PF1.Application.Integration.Title"),
      id: "pf1-integration-config",
      template: "systems/pf1/templates/settings/integration.hbs",
      classes: [...options.classes, "pf1", "integration-config"],
      width: 460,
      height: "auto",
      submitOnChange: false,
      submitOnClose: false,
      closeOnSubmit: true,
    };
  }

  getData() {
    return {
      ...game.settings.get("pf1", "integration"),
      dsnFound: game.modules.get("dice-so-nice")?.active,
      drFound: game.modules.get("drag-ruler")?.active,
      etlFound: game.modules.get("enhanced-terrain-layer")?.active,
    };
  }

  _updateObject(event, formData) {
    formData = foundry.utils.expandObject(formData);
    game.settings.set("pf1", "integration", formData.settings);
  }
}
