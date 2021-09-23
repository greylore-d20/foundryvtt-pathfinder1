// source: https://github.com/30-seconds/30-seconds-of-code/blob/master/snippets/slugify.md
export const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Generates a unique key within a list.
 *
 * @param {string[]} keys - All the current keys to compare to.
 * @param {string} name - The name to try to create. Will append a number if the key created from it is not unique.
 * @returns {string} The actual new name to take.
 */
export const uniqueKey = (keys, name = "New Item") => {
  let count = 2;
  let result = name;

  while (keys.includes(slugify(result))) {
    result = `${name} ${count}`;
    count++;
  }

  return result;
};
