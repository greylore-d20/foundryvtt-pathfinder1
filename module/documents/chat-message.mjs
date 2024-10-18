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
   * Linked action.
   *
   * @type {ItemAction|undefined|null} - Null is returned if no action is linked and ItemAction otherwise.
   */
  get actionSource() {
    const id = this.flags?.pf1?.metadata?.action;
    return id ? this.itemSource?.actions.get(id) : null;
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
   * @deprecated
   * @type {boolean} True if item source is defined, regardless if that item source still exists.
   */
  get hasItemSource() {
    foundry.utils.logCompatibilityWarning(
      "ChatMessagePF.hasItemSource has been deprecated in favor of ChatMessagePF.itemSource",
      {
        since: "PF1 vNEXT",
        until: "PF1 vNEXT+1",
      }
    );
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
