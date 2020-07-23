export class TokenQuickActions {

  static async addTop3Attacks(app, html, data) {

    let actorId = data.actorId,
      actor = game.actors.get(actorId);
    if (data._id && game.actors.tokens[data._id] != null) {
      actorId = data._id;
      actor = game.actors.tokens[actorId];
    }

    if (actor == null)
        return;
    
    let quickActions = '<div class="col actions"><div class="below">'
    let items = actor.getQuickActions();
    items.forEach(function(i) {
      const item = i.item;
      const icon = item.img;
      let title = "";
      if      (item.type === "attack") title = game.i18n.localize("PF1.AttackWith").format(item.name);
      else if (item.type === "spell")  title = game.i18n.localize("PF1.AttackWithSpell").format(item.name);
      else if (item.type === "feat")   title = game.i18n.localize("PF1.AttackWithFeat").format(item.name);
      const type = item.type;
      quickActions += `<div id="${type}-${item._id}" class="control-icon token-quick-action" style="border: 2px solid ${i.color1};">` +
      `<img src="${icon}" width="36" height="36" title="${title}"></div>`;
    });
    
    html.find('.col.middle').after(quickActions + '</div></div>');
    
    items.forEach(function(item) {
      const type = item.type;
      html.find(`#${type}-${item._id}`).click(function(event) {
        game.pf1.rollItemMacro(item.name, {
          itemId: item._id,
          itemType: type,
          actorId: actorId
        });
      });
    });
  }
}
