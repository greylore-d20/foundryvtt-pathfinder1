import { showAttackReach } from "./misc/attack-reach.js";
import { getSkipActionPrompt } from "./settings.js";

export class TokenQuickActions {
  static async addTop3Attacks(app, html, data) {
    const token = canvas.tokens.placeables.find((o) => o.id === data._id);
    const actor = token.actor;

    if (actor == null) return;

    const actualChargeCost = (i) => Math.floor(i.charges / i.chargeCost),
      actualMaxCharge = (i) => Math.floor(i.maxCharges / i.chargeCost);
    const chargeDisplay = (item) => {
      let r = "<charges>";
      const max = item.isCharged ? actualMaxCharge(item) : 0;
      const recharging = item.isCharged && item.chargeCost < 0;
      const uses = item.isCharged
        ? !recharging
          ? actualChargeCost(item)
          : -item.chargeCost
        : item.data.data.links?.ammunition
            ?.flatMap((l) => actor.items.get(l.id) ?? [])
            .reduce((a, b) => a + actualChargeCost(b), 0) ?? 0;
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
      if (item.type === "attack") title = game.i18n.localize("PF1.AttackWith").format(item.name);
      else if (item.type === "spell") title = game.i18n.localize("PF1.AttackWithSpell").format(item.name);
      else if (item.type === "feat") title = game.i18n.localize("PF1.AttackWithFeat").format(item.name);
      const type = item.type;
      quickActions +=
        `<div id="${type}-${item.id}" class="control-icon token-quick-action" style="border: 2px solid ${i.color1};">` +
        `<img src="${icon}" width="36" height="36" title="${title}">`;
      if (item.isCharged || item.data.data.links?.ammunition?.length > 0) quickActions += chargeDisplay(item);
      quickActions += "</div >";
    });

    html.find(".col.middle").after(quickActions + "</div></div>");

    items.forEach(function (i) {
      const item = actor.items.find((o) => o.id === i.item.id);
      const type = item.type;
      const elem = html.find(`#${type}-${item.id}`);

      // Add click handler
      elem.on("click", (event) => {
        if (!event.ctrlKey) {
          return item.use({ skipDialog: getSkipActionPrompt() });
        }
        return item.roll();
      });

      // Add mouse enter handler
      let highlight;
      elem.on("mouseenter", (event) => {
        if (!game.settings.get("pf1", "hideReachMeasurements")) highlight = showAttackReach(token, item);

        if (!highlight) return;

        highlight.normal.render();
        highlight.reach.render();
        highlight.extra.forEach((hl) => {
          hl.render();
        });
      });

      // Add mouse leave callback
      elem.on("mouseleave", (event) => {
        if (!highlight) return;

        highlight.normal.clear(true);
        highlight.reach.clear(true);
        highlight.extra.forEach((hl) => {
          hl.clear(true);
        });
      });
    });
  }
}
