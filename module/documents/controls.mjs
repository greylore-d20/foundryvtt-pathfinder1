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
 */
export const registerSystemControls = () => {
  game.keybindings.register("pf1", "skipConfirmPrompt", {
    name: "PF1.KEYBINDINGS.SkipConfirmPrompt.Name",
    uneditable: SHIFT_KEYS,
    onDown: () => {
      game.pf1.skipConfirmPrompt = true;
    },
    onUp: () => {
      game.pf1.skipConfirmPrompt = false;
    },
  });

  game.keybindings.register("pf1", "forceShowItem", {
    name: "PF1.KEYBINDINGS.ForceShowItem.Name",
    hint: game.i18n.localize("PF1.KEYBINDINGS.ForceShowItem.Hint"),
    uneditable: CTRL_KEYS,
    onDown: () => {
      game.pf1.forceShowItem = true;
    },
    onUp: () => {
      game.pf1.forceShowItem = false;
    },
  });

  game.keybindings.register("pf1", "hideTokenTooltip", {
    name: "PF1.KEYBINDINGS.HideTokenTooltip.Name",
    hint: game.i18n.localize("PF1.KEYBINDINGS.HideTokenTooltip.Hint"),
    uneditable: CTRL_KEYS,
    onDown: () => game.pf1.controls._hideTokenTooltip(true),
    onUp: () => game.pf1.controls._hideTokenTooltip(false),
  });

  game.keybindings.register("pf1", "hideTokenTooltipGMInfo", {
    name: "PF1.KEYBINDINGS.HideTokenTooltipGMInfo.Name",
    uneditable: SHIFT_KEYS,
    restricted: true,
    onDown: () => game.pf1.controls._hideTokenTooltipGMInfo(true),
    onUp: () => game.pf1.controls._hideTokenTooltipGMInfo(false),
  });
};

/**
 * Toggle the display of GM/Player info in the token tooltip
 *
 * @param {boolean} keyDown - Whether the key is pressed down
 * @returns {Promise<void>|void} A Promise that is resolved when the tooltip render handling is done
 */
export const _hideTokenTooltipGMInfo = (keyDown) => {
  game.pf1.tokenTooltip.hideGMInfo = keyDown;
  return game.pf1.tooltip?.refresh();
};

/**
 * Toggle the display of the token tooltip
 *
 * @param {boolean} keyDown - Whether the key is pressed down
 * @returns {Promise<void>|void} A Promise that is resolved when the tooltip render handling is done
 */
export const _hideTokenTooltip = (keyDown) => {
  if (game.settings.get("pf1", "tooltipConfig")?.hideWithoutKey === true) game.pf1.tokenTooltip.hide = !keyDown;
  else game.pf1.tokenTooltip.hide = keyDown;
  return game.pf1.tooltip?.refresh();
};
