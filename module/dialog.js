export function dialogGetNumber({title="Input Number", initial=null, min=Number.NEGATIVE_INFINITY, max=Number.POSITIVE_INFINITY}={}) {
  return new Promise(resolve => {
    let cancelled = true;

    new Dialog({
      title: title,
      content: `<input type="number" name="result" min="${min}" max="${max}" value="${initial || 0}">`,
      buttons: {
        ok: {
          label: "Submit",
          callback: html => {
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
      }
    }).render(true);
  });
};

export const dialogGetActor = function(title="", actors=[]) {
  return new Promise(async resolve => {
    let cancelled = true;

    let content = "";
    actors.forEach(actor => {
      content += `<div class="dialog-get-actor flexrow" data-actor-id="${actor._id}"><img src="${actor.data.img}"><h2>${actor.name}</h2></div>`;
    });

    const dialog = new Dialog({
      title: title,
      content: content,
      buttons: {},
      close: () => {
        if (cancelled) {
          resolve(null);
        }
      },
    });

    dialog.activateListeners = function(html) {
      Dialog.prototype.activateListeners.call(this, html);

      html.find(".dialog-get-actor").click(event => {
        const elem = event.currentTarget;
        const actorId = elem.dataset.actorId;
        const actor = game.actors.entities.find(o => o._id === actorId);
        resolve(actor);
        this.close();
      });
    };

    dialog.render(true);
  });
};
