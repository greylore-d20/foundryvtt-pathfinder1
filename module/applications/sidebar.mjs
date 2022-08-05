import { CompendiumBrowser } from "./compendium-browser.mjs";

export class SidebarPF extends Sidebar {
  constructor(...args) {
    super(...args);

    this.compendiums = {
      spells: new CompendiumBrowser({ type: "spells", documentType: "Item" }),
      items: new CompendiumBrowser({ type: "items", documentType: "Item" }),
      bestiary: new CompendiumBrowser({ type: "bestiary", documentType: "Actor" }),
    };
  }

  async _render(...args) {
    await super._render(...args);

    const parent = this.element.find("#compendium .directory-footer");
    const child = await renderTemplate("systems/pf1/templates/sidebar/compendiums-footer.hbs", {});
    parent.append(child);
    this.activateExtraListeners(parent);
  }

  activateExtraListeners(html) {
    html.find(".compendium-footer .compendium.spells").click((e) => this._onBrowseCompendium(e, "spells"));
    html.find(".compendium-footer .compendium.items").click((e) => this._onBrowseCompendium(e, "items"));
    html.find(".compendium-footer .compendium.bestiary").click((e) => this._onBrowseCompendium(e, "bestiary"));
  }

  _onBrowseCompendium(event, type) {
    event.preventDefault();

    this.compendiums[type]._render(true);
  }
}
