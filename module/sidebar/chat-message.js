export class ChatMessagePF extends ChatMessage {
  get isRoll() {
    return this.data.type === CONST.CHAT_MESSAGE_TYPES.ROLL || this.getFlag("pf1", "noRollRender");
  }

  /**
   * Return linked item or falsey
   *
   * @type {ItemPF}
   */
  get itemSource() {
    const itemId = this.data.flags?.pf1?.metadata?.item;
    const actor = this.constructor.getSpeakerActor(this.data.speaker);
    if (!itemId || !actor) return false;
    return actor.items.get(itemId);
  }

  /**
   * Return associated template or null.
   *
   * @type {MeasuredTemplatePF}
   */
  get measureTemplate() {
    const templateId = this.data.flags?.pf1?.metadata?.template;
    if (!templateId) return null;
    const template = canvas.templates.get(templateId);
    return template || null;
  }

  /**
   * @returns {TokenPF[]} The tokens which were targeted with this chat card.
   */
  get targets() {
    const targetIds = this.data.flags?.pf1?.metadata?.targets ?? [];
    return canvas.tokens.placeables.filter((o) => targetIds.includes(o.id));
  }
}

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
    const tokenDocument = scene.tokens.get(speaker.token);
    const tokenUuid = tokenDocument?.uuid;

    switch (type) {
      case "D":
      case "DAMAGE":
      case "H":
      case "HEAL": {
        rollData = rollData ?? actor?.getRollData() ?? {};
        const roll = RollPF.safeRoll(value, rollData);
        const total = roll.total;

        return (async () => {
          const content = await renderTemplate("systems/pf1/templates/chat/simple-damage.hbs", {
            tokenId: tokenUuid,
            isHealing: type === "HEAL" || type === "H",
            roll,
          });
          const chatOptions = {
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            roll: roll,
            flavor,
            speaker: speaker,
            rollMode: game.settings.get("core", "rollMode"),
            content: content,
          };
          cMsg.create(chatOptions);
        })();
      }
    }
  }
  return false;
};
