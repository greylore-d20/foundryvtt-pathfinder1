/**
 * Transforms a key input into an array of objects for the keybinding API
 *
 * @param {string} key - A key string
 * @returns {{"key": string}[]} Keybinding objects
 */
const getLeftRight = (key) => [`${key}Left`, `${key}Right`].map((k) => ({ key: k }));

const SHIFT_KEYS = getLeftRight("Shift");
const CTRL_KEYS = getLeftRight("Control");

/**
 * Registers the system's keybindings
 *
 * @internal
 */
export const registerSystemControls = () => {
  game.keybindings.register("pf1", "skipConfirmPrompt", {
    name: "PF1.KEYBINDINGS.SkipConfirmPrompt.Name",
    uneditable: SHIFT_KEYS,
    onDown: () => {
      pf1.skipConfirmPrompt = true;
    },
    onUp: () => {
      pf1.skipConfirmPrompt = false;
    },
  });

  game.keybindings.register("pf1", "forceShowItem", {
    name: "PF1.KEYBINDINGS.ForceShowItem.Name",
    hint: "PF1.KEYBINDINGS.ForceShowItem.Hint",
    uneditable: CTRL_KEYS,
    onDown: () => {
      pf1.forceShowItem = true;
    },
    onUp: () => {
      pf1.forceShowItem = false;
    },
  });
};
