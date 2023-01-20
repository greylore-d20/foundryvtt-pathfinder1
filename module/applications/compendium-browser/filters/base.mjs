import { naturalSort } from "@utils";

/**
 * @typedef {object} FilterChoice
 * @property {string} label - The label for this choice visible to the user; will be localized
 * @property {string} key - The key for this choice used to identify it
 * @property {boolean} [active] - Whether this choice is currently active
 */

/**
 * A basic filter class containing common functionality for all filters.
 *
 * Inheriting classes should define the following static properties: {@link label}, {@link indexField}.
 * Inheriting classes may define the following static properties: {@link type}.
 *
 * @abstract
 */
export class BaseFilter {
  /**
   * The label for this filter visible to the user.
   *
   * @abstract
   * @type {string}
   */
  static label = "";
  /**
   * The field this filter checks against its choices.
   * Will also be added to the `compendiumIndexFields` of the document's `CONFIG` object.
   *
   * @abstract
   * @type {string}
   */

  static indexField = "";

  /**
   * A convenience property to define a single `type` this filter applies to.
   *
   * @see {@link types}
   * @see {@link handledTypes}
   */
  static type = "";

  /**
   * The `type`s of document this filter applies to.
   *
   * @see {Actor#type}
   * @see {Item#type}
   * @see {@link handledTypes}
   * @type {string[]}
   */
  static types = [];

  /**
   * The handlebars template used to render this filter.
   *
   * @type {string}
   */
  static TEMPLATE = "systems/pf1/templates/apps/compendium-browser/checkbox-filter.hbs";

  /**
   * The ID of this filter used to identify it in its browser's filters.
   *
   * @type {string}
   */
  id;

  /**
   * A {@link Collection} of {@link FilterChoice}s for this filter.
   *
   * @type {Collection<FilterChoice> | null}
   */
  choices = null;

  /**
   * A reference to the {@link CompendiumBrowser} this filter is used in.
   *
   * @type {import("../compendium-browser.mjs").CompendiumBrowser | null}
   */
  compendiumBrowser = null;

  /**
   * @param {import("../compendium-browser.mjs").CompendiumBrowser} compendiumBrowser - The compendium browser this filter is used in.
   */
  constructor(compendiumBrowser) {
    this.compendiumBrowser = compendiumBrowser;
    Object.defineProperty(this, "id", { value: foundry.utils.randomID(), writable: false, configurable: false });
    this.registerIndexFields();
  }

  /**
   * Generate a {@link Collection} of {@link FilterChoice}s from a {@link CONFIG} object.
   *
   * @param {Record<string, string> | Record<string, Record<string, string>>} configObject - The object to generate choices from; can be a Record<string, string> or
   * @param {object} [options={}] - Options determining how the choices are generated.
   * @param {string} [options.labelKey="_label"] - The key to use to determine the label if the configObject is a Record<string, object>; will be ignored if the configObject is a Record<string, string>.
   * @param {boolean} [options.innerSet=false] - Whether choices should be generated from direct properties of the configObject, or from the properties of the inner objects.
   * @returns {Collection<FilterChoice>} - A Collection of {@link FilterChoice}s
   */
  static getChoicesFromConfig(configObject, { labelKey = "_label", innerSet = false } = {}) {
    /** @type {Collection<FilterChoice>} */
    const choices = new foundry.utils.Collection();
    for (const [key, value] of Object.entries(configObject)) {
      if (innerSet) {
        for (const [innerKey, innerValue] of Object.entries(value)) {
          if (innerKey === labelKey) continue;
          choices.set(innerKey, { key: innerKey, label: innerValue });
        }
      } else {
        if (typeof value === "object" && value[labelKey]) {
          choices.set(key, { key, label: value[labelKey] });
        } else if (typeof value === "string") {
          choices.set(key, { key, label: value });
        }
      }
    }
    return choices;
  }

  /**
   * The authoritative `Set` of `type`s this filter applies to.
   *
   * @type {Set<string>}
   */
  static get handledTypes() {
    return new Set([this.type, ...this.types].filter((type) => type));
  }

  /**
   * Whether this filter has any active choices.
   *
   * @type {boolean}
   */
  get active() {
    return this.choices?.some((choice) => choice.active) ?? false;
  }

  get activeChoiceCount() {
    return this.choices?.filter((choice) => choice.active).length ?? 0;
  }

  /**
   * Adds the index fields checked by this filter to the document's `CONFIG` object,
   * so that {@link CompendiumCollection#getIndex} will include them.
   */
  registerIndexFields() {
    if (!this.compendiumBrowser) return;
    const documentName = this.compendiumBrowser.constructor.documentName;

    // Fields with double underscore are added in the mapping process and not part of Foundry's index
    if (this.constructor.indexField.startsWith("__")) return;

    const compendiumIndexFields = CONFIG[documentName]?.compendiumIndexFields;
    if (
      compendiumIndexFields &&
      this.constructor.indexField &&
      !compendiumIndexFields.includes(this.constructor.indexField)
    ) {
      compendiumIndexFields?.push(this.constructor.indexField);
    }
  }
  /**
   * Prepare the choices for this filter. This is called after the compendium browser has gathered its entries.
   * By default, this will generate a list of choices from the index field of all entries in the compendium.
   */
  prepareChoices() {
    const entries = this.compendiumBrowser?.entries.contents;
    const observedValues = new Set(
      entries.flatMap((entry) => {
        const data = getProperty(entry, this.constructor.indexField);
        if (Array.isArray(data)) {
          if (data.length === 0) return [];
          else return data;
        }
        if (typeof data === "object" && data !== null) {
          const keys = Object.keys(data);
          if (keys.length === 0) return [];
          else return keys;
        }
        if (data == null) return [];
        if (typeof data === "string" && data.trim() === "") return [];
        return [data];
      })
    );
    this.choices = new foundry.utils.Collection(
      naturalSort(
        [...observedValues].map((value) => ({ key: value, label: game.i18n.localize(`${value}`) })),
        "label"
      ).map((choice) => [`${choice.key}`, choice])
    );
  }

  /**
   * Returns whether this filter has more than the given number of choices.
   * Defaults to 1, as a single choice allows for no real filtering.
   *
   * @param {number} [number=1] - The number of choices to check for
   * @returns {boolean} - Whether this filter has more than the given number of choices
   */
  hasChoices(number = 1) {
    return this.choices?.size > number;
  }

  /**
   * Toggle the active state of a choice, or set it to a specific state.
   *
   * @param {string} key - The key of the choice to toggle
   * @param {boolean} [state=null] - The state to set the choice to. If null, the choice will be toggled.
   * @returns {boolean} - The new state of the choice
   * @throws {Error} - If the choice does not exist in this filter
   */
  toggleChoice(key, state = null) {
    const choice = this.choices?.get(key);
    if (!choice) throw new Error(`Choice ${key} does not exist in this filter.`);
    if (state === null) choice.active = !choice.active;
    else choice.active = state;
    return choice.active;
  }

  /** Reset all choices to their default state (inactive) */
  resetActiveChoices() {
    this.choices?.forEach((choice) => (choice.active = false));
  }

  /**
   * Check whether an entry matches this filter.
   * If the filter is not active, this will always return true.
   *
   * @param {object} entry - The entry to check against this filter
   * @returns {boolean} - Whether the entry matches this filter
   */
  applyFilter(entry) {
    const activeChoices = this.choices.filter((choice) => choice.active);
    if (activeChoices.length === 0) return true;
    else {
      const types = this.constructor.handledTypes;
      if (types.length && !types.includes(entry.type)) return false;

      return activeChoices.some((choice) => {
        const data = getProperty(entry, this.constructor.indexField);

        // For arrays and objects, every choice must be present for the filter to match
        if (Array.isArray(data)) {
          return activeChoices.every((choice) => data.includes(choice.key));
        }
        if (typeof data === "object" && data !== null) {
          return activeChoices.every((choice) => choice.key in data && data[choice.key]);
        }

        return data == choice.key;
      });
    }
  }

  /**
   * Activate event listeners for this filter.
   *
   * @param {HTMLElement} html - The rendered HTML element for this filter only
   */
  activateListeners(html) {
    html.addEventListener("change", (event) => {
      if (event.target.type === "checkbox") {
        const checkbox = event.target;
        const choiceKey = checkbox.name.split("choice.").pop();
        if (choiceKey) {
          this.toggleChoice(choiceKey, checkbox.checked);
          this.compendiumBrowser.render();
        }
      }
    });
  }
}
