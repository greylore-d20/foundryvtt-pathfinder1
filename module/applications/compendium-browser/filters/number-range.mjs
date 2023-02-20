import { BaseFilter } from "./base.mjs";

/**
 * A filter that allows the user to input a minimum and maximum value.
 */
export class NumberRangeFilter extends BaseFilter {
  static TEMPLATE = "systems/pf1/templates/apps/compendium-browser/minmax-filter.hbs";

  /** @inheritDoc */
  prepareChoices() {
    const inputs = [
      { key: "min", label: "PF1.Minimum", placeholder: "0" },
      { key: "max", label: "PF1.Maximum", placeholder: "∞" },
    ];
    this.choices = new foundry.utils.Collection(
      inputs.map((input) => [input.key, { ...input, label: game.i18n.localize(input.label) }])
    );
  }

  /** @inheritDoc */
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
        choice.value = Number(value) || null;
        choice.active = Boolean(value);
      }
      this.compendiumBrowser.render();
    });
  }

  /** @inheritDoc */
  applyFilter(entry) {
    const value = foundry.utils.getProperty(entry, this.constructor.indexField) ?? 0;
    const min = this.choices.get("min").value ?? 0;
    const max = this.choices.get("max").value ?? Number.POSITIVE_INFINITY;
    if (value < min) return false;
    if (value > max) return false;
    return true;
  }
}
