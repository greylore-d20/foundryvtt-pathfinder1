/**
 * Flatten an object so that all nested objects are converted to dot-notation keys
 *
 * @param {object} object - The object to flatten
 * @param {number} depth - Track the recursion depth to prevent overflow
 * @returns {object} The flattened object
 */
export function flattenObject(object, depth = 0) {
  if (depth > 100) throw new Error("Maximum object flattening depth exceeded");
  const flattened = {};
  for (const [k, v] of Object.entries(object)) {
    const t = Object.prototype.toString.call(v).slice(8, -1);
    if (t === "Object") {
      if (isEmpty(v)) flattened[k] = v;
      const inner = flattenObject(v, depth + 1);
      for (const [ik, iv] of Object.entries(inner)) {
        flattened[`${k}.${ik}`] = iv;
      }
    } else flattened[k] = v;
  }
  return flattened;
}

/**
 * Expand a flattened object so that all dot-notation keys are converted to nested objects
 * Arrays are preserved as-is.
 *
 * @param {object} object - The object to expand
 * @returns {object} The expanded object
 */
export function expandObject(object) {
  const expanded = {};
  for (const [k, v] of Object.entries(object)) {
    setProperty(expanded, k, v);
  }
  return expanded;
}

/**
 * Set a property on an object using dot-notation
 *
 * @param {object} object - The object to modify
 * @param {string} path - The dot-notation path to the property
 * @param {*} value - The value to set
 */
export function setProperty(object, path, value) {
  const parts = path.split(".");
  const last = parts.pop();
  const parent = parts.reduce((o, p) => o[p] || (o[p] = {}), object);
  parent[last] = value;
}

/**
 * Determine whether an object has a property at a given path
 *
 * @param {object} object - The object to test
 * @param {string} path - The dot-notation path to the property
 * @returns {boolean} Whether the object has a property at the given path
 */
export function hasProperty(object, path) {
  const parts = path.split(".");
  const last = parts.pop();
  const parent = parts.reduce((o, p) => o[p] || (o[p] = {}), object);
  return last in parent;
}

/**
 * Get a property from an object using dot-notation
 *
 * @param {object} object - The object from which to retrieve the property
 * @param {string} path - The dot-notation path to the property
 * @returns {*} The value of the property
 */
export function getProperty(object, path) {
  const parts = path.split(".");
  const last = parts.pop();
  const parent = parts.reduce((o, p) => o[p] || (o[p] = {}), object);
  return parent[last];
}

/**
 * Determine whether an object or object like value is empty
 *
 * @param {object | Array<unknown> | null} object - The object to test
 * @returns {boolean} Whether the object is empty
 */
export function isEmpty(object) {
  if (Array.isArray(object)) return object.length === 0;
  else if (object instanceof Object) return Object.keys(object).length === 0;
  else if (object === undefined || object === null) return true;
  else return false;
}

/**
 * Generate an object containing all properties in `other` that differ from those in `original`.
 * If a property is an object, the function will recurse into that object.
 * If a property is an array, the function will consider empty arrays to be equal; otherwise, it will consider arrays to be different.
 * If a property is a primitive, the function will compare the values directly.
 *
 * @param {object} original - The original object to compare against
 * @param {object} other - The object whose properties should be compared to the original
 * @returns {object} An object containing all properties in `other` that differ from those in `original`
 */
export function diffObject(original, other) {
  /**
   * Recursively compare two objects, returning an object containing all properties in `other` that differ from those in `original`.
   *
   * @param {*} original - The original object to compare against
   * @param {*} other - The object whose properties should be compared to the original
   * @returns {[boolean, object]} An array containing a boolean indicating whether the objects are different, and an object containing all properties in `other` that differ from those in `original`
   */
  function _diff(original, other) {
    // If the two objects are identical, return false
    if (original === other) return [false, null];

    // If either object is not an object, compare the values directly
    if (!(original instanceof Object) || !(other instanceof Object)) {
      return [original !== other, other];
    }

    if (Array.isArray(original) && Array.isArray(other)) {
      // If both arrays are empty, return false
      if (original.length === 0 && other.length === 0) return [false, null];
      // Otherwise, compare the arrays directly
      return [original !== other, other];
    }

    // If both objects are empty, return false
    if (isEmpty(original) && isEmpty(other)) return [false, null];

    // Otherwise, compare the objects
    const diff = {};
    for (const [k, v] of Object.entries(other)) {
      const [isDifferent, difference] = _diff(original[k], v);
      if (isDifferent) diff[k] = difference;
    }
    return [!isEmpty(diff), diff];
  }

  // Ensure both objects are objects
  if (!(original instanceof Object) || !(other instanceof Object)) {
    throw new Error("Both arguments must be objects");
  }

  // Compare the objects
  const [isDifferent, difference] = _diff(original, other);
  return isDifferent ? difference : {};
}

/**
 * Merges the contents of the second object into the first object, recursively.
 *
 * @param {object} first - The object to insert values into.
 * @param {object} second - The object to get values from.
 * @returns {object} The merged result.
 */
export function mergeObject(first, second) {
  // Return non-object immediately
  if (typeof second !== "object" || second === undefined || second === null) {
    return second;
  }
  // Parse array
  if (second instanceof Array) {
    const result = [];
    for (let a = 0; a < second.length; a++) {
      result.push(mergeObject({}, second[a]));
    }
    return result;
  }
  // Parse object
  const result = typeof first === "object" ? first : {};
  for (const [k, v] of Object.entries(second)) {
    result[k] = mergeObject(result[k], v);
  }
  return result;
}
/**
 * Sluggify a string.
 *
 * This function will take a given string and strip it of non-machine-safe
 * characters, so that it contains only lowercase alphanumeric characters and
 * hyphens.
 *
 * @param {string} string String to sluggify.
 * @returns {string} The sluggified string
 */
export function sluggify(string) {
  return string
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .replace(/\s+|-{2,}/g, "-");
}
