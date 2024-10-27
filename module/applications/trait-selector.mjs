import fuzzysort from "fuzzysort";

const { DocumentSheetV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * A specialized form used to select types.
 *
 * @augments {DocumentSheetV2&HandlebarsApplicationMixin}
 * @property {string} _searchFilter           Current search filter
 * @property {string} _collator               Collator for sorting
 * @property {object} attributes              The currently stored values for this trait selector
 * @property {string[]} attributes.value      Elements from the provided set of choices that have been checked
 * @property {string[]} attributes.custom     Custom elements that have been provided by the user
 */
export class ActorTraitSelector extends HandlebarsApplicationMixin(DocumentSheetV2) {
  static DEFAULT_OPTIONS = {
    tag: "form",
    form: {
      handler: ActorTraitSelector._updateDocument,
      submitOnClose: false,
      submitOnChange: false,
      closeOnSubmit: false,
    },
    classes: ["pf1-v2", "trait-selector"],
    window: {
      minimizable: false,
      resizable: false,
    },
    position: {
      width: 320,
    },
    sheetConfig: false,
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/trait-selector.hbs",
      scrollable: [".trait-list"],
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  _searchFilter = "";

  /** @type {boolean} - Include language agnostic ID in search. */
  static SEARCH_INCLUDE_ID = true;

  constructor(options) {
    // Ensure uniqueness to target for trait selector
    options.id ??= `trait-selector-${options.document.uuid.replaceAll(".", "-")}-${options.subject}`;

    super(options);

    // Enrich dialog identity
    this.options.classes.push(options.subject);

    // Get current values
    const { value, custom } = foundry.utils.getProperty(options.document.toObject(), this.attribute) ?? {
      value: [],
      custom: [],
    };

    this.attributes = {
      value: value || [],
      custom: custom || [],
    };

    const searchIndex = [];
    for (const [id, label] of Object.entries(this.options.choices)) {
      searchIndex.push({
        id,
        _id: fuzzysort.prepare(id.normalize("NFKD")),
        _name: fuzzysort.prepare(label.normalize("NFKD")),
      });
    }
    this._searchIndex = searchIndex;

    this._collator = new Intl.Collator(game.i18n.lang, {
      numeric: true,
      ignorePunctuation: true,
    });
  }

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    const { value, custom } = this.attributes;

    // Populate choices
    const choices = foundry.utils.deepClone(this.options.choices);
    for (const [k, v] of Object.entries(choices)) {
      choices[k] = {
        label: v,
        chosen: value.includes(k),
      };
    }

    return {
      choices,
      hideSearch: Object.keys(choices).length < pf1.config.traitSelector.minChoicesForSearch,
      custom: Array.from(new Set(custom)),
      search: this._searchFilter,
      hasCustom: this.options.hasCustom,
      buttons: [
        {
          type: "submit",
          label: this.document instanceof Actor ? "PF1.UpdateActor" : "PF1.UpdateItem",
          icon: "far fa-save",
        },
      ],
    };
  }

  /* -------------------------------------------- */

  /**
   * Configure the title of the trait selector window
   *
   * @override
   * @type {string}
   */
  get title() {
    return `${this.options.title}: ${this.document.name}`;
  }

  /* -------------------------------------------- */

  /**
   * Return a reference to the target attribute
   *
   * @type {string}
   */
  get attribute() {
    return this.options.name;
  }

  /* -------------------------------------------- */

  /**
   * Split a given value based on the configured separator
   *
   * @param {string} value      The value to split
   * @returns {string[]}         The split values, with empty values filtered out
   */
  splitCustom(value) {
    return value
      .split(pf1.config.re.traitSeparator)
      .map((c) => c.trim())
      .filter((c) => !!c);
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
    // Custom tag handling
    const customInput = this.element.querySelector("input[name='custom']");
    if (customInput) {
      customInput.addEventListener("input", this._onCustomInput.bind(this), { passive: true });
      customInput.addEventListener("keydown", this._onActiveCustomInput.bind(this));
      this.element.querySelectorAll(".custom-tags .custom-tag > a[data-action='delete']").forEach((el) => {
        el.addEventListener("click", this._deleteCustomTag.bind(this), { passive: true });
      });
    }

    // Search handling
    const search = this.element.querySelector("input[type='search']");
    if (search) {
      search.addEventListener("input", (ev) => this._onSearch(ev.currentTarget.value), { passive: true });
      search.addEventListener("change", (ev) => this._onSearch(ev.currentTarget.value), { passive: true });
      this._onSearch(this._searchFilter);
    }
  }

  /* -------------------------------------------- */

  /**
   * The event handler for custom field input.
   *
   * @internal
   * @param {Event} event         The originating input event
   * @returns {void}
   */
  _onCustomInput(event) {
    // Consume input if semicolon is inserted
    if (/;/.test(event.currentTarget.value)) {
      this._onChangeForm();
    }
  }

  /* -------------------------------------------- */

  /**
   * The event handler for active keystrokes on the input field.
   *
   * @internal
   * @param {Event} event         The originating keydown event
   * @returns {void}
   */
  _onActiveCustomInput(event) {
    if (event.isComposing) return;

    switch (event.key) {
      case "Enter": {
        event.preventDefault();
        this._onChangeForm();
        break;
      }

      case "Backspace": {
        if (event.currentTarget.value !== "") return;
        if (event.repeat) return; // Ignore when backspace is held down

        const last = this.element.querySelector(".custom-tags .custom-tag:last-of-type");
        if (!last) return;

        if (last.classList.contains("pre-delete")) {
          const tag = last.dataset.customTag;
          this.attributes.custom = this.attributes.custom.filter((t) => t !== tag);
          this.render();
        } else {
          last.classList.add("pre-delete");
        }
        break;
      }

      default:
        this.element.querySelector(".custom-tags .custom-tag:last-of-type")?.classList.remove("pre-delete");
        break;
    }
  }

  /* -------------------------------------------- */

  /**
   * The event handler for deleting a custom tag.
   *
   * @internal
   * @param {Event} event         The originating click event
   * @returns {void}
   */
  _deleteCustomTag(event) {
    const elem = event.currentTarget;
    const tag = elem.dataset.customTag;
    this.attributes.custom = this.attributes.custom.filter((t) => t !== tag);
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Run a search on the provided list of options.
   *
   * @internal
   * @param {string} query        The search string
   * @returns {void}
   */
  _onSearch(query) {
    query = query?.normalize("NFKD");
    this._searchFilter = query;

    const keys = ["_name"];
    if (this.constructor.SEARCH_INCLUDE_ID) keys.push("_id");

    const matches = query
      ? fuzzysort
          .go(query, this._searchIndex, { keys, threshold: -10000 })
          .sort((a, b) => {
            // Sort by score first, then alphabetically by name
            if (a.score !== b.score) return b.score - a.score;
            else return this._collator.compare(a.obj.name, b.obj.name);
          })
          .map((r) => r.obj.id)
      : null;

    const els = this.element.querySelectorAll(".trait-list li");
    for (const el of els) {
      el.classList.toggle("search-mismatch", query && !matches.includes(el.dataset.choice));
    }
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
    const formData = {};
    new FormData(this.element).forEach((value, key) => (formData[key] = value));

    let { choices, custom, search } = foundry.utils.expandObject(formData);
    choices ??= {};

    this._searchFilter = search;

    choices = Object.entries(choices)
      .filter(([_, v]) => v)
      .map(([k]) => k);

    if (custom?.length) this.attributes.custom.push(...this.splitCustom(custom));

    this.attributes.value = choices;
    this.render();
  }

  /* -------------------------------------------- */

  /**
   * Update the Actor object with new trait data processed from the form
   *
   * @this {ActorTraitSelector&DocumentSheetV2}
   * @param {SubmitEvent} event                   The originating form submission event
   * @param {HTMLFormElement} form                The form element that was submitted
   * @param {FormDataExtended} formData           Processed data for the submitted form
   * @returns {Promise<void>}
   * @private
   */
  static async _updateDocument(event, form, formData) {
    // Unregister this app from doc to avoid re-renders
    delete this.document.apps[this.appId];
    const { custom, value } = this.attributes;
    const updateData = {
      [this.attribute]: {
        value,
        custom: [...new Set(custom)],
      },
    };
    this.document.update(updateData);
    this.close({ force: true });
  }
}
