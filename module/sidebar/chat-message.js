export class ChatMessagePF extends ChatMessage {
  get isRoll() {
    return this.data.type === CONST.CHAT_MESSAGE_TYPES.ROLL || this.getFlag("pf1", "noRollRender");
  }

  /**
   * Return linked item or falsey
   * @type {ItemPF}
   */
  get itemSource() {
    let itemId = this.data.flags?.pf1?.metadata?.item;
    let actor = this.constructor.getSpeakerActor(this.data.speaker);
    if (!itemId || !actor) return false;
    return actor.items.get(itemId);
  }
}
