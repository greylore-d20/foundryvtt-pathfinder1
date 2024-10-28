const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * An abstract class for a document selector application.
 *
 * @abstract
 * @augments {ApplicationV2&HandlebarsApplicationMixin}
 * @property {string} selected - The currently selected document ID
 */
export class AbstractDocumentSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: AbstractDocumentSelector._submit,
      submitOnClose: false,
      submitOnChange: true,
      closeOnSubmit: false,
    },
    classes: ["pf1-v2", "document-selector"],
    window: {
      title: "PF1.Application.DocumentSelector.Title",
      minimizable: false,
      resizable: true,
    },
    position: {
      width: 350,
    },
    sheetConfig: false,
    search: {
      delay: 250,
      value: "",
      event: null,
      compositioning: false,
      effectiveSearch: "",
    },
    includeNone: "",
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/document-selector.hbs",
      scrollable: [".document-section-wrapper"],
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  constructor(options) {
    if (options?.title) {
      foundry.utils.logCompatibilityWarning("AbstractDocumentSelector options title property is deprecated", {
        since: "PF1 vNEXT",
        until: "PF1 vNEXT+1",
      });
      options.window ??= {};
      options.window.title = options.title;
      delete options.title;
    }

    super(options);
    this.selected = this.options.selected || "";
  }

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    const sections = await this._getSections();

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      if (!section.documents.length) {
        sections.splice(i, 1);
        i--;
        continue;
      }

      if (!this.options.includeNone) {
        this.selected ||= section.documents[0]?.id;
      }
    }

    return {
      document: this.document,
      selected: this.selected,
      searchTerm: this.options.search.value,
      showSectionHeaders: sections.length > 1,
      sections,
      none: {
        include: this.options.includeNone,
        document: {
          id: "",
          name: game.i18n.localize("PF1.Application.DocumentSelector.None"),
          img: "icons/svg/cancel.svg",
        },
      },
      buttons: [{ type: "submit", label: "PF1.Select" }],
    };
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
    const searchInput = this.element.querySelector("input[type='search']");
    searchInput.addEventListener("keyup", this._onSearch.bind(this));
    searchInput.addEventListener("change", this._onSearch.bind(this));
    searchInput.addEventListener("compositionstart", this._onSearchComposition.bind(this));
    searchInput.addEventListener("compositionend", this._onSearchComposition.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * The event handler for changes to form input elements
   *
   * @internal
   * @param {ApplicationFormConfiguration} formConfig   The configuration of the form being changed
   * @param {Event} event                               The triggering event
   * @returns {void}
   */
  _onChangeForm(formConfig, event) {
    const target = event.target;
    if (target.matches("input[type='radio']")) {
      this.element.querySelector("li.selected")?.classList.remove("selected");
      this.selected = target.value;
      target.closest("li").classList.add("selected");
    }
  }

  /* -------------------------------------------- */

  /**
   * Handle the beginning of a search composition event
   *
   * @param event
   * @private
   */
  _onSearchComposition(event) {
    this.options.search.compositioning = event.type === "compositionstart";
  }

  /* -------------------------------------------- */

  /**
   * Handle search input events
   *
   * @param event
   * @private
   */
  _onSearch(event) {
    event.preventDefault();
    event.stopPropagation();

    // Accept input only while not compositioning

    const searchTerm = event.target.value;
    const changed = this.options.search.value !== searchTerm;

    if (this.options.search.compositioning || changed) clearTimeout(this.options.search.event); // reset
    if (this.options.search.compositioning) return;

    //if (unchanged) return; // nothing changed
    this.options.search.value = searchTerm;

    if (event.type === "keyup") {
      // Delay search
      if (changed)
        this.options.search.event = setTimeout(() => this._searchFilterCommit(event), this.options.search.delay);
    } else {
      this._searchFilterCommit(event);
    }
  }

  /* -------------------------------------------- */

  /**
   * Kick off search
   *
   * @private
   */
  _searchFilterCommit() {
    const searchTerm = this.options.search.value.toLowerCase();

    // Skip if the search term is the same as the last one
    if (this.options.search.effectiveSearch === searchTerm) return;
    this.options.search.effectiveSearch = searchTerm;
    this.render(true);
  }

  /* -------------------------------------------- */

  /**
   * Get the list of sections to show in the selector. Categories are supposed
   * to have their permissions correctly applied and display error messages, if they
   * are not accessible.
   *
   * @async
   * @abstract
   * @private
   * @returns {Promise<DocumentSelectorSection[]>}
   */
  async _getSections() {}

  /* -------------------------------------------- */

  /**
   * Submit the form selection and resolve the stored promise, if provided
   *
   * @private
   */
  static _submit() {
    this.resolve?.(this.selected);
    this.close();
  }

  /* -------------------------------------------- */

  /**
   * Render selector and wait for it to resolve.
   *
   * @param {object} options - Options
   * @returns {Promise<string|null>} - Document ID or null if cancelled.
   */
  static wait(options) {
    return new Promise((resolve) => {
      const app = new this(options);
      app.resolve = resolve;
      app.render({ force: true });
    });
  }
}

/**
 * @typedef {object} DocumentSelectorDocumentExtra
 * @property {string} [label] - The label of the property
 * @property {string} value - The value of the property
 */

/**
 * @typedef {object} DocumentSelectorDocument
 * @property {string} id - The document ID
 * @property {string} name - The document name
 * @property {string} img - The document image
 * @property {boolean} isOwner - Is the current user the owner of the document
 * @property {DocumentSelectorDocumentExtra[]} extras - Additional document properties
 */

/**
 * @typedef {object} DocumentSelectorSection
 * @property {string} id - The section ID
 * @property {string} label - The section label
 * @property {DocumentSelectorDocument[]} documents - The documents in the section
 */
