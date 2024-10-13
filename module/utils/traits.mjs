/**
 *
 *
 * @param {{value?: [], custom?:[] }} traits
 * @param {Record<string, string>} lookup The lookup object used to pull the translation for the traits value
 * @param {'and'|'or'|','} [join]
 * @returns {string}
 */
export function traitsToString(traits, lookup, join = "and") {
  const all = translateTraits(traits, lookup);

  if (join === ",") return all.join(", ");

  if (!all.length) return "";
  if (all.length === 1) return all[0];

  const j = join === "and" ? game.i18n.localize("PF1.JoinAnd") : game.i18n.localize("PF1.JoinOr");

  if (all.length === 2) return all.join(` ${j} `);

  // 3 or more
  const last = all.pop();
  return `${all.join(", ")}, ${j} ${last}`;
}

export function translateTraits(traits, lookup) {
  const value = traits.value?.map((key) => lookup[key] || key) ?? [];
  const custom = traits.custom ?? [];
  return [...value, ...custom];
}
