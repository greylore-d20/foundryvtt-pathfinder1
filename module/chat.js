import { ItemPF } from "./item/entity.js";
import { ChatMessagePF } from "./sidebar/chat-message.js";
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
  ChatMessage.applyRollMode(chatData, chatData.rollMode ?? game.settings.get("core", "rollMode"));

  // Dice So Nice integration
  if (chatData.roll != null && rolls.length === 0) rolls = [chatData.roll];
  if (game.dice3d != null && game.dice3d.isEnabled()) {
    for (const roll of rolls) {
      await game.dice3d.showForRoll(roll, game.user, false, chatData.whisper, chatData.blind);
      chatData.sound = null;
    }
  }

  return ChatMessagePF.create(chatData);
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

export const hideGMSensitiveInfo = function (app, html, data) {
  if (game.user.isGM) return;

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

  // Hide identified and description
  const item = app.itemSource;
  if (item != null && item.data?.data?.identified === false) {
    const unidentifiedName = item.data.data.unidentified?.name;
    if (unidentifiedName) {
      html.find("header .item-name").text(unidentifiedName);
    }
    const unidentifiedDescription = item.data.data.description?.unidentified;
    html.find(".card-content").html(TextEditor.enrichHTML(unidentifiedDescription, item.getRollData()));
  }

  if (!actor || (actor && actor.testUserPermission(game.user, "OBSERVER"))) return;

  // Hide info
  html.find(".gm-sensitive").remove();

  // Alter GM inner texts
  html.find("[data-gm-sensitive-inner]").each((a, elem) => {
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
  const actor = await ItemPF._getChatCardActor(card);
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

export const applyAccessibilitySettings = function (app, html, data, conf) {
  const fontSize = conf.fontSize || 0;

  // Enlarge font sizes
  if (fontSize > 0) {
    // Enlarge table font sizes
    {
      const size = 10 + fontSize * 4;
      html.find("table").css("font-size", `${size}px`);
    }

    // Enlarge attack roll numbers
    {
      const size = 12 + fontSize * 4;
      html.find(".inline-roll, .fake-inline-roll").css("font-size", `${size}px`);
    }

    // Enlarge attack headers
    {
      const size = 1 + fontSize * 0.3;
      html.find(".chat-attack th").css("font-size", `${size}em`);
    }
    // Enlarge attack labels
    {
      const size = 0.7 + fontSize * 0.3;
      html.find(".chat-attack td").css("font-size", `${size}em`);
    }
  }
};

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

export const addTargetCallbacks = function (app, html) {
  const targetElems = html.find(".attack-targets .target[data-uuid]");

  // Define getter functions
  const _getTokenByElem = async function (elem) {
    const actor = await fromUuid(elem?.dataset.uuid ?? "");
    if (actor instanceof TokenDocument) return actor.object;
    return actor?.token ?? (actor != null ? canvas.tokens.placeables.find((o) => o.actor === actor) : null);
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

  const message = await actor.rollSavingThrow(save, { event, skipPrompt: getSkipActionPrompt() });
  const total = message?.roll?.total;

  // Replace saving throw value on original chat card's target
  if (total != null) {
    // Prepare parameters
    const args = {
      eventType: "alterChatTargetAttribute",
      message: app.id,
      targetUuid: actor.uuid,
      save,
      value: total,
    };

    // Add parameters based on d20 result
    const d20 = message.roll.terms[0];
    if (d20.faces === 20) {
      if (d20.total === 1) args.isFailure = true;
      else if (d20.total === 20) args.isSuccess = true;
    }

    // Do action
    if (game.user.isGM) return alterChatTargetAttribute(args);
    else game.socket.emit("system.pf1", args);
  }
};
