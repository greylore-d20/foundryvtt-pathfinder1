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
   * Auto-localize choices.
   *
   * Defaults to false due to pre-translation.
   *
   * @type {boolean}
   */
  static localizeChoices = false;

  /**
   * Auto-localize filter label
   *
   * @type {boolean}
   */
  static localizeLabel = true;

  /**
   * Prefix to add to choices before localization.
   *
   * @type {string}
   */
  static localizePrefix = "";

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
  static TEMPLATE = "";

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
   * @type {pf1.applications.compendiumBrowser.CompendiumBrowser | null}
   */
  compendiumBrowser = null;

  /**
   * @param {pf1.applications.compendiumBrowser.CompendiumBrowser} compendiumBrowser - The compendium browser this filter is used in.
   */
  constructor(compendiumBrowser) {
    this.compendiumBrowser = compendiumBrowser;
    Object.defineProperty(this, "id", { value: foundry.utils.randomID(), writable: false, configurable: false });
    this.registerIndexFields();
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

  /**
   * The number of active choices.
   *
   * @type {number}
   */
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
   * Prepare the filter for use.
   * This step expects the compendium browser to have gathered its entries.
   */
  setup() {
    this.prepareChoices();
  }

  /**
   * Prepare the choices for this filter. This is called after the compendium browser has gathered its entries.
   * By default, this will generate a list of choices from the index field of all entries in the compendium.
   */
  prepareChoices() {
    this.choices = new foundry.utils.Collection();
  }

  /**
   * Returns whether this filter has _more than_ the given number of choices.
   * Defaults to 1, as a single choice allows for no real filtering.
   *
   * @param {number} [number=1] - The number of choices to check for
   * @returns {boolean} - Whether this filter has more than the given number of choices
   */
  hasChoices(number = 1) {
    return this.choices?.size > number;
  }

  /**
   * Reset all choices and controls to their default state (inactive)
   *
   * @abstract
   */
  reset() {}

  /**
   * Check whether an entry matches this filter.
   * If the filter is not active, this will always return true.
   *
   * @abstract
   * @param {object} entry - The entry to check against this filter
   * @returns {boolean} - Whether the entry matches this filter
   */
  applyFilter(entry) {}

  /**
   * Provide data necessary to render this filter.
   * The data object generated by {@link BaseFilter#getData} contains the minimum data not only required
   * by the filter itself, but also by the rendering {@link CompendiumBrowser}.
   *
   * @returns {object}} The data object for this filter
   */
  getData() {
    return {
      id: this.id,
      template: this.constructor.TEMPLATE,
      label: this.constructor.localizeLabel ? game.i18n.localize(this.constructor.label) : this.constructor.label,
      active: this.active,
      activeCount: this.activeChoiceCount,
      choices: this.choices?.contents ?? [],
      field: this.constructor.indexField,
    };
  }

  /**
   * Activate event listeners for this filter.
   *
   * @abstract
   * @param {HTMLElement} html - The rendered HTML element for this filter only
   */
  activateListeners(html) {}
}
