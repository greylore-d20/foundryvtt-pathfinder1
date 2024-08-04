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

  /** @inheritDoc */
  applyFilter(entry) {
    const value = foundry.utils.getProperty(entry, this.constructor.indexField) ?? 0;
    const min = this.choices.get("min").value ?? 0;
    const max = this.choices.get("max").value ?? Number.POSITIVE_INFINITY;
    if (value < Number(min)) return false;
    if (value > Number(max)) return false;
    return true;
  }
}
