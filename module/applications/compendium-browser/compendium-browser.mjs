import { naturalSort } from "@utils";
import { BaseFilter } from "./filters/base.mjs";
import fuzzysort from "fuzzysort";

/**
 * The basic compendium browser class allowing the browsing of compendiums by utilising their indexes.
 *
 * Extending classes must define the following static properties if the browser is not meant to browse Item documents: {@link documentName}.
 * Extending classes should define the following static properties: {@link typeName}, {@link filterClasses}.
 *
 * @abstract
 */
export class CompendiumBrowser extends Application {
  /**
   * The document name of entries this browser displays.
   *
   * @abstract
   * @type {"Actor" | "Item"}
   */
  static documentName = "Item";

  /**
   * A localisation string used in the browser's title.
   *
   * @abstract
   * @type {string}
   */
  static typeName;

  /**
   * An array of classes extending {@link BaseFilter} that should be used for this browser.
   *
   * @type {Array<typeof BaseFilter>}
   */
  static filterClasses = [];

  /**
   * The template used to render individual entries in the browser.
   *
   * @type {string}
   */
  static ENTRY_TEMPLATE = "systems/pf1/templates/apps/compendium-browser/entries.hbs";

  /**
   * A `Promise` that resolves once all pack indexes have been loaded.
   *
   * @internal
   * @type {Map<string, Promise<void>>}
   */
  static #indexingPromises = new Map();

  /**
   * The set of filters to apply to the compendium index.
   *
   * @type {Collection<BaseFilter>}
   */
  filters = new foundry.utils.Collection();

  /**
   * The types of entries this browser handles, as per a document's `type` property.
   *
   * @type {Set<string>}
   */
  handledTypes = new Set();

  /**
   * Compendium packs this browser gets entries from.
   *
   * @type {CompendiumCollection[]}
   */
  packs = [];

  /**
   * A set of filters that were expanded by the user, and should stay expanded upon re-render.
   *
   * @type {Set<string>}
   */
  expandedFilters = new Set();

  /**
   * The {@link Collection} of index entries this browser is aware of.
   *
   * @readonly
   * @type {Collection<IndexEntry>}
   */
  entries;

  /**
   * The current search query entered by the user.
   *
   * @private
   * @type {string}
   */
  _query = "";

  /**
   * An object containing data used to render the loading spinner and related text.
   *
   * @private
   * @type {object | null}
   */
  _loadingInfo = null;

  /**
   * Whether the browser and its data have been set up using {@link CompendiumBrowser.setup}.
   *
   * @private
   * @internal
   * @type {boolean}
   */
  #setup = false;

  constructor(options = {}) {
    super(options);
    /**
     * All index entries this compendium browser is aware of.
     *
     * @type {Collection<object>}
     */
    Object.defineProperty(this, "entries", { value: new Collection() });
    this.initialize();
    this._debouncedRender = foundry.utils.debounce(this.render, 300);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      template: "systems/pf1/templates/apps/compendium-browser/compendium-browser.hbs",
      classes: ["pf1", "app"],
      id: `pf1-compendium-browser-${this.name}`,
      width: 800,
      height: window.innerHeight - 60,
      top: 30,
      left: 40,
      resizable: true,
      scrollY: [".filter-container"],
      dragDrop: [{ dragSelector: ".directory-item", dropSelector: null }],
    });
  }

  /**
   * Initialize all {@link CompendiumBrowser}s found in {@link pf1.applications.compendiumBrowser}
   * and register them in {@link pf1.applications.compendiums}.
   */
  static initializeBrowsers() {
    const compendiums = pf1.applications.compendiums;
    const compendiumClasses = pf1.applications.compendiumBrowser;
    compendiums.items = new compendiumClasses.ItemBrowser();
    compendiums.feats = new compendiumClasses.FeatBrowser();
    compendiums.spells = new compendiumClasses.SpellBrowser();
    compendiums.classes = new compendiumClasses.ClassBrowser();
    compendiums.races = new compendiumClasses.RaceBrowser();
    compendiums.bestiary = new compendiumClasses.CreatureBrowser();
    compendiums.buffs = new compendiumClasses.BuffBrowser();
  }

  /**
   * Request indexes of all packs of a document type to be loaded.
   * This method should only ever be called as {@link CompendiumBrowser.getIndexes} to ensure Promises are properly bundled.
   *
   * @param {string[]} packNames - The names of the packs to load indexes for
   * @see {@link CompendiumBrowser.#indexingPromise}
   * @returns {Promise<void>} A `Promise` that resolves once all indexes have been loaded
   */
  static getIndexes(packNames = []) {
    const packs = packNames.map((name) => game.packs.get(name));
    const resultPromise = [];
    for (const pack of packs) {
      if (!this.#indexingPromises.has(pack.collection)) {
        this.#indexingPromises.set(pack.collection, pack.getIndex());
      }
      resultPromise.push(this.#indexingPromises.get(pack.collection));
    }
    return Promise.all(resultPromise).finally(() => {
      for (const pack of packs) {
        this.#indexingPromises.delete(pack.collection);
      }
    });
  }

  /**
   * Map an entry from a compendium to the format used by the browser.
   *
   * @param {object} entry - The entry to map
   * @param {CompendiumCollection} pack - The compendium the entry is from
   * @returns {IndexEntry} The mapped entry
   */
  static _mapEntry(entry, pack) {
    // NOTE: This decouples the entry from the compendium; it will no longer be refreshed automatically, but changes will stick
    const result = foundry.utils.deepClone(entry);
    // Add default `system` data for the entry's type, as pruned compendium data omits default values
    result.system = mergeObject(game.model[this.documentName][entry.type], result.system, { inplace: false });
    // Add `pack` related fields to allow filtering by pack and label display
    result.__pack = pack.collection;
    result.__packLabel = pack.metadata.label;

    result.__uuid =
      game.release.generation >= 11 ? pack.getUuid(entry._id) : `Compendium.${pack.collection}.${entry._id}`;
    // Prepare `__name` field for fuzzy search optimisation
    result.__name = fuzzysort.prepare(entry.name.normalize("NFKD"));
    return result;
  }

  /**
   * Renders an array of {@link IndexEntry} objects into HTML.
   *
   * @private
   * @param {IndexEntry[]} entries - The entries to render
   * @returns {Promise<string>} The rendered HTML
   */
  static async _renderEntries(entries) {
    return renderTemplate(this.ENTRY_TEMPLATE, { entries });
  }

  /** @inheritDoc */
  get title() {
    return game.i18n.format("PF1.CompendiumBrowserTitle", { type: game.i18n.localize(this.constructor.typeName) });
  }

  /**
   * Perform minimal preparation steps to initialize the compendium browser.
   * Add filters and determine which compendiums include data relevant to this browser.
   *
   * @protected
   */
  initialize() {
    this.filters?.clear();
    for (const cls of this.constructor.filterClasses) {
      if (!(cls.prototype instanceof BaseFilter)) {
        throw new Error(`Filter class ${cls.name} does not extend BaseFilter`);
      }
      const filter = new cls(this);
      this.filters.set(filter.id, filter);
      // Add all types handled by that filter to the browser's list of handled types
      cls.handledTypes.forEach((type) => this.handledTypes.add(type));
    }
    this.packs = game.packs.filter((pack) => this.isPackIncluded(pack));
    this._loadingInfo = {
      indexCount: this.packs.length,
      entryCount: this.packs.reduce(
        (acc, pack) => acc + pack.index.contents.filter((entry) => this.handledTypes.has(entry.type)).length,
        0
      ),
    };
  }

  /**
   * Check whether a compendium should be included in the browser.
   *
   * @param {CompendiumCollection} pack - The compendium to test
   * @returns {boolean} Whether the compendium should be included
   */
  isPackIncluded(pack) {
    // Only include enabled packs with the right document type made for PF1
    if (pack.config.pf1?.disabled) return false;
    if (pack.documentName !== this.constructor.documentName) return false;
    if (pack.metadata.system !== game.system.id) return false;

    // Skip if set to private and the user is not a GM
    if (pack.private && !game.user.isGM) return false;

    // Avoid unnecessarily adding packs that don't contain any relevant entries
    if (pack.index.contents.filter((entry) => this.handledTypes.has(entry.type)).length === 0) return false;

    // Don't skip the compendium
    return true;
  }

  /**
   * Perform the initial setup of the compendium browser.
   * This includes requesting the index of all relevant compendiums if necessary and preparing the filters.
   *
   * @returns {Promise<void>}
   */
  async setup() {
    this.#setup = false;
    this.entries?.clear();
    await CompendiumBrowser.getIndexes(this.packs.map((pack) => pack.collection));
    const unorderedEntries = await Promise.all(this.packs.map((pack) => this.loadPackIndex(pack)));
    naturalSort(unorderedEntries.flat(), "name").forEach((entry) => this.entries.set(`${entry.__uuid}`, entry));
    this.filters.forEach((filter) => filter.setup());
    this.#setup = true;
  }

  /**
   * Load a compendium's index to prepare it for browsing.
   *
   * @param {CompendiumCollection} pack - The compendium to load
   * @returns {Promise<IndexEntry[]>} The loaded index entries
   */
  async loadPackIndex(pack) {
    if (pack.indexed === false) await CompendiumBrowser.getIndexes(pack.collection);
    const index = pack.index;
    return index
      .filter((entry) => this.handledTypes.has(entry.type))
      .map((entry) => {
        try {
          return this.constructor._mapEntry(entry, pack);
        } catch (err) {
          Hooks.onError(`CompendiumBrowser#_mapEntry`, err, {
            msg: `${this.constructor.name} failed to map entry ${entry.name} [${entry._id}] from pack ${pack.collection}`,
            log: "error",
            entry,
            pack,
          });
          return null;
        }
      })
      .filter((entry) => entry !== null);
  }

  /**
   * Get the current set of entries allowed by the filters.
   *
   * @returns {IndexEntry[]} The filtered entries
   */
  getFilteredEntries() {
    let entries = this.entries.contents;

    const activeFilters = this.filters.filter((filter) => filter.active);
    if (activeFilters.length)
      entries = entries.filter((entry) => activeFilters.every((filter) => filter.applyFilter(entry)));

    if (this._query) {
      const collator = new Intl.Collator(game.settings.get("core", "language"), {
        numeric: true,
        ignorePunctuation: true,
      });
      entries = fuzzysort
        .go(this._query.normalize("NFKD"), entries, { key: "__name", threshold: -10000 })
        .sort((a, b) => {
          // Sort by score first, then alphabetically by name
          if (a.score !== b.score) return b.score - a.score;
          else return collator.compare(a.obj.name, b.obj.name);
        })
        .map((match) => match.obj);
    }

    return entries;
  }

  /** @inheritdoc */
  async _render(force, options) {
    // Identify the focused element
    const focus = this.element?.[0]?.querySelector(":focus");
    const selectionStart = focus?.selectionStart;

    // Render the application and restore focus
    await super._render(force, options);
    if (focus && focus.name) {
      const input = this._element[0].querySelector(`[name="${focus.name}"]`);
      if (input && input.focus instanceof Function) {
        input.focus();
        if (selectionStart) input.selectionStart = input.selectionEnd = selectionStart;
      }
    }
  }

  /** @inheritDoc */
  async getData(...args) {
    const context = await super.getData(...args);
    context.id = args[0]?.id;
    context.query = this._query ?? "";
    context.filters = this.filters
      .filter((filter) => filter.hasChoices())
      .map((filter) => ({
        ...filter.getData(),
        collapsed: this.expandedFilters.has(filter.id) ? "" : "collapsed",
      }));

    if (this.#setup) {
      // Browser is set up, so we can render the entries
      this._entries = this.getFilteredEntries();
      context.entries = this._entries.slice(0, 100);
      context.itemCount = this.entries.size;
      context.filteredItemCount = this._entries.length;
    } else {
      // Browser is not set up, display a loading spinner
      context.loading = true;
      context.loadingInfo = this._loadingInfo;
    }
    return context;
  }

  /** @inheritDoc */
  activateListeners(html) {
    super.activateListeners(html);
    /** @type {HTMLElement} */
    const el = html[0];

    // If the browser is not set up yet, start the process and render again once it is done
    if (!this.#setup) {
      this.setup().then(() => this.render());
      // No listeners have to be activated yet, so we can return here
      return;
    }

    this._initLazyScrolling(el);

    // Activate listeners for filters, allowing them to define their own
    el.querySelectorAll(".filter-content").forEach((filterContent) => {
      const filter = this.filters.get(filterContent.closest(".filter").dataset.filterId);
      filter.activateListeners(filterContent);
    });

    el.querySelector(".directory-list").addEventListener("click", (event) => {
      this._onClickEntry(event);
    });

    el.querySelector("button.refresh").addEventListener("click", (event) => {
      this._onRefresh(event);
    });

    el.querySelector("button.reset").addEventListener("click", (event) => {
      this._onResetFilters(event);
    });

    el.querySelectorAll(".filter>h3").forEach((header) => {
      header.addEventListener("click", (event) => {
        this._onFilterHeaderClick(event);
      });
    });

    el.querySelector("input[name=filter]")?.addEventListener("input", (event) => {
      this._onCustomSearchFilter(event);
    });

    ContextMenu.create(this, html, ".directory-item", this._getEntryContextOptions());
  }

  /**
   * Store the current search filter query and re-render the application.
   *
   * @private
   * @param {Event} event - The originating change event
   */
  _onCustomSearchFilter(event) {
    event.preventDefault();
    this._query = event.target.value;
    this._debouncedRender();
  }

  /**
   * Handle a click on an entry in the compendium browser.
   *
   * @private
   * @param {Event} event - The originating click Event
   */
  async _onClickEntry(event) {
    const li = event.target.closest(".directory-item");
    if (!li) return;
    const { uuid } = li.dataset;
    const document = await fromUuid(uuid);
    const collection = game.packs.get(document.pack);
    return document.sheet.render(true, { editable: game.user.isGM && !collection.locked, focus: true });
  }

  /**
   * Get the set of ContextMenu options which should be used for the compendium browser's entries.
   *
   * @protected
   * @returns {object[]} - The Array of ContextMenu options
   */
  _getEntryContextOptions() {
    return [
      {
        name: "COMPENDIUM.ImportEntry",
        icon: '<i class="fas fa-download"></i>',
        condition: () => getDocumentClass(this.constructor.documentName).canUserCreate(game.user),
        callback: async (li) => {
          const collection = game.collections.get(this.constructor.documentName);
          const uuid = li.data("uuid");
          const entry = this.entries.get(uuid);
          return collection.importFromCompendium(game.packs.get(entry.__pack), entry._id, {}, { renderSheet: true });
        },
      },
      {
        name: "PF1.CopyUuidToClipboard",
        icon: '<i class="fas fa-id-badge"></i>',
        callback: (li) => {
          const uuid = li.data("uuid");
          game.clipboard.copyPlainText(uuid);
          const label = game.i18n.localize(getDocumentClass(this.constructor.documentName).metadata.label);
          ui.notifications.info(game.i18n.format("DOCUMENT.IdCopiedClipboard", { label, type: "uuid", id: uuid }));
        },
      },
    ];
  }

  /** @inheritDoc */
  _canDragStart(selector) {
    return true;
  }

  /** @inheritDoc */
  _onDragStart(event) {
    const { uuid } = event.currentTarget.dataset;
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: this.constructor.documentName,
        uuid: uuid,
      })
    );
  }

  /**
   * Handle a click on the reset filters button, resetting all filters to their default state.
   *
   * @private
   * @param {Event} _event - The originating click event
   */
  _onResetFilters(_event) {
    for (const filter of this.filters) {
      filter.reset();
    }
    this._query = "";
    this.expandedFilters.clear();
    this.render();
  }

  /**
   * Handle a click on the refresh button, re-running the setup process,
   * and re-rendering the compendium browser afterwards.
   *
   * @private
   * @param {Event} _event - The originating click event
   */
  async _onRefresh(_event) {
    this.#setup = false;
    this.initialize();
    this.render();
  }

  /**
   * Handle a click on a filter's title to collapse or expand it.
   *
   * @private
   * @param {Event} event - The originating click event
   */
  _onFilterHeaderClick(event) {
    const { filterId } = event.target.closest(".filter").dataset;
    const filterContents = event.target.closest(".filter").querySelector(".filter-content");
    if (this.expandedFilters.has(filterId)) {
      this.expandedFilters.delete(filterId);
      filterContents.classList.add("collapsed");
    } else {
      this.expandedFilters.add(filterId);
      filterContents.classList.remove("collapsed");
    }
  }

  /**
   * Initializes lazy loading of entries so that they are only rendered when close-ish to being visible.
   *
   * @private
   * @param {HTMLElement} html - The HTML element to initialize lazy loading for
   */
  _initLazyScrolling(html) {
    const listEnd = html.querySelector(".directory-bottom");
    if (listEnd) {
      new IntersectionObserver(
        async ([entry], observer) => {
          if (entry.isIntersecting) {
            // Append more entries to the list
            const currentCount = html.querySelectorAll(".directory-item").length;
            const newEntries = this._entries.slice(currentCount, currentCount + 50);
            if (newEntries.length === 0) {
              // No more entries to load with current filters
              observer.unobserve(listEnd);
            } else {
              const newHtml = await this.constructor._renderEntries(newEntries);
              listEnd.insertAdjacentHTML("beforebegin", newHtml);
              this._dragDrop[0].bind(html);
            }
          }
        },
        { root: html.querySelector(".directory-list"), rootMargin: "300px" }
      ).observe(listEnd);
    }
  }
}

/**
 * @typedef {object} IndexEntry
 * @property {string} _id - The entry's ID
 * @property {string} name - The entry's name
 * @property {string} type - The entry's type
 * @property {string} img - The entry's image
 * @property {string} __pack - The {@link CompendiumCollection} this entry is from
 * @property {string} __packLabel - The label of the {@link CompendiumCollection} this entry is from
 * @property {string} __uuid - The UUID of this entry
 */
