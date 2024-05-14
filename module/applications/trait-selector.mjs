/**
 * A specialized form used to select types.
 *
 * @type {DocumentSheet}
 */
export class ActorTraitSelector extends DocumentSheet {
  constructor(doc, options) {
    super(doc, options);
    // Enrich dialog identity
    this.options.classes.push(options.subject);

    // Get current values
    let { value, custom } = foundry.utils.getProperty(doc.toObject(), this.attribute) ?? { value: [], custom: [] };
    value ||= [];
    custom ||= [];

    this.attributes = { value, custom };
  }

  splitCustom(value) {
    return value
      .split(pf1.config.re.traitSeparator)
      .map((c) => c.trim())
      .filter((c) => !!c);
  }

  get title() {
    return `${this.options.title} – ${this.object.name}`;
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

    // Populate choices
    const choices = foundry.utils.deepClone(this.options.choices);
    for (const [k, v] of Object.entries(choices)) {
      choices[k] = {
        label: v,
        chosen: value.includes(k),
      };
    }

    // Object type
    const updateButton = this.object instanceof Actor ? "PF1.UpdateActor" : "PF1.UpdateItem";

    // Return data
    return {
      choices,
      custom: Array.from(new Set(custom)),
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
    this.object.update(updateData);
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

    // Custom tag handling
    const customInput = this.form.querySelector("input[name='custom']");
    customInput.addEventListener("input", this._onCustomInput.bind(this), { passive: true });
    customInput.addEventListener("keydown", this._onActiveCustomInput.bind(this));
    this.form.querySelectorAll(".custom-tags .custom-tag > a[data-action='delete']").forEach((el) => {
      el.addEventListener("click", this._deleteCustomTag.bind(this), { passive: true });
    });

    // Submit button
    this.form.querySelector("button[type='submit']").addEventListener("click", this._updateDocument.bind(this));
  }

  /**
   * Update the Actor object with new trait data processed from the form
   *
   * @param event
   * @param formData
   * @private
   */
  _updateObject(event, formData) {
    let { choices, custom } = foundry.utils.expandObject(formData);

    choices = Object.entries(choices)
      .filter(([_, v]) => v)
      .map(([k]) => k);

    if (custom?.length) this.attributes.custom.push(...this.splitCustom(custom));

    this.attributes.value = choices;

    this.render();
  }
}
