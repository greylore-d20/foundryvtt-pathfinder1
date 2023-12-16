/**
 * A specialized form used to select damage or condition types which apply to an Actor
 *
 * @type {DocumentSheet}
 */
export class ActorTraitSelector extends DocumentSheet {
  constructor(doc, options) {
    super(doc, options);
    // Enrich dialog identity
    this.options.classes.push(options.subject);
  }

  get title() {
    return `${this.options.title} – ${this.object.name}`;
  }

  get id() {
    return `trait-selector-${this.document.uuid}-${this.options.subject}`;
  }

  static get defaultOptions() {
    return {
      ...super.defaultOptions,
      classes: ["pf1", "trait-selector"],
      template: "systems/pf1/templates/apps/trait-selector.hbs",
      width: 320,
      height: "auto",
      sheetConfig: false,
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
    // Get current values
    const attr = foundry.utils.getProperty(this.object, this.attribute) ?? { value: [], custom: "" };

    // Populate choices
    const choices = foundry.utils.deepClone(this.options.choices);
    for (const [k, v] of Object.entries(choices)) {
      choices[k] = {
        label: v,
        chosen: attr.value?.includes(k),
      };
    }

    // Object type
    const updateButton = this.object instanceof Actor ? "PF1.UpdateActor" : "PF1.UpdateItem";

    // Return data
    return {
      choices: choices,
      custom: attr.custom,
      updateButton,
    };
  }

  /* -------------------------------------------- */

  /**
   * Update the Actor object with new trait data processed from the form
   *
   * @param event
   * @param formData
   * @private
   */
  _updateObject(event, formData) {
    const choices = [];
    for (const [k, v] of Object.entries(formData)) {
      if (k !== "custom" && v) choices.push(k);
    }
    this.object.update({
      [`${this.attribute}.value`]: choices,
      [`${this.attribute}.custom`]: formData.custom,
    });
  }
}
