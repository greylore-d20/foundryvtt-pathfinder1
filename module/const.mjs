/**
 * Action type to change context mapping.
 *
 * @see {pf1.documents.item.ItemPF.prototype.getContextChanges}
 */
export const actionTypeToContext = {
  mwak: "wmdamage",
  twak: "twdamage",
  rwak: "rwdamage",
  msak: "sdamage",
  rsak: "sdamage",
  spellsave: "sdamage",
};

/**
 * Message visibility
 *
 * Message visibility mode (roll mode) to non-roll message mapping.
 *
 * This will be obsoleted by Foundry ~v13
 */
export const messageVisibility = {
  publicroll: "PF1.Chat.Visibility.Public",
  gmroll: "PF1.Chat.Visibility.Private",
  blindroll: "PF1.Chat.Visibility.Blind",
  selfroll: "PF1.Chat.Visibility.Self",
};
