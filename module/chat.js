import { getSkipActionPrompt } from "./settings.js";
import { alterChatTargetAttribute } from "./socket.js";
import Color from "color";

/* -------------------------------------------- */

export const createCustomChatMessage = async function (
  chatTemplate,
  chatTemplateData = {},
  chatData = {},
  { rolls = [] } = {}
) {
  chatData = mergeObject(
    {
      user: game.user.id,
      type: CONST.CHAT_MESSAGE_TYPES.CHAT,
    },
    chatData
  );

  chatData.content = await renderTemplate(chatTemplate, chatTemplateData);

  // Handle different roll modes
  game.pf1.chat.ChatMessagePF.applyRollMode(chatData, chatData.rollMode ?? game.settings.get("core", "rollMode"));

  // Dice So Nice integration
  if (chatData.roll != null && rolls.length === 0) rolls = [chatData.roll];
  if (game.dice3d != null && game.dice3d.isEnabled()) {
    for (const roll of rolls) {
      await game.dice3d.showForRoll(roll, game.user, false, chatData.whisper, chatData.blind);
      chatData.sound = null;
    }
  }

  return game.pf1.chat.ChatMessagePF.create(chatData);
};

export const hideRollInfo = function (app, html, data) {
  const whisper = app.data.whisper || [];
  const isBlind = whisper.length && app.data.blind;
  const isVisible = whisper.length ? whisper.includes(game.user.id) || (app.isAuthor && !isBlind) : true;
  if (!isVisible) {
    html.find(".dice-formula").text("???");
    html.find(".dice-total").text("?");
    html.find(".dice").text("");
    html.find(".success").removeClass("success");
    html.find(".failure").removeClass("failure");
  }
};

/**
 * Generates an info block containing an item's identified info for GMs
 *
 * @remarks This HTML has to be generated in a synchronous way, as adding to a rendered chat message's content
 *          will cause erratic scrolling behaviour.
 * @param {ChatMessagePFIdentifiedInfo} info - An object containing the item's identified info
 * @returns {string} HTML string containing the info block
 */
const getIdentifiedBlock = (info) => `
<div class="gm-sensitive-always identified-info">
  <section class="item-description">
    <header class="flexrow description-header">
      <h3 class="item-name">${info.name} </h3>
      <div class="description-metadata">
        <i class="fas fa-user-secret"></i>
      </div>
    </header>
    ${info.description}
  </section>
  ${
    info.actionName
      ? `
  <hr>
  <section class="action-description">
    <h3 class="action-name">${info.actionName}</h3>
    ${info.actionDescription}
  </section>`
      : ``
  }
</div>
  `;

/**
 * Add GM-sensitive info for GMs and hide GM-sensitive info for players
 *
 * @param {ChatMessagePF} app - The chat message
 * @param {JQuery} html - The chat message's HTML
 * @param {object} data - Data used to render the chat message
 */
export const hideGMSensitiveInfo = function (app, html, data) {
  // Handle adding of GM-sensitive info
  if (game.user.isGM) {
    // Show identified info box for GM if item was unidentified when rolled
    const identifiedInfo = app.data.flags.pf1?.identifiedInfo ?? {};
    const { identified = true } = identifiedInfo;
    if (!identified && app.hasItemSource) {
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

  const speaker = app.data.speaker;
  let actor = null;
  if (speaker != null) {
    if (speaker.token) {
      actor = game.actors.tokens[speaker.token];
    }
    if (!actor) {
      actor = game.actors.get(speaker.actor);
    }
  }

  if (!actor || (actor && actor.testUserPermission(game.user, "OBSERVER"))) return;

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
      const roll = Roll.fromJSON(unescape(elem.dataset.roll));
      const parent = elem.parentNode;
      parent.insertBefore($(`<span>${roll.total}</span>`)[0], elem);
      parent.removeChild(elem);
    });
  }
};

export const addChatCardTitleGradient = async function (app, html, data) {
  const card = html.find(".chat-card")[0];
  if (!card) return;
  const actor = await CONFIG.Item.documentClasses.default._getChatCardActor(card);
  if (!actor) return;
  const item = actor.items.get(card.dataset.itemId);
  if (!item) return;
  const title = $(card).find(".card-header");
  if (!title.length) return;

  title.css("background-image", `linear-gradient(to right, ${item.typeColor}, ${item.typeColor2})`);

  const titleText = title.find("h2, h3");
  if (Color(item.typeColor).isLight()) titleText.css("color", "black");
  else titleText.css("color", "white");
};

export const alterAmmoRecovery = function (app, html) {
  const recoveryData = app.getFlag("pf1", "ammoRecovery");
  if (!recoveryData) return;

  html.find(".chat-attack .ammo[data-ammo-id]").each((a, el) => {
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
};

export const alterTargetDefense = function (app, html) {
  const defenseData = app.getFlag("pf1", "targetDefense");
  if (!defenseData) return;

  html.find(".attack-targets .saving-throws div[data-saving-throw]").each((a, el) => {
    const actorUUID = el.closest(".target").dataset.uuid;
    const save = el.dataset.savingThrow;
    const value = getProperty(defenseData, `${actorUUID}.save.${save}`);
    if (value == null) return;
    $(el).find(".value").text(value.toString());
  });
};

export const applyAccessibilitySettings = function (app, html, data, conf) {};

/**
 * Returns an inline roll string suitable for chat messages.
 *
 * @param {Roll} roll - The roll to be stringified
 * @param {object} [options] - Additional options affecting the inline roll
 * @param {boolean} [options.hide3d] - Whether the roll should be hidden from DsN
 * @returns {string} The inline roll string
 */
export const createInlineRollString = (roll, { hide3d = true } = {}) =>
  `<a class="inline-roll inline-result ${hide3d ? "inline-dsn-hidden" : ""}" \
  title="${roll.formula}" data-roll="${escape(JSON.stringify(roll))}"> \
  <i class="fas fa-dice-d20"></i> ${roll.total}</a>`;

export const hideInvisibleTargets = async function (app, html) {
  const targetElems = html.find(".attack-targets .target");
  const targets = targetElems.toArray().reduce((cur, o) => {
    cur.push({ uuid: o.dataset.uuid, elem: o });
    return cur;
  }, []);

  for (const t of targets) {
    const elem = $(t.elem);

    // Gather token
    t.token = (await fromUuid(t.uuid)).object;

    // Hide if token invisible
    if (!t.token?.visible) elem.hide();
    else elem.show();
  }
};

export const addTargetCallbacks = function (app, html) {
  const targetElems = html.find(".attack-targets .target[data-uuid]");

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
        game.pf1.chat.events.targetACClick(app, html, t.actor, event);
      });
    });
    elem.find(".saving-throws .click").on("click", (event) => {
      event.preventDefault();

      _getTokenByElem(_getRootTargetElement(event.currentTarget)).then((t) => {
        if (!t?.actor) return;
        game.pf1.chat.events.targetSavingThrowClick(app, html, t.actor, event);
      });
    });
  }
};

export const targetACClick = async function (app, html, actor, event) {
  actor.rollDefenses({ rollMode: "selfroll" });
};

export const targetSavingThrowClick = async function (app, html, actor, event) {
  const elem = event.currentTarget;
  const save = elem.dataset.savingThrow;

  const message = await actor.rollSavingThrow(save, { event, skipDialog: getSkipActionPrompt() });
  const total = message?.roll?.total;

  // Replace saving throw value on original chat card's target
  if (total != null) {
    const actorUUID = elem.closest(".target").dataset.uuid;
    await app.setFlag("pf1", "targetDefense", { [actorUUID]: { save: { [save]: total } } });
  }
};
