import { clearHighlight, showAttackReach } from "./attack-reach.mjs";
import { getSkipActionPrompt } from "../documents/settings.mjs";

export class TokenQuickActions {
  static async addTop3Attacks(app, html, data) {
    const token = canvas.tokens.get(data._id);
    const actor = token.actor;

    if (actor == null) return;
    if (!actor.getQuickActions) return;

    const actualChargeCost = (i) => Math.floor(i.charges / i.chargeCost),
      actualMaxCharge = (i) => Math.floor(i.maxCharges / i.chargeCost);
    const chargeDisplay = (item) => {
      let r = "<charges>";
      const max = item.isCharged ? actualMaxCharge(item) : 0;
      const recharging = item.isCharged && item.chargeCost < 0;
      const uses = item.isCharged ? (!recharging ? actualChargeCost(item) : -item.chargeCost) : 0;
      if (!recharging) r += `<span class='remaining'>${uses}</span >`;
      else r += `<span class='recharge'>+${uses}</span>`;
      if (!recharging && max !== 0) r += `<span class='delimiter' >/</span ><span class='max'>${max}</span>`;
      r += "</charges>";
      return r;
    };

    let quickActions = '<div class="col actions"><div class="below">';
    const items = actor.getQuickActions();
    items.forEach(function (i) {
      const item = i.item;
      const icon = item.img ?? CONST.DEFAULT_TOKEN;
      let title = "";
      if (["attack", "weapon"].includes(item.type)) title = game.i18n.format("PF1.AttackWith", { name: item.name });
      else if (item.type === "spell") title = game.i18n.format("PF1.AttackWithSpell", { name: item.name });
      else if (item.type === "feat") title = game.i18n.format("PF1.AttackWithFeat", { name: item.name });
      else title = game.i18n.format("PF1.QuickActionUseAny", { name: item.name });
      const type = item.type;
      quickActions +=
        `<div id="${type}-${item.id}" class="control-icon token-quick-action type-${type}">` +
        `<img src="${icon}" width="36" height="36" title="${title}">`;
      quickActions += "</div >";
    });

    html.find(".col.middle").after(quickActions + "</div></div>");

    items.forEach(function (i) {
      const item = actor.items.get(i.item.id);
      const type = item.type;
      const elem = html.find(`#${type}-${item.id}`);
      const firstAction = item.firstAction;
      if (!firstAction) return;

      // Add click handler
      elem.on("click", (event) => {
        if (!event.ctrlKey) {
          return item.use({ ev: event, skipDialog: getSkipActionPrompt() });
        }
        return item.roll();
      });

      elem.on("contextmenu", () => {
        item.sheet.render(true, { focus: true });
      });

      // Add mouse enter handler
      elem.on("mouseenter", (event) => {
        if (!game.settings.get("pf1", "hideReachMeasurements")) showAttackReach(token, item, firstAction);
      });

      // Add mouse leave callback
      elem.on("mouseleave", (event) => {
        clearHighlight();
      });
    });
  }
}
