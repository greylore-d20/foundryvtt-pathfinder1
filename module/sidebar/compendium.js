import { CompendiumBrowser } from "../apps/compendium-browser.js";

export class CompendiumDirectoryPF extends CompendiumDirectory {
  constructor(...args) {
    super(...args);

    this.compendiums = {
      spells: new CompendiumBrowser({ type: "spells", entityType: "Item" }),
      items: new CompendiumBrowser({ type: "items", entityType: "Item" }),
      bestiary: new CompendiumBrowser({ type: "bestiary", entityType: "Actor" }),
    };
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      template: "systems/pf1/templates/sidebar/compendium.html",
    });
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".compendium-footer .compendium.spells").click(e => this._onBrowseCompendium(e, "spells"));
    html.find(".compendium-footer .compendium.items").click(e => this._onBrowseCompendium(e, "items"));
    html.find(".compendium-footer .compendium.bestiary").click(e => this._onBrowseCompendium(e, "bestiary"));
  }

  _onBrowseCompendium(event, type) {
    event.preventDefault();

    this.compendiums[type]._render(true);
  }
}