const getMessage = (html) => game.messages.get(html.dataset.messageId);
const isOwnedSpellCard = (msg) => {
  const item = msg.itemSource;
  return item && item.type === "spell" && item.isOwner && !!item.actor;
};

/**
 * @param _
 * @param {object[]} entries - Context menu entries
 */
function spellCardContextMenu(_, entries) {
  entries.unshift(
    {
      name: "PF1.ConcentrationCheck",
      icon: '<i class="fa-solid fa-brain context-icon pf1 concentration"></i>',
      condition: ([html]) => isOwnedSpellCard(getMessage(html)),
      callback: ([html]) => {
        const msg = getMessage(html);
        const item = msg.itemSource;
        const actor = item?.actor;
        actor.rollConcentration(item.system.spellbook, { messageId: msg.id });
      },
    },
    {
      name: "PF1.CasterLevelCheck",
      icon: '<i class="fa-solid fa-wand-magic-sparkles context-icon pf1 caster-level"></i>',
      condition: ([html]) => isOwnedSpellCard(getMessage(html)),
      callback: ([html]) => {
        const msg = getMessage(html);
        const item = msg.itemSource;
        const actor = item?.actor;
        actor.rollCL(item.system.spellbook, { messageId: msg.id });
      },
    }
    // TODO: Roll ASF option
  );
}

Hooks.on("getChatLogEntryContext", spellCardContextMenu);
