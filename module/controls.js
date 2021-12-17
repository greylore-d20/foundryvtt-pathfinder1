export const registerSystemControls = function () {
  game.keybindings.register("pf1", "skipConfirmPrompt", {
    name: "PF1.KEYBINDINGS.SkipConfirmPrompt.Name",
    uneditable: [
      {
        key: "SHIFT",
      },
    ],
    onDown: () => {
      game.pf1.skipConfirmPrompt = true;
    },
    onUp: () => {
      game.pf1.skipConfirmPrompt = false;
    },
  });

  game.keybindings.register("pf1", "hideTokenTooltip", {
    name: "PF1.KEYBINDINGS.HideTokenTooltip.Name",
    hint: game.i18n.localize("PF1.KEYBINDINGS.HideTokenTooltip.Hint"),
    uneditable: [
      {
        key: "CONTROL",
      },
    ],
    onDown: () => game.pf1.controls._hideTokenTooltip(true),
    onUp: () => game.pf1.controls._hideTokenTooltip(false),
  });

  game.keybindings.register("pf1", "hideTokenTooltipGMInfo", {
    name: "PF1.KEYBINDINGS.HideTokenTooltipGMInfo.Name",
    uneditable: [
      {
        key: "SHIFT",
      },
    ],
    restricted: true,
    onDown: () => game.pf1.controls._hideTokenTooltipGMInfo(true),
    onUp: () => game.pf1.controls._hideTokenTooltipGMInfo(false),
  });

  game.keybindings.register("pf1", "forceShowItem", {
    name: "PF1.KEYBINDINGS.ForceShowItem.Name",
    hint: game.i18n.localize("PF1.KEYBINDINGS.ForceShowItem.Hint"),
    uneditable: [
      {
        key: "CONTROL",
      },
    ],
    onDown: () => {
      game.pf1.forceShowItem = true;
    },
    onUp: () => {
      game.pf1.forceShowItem = false;
    },
  });
};

export const _hideTokenTooltipGMInfo = function (keyDown) {
  game.pf1.tokenTooltip.hideGMInfo = keyDown;
  return game.pf1.tooltip?.refresh();
};

export const _hideTokenTooltip = function (keyDown) {
  if (game.settings.get("pf1", "tooltipConfig")?.hideWithoutKey === true) game.pf1.tokenTooltip.hide = !keyDown;
  else game.pf1.tokenTooltip.hide = keyDown;
  return game.pf1.tooltip?.refresh();
};
