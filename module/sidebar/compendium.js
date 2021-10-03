import { CompendiumBrowser } from "../apps/compendium-browser.js";

export class CompendiumDirectoryPF extends CompendiumDirectory {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      template: "systems/pf1/templates/sidebar/compendium.hbs",
    });
  }

  getData(options) {
    const data = super.getData(options);

    for (const p of Object.values(data.packs)) {
      for (const pack of p.packs) {
        const config = game.settings.get("core", "compendiumConfiguration")[pack.collection];
        const disabled = getProperty(config, "pf1.disabled") === true;
        setProperty(pack, "pf1.disabled", disabled);
      }
    }

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".compendium-footer .compendium.spells").click((e) => this._onBrowseCompendium(e, "spells"));
    html.find(".compendium-footer .compendium.items").click((e) => this._onBrowseCompendium(e, "items"));
    html.find(".compendium-footer .compendium.bestiary").click((e) => this._onBrowseCompendium(e, "bestiary"));
    html.find(".compendium-footer .compendium.feats").click((e) => this._onBrowseCompendium(e, "feats"));
    html.find(".compendium-footer .compendium.classes").click((e) => this._onBrowseCompendium(e, "classes"));
    html.find(".compendium-footer .compendium.races").click((e) => this._onBrowseCompendium(e, "races"));
    html.find(".compendium-footer .compendium.buffs").click((e) => this._onBrowseCompendium(e, "buffs"));
  }

  _onBrowseCompendium(event, type) {
    event.preventDefault();

    if (game.pf1.isMigrating) return ui.notifications.warn(game.i18n.localize("PF1.Migration.Ongoing"));

    game.pf1.compendiums[type]._render(true);
  }
}
