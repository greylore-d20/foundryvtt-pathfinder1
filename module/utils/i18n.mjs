/**
 * Convert string array into joined string according to current language.
 *
 * @param {Array<string>} strings
 * @param {"c"|"d"|"u"} type - conjunction = and, disjunction = or, unit = neither. Only the first letter matters.
 * @param {boolean} short - If true, effectively same as type being set to "u"
 * @returns {string} - Formatted string of all traits.
 */
export function join(strings, type = "u", short = true) {
  type = {
    c: "conjunction",
    d: "disjunction",
    u: "unit",
  }[type[0]];

  return new Intl.ListFormat(game.i18n.lang, { style: short ? "short" : "long", type }).format(strings);
}
