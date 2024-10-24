export class PF1Tour extends Tour {
  /** @type {"start" | "exit" | "previous" | "reset" | null} The function that called current step. */
  calledFrom = null;
  /** @type {pf1.applications.compendiumBrowser.CompendiumBrowser | null} */
  currentOpenCompendium = null;

  /** @override */
  constructor(config, { id, namespace } = {}) {
    super(config, { id, namespace });
    this.calledFrom = null;
    this.currentOpenCompendium = null;
  }

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
   * @returns {pf1.applications.actor.ActorSheetPF | null} The current actor sheet if found.
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
   * @returns {Promise<pf1.applications.actor.ActorSheetPF | null>} The current actor sheet if found.
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
   * Checks if the current step is a safe step meaning this that is not being called from start, exit, previous or reset.
   * This is mainly used to avoid executing irreversible steps such as deleting an actor, adding an item, etc... or just
   * to avoid opening unwanted dialogs.
   *
   * @returns {boolean} True if the current step is a safe step.
   */
  _isSafe() {
    return !["start", "exit", "previous", "reset"].includes(this.calledFrom);
  }

  /**
   * In many steps we might need an specific compendium to be opened to continue.
   * This function opens the given type of compendium and stores it for later closing or referencing.
   *
   * @param {string} compendium The compendium to open.
   * @param {object} [options={}] Additional options to pass to the render function.
   * @see {@link pf1.applications.compendiumBrowser.CompendiumBrowser.initializeBrowsers}
   * @see {@link Application.render}
   * @returns {Application} The opened compendium.
   */
  _openCompendium(compendium, options = {}) {
    if (!Object.prototype.hasOwnProperty.call(pf1.applications.compendiums, compendium)) {
      throw new Error(`Compendium "${compendium}" not found`);
    }
    // Open compendium
    const comp = pf1.applications.compendiums[compendium].render(true, { focus: true, ...options });
    // Set current compendium
    this.currentOpenCompendium = comp;
    return comp;
  }

  /**
   * Closes the currently opened compendium either by referencing the variable or checking if the active window is the compendium.
   *
   * @see {@link _openCompendium}
   * @see {@link Application.render}
   */
  _closeCompendium() {
    if (this.currentOpenCompendium) {
      this.currentOpenCompendium.close();
      this.currentOpenCompendium = null;
      return;
    }

    // Check if the active window is the compendium
    if (ui.activeWindow instanceof pf1.applications.compendiumBrowser.CompendiumBrowser) {
      ui.activeWindow.close();
    }
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

  /**
   * Triggering a typing event in the compendium browser search bar.
   * Since compendium browsers are not rendered immediately, we need to wait for the filter to be applied.
   *
   * @param {string} text Text to type in the search bar.
   * @param {number} [timeout=400] Timeout in milliseconds to wait for the filter to be applied.
   */
  async _typeInCompendiumBrowserSearchBar(text, timeout = 400) {
    if (!this.currentOpenCompendium) {
      this._warn("Trying to type in a search bar for a compendium that isn't open.");
      return;
    }

    /** @type {HTMLInputElement} */
    const searchBar = await this.waitForElement(
      `div[data-appid="${this.currentOpenCompendium.appId}"] input[type="search"][name="filter"]`
    );
    searchBar.value = text;
    searchBar.dispatchEvent(new Event("input", { bubbles: true }));
    // We need to wait for the filter to be applied. It can take some milliseconds
    // Refer to `pf1.applications.compendiumBrowser.CompendiumBrowser._debouncedRender`
    await new Promise((resolve) => setTimeout(resolve, timeout));
  }

  /**
   * Simulates dropping an item from Compendium Browser into the displayed actor sheet.
   *
   * @param {string} selector The CSS selector for the target element.
   * @returns {Promise<Document[]>} The dropped items.
   */
  async _dropItemFromCompendiumBrowser(selector) {
    if (!document.querySelector(selector)) {
      this._warn("Trying to trigger Drag&Drop with an element that's not rendered.");
      return;
    }

    if (!this.sheetInDisplay) {
      this._warn("Trying to trigger Drag&Drop with an actor sheet that isn't rendered.");
      return;
    }

    /** @type {Document[]} */
    const itemUUID = document.querySelector(selector)?.getAttribute("data-uuid");

    if (!itemUUID) {
      this._warn("Trying to trigger Drag&Drop with an element that doesn't have an item UUID.");
      return;
    }

    const droppedItems = await this.sheetInDisplay._onDropItem(new DragEvent("drop"), {
      type: "Item",
      uuid: itemUUID,
    });

    return droppedItems;
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
    this.calledFrom = "previous";
    await super.previous();
  }

  /** @override */
  async next() {
    this.calledFrom = "next";
    await super.next();
  }

  /** @override */
  async reset() {
    this.calledFrom = "reset";
    // Since it's a reset we also want to set openCompendium to null
    this.currentOpenCompendium = null;
    await super.reset();
  }

  /** @override */
  async start() {
    this.calledFrom = "start";
    await super.start();
  }

  /** @override */
  exit() {
    this.calledFrom = "exit";
    super.exit();
  }
}
