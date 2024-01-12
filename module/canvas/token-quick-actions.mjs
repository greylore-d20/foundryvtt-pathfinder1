import { clearHighlight, showAttackReach } from "./attack-reach.mjs";
import { getSkipActionPrompt } from "module/documents/settings.mjs";
import { renderCachedTemplate } from "@utils/handlebars/templates.mjs";

export class TokenQuickActions {
  /**
   * Add quick action buttons to token HUD.
   *
   * @param {TokenHUD} app
   * @param {JQuery} html
   */
  static async addQuickActions(app, html) {
    const token = app.object;
    const actor = token.actor;

    const items = actor?.getQuickActions?.();
    if (!items?.length) return;

    const quickActions = [];
    for (const qi of items) {
      qi.id = qi.item.id;
      qi.name = qi.item.name;
      qi.img = qi.item.img;
      qi.max = qi.maxCharge;
      qi.type = qi.item.type;

      qi.isCharged = qi.haveAnyCharges;
      if (qi.isCharged) {
        qi.uses = qi.charges;

        let chargeCost = qi.item.firstAction.getChargeCost();
        if (chargeCost == 0) qi.isCharged = false;
        qi.recharging = chargeCost < 0;
        chargeCost = Math.abs(chargeCost);

        qi.max = qi.maxCharge;

        if (chargeCost != 0) {
          // Maximum charging
          if (qi.recharging) {
            qi.uses = Math.ceil((qi.max - qi.uses) / chargeCost);
            qi.max = Math.ceil(qi.max / chargeCost);
          }
          // Actual uses
          else {
            qi.uses = Math.floor(qi.uses / chargeCost);
            qi.max = Math.floor(qi.max / chargeCost);
          }
        }
      }

      quickActions.push(qi);
    }

    const templateData = {
      actions: quickActions,
    };

    const div = document.createElement("div");
    div.innerHTML = renderCachedTemplate("systems/pf1/templates/hud/quick-actions.hbs", templateData);

    this.activateElementListeners(div.firstChild, actor, token);

    html[0].querySelector(".col.middle").after(div.firstChild);
  }

  /**
   * Add listeners to token HUD quick action element.
   *
   * @param {Element} el Quick action element
   * @param {Actor} actor - Associated actor
   * @param {Token} token - Associated token
   */
  static activateElementListeners(el, actor, token) {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      const itemId = event.target.dataset.itemId;
      const item = actor.items.get(itemId);
      if (!event.ctrlKey) {
        item.use({ ev: event, token: token.document, skipDialog: getSkipActionPrompt() });
      } else {
        item.displayCard({ token: token.document });
      }
    });

    el.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      const itemId = event.target.dataset.itemId;
      const item = actor.items.get(itemId);
      item.sheet.render(true, { focus: true });
    });

    // Reach highlight on mouse hover
    if (game.settings.get("pf1", "performance").reachLimit >= 10) {
      el.querySelectorAll(".token-quick-action").forEach((el) => {
        const itemId = el.dataset.itemId;
        const item = actor.items.get(itemId);
        const action = item.firstAction;
        el.addEventListener("mouseenter", () => showAttackReach(token, action), { passive: true });
        el.addEventListener("mouseleave", () => clearHighlight(), { passive: true });
      });
    }
  }
}
