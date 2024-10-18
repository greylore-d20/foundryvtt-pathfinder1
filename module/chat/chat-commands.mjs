/**
 * Handle custom roll command
 *
 * @param {string} command
 * @param {string} message
 * @param {string} comment
 * @param {object} options
 * @returns {ChatMessage}
 */
export async function command(command, message, comment, options) {
  command = command.toUpperCase();
  let { speaker, rollData } = options;

  speaker = speaker ?? ChatMessage.implementation.getSpeaker();
  const actor = ChatMessage.implementation.getSpeakerActor(speaker);
  const token = actor?.token;

  switch (command) {
    case "D":
    case "DAMAGE":
    case "H":
    case "HEAL": {
      rollData ??= actor?.getRollData() ?? {};
      const roll = await new Roll(message, rollData).evaluate();

      const isHealing = command[0] === "H";
      const content = await renderTemplate("systems/pf1/templates/chat/simple-damage.hbs", {
        actor,
        token,
        isHealing,
        css: isHealing ? "heal" : "damage",
        value: {
          total: roll.total * (isHealing ? -1 : 1),
          half: Math.floor(roll.total / 2) * (isHealing ? -1 : 1),
        },
        roll,
        details: await roll.getTooltip(),
        hasDetails: roll.terms.length > 1 || !roll.isDeterministic,
      });

      const chatOptions = {
        // TODO: Apply custom message type
        rolls: [roll],
        flavor: comment,
        sound: CONFIG.sounds.dice,
        speaker: speaker,
        rollMode: game.settings.get("core", "rollMode"),
        content,
        flags: { pf1: { subject: { health: isHealing ? "healing" : "damage" } } },
      };

      ChatMessage.implementation.create(chatOptions);
    }
  }
}

function handleChatInput(app, msg, options) {
  if (/^\/(h|heal|d|damage)/i.test(msg)) {
    try {
      const re = /^\/(?<command>h|heal|d|damage)\s+(?<formula>.*?)(\s*#\s*(?<comment>.*))?$/i.exec(msg);
      if (re) {
        const { command, formula, comment } = re.groups;
        console.debug("PF1 | Chat command:", { command, formula, comment });
        pf1.chat.command(command, formula, comment, options);
      } else {
        ui.notifications.error("PF1.Error.CommandParse", { localize: true });
      }
    } catch (err) {
      console.error("Failed to parse command:", msg, "\n", err);
    }
    return false;
  }
}

Hooks.on("chatMessage", handleChatInput);
