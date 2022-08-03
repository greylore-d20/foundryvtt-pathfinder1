export class ChatMessagePF extends ChatMessage {
  get isRoll() {
    return this.type === CONST.CHAT_MESSAGE_TYPES.ROLL || this.getFlag("pf1", "noRollRender");
  }

  /**
   * Linked item.
   *
   * @type {ItemPF|undefined|null} - Null is returned if no item is linked, undefined if item is not found, and ItemPF otherwise.
   */
  get itemSource() {
    const itemId = this.system.flags?.pf1?.metadata?.item;
    if (itemId) {
      const actor = this.constructor.getSpeakerActor(this.system.speaker);
      return actor?.items.get(itemId);
    }
    return null;
  }

  /**
   * @type {boolean} True if item source is defined, regardless if that item source still exists.
   */
  get hasItemSource() {
    return this.system.flags?.pf1?.metadata?.item !== undefined;
  }

  /**
   * Return associated template or null.
   *
   * @type {MeasuredTemplatePF}
   */
  get measureTemplate() {
    const templateId = this.system.flags?.pf1?.metadata?.template;
    if (!templateId) return null;
    const template = canvas.templates.get(templateId);
    return template || null;
  }

  /**
   * @returns {TokenPF[]} The tokens which were targeted with this chat card.
   */
  get targets() {
    const targetIds = this.system.flags?.pf1?.metadata?.targets ?? [];
    return canvas.tokens.placeables.filter((o) => targetIds.includes(o.id));
  }
}

/**
 * @typedef {object} ChatMessagePFIdentifiedInfo
 * @property {boolean} identified - True if item was identified when rolled.
 * @property {string} name - Name of the identified item.
 * @property {string} description - Description of the identified item.
 * @property {string} [actionName] - Name of the action that was used
 * @property {string} [actionDescription] - Description of the action that was used
 */

// Returns a promise to the created chatMessage or false if no command was executed
export const customRolls = function (message, speaker, rollData) {
  if (message.match(/^\/(\w+)(?: +([^#]+))(?:#(.+))?/)) {
    const type = RegExp.$1?.toUpperCase();
    const value = RegExp.$2;
    const flavor = RegExp.$3;
    const cMsg = CONFIG.ChatMessage.documentClass;

    speaker = speaker ?? cMsg.getSpeaker();
    const actor = cMsg.getSpeakerActor(speaker);
    const scene = speaker.scene ? game.scenes.get(speaker.scene) : canvas.scene;
    const tokenDocument = scene?.tokens.get(speaker.token);
    const tokenUuid = tokenDocument?.uuid;

    switch (type) {
      case "D":
      case "DAMAGE":
      case "H":
      case "HEAL": {
        rollData = rollData ?? actor?.getRollData() ?? {};
        const roll = Roll.create(value, rollData).roll();

        return roll.then(async (roll) => {
          const total = roll.total;
          const isHealing = type === "HEAL" || type === "H";
          const content = await renderTemplate("systems/pf1/templates/chat/simple-damage.hbs", {
            tokenId: tokenUuid,
            isHealing,
            css: isHealing ? "heal" : "damage",
            roll,
          });
          const chatOptions = {
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            roll: roll,
            flavor,
            speaker: speaker,
            rollMode: game.settings.get("core", "rollMode"),
            content: content,
            flags: { pf1: { subject: { health: isHealing ? "healing" : "damage" } } },
          };
          cMsg.create(chatOptions);
        });
      }
    }
  }
  return false;
};
