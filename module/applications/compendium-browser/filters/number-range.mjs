import { TextFilter } from "./text.mjs";

/**
 * A filter that allows the user to input a minimum and maximum value.
 */
export class NumberRangeFilter extends TextFilter {
  /** @inheritdoc */
  static inputs = [
    { key: "min", label: "PF1.Minimum", placeholder: "0", type: "number" },
    { key: "max", label: "PF1.Maximum", placeholder: "∞", type: "number" },
  ];

  /** @inheritdoc */
  _parseInput(textInput, choice) {
    let parsedInput = super._parseInput(textInput, choice);
    if (choice.key === "min") {
      parsedInput = Number(parsedInput) || 0;
    } else if (choice.key === "max") {
      parsedInput = Number(parsedInput) || Number.POSITIVE_INFINITY;
    } else {
      throw new Error("Invalid choice key for NumberRangeFilter");
    }
    return parsedInput;
  }

  /** @inheritDoc */
  applyFilter(entry) {
    const value = foundry.utils.getProperty(entry, this.constructor.indexField) ?? 0;
    const min = this.choices.get("min").value;
    const max = this.choices.get("max").value;
    if (value < min || value > max) return false;
    return true;
  }
}
