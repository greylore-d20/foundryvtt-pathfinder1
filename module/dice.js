import { ChatMessagePF } from "./sidebar/chat-message.js";

export const formulaHasDice = function (formula) {
  return formula.match(/[0-9)][dD]/) || formula.match(/[dD][0-9(]/);
};

export class DicePF {
  /**
   * A standardized helper function for managing game system rolls.
   *
   * Holding SHIFT, ALT, or CTRL when the attack is rolled will "fast-forward".
   * This chooses the default options of a normal attack with no bonus, Advantage, or Disadvantage respectively
   *
   * @param {Event} event           The triggering event which initiated the roll
   * @param {Array} parts           The dice roll component parts, excluding the initial d20
   * @param {string} dice           The initial d20
   * @param {Actor} actor           The Actor making the d20 roll
   * @param {object} data           Actor or item data against which to parse the roll
   * @param {string} template       The HTML template used to render the roll dialog
   * @param {string} title          The dice roll UI window title
   * @param {object} speaker        The ChatMessage speaker to pass when creating the chat
   * @param {Function} flavor       A callable function for determining the chat message flavor given parts and data
   * @param {boolean} takeTwenty    Allow rolling with take twenty (and therefore also with take ten)
   * @param {boolean} situational   Allow for an arbitrary situational bonus field
   * @param {boolean} fastForward   Allow fast-forward advantage selection
   * @param {number} critical       The value of d20 result which represents a critical success
   * @param {number} fumble         The value of d20 result which represents a critical failure
   * @param {Function} onClose      Callback for actions to take when the dialog form is closed
   * @param {Object} dialogOptions  Modal dialog options
   * @param {Array} extraRolls      An array containing bonuses/penalties for extra rolls
   * @param {boolean} autoRender    Whether to automatically render the chat messages
   */
  static async d20Roll({
    event,
    parts,
    dice = "1d20",
    data,
    subject,
    template,
    title,
    speaker,
    flavor,
    takeTwenty = true,
    situational = true,
    fastForward = true,
    critical = 20,
    fumble = 1,
    onClose,
    dialogOptions = {},
    extraRolls = [],
    chatTemplate,
    chatTemplateData,
    staticRoll = null,
    chatMessage = true,
    noSound = false,
    compendiumEntry = null,
  }) {
    // Handle input arguments
    flavor = flavor || title;
    let rollMode = game.settings.get("core", "rollMode");
    let rolled = false;

    // Inner roll function
    const _roll = async (parts, setRoll, form) => {
      const originalFlavor = flavor;
      rollMode = form ? form.find('[name="rollMode"]').val() : rollMode;
      for (let a = 0; a < 1 + extraRolls.length; a++) {
        flavor = originalFlavor;
        const curParts = duplicate(parts);
        // Don't include situational bonus unless it is defined
        data.bonus = form ? form.find('[name="bonus"]').val() : 0;
        if (!data.bonus && curParts.indexOf("@bonus") !== -1) curParts.pop();

        // Extra roll specifics
        if (a >= 1) {
          const extraRoll = extraRolls[a - 1];
          curParts.push(extraRoll.bonus);
          flavor += ` <div class="extra-roll-label">${extraRoll.label}</div>`;
        }

        // Do set roll
        if (setRoll != null && setRoll >= 0) {
          curParts[0] = `${setRoll}`;
          flavor += ` (Take ${setRoll})`;
        }

        // Execute the roll
        const roll = await Roll.create(curParts.join(" + "), data).evaluate({ async: true });

        // Convert the roll to a chat message
        if (chatTemplate) {
          // Create roll template data
          const d20 = roll.terms[0];
          const rollData = mergeObject(
            {
              user: game.user.id,
              formula: roll.formula,
              tooltip: await roll.getTooltip(),
              total: roll.total,
              isCrit: d20.total >= critical,
              isFumble: d20.total <= fumble,
              isNat20: d20.total === 20,
              flavor: flavor,
              compendiumEntry: compendiumEntry,
            },
            chatTemplateData || {}
          );

          // Create chat data
          const chatData = {
            user: game.user.id,
            type: CONST.CHAT_MESSAGE_TYPES.ROLL,
            sound: noSound ? null : a === 0 ? CONFIG.sounds.dice : null,
            speaker: speaker,
            content: await renderTemplate(chatTemplate, rollData),
            rollMode: rollMode,
            roll: roll.toJSON(),
            "flags.pf1.noRollRender": true,
          };
          if (subject) setProperty(chatData, "flags.pf1.subject", subject);

          // Send message
          rolled = true;

          if (chatMessage) return await ChatMessagePF.create(chatData);
        } else {
          rolled = true;
          if (chatMessage) {
            const msgData = {
              speaker: speaker,
              flavor: flavor,
              rollMode: rollMode,
              sound: a === 0 ? CONFIG.sounds.dice : null,
            };
            if (subject) setProperty(msgData, "flags.pf1.subject", subject);

            await roll.toMessage(msgData);
          }
        }
        return roll;
      }
    };

    // Modify the roll and handle fast-forwarding
    parts = [dice].concat(parts);
    if (fastForward === true) return _roll(parts, staticRoll);
    else parts = parts.concat(["@bonus"]);

    // Render modal dialog
    template = template || "systems/pf1/templates/chat/roll-dialog.hbs";
    const dialogData = {
      formula: parts.join(" + "),
      data: data,
      rollMode: rollMode,
      rollModes: CONFIG.Dice.rollModes,
    };
    const html = await renderTemplate(template, dialogData);

    let roll;
    return new Promise((resolve) => {
      if (!(dialogOptions.classes instanceof Array)) dialogOptions.classes = [];
      dialogOptions.classes.push("dialog", "pf1", "die-roll");

      new Dialog(
        {
          title: title,
          content: html,
          buttons: {
            normal: {
              label: game.i18n.localize("PF1.Normal"),
              callback: (html) => resolve((roll = _roll(parts, staticRoll != null ? staticRoll : -1, html))),
            },
            takeTen: {
              label: game.i18n.localize("PF1.Take10"),
              condition: takeTwenty,
              callback: (html) => resolve((roll = _roll(parts, 10, html))),
            },
            takeTwenty: {
              label: game.i18n.localize("PF1.Take20"),
              condition: takeTwenty,
              callback: (html) => resolve((roll = _roll(parts, 20, html))),
            },
          },
          default: "normal",
          close: (html) => {
            if (onClose) onClose(html, parts, data);
            resolve(rolled ? roll : false);
          },
        },
        dialogOptions
      ).render(true);
    });
  }

  /* -------------------------------------------- */

  /**
   * A standardized helper function for managing damage rolls.
   *
   * Holding SHIFT, ALT, or CTRL when the attack is rolled will "fast-forward".
   * This chooses the default options of a normal attack with no bonus, Critical, or no bonus respectively
   *
   * @param {Event} event           The triggering event which initiated the roll
   * @param {Array} parts           The dice roll component parts, excluding the initial d20
   * @param {Actor} actor           The Actor making the damage roll
   * @param {object} data           Actor or item data against which to parse the roll
   * @param {string} template       The HTML template used to render the roll dialog
   * @param {string} title          The dice roll UI window title
   * @param {object} speaker        The ChatMessage speaker to pass when creating the chat
   * @param {Function} flavor       A callable function for determining the chat message flavor given parts and data
   * @param {boolean} critical      Allow critical hits to be chosen
   * @param {Function} onClose      Callback for actions to take when the dialog form is closed
   * @param {object} dialogOptions  Modal dialog options
   */
  static async damageRoll({
    event = {},
    parts,
    actor,
    data,
    template,
    title,
    speaker,
    flavor,
    critical = true,
    onClose,
    dialogOptions = {},
    chatTemplate,
    chatTemplateData,
    chatMessage = true,
    noSound = false,
  }) {
    flavor = flavor || title;
    const rollMode = game.settings.get("core", "rollMode");
    let rolled = false;

    // Inner roll function
    const _roll = async (crit, form) => {
      // Don't include situational bonus unless it is defined
      data.bonus = form ? form.find('[name="bonus"]').val() : 0;

      // Detemrine critical multiplier
      data["critMult"] = crit ? data.item.ability.critMult : 1;
      // Determine damage ability
      data["ablMult"] = 0;
      if (data.item.ability.damageMult != null) {
        data["ablMult"] = data.item.ability.damageMult;
      }

      const roll = Roll.create(parts.join("+"), data);
      if (crit === true) {
        const mult = data.item.ability.critMult || 2;

        // Update first damage part
        roll.alter(0, mult);
        flavor = `${flavor} (Critical)`;
      }

      await roll.evaluate({ async: true });

      // Convert the roll to a chat message
      if (chatTemplate) {
        // Create roll template data
        const rollData = mergeObject(
          {
            user: game.user._id,
            formula: roll.formula,
            tooltip: await roll.getTooltip(),
            total: roll.total,
          },
          chatTemplateData || {}
        );

        // Create chat data
        const chatData = {
          user: game.user._id,
          type: CONST.CHAT_MESSAGE_TYPES.ROLL,
          sound: noSound ? null : CONFIG.sounds.dice,
          speaker: speaker,
          flavor: flavor,
          rollMode: rollMode,
          roll: roll,
          content: await renderTemplate(chatTemplate, rollData),
          useCustomContent: true,
        };
        setProperty(chatData, "flags.pf1.subject.core", "damage");

        // Handle different roll modes
        ChatMessage.applyRollMode(chatData, chatData.rollMode);

        // Send message
        rolled = true;
        if (chatMessage) ChatMessagePF.create(chatData);
      } else {
        rolled = true;
        if (chatMessage) {
          roll.toMessage({
            speaker: speaker,
            flavor: flavor,
            rollMode: rollMode,
          });
        }
      }

      // Return the Roll object
      return roll;
    };

    // Modify the roll and handle fast-forwarding
    if (!event.shiftKey) return _roll(event.ctrlKey);
    else parts = parts.concat(["@bonus"]);

    // Construct dialog data
    template = template || "systems/pf1/templates/chat/roll-dialog.hbs";
    const dialogData = {
      formula: parts.join(" + "),
      data: data,
      rollMode: rollMode,
      rollModes: CONFIG.Dice.rollModes,
    };
    const html = await renderTemplate(template, dialogData);

    // Render modal dialog
    let roll;
    return new Promise((resolve) => {
      if (!(dialogOptions.classes instanceof Array)) dialogOptions.classes = [];
      dialogOptions.classes.push("dialog", "pf1", "damage-roll");

      new Dialog(
        {
          title: title,
          content: html,
          buttons: {
            normal: {
              label: critical ? "Normal" : "Roll",
              callback: (html) => (roll = _roll(false, html)),
            },
            critical: {
              condition: critical,
              label: "Critical Hit",
              callback: (html) => (roll = _roll(true, html)),
            },
          },
          default: "normal",
          close: (html) => {
            if (onClose) onClose(html, parts, data);
            resolve(rolled ? roll : false);
          },
        },
        dialogOptions
      ).render(true);
    });
  }

  static messageRoll({ data, msgStr }) {
    const re = /\[\[(.+)\]\]/g;
    return msgStr.replace(re, (_, p1) => {
      const roll = RollPF.safeRoll(p1, data);
      return roll.total.toString();
    });
  }
}
