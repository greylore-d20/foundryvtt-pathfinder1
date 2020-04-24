export class CompendiumBrowser extends Application {
  constructor(...args) {
    super(...args);

    this.items = [];

    this.filters = [];

    this.filterQuery = /.*/i;
    this.activeFilters = {};
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      template: "systems/pf1/templates/apps/compendium-browser.html",
      width: 720,
      height: window.innerHeight - 60,
      top: 30,
      left: 40,
    });
  }

  get typeName() {
    switch (this.type) {
      case "spells":
        return game.i18n.localize("PF1.Spells");
      case "items":
        return game.i18n.localize("PF1.Items");
    }
    return this.type;
  }

  get type() {
    return this.options.type;
  }

  get title() {
    return [this.typeName, "Browser"].join(" ");
  }

  async _fetchMetadata() {
    this.items = [];

    for (let p of game.packs) {
      if (p.entity !== "Item") continue;

      const items = await p.getContent();
      for (let i of items) {
        if (!this._filterItems(i)) continue;
        this.items.push(this._mapItems(p, i));
      }
    }
    this.items.sort((a, b) => {
      if (a.item.name < b.item.name) return -1;
      if (a.item.name > b.item.name) return 1;
      return 0;
    });

    if (this.type === "spells") this._fetchSpellFilters();
    else if (this.type === "items") this._fetchItemFilters();
  }

  _filterItems(item) {
    if (this.type === "spells" && item.type !== "spell") return false;
    if (this.type === "items" && !["weapon", "equipment", "loot", "consumable"].includes(item.type)) return false;
    return true;
  }

  _mapItems(pack, item) {
    const result = {
      collection: pack.collection,
      item: {
        _id: item._id,
        name: item.name,
        type: item.type,
        img: item.img,
        data: item.data.data,
      },
    };

    // Handle spell data
    if (this.type === "spells") {
      if (!this.extraFilters) {
        this.extraFilters = {
          "learnedAt.class": [],
          "learnedAt.domain": [],
          "learnedAt.subDomain": [],
          "learnedAt.elementalSchool": [],
          "learnedAt.bloodline": [],
          "data.subschool": [],
          "spellTypes": [],
        };
      }

      result.item.allSpellLevels = [];

      // Add class/domain/etc filters
      result.item.learnedAt = {
        "class": (getProperty(item.data, "data.learnedAt.class") || []).reduce((cur, o) => {
          if (!this.extraFilters["learnedAt.class"].includes(o[0])) this.extraFilters["learnedAt.class"].push(o[0]);
          if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
          cur.push(o[0]);
          return cur;
        }, []),
        "domain": (getProperty(item.data, "data.learnedAt.domain") || []).reduce((cur, o) => {
          if (!this.extraFilters["learnedAt.domain"].includes(o[0])) this.extraFilters["learnedAt.domain"].push(o[0]);
          if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
          cur.push(o[0]);
          return cur;
        }, []),
        "subDomain": (getProperty(item.data, "data.learnedAt.subDomain") || []).reduce((cur, o) => {
          if (!this.extraFilters["learnedAt.subDomain"].includes(o[0])) this.extraFilters["learnedAt.subDomain"].push(o[0]);
          if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
          cur.push(o[0]);
          return cur;
        }, []),
        "elementalSchool": (getProperty(item.data, "data.learnedAt.elementalSchool") || []).reduce((cur, o) => {
          if (!this.extraFilters["learnedAt.elementalSchool"].includes(o[0])) this.extraFilters["learnedAt.elementalSchool"].push(o[0]);
          if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
          cur.push(o[0]);
          return cur;
        }, []),
        "bloodline": (getProperty(item.data, "data.learnedAt.bloodline") || []).reduce((cur, o) => {
          if (!this.extraFilters["learnedAt.bloodline"].includes(o[0])) this.extraFilters["learnedAt.bloodline"].push(o[0]);
          if (!result.item.allSpellLevels.includes(o[1])) result.item.allSpellLevels.push(o[1]);
          cur.push(o[0]);
          return cur;
        }, []),
        "spellLevel": {
          "class": (getProperty(item.data, "data.learnedAt.class") || []).reduce((cur, o) => {
            cur[o[0]] = o[1];
            return cur;
          }, {}),
          "domain": (getProperty(item.data, "data.learnedAt.domain") || []).reduce((cur, o) => {
            cur[o[0]] = o[1];
            return cur;
          }, {}),
          "subDomain": (getProperty(item.data, "data.learnedAt.subDomain") || []).reduce((cur, o) => {
            cur[o[0]] = o[1];
            return cur;
          }, {}),
          "elementalSchool": (getProperty(item.data, "data.learnedAt.elementalSchool") || []).reduce((cur, o) => {
            cur[o[0]] = o[1];
            return cur;
          }, {}),
          "bloodline": (getProperty(item.data, "data.learnedAt.bloodline") || []).reduce((cur, o) => {
            cur[o[0]] = o[1];
            return cur;
          }, {}),
        },
      };

      // Add subschools
      {
        const subschool = getProperty(item.data, "data.subschool");
        if (subschool && !this.extraFilters["data.subschool"].includes(subschool)) this.extraFilters["data.subschool"].push(subschool);
      }
      // Add spell types
      {
        const spellTypes = getProperty(item.data, "data.types") ? getProperty(item.data, "data.types").split(CONFIG.PF1.re.traitSeparator) : []
        result.item.spellTypes = spellTypes;
        for (let st of spellTypes) {
          if (!this.extraFilters["spellTypes"].includes(st)) this.extraFilters["spellTypes"].push(st);
        }
      }
    }

    return result;
  }

  async getData() {
    await this._fetchMetadata();

    return {
      filters: this.filters,
      collection: this.items,
    };
  }

  _fetchSpellFilters() {
    this.filters = [
      {
        path: "data.school",
        label: game.i18n.localize("PF1.SpellSchool"),
        items: CONFIG.PF1.spellSchools,
      },
      {
        path: "data.subschool",
        label: game.i18n.localize("PF1.SubSchool"),
        items: this.extraFilters["data.subschool"].reduce((cur, o) => {
          cur[o] = o;
          return cur;
        }, {}),
      },
      {
        path: "spellTypes",
        label: game.i18n.localize("PF1.TypePlural"),
        items: this.extraFilters["spellTypes"].reduce((cur, o) => {
          cur[o] = o;
          return cur;
        }, {}),
      },
      {
        path: "learnedAt.class",
        label: game.i18n.localize("PF1.ClassPlural"),
        items: this.extraFilters["learnedAt.class"].reduce((cur, o) => {
          cur[o] = o;
          return cur;
        }, {}),
      },
      {
        path: "learnedAt.domain",
        label: game.i18n.localize("PF1.Domain"),
        items: this.extraFilters["learnedAt.domain"].reduce((cur, o) => {
          cur[o] = o;
          return cur;
        }, {}),
      },
      {
        path: "learnedAt.subDomain",
        label: game.i18n.localize("PF1.SubDomain"),
        items: this.extraFilters["learnedAt.subDomain"].reduce((cur, o) => {
          cur[o] = o;
          return cur;
        }, {}),
      },
      {
        path: "learnedAt.elementalSchool",
        label: game.i18n.localize("PF1.ElementalSchool"),
        items: this.extraFilters["learnedAt.elementalSchool"].reduce((cur, o) => {
          cur[o] = o;
          return cur;
        }, {}),
      },
      {
        path: "learnedAt.bloodline",
        label: game.i18n.localize("PF1.Bloodline"),
        items: this.extraFilters["learnedAt.bloodline"].reduce((cur, o) => {
          cur[o] = o;
          return cur;
        }, {}),
      },
      {
        path: "_spellLevel",
        label: game.i18n.localize("PF1.SpellLevel"),
        items: CONFIG.PF1.spellLevels,
      },
    ];

    this.activeFilters = this.filters.reduce((cur, f) => {
      cur[f.path] = [];
      return cur;
    }, {});
  }

  _fetchItemFilters() {
    this.filters = [
      {
        path: "type",
        label: game.i18n.localize("PF1.Type"),
        items: {
          "weapon": game.i18n.localize("PF1.ItemTypeWeapon"),
          "equipment": game.i18n.localize("PF1.ItemTypeEquipment"),
          "consumable": game.i18n.localize("PF1.ItemTypeConsumable"),
          "loot": game.i18n.localize("PF1.Misc"),
        }
      },
      {
        path: "data.weaponType",
        label: game.i18n.localize("PF1.WeaponType"),
        items: CONFIG.PF1.weaponTypes,
      },
      {
        path: "data.armor.type",
        label: game.i18n.localize("PF1.EquipmentType"),
        items: CONFIG.PF1.equipmentTypes,
      },
      {
        path: "data.slot",
        label: game.i18n.localize("PF1.Slot"),
        items: CONFIG.PF1.equipmentSlots,
      },
      {
        path: "data.consumableType",
        label: game.i18n.localize("PF1.ConsumableType"),
        items: CONFIG.PF1.consumableTypes,
      },
      {
        path: "data.subType",
        label: game.i18n.localize("PF1.Misc"),
        items: CONFIG.PF1.lootTypes,
      },
    ];

    this.activeFilters = this.filters.reduce((cur, f) => {
      cur[f.path] = [];
      return cur;
    }, {});
  }

  async _render(...args) {
    await super._render(...args);

    this.element.find(".filter-content").css("display", "none");
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Open sheets
    html.find('.entry-name').click(ev => {
      let li = ev.currentTarget.parentElement;
      this._onEntry(li.getAttribute("data-collection"), li.getAttribute("data-entry-id"));
    });

    // Make compendium items draggable
    html.find('.directory-item').each((i, li) => {
      li.setAttribute("draggable", true);
      li.addEventListener('dragstart', this._onDragStart, false);
    });

    html.find('input[name="search"]').keyup(this._onFilterResults.bind(this));

    html.find('.filter input[type="checkbox"]').change(this._onActivateBooleanFilter.bind(this));

    html.find('.filter h3').click(this._toggleFilterVisibility.bind(this));
  }

  /**
   * Handle opening a single compendium entry by invoking the configured entity class and its sheet
   * @private
   */
  async _onEntry(collectionKey, entryId) {
    const pack = game.packs.find(o => o.collection === collectionKey);
    const entity = await pack.getEntity(entryId);
    entity.sheet.render(true);
  }

  /**
   * Handle a new drag event from the compendium, create a placeholder token for dropping the item
   * @private
   */
  _onDragStart(event) {
    const li = this,
          packName = li.getAttribute("data-collection"),
          pack = game.packs.find(p => p.collection === packName);

    // Get the pack
    if (!pack) {
      event.preventDefault();
      return false;
    }

    // Set the transfer data
    event.dataTransfer.setData("text/plain", JSON.stringify({
      type: pack.entity,
      pack: pack.collection,
      id: li.getAttribute("data-entry-id")
    }));
  }

  _toggleFilterVisibility(event) {
    event.preventDefault();
    const title = event.currentTarget;
    const content = $(title).siblings(".filter-content")[0];

    if (content.style.display === "none") content.style.display = "block";
    else content.style.display = "none";
  }

  _onFilterResults(event) {
    event.preventDefault();
    let input = event.currentTarget;

    // Define filtering function
    let filter = query => {
      this.filterQuery = query;
      this._filterResults();
    };

    // Filter if we are done entering keys
    let query = new RegExp(RegExp.escape(input.value), "i");
    if (this._filterTimeout) {
      clearTimeout(this._filterTimeout);
      this._filterTimeout = null;
    }
    this._filterTimeout = setTimeout(() => filter(query), 100);
  }

  _onActivateBooleanFilter(event) {
    event.preventDefault();
    let input = event.currentTarget;
    const path = input.closest(".filter").dataset.path;
    const key = input.name;
    const value = input.checked;

    if (value) {
      let index = this.activeFilters[path].indexOf(key);
      if (index < 0) this.activeFilters[path].push(key);
    }
    else {
      let index = this.activeFilters[path].indexOf(key);
      if (index >= 0) this.activeFilters[path].splice(index, 1);
    }

    this._filterResults();
  }

  _filterResults() {
    this.element.find("li.directory-item").each((a, li) => {
      const id = li.dataset.entryId;
      let item = this.items.find(i => i.item._id === id).item;
      li.style.display = this._passesFilters(item) ? "flex" : "none";
    });
  }

  _passesFilters(item) {
    if (!this.filterQuery.test(item.name)) return false;

    for (let [path, filter] of Object.entries(this.activeFilters)) {
      if (filter.length === 0) continue;

      // Handle special cases
      // Handle Spell Level
      if (this.type === "spells" && path === "_spellLevel") {
        const spellLevels = this.activeFilters[path];
        const checks = [
          { path: "learnedAt.class", type: "class" },
          { path: "learnedAt.domain", type: "domain" },
          { path: "learnedAt.subDomain", type: "subDomain" },
          { path: "learnedAt.elementalSchool", type: "elementalSchool" },
          { path: "learnedAt.bloodline", type: "bloodline" },
        ];
        for (let c of checks) {
          const f = this.activeFilters[c.path];
          if (!f || !f.length) continue;
          const p = getProperty(item, `learnedAt.spellLevel.${c.type}`);
          for (let fi of f) {
            if (!spellLevels.every(sl => p[fi] === parseInt(sl))) return false;
          }
        }
        if (!spellLevels.every(sl => item.allSpellLevels.includes(parseInt(sl)))) return false;
        continue;
      }

      // Handle the rest
      const prop = getProperty(item, path);
      if (prop == null) return false;
      if (prop instanceof Array) {
        if (!filter.every(o => prop.includes(o))) return false;
        continue;
      }
      if (!filter.includes(prop)) return false;
    }

    return true;
  }
}