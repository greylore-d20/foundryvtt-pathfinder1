/**
 * Translate and combine traits.
 *
 * This sets .total on the traits object as translated set of both values and custom entries.
 *
 * @internal
 * @param {{value: Array<string>, custom: Array<string>}} traits - Trait data structure
 * @param {Record<string,string>} lookup - Label lookup record
 */
export function translate(traits, lookup) {
  const value = traits.value?.map((key) => lookup[key] || key) ?? [];
  const custom = traits.custom ?? [];
  traits.total = new Set([...value, ...custom]);
}
