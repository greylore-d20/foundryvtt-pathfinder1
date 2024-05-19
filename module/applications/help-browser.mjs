/**
 * An {@link Application} displaying documentation for the Pathfinder 1e system within Foundry.
 *
 * @augments Application
 */
export class HelpBrowserPF extends Application {
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
  constructor(...args) {
    super(...args);

    this.#converter = new showdown.Converter({
      extensions: [HelpBrowserPF.defaultExtensions],
      noHeaderId: false,
      ghCompatibleHeaderId: true,
      prefixHeaderId: "pf1-help-browser-",
    });
  }

  /** @inheritdoc */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["pf1", "help-browser"],
      template: "systems/pf1/templates/apps/help-browser.hbs",
      minWidth: 800,
      minHeight: 450,
      width: 960,
      height: 600,
      resizable: true,
      id: "pf1-help-browser",
    });
  }

  /** @inheritdoc */
  get title() {
    return game.i18n.localize("PF1.Help.Label");
  }

  /**
   * The URL of the page currently displayed
   *
   * @type {string}
   */
  get currentUrl() {
    return this._currentPage.url;
  }

  /** @override */
  async getData() {
    const data = await super.getData();

    data.hasHistoryBack = this._backwardHistory.length > 0;
    data.hasHistoryForward = this._forwardHistory.length > 0;

    // Get markdown string from localisation, and parse it
    data.pageContent = this.#converter.makeHtml(game.i18n.localize(`PF1.${this.currentUrl}`));
    data.isHome = this.currentUrl === "Help/Home";

    return data;
  }

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

  /** @inheritdoc */
  async _render(force, options) {
    await super._render(force, options);
    const contentElement = this.element.find(".content")[0];

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

  /**
   * Returns a {@link HistoryEntry} containing a snapshot of the currently rendered state.
   *
   * @returns {HistoryEntry} The current state
   */
  getCurrentHistoryObject() {
    const elem = this.element.find(".content")[0];
    const scrollTop = elem?.scrollTop ?? 0;
    return {
      url: this.currentUrl,
      scrollTop: scrollTop,
    };
  }

  /** Go back one page in history. */
  backInHistory() {
    if (!this._backwardHistory.length) return;
    this._forwardHistory.push(this.getCurrentHistoryObject());
    this._currentPage = this._backwardHistory.pop();
    this.render();
  }

  /** Go forward one page in history. */
  forwardInHistory() {
    if (!this._forwardHistory.length) return;
    this._backwardHistory.push(this.getCurrentHistoryObject());
    this._currentPage = this._forwardHistory.pop();
    this.render();
  }

  /** @param {JQuery<HTMLElement>} html - This application's HTML element */
  activateListeners(html) {
    // Remove href attributes to avoid actual browser page changes
    const links = html.find("a[href]");
    for (const l of links) {
      const href = l.getAttribute("href");
      l.removeAttribute("href");
      // Store target in dataset
      l.dataset.url = href;
    }
    html.on("click", "a", (event) => {
      event.preventDefault();
      const url = event.currentTarget.dataset.url;
      if (url) this.openUrl(url);
    });

    // History buttons
    html.find(".history-back").on("click", this.backInHistory.bind(this));
    html.find(".history-forward").on("click", this.forwardInHistory.bind(this));
    html.find(".history-home").on("click", () => this.openUrl("Help/Home"));
  }

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
      // Replace `::: <block>` with `<div class="<block>">` and `:::` with `</div>
      {
        type: "output",
        regex: /<p>:::(\s\w+)?<\/p>/g,
        replace: function (_match, blockName, _offset, _string) {
          if (blockName) return `<div class="${blockName.slugify()}">`;
          else return "</div>";
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
