import { ItemSelector } from "module/applications/item-selector.mjs";
import { ActorSelector } from "module/applications/actor-selector.mjs";

/**
 * Choose actor from list.
 *
 * This is simplified interface to {@link pf1.applications.ActorSelector}
 *
 * @param {ApplicationRenderOptions&ActorSelectorOptions} options - Options
 * @param {Function<Actor>} [options.filter] - Filtering callback function.
 * @param {Actor[]} [options.actors] - Actor list to choose from.
 * @param {string} [options.selected] - Already selected actor ID.
 * @returns {Promise<string|null>} - Actor ID or null if cancelled.
 */
export async function getActor(options) {
  return ActorSelector.wait(options);
}

/**
 * Choose item from actor.
 *
 * This is simplified interface to {@link pf1.applications.ItemSelector}
 *
 * @param {ApplicationRenderOptions&ItemSelectorOptions} options - Options
 * @param {boolean} [options.empty=true] - Allow empty selection.
 * @param {string} [options.type] - Basic filter for item type, unused if filterFunc is provided.
 * @param {string} [options.subType] - Basic filter for item subtype, unused if filterFunc is provided.
 * @returns {Promise<Item|null>} - Chosen item or null.
 */
export async function getItem(options) {
  if (!options.type && !options.subType && !options.filterFunc) throw new Error("Insufficient filter rules provided.");

  options.filterFunc ||= (item) => {
    return (!options.type || item.type === options.type) && (!options.subType || item.subType === options.subType);
  };

  if (!options.window) options.window = {};

  // Provide nice basic title
  if (!options.window.title && !options.filterFunc && options.type) {
    options.window.title = game.i18n.format("PF1.SelectSpecific", {
      specifier: options.subType
        ? pf1.config[`${options.type}Types`]?.[options.subType]
        : game.i18n.localize(CONFIG.Item.typeLabels[options.type]),
    });
  }

  return ItemSelector.wait(options);
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
