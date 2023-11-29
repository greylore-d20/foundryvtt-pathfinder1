import Color from "color";

/**
 * @param {string} chatTemplate - Chat message template path.
 * @param {object} chatTemplateData - Data to feed to the chat message template.
 * @param {object} chatData - Chat message data, excluding content.
 * @param {object} [options] - Additional options
 * @param {Roll[]} [options.rolls=[]] - Array of roll instances
 * @returns {Promise<ChatMessage>} - Generated chat message instance.
 */
export async function createCustomChatMessage(chatTemplate, chatTemplateData = {}, chatData = {}, { rolls = [] } = {}) {
  chatData.user ??= game.user.id;
  chatData.type ??= CONST.CHAT_MESSAGE_TYPES.CHAT;

  chatData.content = await renderTemplate(chatTemplate, chatTemplateData);
  chatData.rollMode ??= game.settings.get("core", "rollMode");

  // Handle different roll modes
  ChatMessage.implementation.applyRollMode(chatData, chatData.rollMode);

  // Dice So Nice integration
  if (chatData.roll != null && rolls.length === 0) rolls = [chatData.roll];
  if (game.dice3d != null && game.dice3d.isEnabled()) {
    for (const roll of rolls) {
      await game.dice3d.showForRoll(roll, game.user, false, chatData.whisper, chatData.blind);
      chatData.sound = null;
    }
  }

  return ChatMessage.implementation.create(chatData);
}

/**
 * @param {ChatMessage} cm - Chat message instance
 * @param {JQuery<HTMLElement>} jq - JQuery instance
 * @param {object} data  - Render options
 */
export function hideRollInfo(cm, jq, data) {
  const whisper = cm.whisper || [];
  const isBlind = whisper.length && cm.blind;
  const isVisible = whisper.length ? whisper.includes(game.user.id) || (cm.isAuthor && !isBlind) : true;
  if (!isVisible) {
    jq.find(".dice-formula").text("???");
    jq.find(".dice-total").text("?");
    jq.find(".dice").text("");
    jq.find(".success").removeClass("success");
    jq.find(".failure").removeClass("failure");
  }
}

/**
 * Generates an info block containing an item's identified info for GMs
 *
 * @remarks This HTML has to be generated in a synchronous way, as adding to a rendered chat message's content
 *          will cause erratic scrolling behaviour.
 * @param {ChatMessagePFIdentifiedInfo} info - An object containing the item's identified info
 * @returns {string} HTML string containing the info block
 */
function getIdentifiedBlock(info) {
  const hasCombinedName = info.actionName && !info.actionDescription;
  return (
    _templateCache["systems/pf1/templates/chat/parts/gm-description.hbs"]?.(
      { ...info, hasCombinedName },
      { allowProtoMethodsByDefault: true, allowProtoPropertiesByDefault: true }
    ) ?? ""
  );
}

/**
 * Add GM-sensitive info for GMs and hide GM-sensitive info for players
 *
 * @param {ChatMessagePF} cm - The chat message
 * @param {JQuery} html - The chat message's HTML
 * @param {object} data - Data used to render the chat message
 */
export function hideGMSensitiveInfo(cm, html, data) {
  // Handle adding of GM-sensitive info
  if (game.user.isGM) {
    // Show identified info box for GM if item was unidentified when rolled
    const identifiedInfo = cm.flags.pf1?.identifiedInfo ?? {};
    const { identified = true } = identifiedInfo;
    if (!identified && cm.hasItemSource) {
      const cardContent = html.find(".card-content");
      cardContent.append(getIdentifiedBlock(identifiedInfo));
    }
    // Return early, as the rest of the function handles removing already existing info
    return;
  }

  // Hide info that's always sensitive, no matter the card's owner
  html.find(".gm-sensitive-always").remove();

  // Hide info about unowned tokens
  html.find("[data-gm-sensitive-uuid]").each((a, elem) => {
    // Quickly hide element
    elem = $(elem);
    elem.hide();

    // Then check for stuff
    const uuid = elem.data("gm-sensitive-uuid");
    if (!uuid) return;
    fromUuid(uuid).then((obj) => {
      // If token or token document, get actor for testing user permissions
      if (obj instanceof Token || obj instanceof TokenDocument) obj = obj.actor;
      //  Show element again, since we have permission
      if (obj?.testUserPermission && obj.testUserPermission(game.user, "OBSERVER")) {
        elem.show();
      }
      // Remove element completely, since we don't have permission
      else {
        elem.remove();
      }
    });
  });

  const actor = ChatMessage.getSpeakerActor(cm.speaker);
  // Exit if allowed to see, followup is for hiding info
  if (actor?.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER)) return;

  // Hide info
  html.find(".gm-sensitive").remove();

  // Alter GM inner texts
  html.find("[data-gm-sensitive-inner]").each((a, elem) => {
    if (!game.settings.get("pf1", "obscureSaveDCs") && elem.dataset.action === "save") return;

    elem = $(elem);
    elem.text(elem.data("gm-sensitive-inner"));
    elem.removeData("gm-sensitive-inner");
  });

  if (game.settings.get("pf1", "obscureInlineRolls")) {
    // Turn rolls into raw strings
    html.find(".inline-roll").each((a, elem) => {
      if (!elem.dataset.roll) {
        return;
      }

      const roll = Roll.fromJSON(unescape(elem.dataset.roll));
      const parent = elem.parentNode;
      parent.insertBefore($(`<span>${roll.total}</span>`)[0], elem);
      parent.removeChild(elem);
    });
  }
}

/**
 * @param {ChatMessage} cm - Chat message instance
 * @param {JQuery<HTMLElement>} jq - JQuery instance
 */
export function alterAmmoRecovery(cm, jq) {
  const recoveryData = cm.getFlag("pf1", "ammoRecovery");
  if (!recoveryData) return;

  jq.find(".chat-attack .ammo[data-ammo-id]").each((a, el) => {
    const attackIndex = el.closest(".chat-attack").dataset.index;
    const ammoId = el.dataset.ammoId;
    const data = recoveryData[attackIndex]?.[ammoId];
    if (!data) return;
    $(el)
      .find(".inline-action")
      .each((i, ia) => {
        // TODO: Disable button & track proper quantities
        if (data.recovered) ia.classList.add("recovered");
        if (data.failed) ia.classList.add("recovery-failed");
      });
  });
}

/**
 * @param {ChatMessage} cm - Chat message instance
 * @param {JQuery<HTMLElement>} jq - JQuery instance
 */
export function alterTargetDefense(cm, jq) {
  const defenseData = cm.getFlag("pf1", "targetDefense");
  if (!defenseData) return;

  jq.find(".attack-targets .saving-throws div[data-saving-throw]").each((a, el) => {
    const actorUUID = el.closest(".target").dataset.uuid;
    const save = el.dataset.savingThrow;
    const value = getProperty(defenseData, `${actorUUID}.save.${save}`);
    if (value == null) return;
    $(el).find(".value").text(value.toString());
  });
}

/**
 * @param app
 * @param html
 * @param data
 * @param conf
 */
export function applyAccessibilitySettings(app, html, data, conf) {}

/**
 * Returns an inline roll string suitable for chat messages.
 *
 * @param {Roll} roll - The roll to be stringified
 * @param {object} [options] - Additional options affecting the inline roll
 * @param {boolean} [options.hide3d] - Whether the roll should be hidden from DsN
 * @returns {string} The inline roll string
 */
export function createInlineRollString(roll, { hide3d = true } = {}) {
  return `<a class="inline-roll inline-result ${hide3d ? "inline-dsn-hidden" : ""}" \
  data-tooltip="${roll.formula}" data-roll="${escape(JSON.stringify(roll))}"> \
  <i class="fas fa-dice-d20"></i> ${roll.total}</a>`;
}

/**
 * @param {ChatMessage} cm - Chat message instance
 * @param {JQuery<HTMLElement>} jq - JQuery instance
 */
export async function hideInvisibleTargets(cm, jq) {
  const targetElems = jq.find(".attack-targets .target");
  const targets = targetElems.toArray().reduce((cur, o) => {
    cur.push({ uuid: o.dataset.uuid, elem: o });
    return cur;
  }, []);

  for (const t of targets) {
    const elem = $(t.elem);

    // Gather token
    const token = await fromUuid(t.uuid);
    if (!token) continue;
    t.token = token.object;

    // Hide if token invisible
    if (!t.token?.visible) elem.hide();
    else elem.show();
  }
}

/**
 * @param {ChatMessage} cm - Chat message instance
 * @param {JQuery<HTMLElement>} jq - JQuery instance
 */
export function addTargetCallbacks(cm, jq) {
  const targetElems = jq.find(".attack-targets .target[data-uuid]");

  // Define getter functions
  const _getTokenByElem = async function (elem) {
    return (await fromUuid(elem?.dataset.uuid ?? ""))?.object;
  };
  const _getRootTargetElement = function (elem) {
    if (elem.dataset.uuid != null) return elem;
    return elem.closest("[data-uuid]");
  };

  // Create image callback functions
  const _mouseEnterCallback = function (event) {
    _getTokenByElem(_getRootTargetElement(event.currentTarget)).then((t) => {
      t?._onHoverIn(event, { hoverOutOthers: false });
    });
  };
  const _mouseLeaveCallback = function (event) {
    _getTokenByElem(_getRootTargetElement(event.currentTarget)).then((t) => {
      t?._onHoverOut(event);
    });
  };
  const _imageClickCallback = function (event) {
    event.preventDefault();
    _getTokenByElem(_getRootTargetElement(event.currentTarget)).then((t) => {
      if (t?.actor.testUserPermission(game.user, "OWNER")) {
        if (t._controlled) {
          if (event.shiftKey) t.release();
        } else {
          t.control({ releaseOthers: !event.shiftKey });
        }
      }
    });
  };

  // Add callbacks
  for (let elem of targetElems) {
    elem = $(elem);

    // Image element events
    const imgElem = elem.find(".target-image");
    imgElem.on("mouseenter", _mouseEnterCallback);
    imgElem.on("mouseleave", _mouseLeaveCallback);
    imgElem.on("click", _imageClickCallback);

    // Misc element events
    elem.find(".ac").on("click", (event) => {
      event.preventDefault();

      _getTokenByElem(_getRootTargetElement(event.currentTarget)).then((t) => {
        if (!t?.actor) return;
        pf1.utils.chat.targetACClick(cm, jq, t.actor, event);
      });
    });
    elem.find(".saving-throws .click").on("click", (event) => {
      event.preventDefault();

      _getTokenByElem(_getRootTargetElement(event.currentTarget)).then((t) => {
        if (!t?.actor) return;
        pf1.utils.chat.targetSavingThrowClick(cm, jq, t.actor, event);
      });
    });
  }
}

/**
 * @param {ChatMessage}  cm - Chat message instance
 * @param {JQuery<HTMLElement>} jq - JQuery instance
 * @param {Actor} actor - Actor instance
 * @param {Event} event - Triggering event
 */
export async function targetACClick(cm, jq, actor, event) {
  actor.displayDefenseCard({ rollMode: "selfroll" });
}

/**
 * @param {ChatMessage}  cm - Chat message instance
 * @param {JQuery<HTMLElement>} jq - JQuery instance
 * @param {Actor} actor - Actor instance
 * @param {Event} event - Triggering event
 */
export async function targetSavingThrowClick(cm, jq, actor, event) {
  const elem = event.currentTarget;
  const save = elem.dataset.savingThrow;

  const message = await actor.rollSavingThrow(save, { event });
  const total = message?.rolls?.[0]?.total;

  // Replace saving throw value on original chat card's target
  if (total != null) {
    const actorUUID = elem.closest(".target").dataset.uuid;
    await cm.setFlag("pf1", "targetDefense", { [actorUUID]: { save: { [save]: total } } });
  }
}
