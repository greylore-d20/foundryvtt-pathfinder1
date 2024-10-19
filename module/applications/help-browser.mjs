const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * An {@link Application} displaying documentation for the Pathfinder 1e system within Foundry.
 *
 * @augments Application
 */
export class HelpBrowserPF extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "pf1-help-browser",
    classes: ["pf1-v2", "help-browser"],
    window: {
      title: "PF1.Help.Label",
      minimizable: false,
      resizable: true,
    },
    position: {
      width: 620,
      height: 600,
    },
    actions: {
      forward: HelpBrowserPF._forwardInHistory,
      back: HelpBrowserPF._backInHistory,
      home: HelpBrowserPF._home,
    },
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/help-browser.hbs",
    },
  };

  /**
   * @type {HistoryEntry[]}
   * @private
   */
  _backwardHistory = [];

  /**
   * @type {HistoryEntry[]}
   * @private
   */
  _forwardHistory = [];

  /**
   * The currently shown entry.
   *
   * @type {HistoryEntry}
   * @private
   */
  _currentPage = { url: "Help/Home" };

  /**
   * The Markdown converter for this application.
   *
   * @type {showdown.Converter}
   * @private
   */
  #converter;

  /** @inheritdoc */
  constructor(options = {}) {
    super(options);

    this.#converter = new showdown.Converter({
      extensions: [HelpBrowserPF.defaultExtensions],
      noHeaderId: false,
      ghCompatibleHeaderId: true,
      prefixHeaderId: "pf1-help-browser-",
    });
  }

  /* -------------------------------------------- */

  /**
   * The URL of the page currently displayed
   *
   * @type {string}
   */
  get currentUrl() {
    return this._currentPage.url;
  }

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    return {
      hasHistoryBack: this._backwardHistory.length > 0,
      hasHistoryForward: this._forwardHistory.length > 0,
      // Get markdown string from localisation, and parse it
      pageContent: this.#converter.makeHtml(game.i18n.localize(`PF1.${this.currentUrl}`)),
      url: this.currentUrl.slugify({ strict: true }),
    };
  }

  /* -------------------------------------------- */

  /**
   * Opens a specific page in the help browser.
   *
   * @param {string} url - The help URL to open
   */
  openUrl(url) {
    // Remove leading `/`, which are okay in the wiki, but not present in localisation files
    if (url.startsWith("/")) url = url.slice(1);
    let header;
    // Extract header from URL
    [url, header] = url.split("#");
    if (this.currentUrl && url !== this.currentUrl) {
      // Add new page to history
      this._backwardHistory.push(this.getCurrentHistoryObject());
      this._forwardHistory.splice(0, this._forwardHistory.length);
    }
    this._currentPage = { url };
    this.render(true, { header: header });
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async _render(force, options) {
    await super._render(force, options);
    const contentElement = this.element.querySelector(".content");

    if (this._currentPage.scrollTop) {
      // Dirty timeout to wait for loading of images with unknown height
      setTimeout(() => {
        contentElement.scrollTop = this._currentPage.scrollTop;
      }, 0);
    } else if (options.header) {
      const headerElement = document.getElementById(`pf1-help-browser-${options.header}`);
      if (headerElement) {
        setTimeout(() => {
          headerElement.scrollIntoView({ block: "start" });
        }, 0);
      }
    }
  }

  /* -------------------------------------------- */

  /**
   * Returns a {@link HistoryEntry} containing a snapshot of the currently rendered state.
   *
   * @returns {HistoryEntry} The current state
   */
  getCurrentHistoryObject() {
    const elem = this.element.querySelector(".content");
    const scrollTop = elem?.scrollTop ?? 0;
    return {
      url: this.currentUrl,
      scrollTop: scrollTop,
    };
  }

  /* -------------------------------------------- */

  /** Go back one page in history. */
  static _backInHistory() {
    if (!this._backwardHistory.length) return;
    this._forwardHistory.push(this.getCurrentHistoryObject());
    this._currentPage = this._backwardHistory.pop();
    this.render();
  }

  /* -------------------------------------------- */

  /** Go forward one page in history. */
  static _forwardInHistory() {
    if (!this._forwardHistory.length) return;
    this._backwardHistory.push(this.getCurrentHistoryObject());
    this._currentPage = this._forwardHistory.pop();
    this.render();
  }

  /* -------------------------------------------- */

  static _home() {
    this.openUrl("Help/Home");
  }

  /* -------------------------------------------- */

  /**
   * Attach event listeners to the rendered application form.
   *
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */
  _onRender(context, options) {
    // Remove href attributes to avoid actual browser page changes
    const links = this.element.querySelectorAll("a[href]");
    for (const l of links) {
      const href = l.getAttribute("href");
      if (!href.startsWith("Help")) {
        l.addEventListener("contextmenu", (event) => {
          event.stopImmediatePropagation();
        });
        continue;
      }
      l.removeAttribute("href");
      // Store target in dataset
      l.dataset.url = href;

      l.addEventListener("click", (event) => {
        event.preventDefault();
        this.openUrl(href);
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Extensions for the Markdown converter used by the help browser.
   *
   * @type {showdown.ShowdownExtension[]}
   */
  static get defaultExtensions() {
    return [
      // Replace image paths from the wiki with localised paths available in the current Foundry context
      {
        type: "output",
        regex: /<img.*?src="(.+?)".*?>/g,
        replace: function (match, src, _offset, _string) {
          const foundrySrc = game.i18n.localize(`PF1.${src.startsWith("/") ? src.slice(1) : src}`);
          return match.replace(src, foundry.utils.getRoute(`systems/pf1/${foundrySrc}`));
        },
      },
    ];
  }
}

/**
 * The singleton instance of the {@link HelpBrowserPF} available at runtime.
 */
export const helpBrowser = new HelpBrowserPF();

/**
 * @typedef {object} HistoryEntry
 * @property {string} url - URL of this history entry
 * @property {number} [scrollTop] - Scroll position of this history entry
 */
