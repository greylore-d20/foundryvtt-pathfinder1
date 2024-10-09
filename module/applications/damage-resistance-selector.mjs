import { naturalSort } from "@utils";

/**
 * Extend the FormApplication to handle creating, removing, and editing
 * and Actor's Damage Reduction and Energy Resistances.
 *
 */
export class ActorResistanceSelector extends FormApplication {
  /** @override */
  constructor(...args) {
    super(...args);

    /** Basic properties for handling operations */
    // Prepare data and convert it into format compatible with the editor
    this.isDR = this.options.isDR === true;

    /** Working copy of our trait's data */
    const resistances = foundry.utils.deepClone(foundry.utils.getProperty(this.object, this.attribute) ?? {});

    /**
     * Custom user input for damage sources
     *
     * @property
     * @type {string}
     */
    this.custom = resistances.custom;

    /**
     * Original copy of the trait's entries
     *
     * @property
     * @type {Object<string, any>}
     */
    this.originalEntries = resistances.value;
    this.entries = resistances.value;

    /** Processing Damage sources */
    const damageOBJ = naturalSort([...pf1.registry.damageTypes], "name").filter((dType) => !dType.isModifier);
    const damages = {};

    // Loop through the registry to filter not-applicable damage sources
    Object.values(damageOBJ)
      .sort()
      .forEach((dType) => {
        // If we are looking for DR, we want to exclude types that are energy or not untyped
        if ((dType.category === "energy" || dType.category === "misc") && this.isDR) {
          return;
        }

        // If we are looking for ERES, we want to exclude types that are physical or untyped
        if ((dType.category === "physical" || (dType.category === "misc" && dType.id === "untyped")) && !this.isDR) {
          return;
        }

        damages[dType.id] = dType.name;
      });

    if (this.isDR) {
      this.options.id = "damage-resistance-selector";

      Object.keys(pf1.config.damageResistances).forEach((dType) => {
        damages[dType] = pf1.config.damageResistances[dType];
      });

      naturalSort([...pf1.registry.materials], "name").forEach((material) => {
        if (
          material.dr &&
          !material.treatedAs &&
          (material.allowed.lightBlade ||
            material.allowed.oneHandBlade ||
            material.allowed.twoHandBlade ||
            material.allowed.rangedWeapon)
        ) {
          damages[material.id] = material.shortName || material.name;
        }
      });
    }

    /**
     * A list of key-value pairs for dropdown damage types
     *
     * @property
     * @type {Object<string, string>}
     */
    this.damages = damages;

    /**
     * A dropdown list of combination types for multiple damage types
     *
     * @property
     * @type {Object<boolean, string>}
     */
    this.operators = {
      true: "PF1.Application.DamageResistanceSelector.CombinationOr",
      false: "PF1.Application.DamageResistanceSelector.CombinationAnd",
    };
  }

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "energy-resistance-selector",
      classes: ["pf1", "resistance"],
      template: "systems/pf1/templates/apps/damage-resistance-selector.hbs",
      height: "auto",
      closeOnSubmit: true,
      submitOnClose: false,
    });
  }

  /** @override */
  get title() {
    return game.i18n.localize("PF1.Application.DamageResistanceSelector." + (this.isDR ? "DR" : "ER") + "Title");
  }

  get attribute() {
    return this.options.name;
  }

  get fields() {
    return this.options.fields.split(";");
  }

  get dtypes() {
    return this.options.dtypes.split(";");
  }

  get dataCount() {
    return this.fields.length;
  }

  /**
   * Fetches simple data for the interface
   *
   */
  getData() {
    return {
      custom: this.custom,
      damages: this.damages,
      operators: this.operators,
      entries: this.entries,
      fields: this.fields,
      dtypes: this.dtypes,
      isDR: this.isDR,
    };
  }

  /**
   * Activate event listeners using the prepared sheet HTML
   *
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
  activateListeners(html) {
    html.find(".resistance-control").click(this._onResistanceControl.bind(this));

    html.find("tr td input").change(this._onResistanceChange.bind(this));
    html.find("tr td select").change(this._onResistanceChange.bind(this));
    html.find("input[name=custom]").change(this._onResistanceCustomChange.bind(this));
  }

  /**
   * Updates the actor with the new resistances
   *
   * @override
   * @param {Event} event
   * @param {any} formData
   * @returns  The updated actor
   */
  async _updateObject(event, formData) {
    const updateData = {};

    const entries = this.entries.map((value) => {
      // Ensure no matter what, we have values
      value.types[0] ??= "";
      value.types[1] ??= "";

      if (value.types[0] === "" && value.types[1] !== "") {
        value.types[0] = value.types[1];
        value.types[1] = "";
      }
      if (value.types[0] === value.types[1]) {
        value.types[1] = "";
      }

      // Convert from string key to boolean value
      value.operator = String(value.operator).toLowerCase() === "true";
      return value;
    });

    updateData[this.attribute + ".value"] = entries;
    updateData[this.attribute + ".custom"] = this.custom;

    return this.object.update(updateData);
  }

  /**
   * A trigger for an operation to add or delete a resistance entry
   *
   * @param {Event} event - The action and associated data that triggered the operation
   * @returns A call to render (refresh) the UI
   */
  async _onResistanceControl(event) {
    event.preventDefault();
    const target = event.currentTarget;

    // Add a new blank entry
    if (target.classList.contains("add-resistance")) {
      const obj = {
        amount: 0,
        types: [this.isDR ? "" : "fire", ""],
        operator: true,
      };

      this.entries.push(obj);

      return this.render();
    }

    // Delete an existign entry instead
    if (target.classList.contains("delete-resistance")) {
      const tr = target.closest("tr");
      const index = parseInt(tr.dataset.index);
      this.entries.splice(index, 1);
      return this.render();
    }
  }

  /**
   * A triggered operation when any inputs or dropdowns are interacted
   * with to save the data from UI
   *
   * @param {Event} event
   */
  async _onResistanceChange(event) {
    const target = event.currentTarget;

    const tr = target.closest("tr.resistance");
    const index = parseInt(tr.dataset.index);
    const index2 = target.dataset.index;
    const value = target.value;
    let updateValue = null;

    // Sanity-check our updated value
    if (target.dataset.dtype === "Number") {
      let val = parseFloat(value);
      if (isNaN(val)) val = 0;
      updateValue = Math.floor(val * 100) / 100;
    } else if (target.dataset.dtype === "Boolean") updateValue = value === "true";
    else updateValue = value;

    // Process the value into the types array or assign to an entry property
    switch (index2) {
      case "types0":
        this.entries[index].types[0] = updateValue;
        break;
      case "types1":
        this.entries[index].types[1] = updateValue;
        break;
      default:
        this.entries[index][index2] = updateValue;
        break;
    }
  }

  /**
   * A triggered operation when the user modifies the custom input section
   *
   * @param {Event} event
   */
  async _onResistanceCustomChange(event) {
    const target = event.currentTarget;

    this.custom = target.value;
  }
}
