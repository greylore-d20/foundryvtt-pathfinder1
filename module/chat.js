import { ItemPF } from "./item/entity.js";
import { ChatMessagePF } from "./sidebar/chat-message.js";
import Color from "color";

/* -------------------------------------------- */

export const createCustomChatMessage = async function (
  chatTemplate,
  chatTemplateData = {},
  chatData = {},
  { rolls = [] } = {}
) {
  const rollMode = game.settings.get("core", "rollMode");
  chatData = mergeObject(
    {
      rollMode: rollMode,
      user: game.user.id,
      type: CONST.CHAT_MESSAGE_TYPES.CHAT,
    },
    chatData
  );
  chatData.content = await renderTemplate(chatTemplate, chatTemplateData);
  // Handle different roll modes
  ChatMessagePF.applyRollMode(chatData, chatData.rollMode);

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

  if (!actor || (actor && actor.testUserPermission(game.user, "LIMITED"))) return;

  // Hide info
  html.find(".gm-sensitive").remove();
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
