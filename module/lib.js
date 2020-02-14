/**
 * Creates a tag from a string.
 * For example, if you input the string "Wizard of Oz 2", you will get "wizardOfOz2"
 */
export const createTag = function(str) {
  return str.replace(/[^a-zA-Z0-9\s]/g, "").split(/\s+/).map((s, a) => {
    s = s.toLowerCase();
    if (a > 0) s = s.substring(0, 1).toUpperCase() + s.substring(1);
    return s;
  }).join("");
};

/**
 * Alters a roll in string form.
 */
export const alterRoll = function(str, add, multiply) {
  const rgx = new RegExp(Die.rgx.die, "g");
  return str.replace(rgx, (match, nd, d, mods) => {
    nd = (nd * (multiply || 1)) + (add || 0);
    mods = mods || "";
    return nd + "d" + d + mods;
  });
};