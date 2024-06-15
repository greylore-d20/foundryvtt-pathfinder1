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

    let obj = fromUuidSync(uuid);
    // If token or token document, get actor for testing user permissions
    // TODO: This should no longer be necessary with Foundry v11, unlinked actors give actor directly.
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
      if (!elem.dataset.roll) return;

      let roll;
      try {
        roll = Roll.fromJSON(unescape(elem.dataset.roll));
      } catch (err) {
        console.error(`Inline roll in chat message ${cm.id} had invalid data`, err);
        return;
      }

      const nroll = Roll.defaultImplementation.safeRollSync(`${roll.total}`);
      elem.dataset.roll = escape(JSON.stringify(nroll));
      delete elem.dataset.tooltip;
      elem.classList.add("obfuscated");
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
    const { recovered } = data;
    $(el)
      .find(".inline-action")
      .each((i, ia) => {
        // TODO: Disable button & track proper quantities
        // TODO: Mark partial recovery
        if (recovered === undefined) return;
        else if (recovered > 0) ia.classList.add("recovered");
        else ia.classList.add("recovery-failed");
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
    const value = foundry.utils.getProperty(defenseData, `${actorUUID}.save.${save}`);
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
 * @deprecated
 * @param {Roll} roll - The roll to be stringified
 * @param {object} [options] - Additional options affecting the inline roll
 * @param {boolean} [options.hide3d] - Whether the roll should be hidden from DsN
 * @returns {string} The inline roll string
 */
export function createInlineRollString(roll, { hide3d = true } = {}) {
  foundry.utils.logCompatibilityWarning("pf1.utils.chat.createInlineRollString() is deprecated with no replacement", {
    since: "PF1 v10",
    until: "PF1 v11",
  });

  const a = roll.toAnchor();
  if (hide3d) a.classList.add("inline-dsn-hidden");
  return a.outerHTML;
}

/**
 * @param {ChatMessage} cm - Chat message instance
 * @param {HTMLElement} html - HTML element
 * @param recursive
 */
export async function hideInvisibleTargets(cm, html, recursive = false) {
  const targetsElem = html.querySelector(".pf1.chat-card .attack-targets");
  if (!targetsElem) return; // No targets

  // Delay until canvas ready if it's not yet so.
  if (!canvas.ready) {
    if (recursive) return;
    targetsElem.style.display = "none";
    if (!game.settings.get("core", "noCanvas")) {
      Hooks.once("canvasReady", () => hideInvisibleTargets(cm, html, true));
    } else {
      // Canvas disabled, remove targets
      targetsElem.remove();
    }
    return;
  }

  const targetElems = targetsElem.querySelectorAll(".target");
  const targets = Array.from(targetElems).map((elem) => ({ uuid: elem.dataset.uuid, elem }));

  let hasVisible = false;
  for (const t of targets) {
    /** @type {TokenDocumentPF} */
    const token = fromUuidSync(t.uuid);
    if (!token) continue;
    t.token = token.object;

    const isVisible = t.token?.isVisible;
    const isObserver = token.actor?.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER) ?? false;

    // Hide if token invisible and user isn't observer of token
    if (!isVisible && !isObserver) $(t.elem).hide();
    else {
      hasVisible = true;
      $(t.elem).show();
    }
  }

  // Hide targets if there's none visible to not reveal presence of invisible targets
  if (!hasVisible) targetsElem.remove();
  else targetElems.style.removeProperty("display");
}

const getTokenByUuid = (uuid) => fromUuidSync(uuid)?.object;

/**
 * Pan to defined token
 *
 * Provided here to allow overriding the behaviour.
 *
 * @internal
 * @param {Token} token - Token to pan to
 * @param {number} [duration=250] - Animation duration
 */
export function panToToken(token, duration = 250) {
  canvas.animatePan({ ...token.center, duration });
}

/**
 * @param {ChatMessage} cm - Chat message instance
 * @param {JQuery<HTMLElement>} jq - JQuery instance
 */
export function addTargetCallbacks(cm, jq) {
  const targetElems = jq[0].querySelectorAll(".attack-targets .target[data-uuid]");

  // Define getter functions
  /**
   * @param {HTMLElement} elem
   * @returns {TokenPF|undefined}
   */
  function _getTokenByElem(elem) {
    return fromUuidSync(elem?.dataset.uuid ?? "")?.object;
  }

  /**
   * @param {HTMLElement} elem
   * @returns {HTMLElement}
   */
  const _getRootTargetElement = function (elem) {
    if (elem.dataset.uuid) return elem;
    return elem.closest("[data-uuid]");
  };

  function _mouseEnterCallback(event, uuid) {
    getTokenByUuid(uuid)?._onHoverIn(event, { hoverOutOthers: false });
  }

  function _mouseLeaveCallback(event, uuid) {
    getTokenByUuid(uuid)?._onHoverOut(event);
  }

  function _imageClickCallback(event, uuid) {
    event.preventDefault();

    const token = getTokenByUuid(uuid);
    if (!token?.actor.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER)) return;

    const toggle = event.shiftKey;

    if (!toggle || (!token.controlled && toggle)) pf1.utils.chat.panToToken(token);

    if (token.actor.isOwner) {
      if (token.controlled) {
        if (toggle) token.release();
      } else {
        token.control({ releaseOthers: !toggle });
      }
    }
  }

  // Add callbacks
  for (let elem of targetElems) {
    const uuid = elem.dataset.uuid;
    const t = fromUuidSync(uuid);
    if (!t) continue;

    // Image element events
    const imgElem = elem.querySelector(".target-image");
    imgElem.addEventListener("pointerenter", (ev) => _mouseEnterCallback(ev, uuid), { passive: true });
    imgElem.addEventListener("pointerleave", (ev) => _mouseLeaveCallback(ev, uuid), { passive: true });
    imgElem.addEventListener("click", (ev) => _imageClickCallback(ev, uuid));

    // Misc element events
    elem = $(elem);
    elem.find(".ac").on("click", (event) => {
      event.preventDefault();

      const t = fromUuidSync(uuid);
      if (!t?.actor) return;
      pf1.utils.chat.targetACClick(cm, jq, t.actor, event);
    });

    elem.find(".saving-throws .click").on("click", (event) => {
      event.preventDefault();

      const t = fromUuidSync(uuid);
      if (!t?.actor) return;
      pf1.utils.chat.targetSavingThrowClick(cm, jq, t.actor, event);
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
