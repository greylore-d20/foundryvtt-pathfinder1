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

  game.keybindings.register("pf1", "hideTokenTooltip", {
    name: "PF1.KEYBINDINGS.HideTokenTooltip.Name",
    hint: "PF1.KEYBINDINGS.HideTokenTooltip.Hint",
    uneditable: CTRL_KEYS,
    onDown: () => pf1.documents.controls._hideTokenTooltip(true),
    onUp: () => pf1.documents.controls._hideTokenTooltip(false),
  });

  game.keybindings.register("pf1", "hideTokenTooltipGMInfo", {
    name: "PF1.KEYBINDINGS.HideTokenTooltipGMInfo.Name",
    uneditable: SHIFT_KEYS,
    restricted: true,
    onDown: () => pf1.documents.controls._hideTokenTooltipGMInfo(true),
    onUp: () => pf1.documents.controls._hideTokenTooltipGMInfo(false),
  });

  game.keybindings.register("pf1", "stickyTokenTooltip", {
    name: "PF1.KEYBINDINGS.StickyTokenTooltip.Name",
    hint: "PF1.KEYBINDINGS.StickyTokenTooltip.Hint",
    onDown: () => pf1.documents.controls._stickyTokenTooltip(true),
    onUp: () => pf1.documents.controls._stickyTokenTooltip(false),
  });
};

/**
 * Toggle the display of GM/Player info in the token tooltip
 *
 * @internal
 * @param {boolean} keyDown - Whether the key is pressed down
 * @returns {Promise<void>|void} A Promise that is resolved when the tooltip render handling is done
 */
export const _hideTokenTooltipGMInfo = (keyDown) => {
  if (!pf1.tooltip) return;
  pf1.tooltip.forceHideGMInfo = keyDown;
  pf1.tooltip.refresh();
};

/**
 * @internal
 * @param {*} stickify
 */
export const _stickyTokenTooltip = (stickify) => {
  if (!pf1.tooltip) return;
  pf1.tooltip.sticky = stickify;
};

/**
 * Toggle the display of the token tooltip
 *
 * @internal
 * @param {boolean} keyDown - Whether the key is pressed down
 * @returns {Promise<void>|void} A Promise that is resolved when the tooltip render handling is done
 */
export const _hideTokenTooltip = (keyDown) => {
  if (!pf1.tooltip) return;
  if (game.settings.get("pf1", "tooltipConfig")?.hideWithoutKey === true) pf1.tooltip.forceHide = !keyDown;
  else pf1.tooltip.forceHide = keyDown;
  pf1.tooltip.refresh();
};
