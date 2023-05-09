import { isGMActive } from "./lib.mjs";

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

    let content = "";
    actors.forEach((target) => {
      if (target instanceof Actor) {
        const gmActive = isGMActive();
        const enabled = gmActive || target.testUserPermission(game.user, "OWNER");
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
