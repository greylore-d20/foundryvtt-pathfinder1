import { naturalSort } from "@utils";
import fuzzysort from "fuzzysort";

/**
 * A specialized form used to select types.
 *
 * @type {DocumentSheet}
 */
export class ActorTraitSelector extends DocumentSheet {
  _searchFilter = "";

  /** @type {boolean} - Include language agnostic ID in search. */
  static SEARCH_INCLUDE_ID = true;

  constructor(doc, options) {
    super(doc, options);
    // Enrich dialog identity
    this.options.classes.push(options.subject);

    // Get current values
    let { value, custom } = foundry.utils.getProperty(doc.toObject(), this.attribute) ?? { value: [], custom: [] };
    value ||= [];
    custom ||= [];

    this.attributes = { value, custom };

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

  splitCustom(value) {
    return value
      .split(pf1.config.re.traitSeparator)
      .map((c) => c.trim())
      .filter((c) => !!c);
  }

  get title() {
    return `${this.options.title} – ${this.document.name}`;
  }

  get id() {
    return `trait-selector-${this.document.uuid.replaceAll(".", "-")}-${this.options.subject}`;
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    return {
      ...options,
      classes: [...options.classes, "pf1", "trait-selector"],
      template: "systems/pf1/templates/apps/trait-selector.hbs",
      width: 320,
      height: "auto",
      sheetConfig: false,
      submitOnClose: false,
      submitOnChange: true,
      closeOnSubmit: false,
    };
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
   * Provide data to the HTML template for rendering
   *
   * @type {object}
   */
  getData() {
    const { value, custom } = this.attributes;

    // Sort and Populate choices
    const choices = {};
    naturalSort(Object.entries(this.options.choices), "1").forEach(
      ([key, label]) => (choices[key] = { label, chosen: value.includes(key) })
    );

    // Object type
    const updateButton = this.document instanceof Actor ? "PF1.UpdateActor" : "PF1.UpdateItem";

    // Return data
    return {
      choices,
      custom: Array.from(new Set(custom)),
      hideSearch: Object.keys(choices) < pf1.config.traitSelector.minChoicesForSearch,
      search: this._searchFilter,
      updateButton,
    };
  }

  /* -------------------------------------------- */

  async _updateDocument(event) {
    await this._onSubmit(event, { preventRender: true });

    // Unregister this app from doc to avoid re-renders
    delete this.document.apps[this.appId];

    const { custom, value } = this.attributes;
    const updateData = { [this.attribute]: { value, custom } };
    this.document.update(updateData);
    this.close({ force: true });
  }

  /**
   * @internal
   * @param {Event} event
   */
  _onCustomInput(event) {
    // Consume input if semicolon is inserted
    if (/;/.test(event.target.value)) {
      event.preventDefault();
      this.submit();
    }
  }

  /**
   * @internal
   * @param {Event} event
   */
  _onActiveCustomInput(event) {
    if (event.isComposing) return;

    switch (event.key) {
      case "Enter": {
        event.preventDefault();
        this.submit();
        break;
      }
      case "Backspace": {
        if (event.target.value !== "") return;
        if (event.repeat) return; // Ignore when backspace is held down
        const last = this.form.querySelector(".custom-tags .custom-tag:last-of-type");
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
        this.form.querySelector(".custom-tags .custom-tag:last-of-type")?.classList.remove("pre-delete");
        break;
    }
  }

  _deleteCustomTag(event) {
    const elem = event.target;
    const tag = elem.dataset.customTag;
    this.attributes.custom = this.attributes.custom.filter((t) => t !== tag);
    this.render();
  }

  /**
   * @param {JQuery<HTMLElement>} jq
   */
  activateListeners(jq) {
    super.activateListeners(jq);

    // Stop auto-height adjusts after first render
    delete this.options.height;

    // Custom tag handling
    const customInput = this.form.querySelector("input[name='custom']");
    customInput.addEventListener("input", this._onCustomInput.bind(this), { passive: true });
    customInput.addEventListener("keydown", this._onActiveCustomInput.bind(this));
    this.form.querySelectorAll(".custom-tags .custom-tag > a[data-action='delete']").forEach((el) => {
      el.addEventListener("click", this._deleteCustomTag.bind(this), { passive: true });
    });

    const search = this.form.querySelector("input[type='search']");
    if (search) {
      search.addEventListener("input", (ev) => this._onSearch(ev.target.value), { passive: true });
      search.addEventListener("change", (ev) => this._onSearch(ev.target.value), { passive: true });

      this._onSearch(this._searchFilter);
    }

    // Submit button
    this.form.querySelector("button[type='submit']").addEventListener("click", this._updateDocument.bind(this));
  }

  /**
   * @internal
   * @param {string} query - Seach string
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

    const els = this.form.querySelectorAll(".trait-list li");
    for (const el of els) {
      el.classList.toggle("search-mismatch", query && !matches.includes(el.dataset.choice));
    }
  }

  /**
   * Update the Actor object with new trait data processed from the form
   *
   * @param event
   * @param formData
   * @private
   */
  _updateObject(event, formData) {
    let { choices, custom, search } = foundry.utils.expandObject(formData);

    this._searchFilter = search;

    choices = Object.entries(choices || {})
      .filter(([_, v]) => v)
      .map(([k]) => k);

    if (custom?.length) this.attributes.custom.push(...this.splitCustom(custom));

    this.attributes.value = choices;

    this.render();
  }
}
