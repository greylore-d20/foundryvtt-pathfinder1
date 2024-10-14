import { naturalSort } from "@utils";
import { AbstractListSelector } from "@app/abstract-list-selector.mjs";

/**
 * Extend the FormApplication to handle creating, removing, and editing
 * and Actor's Damage Reduction and Energy Resistances.
 *
 * @augments {AbstractListSelector}
 * @param {ActorPF} actor     The Actor instance
 */
export class DamageResistanceSelector extends AbstractListSelector {
  static DEFAULT_OPTIONS = {
    classes: ["damage-resistance-selector"],
  };

  static PARTS = {
    form: {
      template: "systems/pf1/templates/apps/damage-resistance-selector.hbs",
    },
    footer: {
      template: "templates/generic/form-footer.hbs",
    },
  };

  /** @override */
  constructor(options) {
    super(options);

    /** Basic properties for handling operations */
    // Prepare data and convert it into format compatible with the editor
    this.isDR = options.isDR === true;

    /** Working copy of our trait's data */
    const resistances = foundry.utils.deepClone(foundry.utils.getProperty(this.document, this.attribute) ?? {});

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

  /* -------------------------------------------- */

  /**
   * Initialize the configuration for this application. Override the default ID to be unique to this
   * entry selector instance based on document and attribute that is being edited.
   *
   * @override
   * @param {ApplicationConfiguration} options    The provided configuration options for the Application
   * @returns {ApplicationConfiguration}           The final configuration values for the application
   */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);

    const type = options.isDR ? "DR" : "ER";
    options.id = `DamageResistanceSelector-${type}-${options.document.uuid.replaceAll(".", "-")}`;

    return options;
  }

  /* -------------------------------------------- */

  /**
   * @inheritDoc
   * @internal
   * @async
   */
  async _prepareContext() {
    return {
      ...(await super._prepareContext()),
      custom: this.custom,
      damages: this.damages,
      operators: this.operators,
      isDR: this.isDR,
    };
  }

  /* -------------------------------------------- */

  /**
   * Alias the document property to actor
   *
   * @type {ActorPF}
   */
  get actor() {
    return this.document;
  }

  /* -------------------------------------------- */

  /**
   * Configure the title of the window to include the Actor name
   *
   * @override
   * @type {string}
   */
  get title() {
    return `${game.i18n.localize("PF1.Application.DamageResistanceSelector." + (this.isDR ? "DR" : "ER") + "Title")}: ${
      this.actor.name
    }`;
  }

  /* -------------------------------------------- */

  /**
   * Provides default data for a new list entry
   *
   * @override
   * @param event
   * @protected
   * @returns {object}
   */
  _getNewEntry(event) {
    return {
      amount: 0,
      types: [this.isDR ? "" : "fire", ""],
      operator: true,
    };
  }

  /* -------------------------------------------- */

  /**
   * Update internal data snapshot on form change
   *
   * @param formConfig
   * @param event
   * @override
   * @internal
   * @this {EntrySelector&AbstractListSelector}
   * @returns {Promise<void>}
   */
  async _onChangeForm(formConfig, event) {
    const target = event.target;

    if (target.matches("[name=custom]")) {
      this._onResistanceCustomChange(event);
    } else {
      this._onResistanceChange(event);
    }

    super._onChangeForm(formConfig, event);
  }

  /* -------------------------------------------- */

  /**
   * A triggered operation when any inputs or dropdowns are interacted
   * with to save the data from UI
   *
   * @param {Event} event
   */
  async _onResistanceChange(event) {
    const target = event.target;

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

  /* -------------------------------------------- */

  /**
   * A triggered operation when the user modifies the custom input section
   *
   * @param {Event} event
   */
  async _onResistanceCustomChange(event) {
    const target = event.target;
    this.custom = target.value;
  }

  /* -------------------------------------------- */

  /**
   * Provides update data for saves
   *
   * @override
   * @protected
   * @returns {object}
   */
  _getUpdateData() {
    const updateData = {};

    updateData[this.attribute + ".value"] = this.entries.map((value) => {
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
    updateData[this.attribute + ".custom"] = this.custom;

    return updateData;
  }
}
