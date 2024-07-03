import * as baseFilter from "./base.mjs";

/**
 * @typedef {object} InputObject
 * @property {string} key - The key to retrieve choices.
 * @property {string} [label] - The label to display (can be localized).
 * @property {boolean} [active] - Whether this choice is currently active.
 * @property {string} [value] - The value of the choice.
 * @property {string} [placeholder] - The placeholder text for the input.
 * @property {string} [type="text"] - The HTML type property of input.
 */

/**
 * Base class for filters that require text input.
 */
export class TextFilter extends baseFilter.BaseFilter {
  static TEMPLATE = "systems/pf1/templates/apps/compendium-browser/text-filter.hbs";

  /**
   * List of inputs for this filter.
   *
   * @type {Array<InputObject>}
   */
  static inputs = [];

  /** @inheritdoc */
  hasChoices(number = 1) {
    // We need to allow at least one choice
    if (this.choices?.size == 1) return true;
    return super.hasChoices(number);
  }

  /** @inheritdoc */
  prepareChoices() {
    this.choices = new foundry.utils.Collection(
      this.constructor.inputs.map((input) => [
        input.key,
        {
          ...input,
          label: input.label ? game.i18n.localize(input.label) : undefined,
          placeholder: input.placeholder ? game.i18n.localize(input.placeholder) : undefined,
          type: input.type ?? "text",
        },
      ])
    );
  }

  /** @inheritdoc */
  reset() {
    this.choices.forEach((choice) => {
      choice.value = null;
      choice.active = false;
    });
  }

  /** @inheritDoc */
  activateListeners(html) {
    html.addEventListener("change", (event) => {
      const input = event.target;
      const value = input.value;
      const key = input.name.split("choice.").pop();
      const choice = this.choices.get(key);
      if (choice) {
        choice.value = this._parseInput(value, choice);
        choice.active = Boolean(value);
      }
      this.compendiumBrowser.render();
    });
  }

  /**
   * Parse the input before it is stored in the choice value.
   *
   * @param {string} textInput - The text input to parse.
   * @param {import("./base.mjs").FilterChoice} choice - The choice object for custom handle by choice.
   * @returns {string} - The parsed value if any transformation, otherwise the original string.
   */
  _parseInput(textInput, choice) {
    return textInput;
  }
}
