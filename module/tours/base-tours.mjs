// FIXME: Tour class is not in v9.6 of Foundry types
// eslint-disable-next-line no-undef
export class PF1Tour extends Tour {
  /**
   * Foundry Tours do not wait for the element to be rendered so we need this workaround.
   *
   * @param {string} selector CSS selector of the element to wait for
   * @returns {Promise<void>}
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

  /** @override */
  async _preStep() {
    await super._preStep();
    await this.waitForElement(this.currentStep?.selector);
  }
}

export class PF1SidebarTour extends PF1Tour {}
