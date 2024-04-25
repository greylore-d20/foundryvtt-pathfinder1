import { ItemSelector } from "module/applications/item-selector.mjs";
import { ActorSelector } from "module/applications/actor-selector.mjs";

/**
 * @deprecated - Use {@link pf1.utils.dialog.getNumber} instead
 * @param options
 * @param options.title
 * @param options.initial
 * @param options.min
 * @param options.max
 */
export async function dialogGetNumber({
  title = "Input Number",
  initial = null,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
} = {}) {
  foundry.utils.logCompatibilityWarning(
    "pf1.utils.dialog.dialogGetNumber is deprecated in favor of pf1.utils.dialog.getNumber",
    {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    }
  );

  let num = await pf1.utils.dialog.getNumber({ title, initial, min, max });
  // match old return type and value
  if (Number.isNaN(num)) num = initial;
  return `${num}`;
}

/**
 * @deprecated - Use {@link pf1.utils.dialog.getActor} instead
 * @param title
 * @param actors
 * @returns {Promise<{type: string, id: string}>}
 */
export async function dialogGetActor(title = "", actors = []) {
  foundry.utils.logCompatibilityWarning(
    "pf1.utils.dialog.dialogGetActor is deprecated in favor of pf1.utils.dialog.getActor",
    {
      since: "PF1 vNEXT",
      until: "PF1 vNEXT+1",
    }
  );

  const actorId = await pf1.utils.dialog.getActor({ actors: actors, title: title });
  return { type: "actor", id: actorId };
}

/**
 * Choose actor from list.
 *
 * This is simplified interface to {@link pf1.applications.ActorSelector}
 *
 * @param {object} options - Options
 * @param {Function<Actor>} [options.filter] - Filtering callback function.
 * @param {Actor[]} [options.actors] - Actor list to choose from.
 * @param {string} [options.title] - Dialog title
 * @param {boolean} [options.disableUnowned=true] - Disable interactions with unowned actors.
 * @param {string} [options.selected] - Already selected actor ID.
 * @param {*} [options.ownership=CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED] - Minimum Ownership level
 * @param {boolean} [options.showUnowned=true] - Whether to show unowned actors.
 * @param {object} [options.appOptions={}] - Application options
 * @param {object} [options.renderOptions={}] - Render options
 * @returns {Promise<string|null>} - Actor ID or null if cancelled.
 */
export async function getActor({
  filter,
  actors,
  title,
  disableUnowned,
  ownership,
  selected,
  showUnowned,
  appOptions = {},
  renderOptions = {},
} = {}) {
  const filterFunc = (actor) => {
    return filter?.(actor) ?? true;
  };

  const options = {
    actors,
    disableUnowned,
    filter: filterFunc,
    ownership,
    selected,
    showUnowned,
  };

  appOptions.title = title;

  return ActorSelector.wait(options, appOptions, renderOptions);
}

/**
 * Choose item from actor.
 *
 * This is simplified interface to {@link pf1.applications.ItemSelector}
 *
 * @param {object} options - Options
 * @param {boolean} [options.empty=true] - Allow empty selection.
 * @param {string} [options.type] - Basic filter for item type.
 * @param {string} [options.subType] - Basic filter for item subtype.
 * @param {Function<Item>} [options.filter] - Filtering callback function.
 * @param {Actor} [options.actor] - Actor from which to get items from.
 * @param {Item[]} [options.items] - Item list to get item from. Used only if actor is undefined.
 * @param {string} [options.title] - Dialog title
 * @param {object} [options.appOptions={}] - Application options
 * @param {object} [options.renderOptions={}] - Render options
 * @returns {Promise<Item|null>} - Chosen item or null.
 */
export async function getItem({
  empty = true,
  type,
  subType,
  filter,
  actor,
  items,
  title,
  appOptions = {},
  renderOptions = {},
} = {}) {
  if (!actor.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER))
    throw new Error("Insufficient permission to actor");

  if (!type && !subType && !filter) throw new Error("Insufficient filter rules provided.");

  const filterFunc = (item) => {
    if (type && item.type !== type) return false;
    if (subType && item.subType !== subType) return false;
    return filter?.(item) ?? true;
  };

  const options = {
    actor,
    items,
    empty,
    filter: filterFunc,
  };

  // Provide nice basic title
  if (!title && !filter && type) {
    if (subType) title = pf1.config[`${type}Types`]?.[subType];
    else title = game.i18n.localize(CONFIG.Item.typeLabels[type]);
    if (title) title = game.i18n.format("PF1.SelectSpecific", { specifier: title });
  }

  appOptions.title = title;

  return ItemSelector.wait(options, appOptions, renderOptions);
}

/**
 * Query for a number from current user.
 *
 * @example
 * const num = await pf1.utils.dialog.getNumber({
 *   placeholder: "NaN",
 *   hint: "Amazing",
 *   label: "Gimme a number",
 * });
 *
 * @param {object} [options={}] Additional options
 * @param {number} [options.min=null] Minimum value
 * @param {number} [options.max=null] Maximum value
 * @param {number} [options.step] Value stepping
 * @param {string} [options.title] Dialog title
 * @param {string} [options.label] A label preceding the number input.
 * @param {string} [options.hint] A hint displayed under the input.
 * @param {number} [options.initial] Initial value
 * @param {string} [options.placeholder] Placeholder value or description.
 * @param {string[]} [options.classes=[]] CSS classes to add.
 * @param {Function} [options.render] Render callback.
 * @param {object} [options.dialog={}] Additional dialog options.
 * @returns {Promise<number>} Provided value
 */
export async function getNumber({
  title,
  label,
  hint,
  initial,
  placeholder,
  min,
  max,
  step,
  classes = [],
  render,
  dialog: dialogOptions = {},
} = {}) {
  const templateData = { value: initial, min, max, step, placeholder, label, hint };
  const content = await renderTemplate("systems/pf1/templates/apps/get-number.hbs", templateData);

  return Dialog.wait(
    {
      title: title || game.i18n.localize("PF1.Application.GetNumber.Title"),
      content,
      buttons: {
        confirm: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize("PF1.Application.GetNumber.Confirm"),
          callback: (html) => html.querySelector("input[name='number']").valueAsNumber,
        },
      },
      default: "confirm",
      render,
      close: () => NaN,
    },
    {
      jQuery: false,
      classes: [...Dialog.defaultOptions.classes, "pf1", "get-number", ...classes],
    },
    {
      focus: true,
      width: 260,
      ...dialogOptions,
    }
  );
}
