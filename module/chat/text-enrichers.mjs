import { RollPF } from "module/dice/roll.mjs";
import { openJournal } from "@utils";

export const searchLimit = 500;

// Was game.documentIndex.index() called?
let indexed = false;

/**
 * @internal
 * @param {string} name - Item name to search for
 * @param {object} [options] - Additional options
 * @param {string} [options.type]
 * @returns {string|null} - Most appropriate matching item's UUID
 */
async function findItem(name, { type } = {}) {
  // HACK: Early need of documentIndex
  if (!indexed && !game.ready) {
    console.debug("PF1 | Forcing early document index creation");
    await game.documentIndex.index();
    indexed = true;
  }

  let items = game.documentIndex
    .lookup(name, { documentTypes: ["Item"], limit: searchLimit })
    .Item // Omit items on actors and items of wrong type
    .filter((e) => !e.entry.actor && (!type || e.entry.type === type));

  const packTypePriority = {
    items: 1_000,
    world: 2_000,
    module: 3_000,
    system: 4_000,
  };

  items = items
    .map((e) => {
      const pack = game.packs.get(e.pack);
      const packType = pack?.metadata.packageType ?? "items";

      return {
        ...e,
        exact: e.entry.name === name,
        visible: pack?.visible ?? true,
        disabled: pack?.config.pf1?.disabled ?? false,
        sort: packTypePriority[packType],
      };
    })
    .filter((e) => !e.disabled && e.visible)
    // Priotizie by item location
    .sort((a, b) => a.sort - b.sort)
    // Prioritize exact matches
    .sort((a, b) => (a.exact ? -1 : 0) + (b.exact ? 1 : 0));

  // Return most likely match
  return items[0]?.uuid ?? null;
}

/**
 * Helper class for making `CONFIG.TextEditor.enrichers` usage easier.
 */
export class PF1TextEnricher {
  id;

  pattern;

  match;

  enricher;

  /**
   * @abstract
   * @param {Event} event Click event
   * @param {HTMLElement} target Target element
   */
  click(event, target) {}

  /**
   * @abstract
   * @param {Event} event Drag event
   * @param {HTMLElement} target Target element
   */
  drag(event, target) {}

  /**
   * @param {string} id Unique identifier
   * @param {RegExp} pattern Pattern for content matching.
   * @param {Function} enricher Function for generating enrichted content.
   * @param {object} [interaction] Additional interaction options
   * @param {string[]} [interaction.match] CSS selectors for triggering click or drag handler
   * @param {Function} [interaction.click] Click handler
   * @param {Function} [interaction.drag] Drag handler
   */
  constructor(id, pattern, enricher, { click, drag } = {}) {
    if (!(pattern instanceof RegExp)) throw new Error("TextEnricher pattern must be a regular expression");
    if (!pattern.global) throw new Error("TextEnricher pattern must be global");
    this.id = id;
    this.pattern = pattern;
    this.enricher = enricher.bind(this);
    if (click) this.click = click;
    if (drag) this.drag = drag;
  }
}

/**
 * @param {Element} el
 * @param {string} icon
 */
function setIcon(el, icon) {
  const i = document.createElement("i");
  i.classList.add(...icon.split(" "));
  el.prepend(i, " ");
}

/**
 * Parses duration string into distinct time and unit.
 *
 * @param {string} duration
 */
function parseDuration(duration) {
  const re = /(?<time>\d+)(?<unit>\w+)?/.exec(duration);
  if (!re) return [];
  let { time, unit } = re.groups;

  unit = (() => {
    switch (unit?.[0]) {
      case "r":
        return game.i18n.localize("PF1.Time.Period.round.Label");
      case undefined:
      case "s":
        return game.i18n.localize("PF1.Time.Period.second.Label");
      case "h":
        return game.i18n.localize("PF1.Time.Period.hour.Label");
      case "m":
        return game.i18n.localize("PF1.Time.Period.minute.Label");
      default:
        return null;
    }
  })();

  return [parseInt(time), unit];
}

/**
 * Create enriched element for interaction.
 *
 * @param {object} config - Element configuration
 * @param {string} [config.label] - Prefix label for the element
 * @param {string} [config.icon] - Font Awesome icon classes
 * @param {boolean} [config.click=false] - Is this a clickable element?
 * @param {boolean} [config.drag=false] - Is this draggable element?
 * @param {string} config.handler - {@link PF1TextEnricher} ID
 * @param {Record<string,string>} [config.options] - Addional options set as dataset elements.
 * @param {boolean} [config.broken=false] - Is this broken?
 * @returns {HTMLElement} - The element.
 */
export function createElement({ label, icon, click = false, drag = false, handler, options, broken = false } = {}) {
  const a = document.createElement("a");
  if (click || drag) a.classList.add("pf1-link");
  else a.classList.add("pf1-info");
  if (click) a.classList.add("button");
  if (drag) {
    a.classList.add("content");
    a.draggable = true;
  }
  if (icon) setIcon(a, icon);

  if (label) a.append(label, ": ");
  if (handler) a.dataset.handler = handler;

  if (broken) a.classList.add("broken");

  setElementOptions(a, options);

  return a;
}

function getSpeaker(target) {
  const messageId = target.closest("[data-message-id]")?.dataset.messageId;
  const message = game.messages.get(messageId);
  return ChatMessage.getSpeakerActor(message.speaker);
}

/**
 * Get relevant actors based on the enriched element data.
 *
 * @param {HTMLElement} button - Clicked element.
 * @returns {ActorPF[]} - Relevant actors
 */
export function getRelevantActors(button) {
  const actors = [];

  const as = button.dataset.as;
  const asSpeaker = button.dataset.speaker || as === "speaker";

  // Speaker
  if (asSpeaker) {
    const actor = getSpeaker(button);
    if (actor) actors.push(actor);
  }
  // Controlled tokens
  else if (canvas.tokens.controlled.length) {
    const tokenActors = canvas.tokens.controlled.map((t) => t.actor);
    for (const actor of tokenActors) {
      if (actor) actors.push(actor);
    }
  }
  // Configured character
  else {
    const actor = game.user.character;
    if (actor) actors.push(actor);
  }

  if (actors.length == 0) {
    ui.notifications.error(game.i18n.localize("PF1.EnrichedText.Errors.NoActors"));
    throw new Error("No valid actors found.");
  }

  return actors;
}

/**
 * Add tooltip to enriched element.
 *
 * @param {Element} el Target element
 */
export function generateTooltip(el) {
  const { roll, formula, bonus, speaker, name, level } = el.dataset;

  const tooltip = [];
  if (name) tooltip.push(name);
  if (roll) {
    if (/d\d+/.test(roll)) tooltip.push(game.i18n.localize("PF1.Roll") + `: ${roll}`);
    else tooltip.push(game.i18n.format("PF1.TakeX", { number: roll }));
  } else if (formula) {
    tooltip.push(formula);
  }
  if (level) tooltip.push(game.i18n.localize("PF1.Level") + `: ${level}`);
  if (bonus) tooltip.push(game.i18n.localize("PF1.Bonus") + `: ${bonus}`);
  if (speaker) tooltip.push(game.i18n.localize("PF1.EnrichedText.AsSpeaker"));

  el.dataset.tooltip = tooltip.join("<br>");
}

/**
 * Break down options string into dataset properties.
 *
 * @internal
 * @param {Element} el Target element
 * @param {string} options Options string
 */
export function setElementOptions(el, options) {
  if (options) {
    for (const option of options.split(";")) {
      const [key, value] = option.split("=", 2);
      el.dataset[key] = value ?? true;
    }
  }
}

/**
 * @param {Event} event - Triggering event
 * @param {HTMLElement} target - Triggered element
 */
export function onSave(event, target) {
  const actors = getRelevantActors(target);

  // Add additional options
  const options = {};
  const { roll, bonus, type } = target.dataset;
  if (!type) throw new Error("No save type defined");
  if (roll) options.staticRoll = roll;
  if (bonus) options.bonus = bonus;

  // Roll
  for (const actor of actors) {
    actor.rollSavingThrow(type, foundry.utils.deepClone(options));
  }
}

/**
 * @param {Event} event - Triggering event
 * @param {HTMLElement} target - Triggered element
 */
export function onAbility(event, target) {
  const actors = getRelevantActors(target);

  // Add additional options
  const options = {};
  const { ability, bonus, roll } = target.dataset;
  if (!ability) throw new Error("No ability check type defined");
  if (roll) options.staticRoll = roll;
  if (bonus) options.bonus = bonus;

  // Roll
  for (const actor of actors) {
    actor.rollAbilityTest(ability, foundry.utils.deepClone(options));
  }
}

/**
 * @param {Event} _event - Triggering event
 * @param {HTMLElement} target - Triggered element
 */
export async function onDraw(_event, target) {
  const { ident } = target.dataset;
  if (!ident) throw new Error("No roll table defined");

  const table = await fromUuid(ident);
  if (!table) throw new Error(`Roll table not found for "${ident}"`);
  await table.draw({ roll: true, displayChat: true });
}

/**
 * @param {Event} event - Triggering event
 * @param {HTMLElement} target - Triggered element
 */
export function onSkill(event, target) {
  // Add additional options
  const options = {};
  const { skill, bonus, roll, info } = target.dataset;
  if (!skill) throw new Error("No skill key defined");

  if (info) {
    const journal = pf1.config.skillCompendiumEntries[skill];
    if (!journal) throw new Error(`Journal entry not found for skill "${skill}"`);
    return void openJournal(journal);
  }

  if (roll) options.staticRoll = roll;
  if (bonus) options.bonus = bonus;

  const actors = getRelevantActors(target);

  // Roll
  for (const actor of actors) {
    actor.rollSkill(skill, foundry.utils.deepClone(options));
  }
}

/**
 * @param {Event} event - Triggering event
 * @param {HTMLElement} target - Triggered element
 */
export function onUse(event, target) {
  // Add additional options
  const options = {};
  const { type, item: itemName, action: actionIdent, speaker } = target.dataset;
  if (!itemName) throw new Error("No item name defined");

  const actors = getRelevantActors(target);

  for (const actor of actors) {
    const item = actor.items.find((item) => {
      if (type && item.type !== type) return false;
      return item.name.localeCompare(itemName, undefined, { usage: "search" }) == 0;
    });

    if (!item) {
      const msg = game.i18n.format("PF1.Warning.NoItemOnActor", { actor: actor.name, item: itemName });
      ui.notifications.warn(msg, { console: false });
      console.warn("PF1 | @Use |", msg, actor);
      continue;
    }

    let itemAction;
    if (actionIdent) {
      const re = /^(?:tag:(?<actionTag>.*?)|id:(?<actionId>.*?))$/.exec(actionIdent);
      const { actionTag, actionId } = re?.groups ?? {};
      const actionName = !actionTag && !actionId ? actionIdent : null;
      itemAction = item.actions.find((act) => {
        if (actionId) return act.id === actionId;
        if (actionTag) return act.data.tag === actionTag;
        return act.name.localeCompare(actionName, undefined, { usage: "search" }) == 0;
      });

      if (!itemAction) {
        const msg = game.i18n.format("PF1.Warning.NoActionInItem", { item: item.name, action: actionIdent });
        ui.notifications.warn(msg, { console: false });
        console.warn("PF1 | @Use |", msg, actor);
        continue;
      }

      itemAction.use();
    } else {
      item.use();
    }
  }
}

/**
 * @param {Event} event - Triggering event
 * @param {HTMLElement} target - Triggered element
 */
export function onAction(event, target) {
  // Add additional options
  const options = {};
  const { action: actionIdent } = target.dataset;

  const msgId = target.closest(".chat-message[data-message-id]")?.dataset.messageId;
  const msg = game.messages.get(msgId);
  const item = msg.itemSource;

  if (!item) {
    const warn = game.i18n.format("PF1.EnrichedText.Errors.NoItemInMessage");
    ui.notifications.warn(warn, { console: false });
    return void console.warn("PF1 | @Action |", warn, msg);
  }

  const actor = item.actor;

  const re = /^(?:tag:(?<actionTag>.*?)|id:(?<actionId>.*?))$/.exec(actionIdent);
  const { actionTag, actionId } = re?.groups ?? {};
  const actionName = !actionTag && !actionId ? actionIdent : null;

  const action = item.actions.find((act) => {
    if (actionId) return act.id === actionId;
    if (actionTag) return act.data.tag === actionTag;
    return act.name.localeCompare(actionName, undefined, { usage: "search" }) == 0;
  });

  if (!action) {
    const msg = game.i18n.format("PF1.Warning.NoActionInItem", { item: item.name, actor: actor.name });
    ui.notifications.warn(msg, { console: false });
    return void console.warn("PF1 | @Action |", msg, actor);
  }

  action.use();
}

/**
 * @param {Event} event - Triggering event
 * @param {HTMLElement} target - Triggered element
 */
export async function onHealth(event, target) {
  const { command, formula, speaker, nonlethal, vars, dual } = target.dataset;

  const actors = getRelevantActors(target);

  // Add additional options
  const options = {};
  if (nonlethal) options.asNonlethal = true;
  if (dual) options.dualHeal = true;

  const targetRolldata = vars === "target";

  let rollData;
  if (!targetRolldata) rollData = getSpeaker(target)?.getRollData();

  for (const actor of actors) {
    if (targetRolldata) rollData = actor.getRollData();
    let value = await RollPF.safeRollAsync(formula, rollData).total;
    if (command === "heal") value = -value;
    actor.applyDamage(value, { ...options, event, element: target });
  }
}

/**
 * @param {Event} event - Triggering event
 * @param {HTMLElement} target - Triggered element
 */
export function onBrowse(event, target) {
  const { category, options } = target.dataset;

  // TODO: Configure browser filters with options.
  // TODO: Find closest browser via Sørensen–Dice coefficient or something.

  const browser = pf1.applications.compendiums[category];
  if (browser) browser.render(true, { focus: true });
  else ui.notifications.error(game.i18n.format("PF1.EnrichedText.Errors.BrowserNotFound", { category }));
}

/**
 * @param {Event} event - Triggering event
 * @param {HTMLElement} target - Triggered element
 */
export function onCondition(event, target) {
  const { condition, toggle, remove, duration, options, info } = target.dataset;

  /*
  if (duration) {
    const [time, unit] = parseDuration(duration);
  }
  */

  if (info) {
    const journal = pf1.registry.conditions.get(condition)?.journal;
    if (!journal) throw new Error(`Journal entry not found for condition "${condition}"`);
    return void openJournal(journal);
  }

  const actors = getRelevantActors(target);

  for (const actor of actors) {
    if (toggle) {
      actor.toggleCondition(condition);
    } else {
      actor.setCondition(condition, !remove);
    }
  }
}

/**
 * @param {Event} event - Triggering event
 * @param {HTMLElement} target - Triggered element
 */
export async function onApply(event, target) {
  const { uuid, level } = target.dataset;

  const actors = getRelevantActors(target);
  if (actors.length == 0) return;

  const item = await fromUuid(uuid);
  if (!item) {
    const warn = game.i18n.localize("PF1.EnrichedText.Errors.ItemNotFound");
    ui.notifications.warn(warn, { console: false });
    return void console.error("PF1 | @Apply |", warn, uuid);
  }

  // TODO: Support more types (race, class, and few others should never be here)
  if (item.type !== "buff") {
    return void ui.notifications.error(
      game.i18n.format("PF1.EnrichedText.Errors.UnsupportedItemType", { type: item.type })
    );
  }

  // Prepare item
  const itemData = game.items.fromCompendium(item, { clearFolder: true });

  itemData.system.active = true;
  if (level !== undefined) {
    itemData.system.level = Number(level);
  }

  // Apply
  for (const actor of actors) {
    // Activate existing item with same sourceId
    const old = actor.itemTypes[item.type].find((i) => i.getFlag("core", "sourceId") === uuid);
    if (old) {
      const activationData = { system: { active: true } };
      if (level !== undefined) activationData.system.level = level;
      old.update(activationData);
    }
    // Add new
    else {
      Item.implementation.create(itemData, { parent: actor });
    }
  }
}

/**
 * Text enrichers
 */
export const enrichers = [
  // @Apply
  new PF1TextEnricher(
    "apply",
    /@Apply\[(?<ident>.*?)(?:;(?<options>.*?))?\](?:\{(?<label>.*?)})?/g,
    async (match, _options) => {
      const { ident, options, label } = match.groups;

      const item = fromUuidSync(ident) ?? fromUuidSync(await findItem(ident, { type: "buff" }));

      if (!item) console.warn("PF1 | @Apply | Could not find item", ident);

      const broken = !item;

      const a = createElement({ label, click: true, handler: "apply", options, broken });

      if (item) {
        a.dataset.name = `${game.i18n.localize("DOCUMENT.Item")}: ${item.name}`;
        a.dataset.uuid = item.uuid;
        a.append(item.name);

        generateTooltip(a);
      } else {
        a.replaceChildren(ident);
      }

      setIcon(a, "fa-solid fa-angles-right");

      return a;
    },
    {
      click: onApply,
    }
  ),
  // @Save
  new PF1TextEnricher(
    "save",
    /@Save\[(?<save>\w+)(;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
    (match, { rollData } = {}) => {
      const { save, options, label } = match.groups;
      const a = createElement({ label, click: true, handler: "save", options });
      const name = CONFIG.PF1.savingThrows[save];

      let dc = a.dataset.dc;

      // DC is not simple value
      // For supporting things like: @Save[ref;dc=15+@attributes.hd.total + 2]
      if (!/^\d+$/.test(dc)) {
        a.dataset.formula = dc;
        const roll = RollPF.safeRollSync(dc, rollData, { formula: dc }, {}, { minimize: true });
        dc = roll.total;
      }

      const title = dc !== undefined ? game.i18n.format("PF1.SavingThrowButtonLabel", { type: name, dc }) : name;
      a.append(title);
      a.dataset.type = save;

      generateTooltip(a);
      setIcon(a, "fa-solid fa-shield-halved");

      return a;
    },
    {
      click: onSave,
    }
  ),
  // @Ability
  new PF1TextEnricher(
    "ability",
    /@Ability\[(?<ability>\w+)(;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
    (match, _options) => {
      const { ability, label, options } = match.groups;
      const a = createElement({ label, click: true, handler: "ability", options });
      const title = CONFIG.PF1.abilities[ability] ?? ability;
      a.dataset.ability = ability;
      a.append(title);

      generateTooltip(a);
      setIcon(a, "fa-solid fa-brain");

      return a;
    },
    {
      click: onAbility,
    }
  ),
  // @Skill
  new PF1TextEnricher(
    "skill",
    /@Skill\[(?<skill>\w+)(;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
    (match, _options) => {
      const { skill, label, options } = match.groups;
      const a = createElement({ label, click: true, handler: "skill", options });
      const title = CONFIG.PF1.skills[skill] ?? skill;
      a.dataset.skill = skill;

      if (a.dataset.info) {
        const compendium = pf1.config.skillCompendiumEntries[skill];
        if (!compendium) return;
        setIcon(a, "fa-solid fa-book");
      }

      a.append(title);

      generateTooltip(a);
      setIcon(a, "fa-solid fa-hands-clapping");

      return a;
    },
    {
      click: onSkill,
    }
  ),
  // @Use
  new PF1TextEnricher(
    "use",
    /@Use\[(?<item>.*?)(?:#(?<action>.*?))?(?:;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,

    (match, _options) => {
      const { item, action, label, options } = match.groups;
      const a = createElement({ label, click: true, handler: "use", options });
      a.append(item?.trim());
      a.dataset.item = item?.trim();
      if (action) {
        const displayAction = action.replace(/^(id|tag):\s*/, "")?.trim();
        // TODO: pretty print action name if speaker option is enabled
        a.append(` (${displayAction})`);
        a.dataset.action = action?.trim();
      }

      generateTooltip(a);
      setIcon(a, "fa-solid fa-trowel");

      return a;
    },
    {
      click: onUse,
    }
  ),
  // @Action
  new PF1TextEnricher(
    "action",
    /@Action\[(?<action>.*?)(?:;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
    (match, _options) => {
      const { action, label, options } = match.groups;
      const a = createElement({ label, click: true, handler: "action", options });
      // TODO: Pretty print the action name, especially if speaker option is enabled
      a.append(action);
      a.dataset.speaker = true;
      a.dataset.action = action?.trim();

      generateTooltip(a);
      setIcon(a, "fa-solid fa-trowel");

      return a;
    },
    {
      click: onAction,
    }
  ),
  // @Heal & @Damage
  new PF1TextEnricher(
    "health",
    /@(?<command>Heal|Damage)\[(?<formula>.*?)(?:;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
    (match, _options) => {
      const { command, formula, label, options } = match.groups;
      const a = createElement({ click: true, handler: "health", options });
      a.dataset.command = command.toLowerCase();
      a.dataset.formula = formula;

      a.append(
        game.i18n.format(`PF1.EnrichedText.Health.${command}`, {
          value: label || formula,
          NL: a.dataset.nonlethal ? game.i18n.localize("PF1.EnrichedText.Health.NL") : "",
        })
      );

      generateTooltip(a);

      if (a.dataset.command === "heal") setIcon(a, "fa-solid fa-heart-pulse");
      else setIcon(a, "fa-solid fa-heart-crack");

      return a;
    },
    {
      click: onHealth,
    }
  ),
  // @Browse
  new PF1TextEnricher(
    "browse",
    /@Browse\[(?<category>\w+)(?:;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
    (match) => {
      const { category, label, options } = match.groups;
      const a = createElement({ click: true, handler: "browse", options });

      a.dataset.category = category;

      let mainlabel;
      const browser = pf1.applications.compendiums[category];
      // BUG: Fails on world load
      if (!browser) {
        setIcon(a, "fa-solid fa-link-slash");
        a.classList.add("invalid");
        mainlabel = category;
      } else {
        setIcon(a, "fa-solid fa-book");
        mainlabel = game.i18n.localize(browser.constructor.typeName);
      }

      mainlabel = game.i18n.format("PF1.EnrichedText.Browse", { value: mainlabel });

      if (label) a.append(label);
      else a.append(mainlabel);

      generateTooltip(a);

      if (label) a.dataset.tooltip = mainlabel;
      if (!browser) {
        if (label) a.dataset.tooltip += "<br>";
        a.dataset.tooltip +=
          game.i18n.localize("PF1.EnrichedText.Error") +
          ": " +
          game.i18n.localize("PF1.EnrichedText.Errors.NoCategory");
      }

      return a;
    },
    {
      click: onBrowse,
    }
  ),
  // Weight
  new PF1TextEnricher("weight", /@Weight\[(?<formula>.+?)(?:;(?<options>.*?))?\]/g, (match, rollData) => {
    const { formula, options } = match.groups;

    const a = createElement({ options });

    const isDual = !!a.dataset.dual;

    const re = /^(?<value>.+?)\s*(?<unit>lbs|kg)?$/.exec(formula);
    const { value, unit } = re?.groups ?? {};
    if (unit === "kg") {
      a.dataset.metric = "true";
      delete a.dataset.imperial;
    } else if (unit === "lbs") {
      a.dataset.imperial = "true";
      delete a.dataset.metric;
    }

    const sourceMetric = !!a.dataset.metric;
    const sourceImperial = !sourceMetric;

    const total = RollPF.safeRollSync(value || "0", rollData).total;

    let lbs = total,
      kg = total;

    if (sourceImperial) kg = pf1.utils.swapWeight(total, "lbs");
    if (sourceMetric) lbs = pf1.utils.swapWeight(total, "kg");

    const kgl = `${pf1.utils.limitPrecision(kg, 3)} ${game.i18n.localize("PF1.Kgs")}`;
    const lbsl = `${pf1.utils.limitPrecision(lbs, 3)} ${game.i18n.localize("PF1.Lbs")}`;

    const isMetric = pf1.utils.getWeightSystem() == "metric";

    let label;
    if (isDual) {
      if (isMetric) label = `${kgl} (${lbsl})`;
      else label = `${lbsl} (${kgl})`;
    } else if (isMetric) label = kgl;
    else label = lbsl;

    a.textContent = label;

    return a;
  }),
  // Distance
  new PF1TextEnricher("distance", /@Distance\[(?<formula>.+?)(?:;(?<options>.*?))?\]/g, (match, rollData) => {
    const { formula, options } = match.groups;

    const a = createElement({ options });

    const isDual = !!a.dataset.dual;

    const re = /^(?<value>.+?)\s*(?<unit>ft|m)?$/.exec(formula);
    const { value, unit } = re?.groups ?? {};
    if (unit === "m") {
      a.dataset.metric = "true";
      delete a.dataset.imperial;
    } else if (unit === "ft") {
      a.dataset.imperial = "true";
      delete a.dataset.metric;
    }

    const sourceMetric = !!a.dataset.metric;
    const sourceImperial = !sourceMetric;

    const total = RollPF.safeRollSync(value || "0", rollData).total;
    let ft = total,
      m = total;

    if (sourceImperial) m = pf1.utils.swapDistance(total, "ft");
    if (sourceMetric) ft = pf1.utils.swapDistance(total, "m");

    const ml = `${pf1.utils.limitPrecision(m, 3)} ${pf1.config.measureUnitsShort.m}`;
    const ftl = `${pf1.utils.limitPrecision(ft, 3)} ${pf1.config.measureUnitsShort.ft}`;

    const isMetric = pf1.utils.getDistanceSystem() == "metric";

    let label;
    if (isDual) {
      if (isMetric) label = `${ml} (${ftl})`;
      else label = `${ftl} (${ml})`;
    } else if (isMetric) label = ml;
    else label = ftl;

    a.textContent = label;

    a.dataset.tooltip = formula;

    return a;
  }),
  // @Condition
  new PF1TextEnricher(
    "condition",
    /@Condition\[(?<condition>\w+)(?:;(?<options>.*?))?](?:\{(?<label>.*?)})?/g,
    (match) => {
      const { condition, options, label } = match.groups;

      // TODO: Find closest condition via Sørensen–Dice coefficient or something.
      const cond = pf1.registry.conditions.get(condition);
      const text = label || cond?.name || condition;

      const broken = !cond;

      const a = createElement({ click: true, handler: "condition", options, broken });
      if (!cond) a.classList.add("broken");

      a.dataset.condition = condition;

      if (a.dataset.disable) a.dataset.remove = true;

      if (a.dataset.info) {
        setIcon(a, "fa-solid fa-atlas");
        if (!cond?.journal) a.classList.add("broken");
      } else if (a.dataset.remove) {
        setIcon(a, "fa-solid fa-minus");
        a.dataset.tooltip = game.i18n.format("PF1.EnrichedText.Remove", { value: text });
      } else if (a.dataset.toggle) {
        setIcon(a, "fa-solid fa-plus-minus");
        a.dataset.tooltip = game.i18n.format("PF1.EnrichedText.Toggle", { value: text });
      } else {
        setIcon(a, "fa-solid fa-plus");
        a.dataset.tooltip = game.i18n.format("PF1.EnrichedText.Add", { value: text });
      }

      /*
      if (a.dataset.duration) {
        const [time, unit] = parseDuration(a.dataset.duration);
        // TODO: i18n
        const unitLabel = unit;
        a.dataset.tooltip +=
          "<br>" + game.i18n.format("PF1.EnrichedText.Condition.Duration", { unit: unitLabel, period: time });
      }
      */

      a.append(text);

      return a;
    },
    {
      click: onCondition,
    }
  ),
  // @Draw
  new PF1TextEnricher(
    "draw",
    /@Draw\[(?<ident>.*?)\](?:\{(?<label>.*?)\})?/g,
    /**
     * @param {any} match
     * @param {unknown} _options
     * @returns
     */
    async (match, _options) => {
      const { ident, label } = match.groups;

      const table = fromUuidSync(ident) || game.tables.getName(ident);

      if (!table) console.warn("PF1 | @Draw | Could not find roll table", ident);

      const broken = !table;

      const a = createElement({ click: true, handler: "draw", broken });

      if (table) {
        a.dataset.name = `${game.i18n.localize("DOCUMENT.RollTable")}: ${table.name}`;
        a.dataset.ident = table.uuid;

        a.append(label || table.name);

        generateTooltip(a);
      } else {
        a.replaceChildren(ident);
      }

      setIcon(a, "fas fa-th-list");

      return a;
    },
    {
      click: onDraw,
    }
  ),
];

/**
 * Register in setup phase so modules can alter the enrichers before they're registered
 * ... and become largely immutable without deeper modification.
 * Otherwise this could be done in init phase.
 */
Hooks.once("setup", () => {
  CONFIG.TextEditor.enrichers.push(...enrichers);
});

/**
 * Proxy click and drag events to the enrichers
 *
 * @param {JQuery<MouseEvent>} event Click event
 * @param click
 */
const onEnrichedInteraction = (event, click = true) => {
  const target = event.currentTarget,
    handler = target.dataset.handler,
    enricher = enrichers.find((e) => e.id === handler);

  if (!enricher) throw new Error(`Relevant enricher not found: ${handler}`);

  if (target.classList.contains("broken")) return;

  event.stopPropagation();
  event.preventDefault();

  if (click) enricher.click(event, target);
  else enricher.drag(event, target);
};

// Register click & drag handlers
Hooks.once("ready", () => {
  // Mimic Foundry listener handling for simplicity
  // TODO: Use plain DOM instead
  const body = $("body");
  body.on("click", "a.pf1-link.button", (event) => onEnrichedInteraction(event, true));
  //body.on("drag", "a.pf1-link.content", (event) => onEnrichedInteraction(event, false));
});
