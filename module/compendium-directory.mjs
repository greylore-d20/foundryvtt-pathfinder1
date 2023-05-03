export class CompendiumDirectoryPF extends CompendiumDirectory {
  get template() {
    return "systems/pf1/templates/sidebar/compendium.hbs";
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

    if (pf1.migrations.isMigrating) {
      return void ui.notifications.warn(game.i18n.localize("PF1.Migration.Ongoing"));
    }

    pf1.applications.compendiums[type]._render(true, { focus: true });
  }
}
