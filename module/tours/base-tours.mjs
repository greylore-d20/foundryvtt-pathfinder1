export class PF1Tour extends Tour {
  calledAsPreviousStep = false;
  calledAsExit = false;
  calledAsReset = false;

  /**
   * @returns {TourStep} The previous step.
   */
  get previousStep() {
    return this.hasPrevious ? this.steps[this.stepIndex - 1] : undefined;
  }

  /**
   * Gets the current sheet based on if it's displayed or not.
   * WARNING: This won't work if the actor sheet is not displayed or there are multiple actor sheets open at once.
   *
   * @returns {import("@app/actor/actor-sheet.mjs").ActorSheetPF | null} The current actor sheet if found.
   */
  get sheetInDisplay() {
    // We need to Actor ID to find the sheet. The actor ID is in the ID of the sheet element but needs some formatting
    const sheetAppID = document.querySelector("div.sheet.pf1.actor")?.getAttribute("data-appid");
    if (!sheetAppID) return null;
    return ui.windows[sheetAppID];
  }

  /**
   * In case you need to wait for the actor sheet to be displayed.
   * WARNING: This blocks the code until the actor sheet is displayed.
   *
   * @returns {Promise<import("@app/actor/actor-sheet.mjs").ActorSheetPF | null>} The current actor sheet if found.
   */
  async waitForSheetInDisplay() {
    const sheetSelector = "div.sheet.pf1.actor";
    await this.waitForElement(sheetSelector);
    return this.sheetInDisplay;
  }

  /**
   * Given the ID of a step, returns the step from the steps array.
   *
   * @param {string} id The ID of the step.
   * @returns {TourStep | undefined} The step with the given ID.
   */
  getStepById(id) {
    return this.steps.find((step) => step.id === id);
  }

  /**
   * Given the ID of a step, returns the step index associated with it.
   *
   * @param {string} id The ID of the step.
   * @returns {number} The step index with the given ID (-1 if not found).
   */
  getStepIndexById(id) {
    return this.steps.findIndex((step) => step.id === id);
  }

  /**
   * In many steps we might need an specific compendium to be opened to continue.
   *
   * @param {string} compendium The compendium to open.
   * @see {@link pf1.applications.compendiumBrowser.CompendiumBrowser.initializeBrowsers}
   * @returns {Application} The opened compendium.
   */
  _openCompendium(compendium) {
    if (!Object.prototype.hasOwnProperty.call(pf1.applications.compendiums, compendium)) {
      throw new Error(`Compendium "${compendium}" not found`);
    }
    // Open compendium
    return pf1.applications.compendiums[compendium].render(true, { focus: true });
  }

  /**
   * This log functions outputs the given text to the console with Tour ID in the log message.
   *
   * @param {string} text The text to log.
   * @param {"log"|"debug"|"warn"} loglevel The log level to use.
   * @param {...any} args Extra arguments to pass to {@link console.info}.
   */
  _log(text, loglevel = "log", ...args) {
    console[loglevel](`[Tour Step "%s.%s.%s"]: ${text}`, ...[this.namespace, this.id, this.currentStep?.id, ...args]);
  }

  /**
   * @param {string} text The text to log.
   * @param  {...any} args Extra arguments to pass to {@link console.info}.
   * @see {@link _log}
   */
  _debug(text, ...args) {
    this._log(text, "debug", ...args);
  }

  /**
   * @param {string} text The text to log.
   * @param  {...any} args Extra arguments to pass to {@link console.info}.
   * @see {@link _log}
   */
  _warn(text, ...args) {
    this._log(text, "warn", ...args);
  }

  /**
   * Foundry Tours do not wait for the element to be rendered so we need this workaround.
   *
   * @param {string} selector CSS selector of the element to wait for
   * @returns {Promise<HTMLElement>} The awaited element.
   */
  async waitForElement(selector) {
    return new Promise((resolve, reject) => {
      // If the document is there don't need to worry
      if (document.querySelector(selector)) {
        return resolve(document.querySelector(selector));
      }

      // See https://developer.mozilla.org/docs/Web/API/MutationObserver
      const observer = new MutationObserver((mutations) => {
        if (document.querySelector(selector)) {
          observer.disconnect();
          resolve(document.querySelector(selector));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }

  /**
   * Triggering a typing event in an input field.
   *
   * @param {string} selector The CSS selector for the search bar.
   * @param {string} text Text to type in the search bar.
   */
  async _typeInInputField(selector, text) {
    /** @type {HTMLInputElement} */
    const searchBar = await this.waitForElement(selector);
    searchBar.value = text;
    searchBar.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /** @override */
  async _preStep() {
    // We will always want `this.targetElement` to be there
    await this.waitForElement(this.currentStep?.selector);
    await super._preStep();
  }

  /** @override */
  async _postStep() {
    await super._postStep();
    this.calledAsReset = false;
  }

  /** @override */
  async previous() {
    this.calledAsPreviousStep = true;
    await super.previous();
  }

  /** @override */
  async next() {
    this.calledAsPreviousStep = false;
    await super.next();
  }

  /** @override */
  async reset() {
    this.calledAsPreviousStep = false;
    this.calledAsExit = false;
    this.calledAsReset = true;
    await super.reset();
  }

  /** @override */
  async start() {
    this.calledAsPreviousStep = false;
    this.calledAsExit = false;
    await super.start();
  }

  /** @override */
  exit() {
    this.calledAsExit = true;
    super.exit();
  }
}
