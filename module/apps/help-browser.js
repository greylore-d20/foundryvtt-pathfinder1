import MarkdownIt from "markdown-it";
import Renderer from "markdown-it/lib/renderer";

/**
 * An {@link Application} displaying documentation for the Pathfinder 1e system within Foundry.
 *
 * @augments Application
 */
export class Pf1HelpBrowser extends Application {
  /**
   * Maximum number of pages to track in history.
   *
   * @type {number}
   */
  maxHistory = 20;

  /**
   * History list.
   *
   * @type {Array.<{url: string; scrollTop: number}>}
   * @private
   */
  _history = [];

  /**
   * The current index in history.
   *
   * @type {number}
   * @private
   */
  _historyIndex = 0;

  /**
   * The currently shown entry.
   *
   * @type {string}
   * @private
   */
  _currentUrl = "";

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
   * Returns the current entry as per the application's {@link Pf1HelpBrowser#_historyIndex}.
   *
   * @type {string}
   */
  get currentUrl() {
    return this._history[this._historyIndex].url;
  }

  /**
   * Initialzes this help browser's {@link MarkdownIt} instance, adjusting rules as necessary.
   *
   * @private
   */
  _initMarkdown() {
    const md = new MarkdownIt();
    const defaultImageRenderRule = md.renderer.rules.image;
    md.renderer.rules.image = pf1HelpImageRenderer(defaultImageRenderRule);
    this._md = md;
  }

  /** @override */
  async getData() {
    const data = await super.getData();

    // Nav element only needs to get rendered once
    this.nav ??= this._md.render(game.i18n.localize("PF1.Help/Home"));

    data.hasHistoryBack = this._history.length > this._historyIndex + 1;
    data.hasHistoryForward = this._historyIndex > 0;
    data.nav = this.nav;

    // Get markdown string from localisation, and parse it
    data.pageContent = this._md.render(game.i18n.localize(`PF1.${this._currentUrl}`));

    return data;
  }

  /**
   * Opens a specific page in the help browser.
   *
   * @param {string} url - The help URL to open
   * @param {object} [options] - Additional options
   * @param {boolean} [options.addToHistory=true] - Whether this page should be added to history
   * @param {string} [options.header=""] - Which header the page should scroll to
   */
  openUrl(url, { addToHistory = true, header = "" } = {}) {
    if (url.startsWith("/")) url = url.slice(1);
    if (url !== this._currentUrl) {
      // Add new page to history
      if (addToHistory) {
        this.addHistory(url);
        this._historyIndex = 0;
      }
    }
    this._currentUrl = url;
    this.render({ header: header });
  }

  /** @inheritdoc */
  async _render(options) {
    await super._render(options);

    if (options.header) {
      this.element.find(".content")[0].scrollTop = this.element?.find(`.${options.header}`)[0]?.offsetTop || 0;
    }
  }

  /**
   * Adds a history URL and scroll position to the history list.
   *
   * @param {string} url - The URL to add.
   */
  addHistory(url) {
    const elem = this.element.find(".content")[0];
    const scrollTop = elem?.scrollTop ?? 0;
    const historyObject = {
      url: url,
      scrollTop: scrollTop,
    };

    this._history = this._history.slice(this._historyIndex);

    this._history.unshift(historyObject);
    if (this._history.length > this.maxHistory) {
      this._history.splice(20, this._history.length - this.maxHistory);
    }
  }

  /**
   * Go to a specific history index, rerendering the content.
   *
   * @param {number} index - The specific index in history to go to. Larger values are further down history.
   */
  async goToHistory(index) {
    if (this._history[this._historyIndex]) {
      const elem = this.element.find(".content")[0];
      this._history[this._historyIndex].scrollTop = elem ? elem.scrollTop : 0;
    }

    this._historyIndex = index;
    this.openUrl(this.currentUrl, { addToHistory: false });

    window.setTimeout(() => {
      this.element.find(".content")[0].scrollTop = this._history[index].scrollTop || 0;
    }, 25);
  }

  /** Go back one page in history. */
  backInHistory() {
    if (this._historyIndex < this.maxHistory) {
      this.goToHistory(this._historyIndex + 1);
    }
  }

  /** Go forward one page in history. */
  forwardInHistory() {
    if (this._historyIndex > 0) {
      this.goToHistory(this._historyIndex - 1);
    }
  }

  /** @inheritdoc */
  activateListeners(html) {
    // Translate links
    {
      const links = html.find("a[href]");
      for (const l of links) {
        const href = l.getAttribute("href");
        l.removeAttribute("href");
        l.addEventListener("click", () => {
          const header = l.dataset?.header || "";
          this.openUrl(href, { header: header });
        });
      }
    }

    // History buttons
    html.find(".history-back").click(this.backInHistory.bind(this));
    html.find(".history-forward").click(this.forwardInHistory.bind(this));
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
