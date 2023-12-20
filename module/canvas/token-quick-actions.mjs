import { clearHighlight, showAttackReach } from "./attack-reach.mjs";
import { getSkipActionPrompt } from "module/documents/settings.mjs";

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
    if (!items) return;

    const quickActions = $('<div class="col actions">');
    const quickActionsList = $('<div class="below">');

    items.forEach(({ item }) => {
      const action = item.firstAction;
      const icon = item.img ?? CONST.DEFAULT_TOKEN;
      let title = "";
      if (["attack", "weapon"].includes(item.type)) title = game.i18n.format("PF1.AttackWith", { name: item.name });
      else if (item.type === "spell") title = game.i18n.format("PF1.AttackWithSpell", { name: item.name });
      else if (item.type === "feat") title = game.i18n.format("PF1.AttackWithFeat", { name: item.name });
      else title = game.i18n.format("PF1.QuickActionUseAny", { name: item.name });
      const type = item.type;

      const actionHTML = [];
      actionHTML.push(
        `<div data-item-id="${item.id}" data-item-type="${type}" class="control-icon token-quick-action type-${type}">`,
        `<img src="${icon}" width="36" height="36" data-tooltip="${title}">`
      );
      if (action && (item.isCharged || !!action?.ammoType)) {
        actionHTML.push(this.createChargeElement(action));
      }
      actionHTML.push("</div>");

      const actionEl = document.createElement("div");
      actionEl.innerHTML = actionHTML.join("");
      const el = actionEl.firstChild;

      this.activateElementListeners(el, item, action, token);

      quickActionsList.append(el);
    });

    quickActions.append(quickActionsList);

    html.find(".col.middle").after(quickActions);
  }

  /**
   * Generate charge display element for an action.
   *
   * @param {pf1.components.ItemAction} action Action
   * @returns {Element} HTML element with charge information.
   */
  static createChargeElement(action) {
    const item = action.item,
      usesAmmo = !!action.ammoType,
      chargeCost = action.getChargeCost(),
      isSingleUse = item.isSingleUse;

    const actualChargeCost = (action) => Math.floor(item.charges / chargeCost),
      actualMaxCharge = (action) => Math.floor(item.maxCharges / chargeCost);

    // TODO: Move HTML generation to a precompiled HBS partial
    const htmlparts = ["<charges>"],
      isCharged = action.isCharged,
      max = isSingleUse ? 0 : isCharged ? actualMaxCharge(action) : 0,
      recharging = isCharged && chargeCost < 0;

    let uses = 0;
    if (usesAmmo) {
      uses = item.defaultAmmo?.system.quantity ?? 0;
    } else if (isSingleUse) {
      uses = item.system.quantity;
    } else if (isCharged) {
      if (!recharging) {
        uses = actualChargeCost(action);
      } else {
        uses = -chargeCost;
      }
    }

    if (!recharging) htmlparts.push(`<span class='remaining'>${uses}</span >`);
    else htmlparts.push(`<span class='recharge'>+${uses}</span>`);
    if (!recharging && max !== 0) htmlparts.push(`<span class='delimiter' >/</span ><span class='max'>${max}</span>`);
    htmlparts.push("</charges>");
    return htmlparts.join("");
  }

  /**
   * Add listeners to token HUD quick action element.
   *
   * @param {Element} el Quick action element
   * @param {Item} item
   * @param {pf1.components.ItemAction} action
   * @param {Token} token
   */
  static activateElementListeners(el, item, action, token) {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      if (!event.ctrlKey) {
        item.use({ ev: event, token: token.document, skipDialog: getSkipActionPrompt() });
      } else {
        item.displayCard({ token: token.document });
      }
    });

    el.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      item.sheet.render(true, { focus: true });
    });

    // Reach highlight on mouse hover
    if (game.settings.get("pf1", "performance").reachLimit >= 10) {
      el.addEventListener("mouseenter", () => showAttackReach(token, action), { passive: true });
      el.addEventListener("mouseleave", () => clearHighlight(), { passive: true });
    }
  }
}
