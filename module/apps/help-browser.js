import MarkdownIt from "markdown-it";
import Renderer from "markdown-it/lib/renderer";
import MarkDownItAnchor from "markdown-it-anchor";

/**
 * @typedef {object} HistoryEntry
 * @property {string} url - URL of this history entry
 * @property {number} [scrollTop] - Scroll position of this history entry
 */

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
  _currentPage = { url: "" };

  /**
   * The markdown parser instance for this application.
   *
   * @type {MarkdownIt}
   * @private
   */
  _md;

  /** @inheritdoc */
  constructor(...args) {
    super(...args);
    this._initMarkdown();
    return this;
  }

  /** @inheritdoc */
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
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

  /**
   * Initialzes this help browser's {@link MarkdownIt} instance, adjusting rules as necessary.
   *
   * @private
   */
  _initMarkdown() {
    const md = new MarkdownIt().use(MarkDownItAnchor, {
      tabIndex: false,
      slugify: (url) => `pf1-help-browser.${url.slugify()}`,
    });
    const defaultImageRenderRule = md.renderer.rules.image;
    md.renderer.rules.image = pf1HelpImageRenderer(defaultImageRenderRule);
    this._md = md;
  }

  /** @override */
  async getData() {
    const data = await super.getData();

    // Nav element only needs to get rendered once
    this.nav ??= this._md.render(game.i18n.localize("PF1.Help/Home"));

    data.hasHistoryBack = this._backwardHistory.length > 0;
    data.hasHistoryForward = this._forwardHistory.length > 0;
    data.nav = this.nav;

    // Get markdown string from localisation, and parse it
    data.pageContent = this._md.render(game.i18n.localize(`PF1.${this.currentUrl}`));

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
    let header = "";
    // Extract header from URL
    [url, header] = url.split("#");
    if (this.currentUrl && url !== this.currentUrl) {
      // Add new page to history
      this._backwardHistory.push(this.getCurrentHistoryObject());
      this._forwardHistory.splice(0, this._forwardHistory.length);
    }
    this._currentPage = { url };
    this.render({ header: header });
  }

  /** @inheritdoc */
  async _render(options) {
    await super._render(options);
    const contentElement = this.element.find(".content")[0];

    if (this._currentPage.scrollTop) {
      // Dirty timeout to wait for loading of images with unknown height
      setTimeout(() => {
        contentElement.scrollTop = this._currentPage.scrollTop;
      }, 0);
    } else if (options.header) {
      const headerElement = document.getElementById(`pf1-help-browser.${options.header}`);
      if (headerElement) {
        setTimeout(() => {
          const emHeight = Number.parseFloat(getComputedStyle(headerElement).fontSize);
          contentElement.scrollTop = headerElement.offsetTop - (45 + 1.5 * emHeight);
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
    const historyObject = {
      url: this.currentUrl,
      scrollTop: scrollTop,
    };
    return historyObject;
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
  }
}

/** @type {(defaultRenderer: Renderer.RenderRule) => Renderer.RenderRule} */
const pf1HelpImageRenderer = (defaultRenderer) => (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  let src = token.attrGet("src");
  if (src.startsWith("/")) src = src.slice(1);
  const foundrySrc = game.i18n.localize(`PF1.${src}`);
  token.attrSet("src", foundry.utils.getRoute(`systems/pf1/${foundrySrc}`));
  return defaultRenderer(tokens, idx, options, env, self);
};
