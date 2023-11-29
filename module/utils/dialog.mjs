import { ItemSelector } from "module/applications/item-selector.mjs";

/**
 * @param root0
 * @param root0.title
 * @param root0.initial
 * @param root0.min
 * @param root0.max
 */
export function dialogGetNumber({
  title = "Input Number",
  initial = null,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
} = {}) {
  return new Promise((resolve) => {
    let cancelled = true;

    new Dialog(
      {
        title: title,
        content: `<input type="number" name="result" min="${min}" max="${max}" value="${initial || 0}">`,
        buttons: {
          ok: {
            label: "Submit",
            callback: (html) => {
              cancelled = false;
              const input = html.find('input[name="result"]');
              resolve(input.val());
            },
          },
        },
        close: () => {
          if (!cancelled) {
            resolve(initial);
          }
        },
        default: "ok",
        render: (htm) => {
          htm.find("input").select();
        },
      },
      {
        classes: [...Dialog.defaultOptions.classes, "pf1", "get-number"],
      }
    ).render(true);
  });
}

export const dialogGetActor = function (title = "", actors = []) {
  return new Promise((resolve) => {
    const cancelled = true;

    const gmActive = !!game.users.activeGM;

    let content = "";
    actors.forEach((target) => {
      if (target instanceof Actor) {
        const enabled = gmActive || target.isOwner;
        const disabledClass = enabled ? "" : "disabled";
        content += `<div class="dialog-get-actor flexrow ${disabledClass}" data-actor-id="${target.id}"><img src="${target.img}"><h2>${target.name}</h2></div>`;
      } else if (target instanceof Item) {
        content += `<div class="dialog-get-actor flexrow" data-item-id="${target.id}"><img src="${target.img}"><h2>${target.name}</h2></div>`;
      }
    });

    new Dialog(
      {
        title: title,
        content: content,
        buttons: {},
        close: () => {
          if (cancelled) {
            resolve(null);
          }
        },
        render: function (html) {
          html.find(".dialog-get-actor:not(.disabled)").click((event) => {
            const elem = event.currentTarget;
            const actorId = elem.dataset.actorId;
            if (actorId) {
              resolve({ type: "actor", id: actorId });
            } else {
              const itemId = elem.dataset.itemId;
              if (itemId) {
                resolve({ type: "item", id: itemId });
              }
            }
            this.close();
          });
        },
      },
      {
        classes: [...Dialog.defaultOptions.classes, "pf1", "get-actor"],
      }
    ).render(true);
  });
};

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
  if (!actor.testUserPermission(game.user, CONST.DOCUMENT_PERMISSION_LEVELS.OBSERVER))
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
