export class ChatMessagePF extends ChatMessage {
  /**
   * Replaces all roll data object in a given object with {@link Roll} instances
   *
   * @param {object} maybeRollObject - The object to replace roll data objects with {@link Roll} instances
   * @returns {object} The object with all roll data objects replaced with {@link Roll} instances
   * @private
   */
  static _initRollObject(maybeRollObject) {
    // If object is an array, map to roll objects
    if (Array.isArray(maybeRollObject)) {
      return maybeRollObject.map((o) => this._initRollObject(o));
    }

    // If this is a roll object, initialize it
    if (maybeRollObject != null && typeof maybeRollObject === "object" && "class" in maybeRollObject) {
      return Roll.fromData(maybeRollObject);
    }

    // If object is a regular object, recurse into it to find roll to initialise
    if (typeof maybeRollObject === "object" && maybeRollObject != null) {
      for (const [k, v] of Object.entries(maybeRollObject)) {
        maybeRollObject[k] = this._initRollObject(v);
      }
    }
    // Return object in which all roll data has been replaced by Roll instances
    return maybeRollObject;
  }

  /**
   * Linked item.
   *
   * @type {ItemPF|undefined|null} - Null is returned if no item is linked, undefined if item is not found, and ItemPF otherwise.
   */
  get itemSource() {
    const itemId = this.flags?.pf1?.metadata?.item;
    if (itemId) {
      const actor = this.constructor.getSpeakerActor(this.speaker);
      return actor?.items.get(itemId);
    }
    return null;
  }

  /**
   * @type {boolean} True if item source is defined, regardless if that item source still exists.
   */
  get hasItemSource() {
    return this.flags?.pf1?.metadata?.item !== undefined;
  }

  /** @type {MeasuredTemplatePF|null} - Associated measured template */
  get measureTemplate() {
    const templateId = this.flags?.pf1?.metadata?.template;
    if (!templateId) return null;

    return fromUuidSync(templateId) ?? canvas.templates.get(templateId) ?? null;
  }

  /**
   * @returns {TokenPF[]} The tokens which were targeted with this chat card.
   */
  get targets() {
    const targetIds = this.flags?.pf1?.metadata?.targets ?? [];
    if (targetIds.length === 0) return targetIds;

    // Legacy IDs from old messages
    if (/^\w{16}$/.test(targetIds[0])) return canvas.tokens.placeables.filter((o) => targetIds.includes(o.id));

    return targetIds.map((uuid) => fromUuidSync(uuid)?.object).filter((t) => !!t);
  }

  /** @inheritDoc */
  prepareDerivedData() {
    super.prepareDerivedData();

    /**
     * An object containing Pathfinder specific rolls for this chat message,
     * with a structure grouping them by their purpose.
     *
     * @type {object}
     */
    this.systemRolls = this.constructor._initRollObject(this.flags?.pf1?.metadata?.rolls ?? {});
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

    speaker = speaker ?? ChatMessage.implementation.getSpeaker();
    const actor = ChatMessage.implementation.getSpeakerActor(speaker);
    const scene = speaker.scene ? game.scenes.get(speaker.scene) : canvas.scene;
    const tokenDocument = scene?.tokens.get(speaker.token);
    const tokenUuid = tokenDocument?.uuid;

    switch (type) {
      case "D":
      case "DAMAGE":
      case "H":
      case "HEAL": {
        rollData = rollData ?? actor?.getRollData() ?? {};
        const roll = new Roll(value, rollData).evaluate();

        return roll.then(async (roll) => {
          const total = roll.total;
          const isHealing = type === "HEAL" || type === "H";
          const content = await renderTemplate("systems/pf1/templates/chat/simple-damage.hbs", {
            tokenId: tokenUuid,
            isHealing,
            css: isHealing ? "heal" : "damage",
            value: {
              total: roll.total * (isHealing ? -1 : 1),
              half: Math.floor(roll.total / 2) * (isHealing ? -1 : 1),
            },
            roll,
          });
          const chatOptions = {
            rolls: [roll],
            flavor,
            sound: CONFIG.sounds.dice,
            speaker: speaker,
            rollMode: game.settings.get("core", "rollMode"),
            content: content,
            flags: { pf1: { subject: { health: isHealing ? "healing" : "damage" } } },
          };
          ChatMessage.implementation.create(chatOptions);
        });
      }
    }
  }
  return false;
};
