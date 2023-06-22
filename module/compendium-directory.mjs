const buttons = {
  spells: { label: "PF1.BrowseSpells" },
  items: { label: "PF1.BrowseItems" },
  bestiary: { label: "PF1.BrowseBestiary" },
  feats: { label: "PF1.BrowseFeats" },
  classes: { label: "PF1.BrowseClasses" },
  races: { label: "PF1.BrowseRaces" },
  buffs: { label: "PF1.BrowseBuffs", wide: true },
};

/**
 * @param event
 */
function compendiumButtonClick(event) {
  event.preventDefault();
  const type = event.target.dataset.category;
  pf1.applications.compendiums[type]._render(true, { focus: true });
}

/**
 * Render compendium browser buttons.
 *
 * @param {CompendiumDirectory} app
 * @param {JQuery} html
 * @param {object} options
 */
Hooks.on("renderCompendiumDirectory", async (app, [html], options) => {
  const element = html.querySelector("footer.directory-footer");
  element.classList.add("action-buttons"); // For v10 cross-compatibility

  for (const [category, info] of Object.entries(buttons)) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.category = category;
    button.classList.add("compendium", category);
    button.innerText = game.i18n.localize(info.label);
    if (info.wide) button.classList.add("colspan-2");
    element.append(button);
    button.addEventListener("click", compendiumButtonClick);
  }
});

// Add compendium sidebar context options
Hooks.on("getCompendiumDirectoryEntryContext", (html, entryOptions) => {
  // Add option to enable & disable pack
  entryOptions.unshift(
    {
      name: game.i18n.localize("PF1.CompendiumBrowser.HidePack"),
      icon: '<i class="fas fa-low-vision"></i>',
      condition: ([li]) => {
        const pack = game.packs.get(li.dataset.pack);
        return pack.config.pf1?.disabled !== true;
      },
      callback: ([li]) => {
        const pack = game.packs.get(li.dataset.pack);
        pack.configure({ pf1: { disabled: true } });
      },
    },
    {
      name: game.i18n.localize("PF1.CompendiumBrowser.ShowPack"),
      icon: '<i class="fas fa-eye"></i>',
      condition: ([li]) => {
        const pack = game.packs.get(li.dataset.pack);
        return pack.config.pf1?.disabled === true;
      },
      callback: ([li]) => {
        const pack = game.packs.get(li.dataset.pack);
        pack.configure({ pf1: { disabled: false } });
      },
    }
  );
});
