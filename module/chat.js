/* -------------------------------------------- */

export const createCustomChatMessage = async function(chatTemplate, chatTemplateData={}, chatData={}, {rolls=[]}={}) {
  let rollMode = game.settings.get("core", "rollMode");
  chatData = mergeObject({
    rollMode: rollMode,
    user: game.user._id,
    type: CONST.CHAT_MESSAGE_TYPES.CHAT,
  }, chatData);
  chatData.content = await renderTemplate(chatTemplate, chatTemplateData);
  // Handle different roll modes
  switch (chatData.rollMode) {
    case "gmroll":
      chatData["whisper"] = game.users.entities.filter(u => u.isGM).map(u => u._id);
      break;
    case "selfroll":
      chatData["whisper"] = [game.user._id];
      break;
    case "blindroll":
      chatData["whisper"] = game.users.entities.filter(u => u.isGM).map(u => u._id);
      chatData["blind"] = true;
      break;
  }

  // Dice So Nice integration
  if (chatData.roll != null && rolls.length === 0) rolls = [chatData.roll];
  if (game.dice3d != null) {
    for (let roll of rolls) {
      await game.dice3d.showForRoll(roll, chatData.whisper, chatData.blind);
      chatData.sound = null;
    }
  }

  ChatMessage.create(chatData);
};

export const hideRollInfo = function(app, html, data) {
  const whisper = app.data.whisper || [];
  const isBlind = whisper.length && app.data.blind;
  const isVisible = whisper.length ? (whisper.includes(game.user._id) || (app.isAuthor && !isBlind)) : true;
  if (!isVisible) {
    html.find(".dice-formula").text("???");
    html.find(".dice-total").text("?");
    html.find(".dice").text("");
    html.find(".success").removeClass("success");
    html.find(".failure").removeClass("failure");
  }
};

export const hideGMSensitiveInfo = function(app, html, data) {
  if (game.user.isGM) return;

  let speaker = app.data.speaker,
    actor = speaker != null ? (speaker.token ? game.actors.tokens[speaker.token] : game.actors.get(speaker.actor)) : null;
  if (!actor || (actor && actor.hasPerm(game.user, "LIMITED"))) return;

  // Hide info
  html.find(".gm-sensitive").remove();
};
