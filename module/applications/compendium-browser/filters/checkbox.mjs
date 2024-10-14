import * as baseFilter from "./base.mjs";
import { naturalSort } from "@utils";
import fuzzysort from "fuzzysort";

export class CheckboxFilter extends baseFilter.BaseFilter {
  static TEMPLATE = "systems/pf1/templates/apps/compendium-browser/checkbox-filter.hbs";

  /**
   * The minimum number of choices that must be present before the filter will show a search box.
   * Booleans can be used to override this check.
   *
   * @type {number | boolean}
   */
  static MIN_SEARCH_CHOICES = 10;

  /**
   * The boolean operator used to combine choices of this filter.
   * If "OR", an entry will be included if at least one active choice matches.
   * If "AND", an entry will only be included if all active choices match.
   *
   * @type {BooleanOperator}
   */
  booleanOperator = BOOLEAN_OPERATOR.NONE;

  /**
   * A string used to determine which choices are shown.
   *
   * @type {string}
   * @private
   */
  _choiceQuery = "";

  constructor(...args) {
    super(...args);
    this._debouncedFilterChoices = foundry.utils.debounce(this._onCustomSearchFilter, 100);
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
   * Whether this filter provides controls in addition to its choices.
   *
   * @type {boolean}
   */
  get hasControls() {
    return this.booleanOperator !== BOOLEAN_OPERATOR.NONE || this.choices.size >= this.constructor.MIN_SEARCH_CHOICES;
  }

  get hasSearch() {
    if (this.choices.size >= this.constructor.MIN_SEARCH_CHOICES) return true;
    return this.constructor.MIN_SEARCH_CHOICES ?? false;
  }

  /** @inheritDoc */
  setup() {
    super.setup();
    this.prepareBooleanOperator();
  }

  /**
   * Prepare the boolean operator for this filter.
   */
  prepareBooleanOperator() {
    const entries = this.compendiumBrowser?.entries.contents;
    // Find the first entry that has data in the field and use its data
    let fieldData;
    entries.find((entry) => {
      return (fieldData = foundry.utils.getProperty(entry, this.constructor.indexField));
    });
    if (["Array", "Object"].includes(foundry.utils.getType(fieldData))) this.booleanOperator = BOOLEAN_OPERATOR.AND;
  }

  /** @inheritDoc */
  prepareChoices() {
    const entries = this.compendiumBrowser?.entries.contents;
    const observedValues = new Set(
      entries.flatMap((entry) => {
        const data = foundry.utils.getProperty(entry, this.constructor.indexField);
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

    const autoLocalize = this.constructor.localizeChoices;
    const i18nPrefix = this.constructor.localizePrefix || "";

    const localize = (key) => {
      if (autoLocalize) {
        const path = `${i18nPrefix}${key}`;
        if (game.i18n.has(path)) return game.i18n.localize(path);
      }
      return key;
    };

    this.choices = new foundry.utils.Collection(
      naturalSort(
        [...observedValues].map((key) => ({ key, label: localize(key) })),
        "label"
      ).map((choice) => [`${choice.key}`, choice])
    );
  }

  /**
   * Toggle the active state of a choice, or set it to a specific state.
   *
   * @param {string} key - The key of the choice to toggle
   * @param {boolean | null} [state=null] - The state to set the choice to. If null, the choice will be toggled.
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

  /** @inheritDoc */
  reset() {
    super.reset();
    this.prepareBooleanOperator();
    this._choiceQuery = "";
    this.choices?.forEach((choice) => (choice.active = false));
  }

  /** @inheritDoc */
  applyFilter(entry) {
    const activeChoices = this.choices.filter((choice) => choice.active);
    // If no choices are active, this filter applies no conditions
    if (activeChoices.length === 0) return true;

    // If the filter is active, but the entry does not match the filter's types, the entry cannot match
    const types = this.constructor.handledTypes;
    if (types.size && !types.has(entry.type)) return false;

    /** @type {string | string[] | Record<string, boolean>} */
    const data = foundry.utils.getProperty(entry, this.constructor.indexField);

    const testMethod = this.booleanOperator === BOOLEAN_OPERATOR.OR ? "some" : "every";
    if (Array.isArray(data)) {
      return activeChoices[testMethod]((choice) => data.includes(choice.key));
    } else if (typeof data === "object" && data !== null) {
      return activeChoices[testMethod]((choice) => choice.key in data && data[choice.key] !== false);
    } else {
      return activeChoices.some((choice) => {
        return data == choice.key;
      });
    }
  }

  /** @inheritDoc */
  getData() {
    return {
      ...super.getData(),
      hasControls: this.hasControls,
      boolean: this.booleanOperator,
      hasSearch: this.choices.size > this.constructor.MIN_SEARCH_CHOICES,
      choiceQuery: this._choiceQuery,
    };
  }

  /** @inheritDoc */
  activateListeners(html) {
    super.activateListeners(html);
    this._onCustomSearchFilter(null, html);
    html.querySelector("button.boolean")?.addEventListener("click", (event) => {
      event.preventDefault();
      if (this.booleanOperator === BOOLEAN_OPERATOR.OR) this.booleanOperator = BOOLEAN_OPERATOR.AND;
      else this.booleanOperator = BOOLEAN_OPERATOR.OR;
      this.compendiumBrowser.render();
    });
    html
      .querySelector("input[name=choice-query]")
      ?.addEventListener("input", (event) => this._debouncedFilterChoices(event, html));
    html.addEventListener("change", (event) => {
      if (event.target.type === "checkbox") {
        const checkbox = event.target;
        const choiceKey = /filter.\w*.choice.(?<choice>.*)/.exec(checkbox.name)?.groups?.choice;
        if (choiceKey) {
          this.toggleChoice(choiceKey, checkbox.checked);
          this.compendiumBrowser.render();
        }
      }
    });
  }

  /**
   * Filter this filter's choices based on a string query.
   *
   * @protected
   * @param {Event} event - The originating input event
   * @param {HTMLElement} html - The rendered HTML of this filter
   */
  _onCustomSearchFilter(event, html) {
    if (event) {
      event.preventDefault();
      this._choiceQuery = SearchFilter.cleanQuery(event.target.value);
    }

    const matchingChoices = fuzzysort
      .go(this._choiceQuery, this.choices.contents, {
        key: "label",
        threshold: -10000,
      })
      .map((result) => `${result.obj.key}`);
    const choiceSet = new Set(matchingChoices);

    for (const li of html.querySelectorAll("li.filter-choice")) {
      const choiceKey = li.dataset.choice;
      if (choiceKey) {
        if (choiceSet.has(choiceKey) || !this._choiceQuery) li.classList.remove("hidden");
        else li.classList.add("hidden");
      }
    }
    if (this._choiceQuery && matchingChoices.length === 0)
      html.querySelector("span.no-choices")?.classList.remove("hidden");
    else html.querySelector("span.no-choices")?.classList.add("hidden");
  }
}

/** @typedef {typeof BOOLEAN_OPERATOR[keyof typeof BOOLEAN_OPERATOR]} BooleanOperator */
/**
 * States for the boolean operator of a filter.
 */
export const BOOLEAN_OPERATOR = /** @type {const} */ ({
  AND: "AND",
  OR: "OR",
  NONE: false,
});
