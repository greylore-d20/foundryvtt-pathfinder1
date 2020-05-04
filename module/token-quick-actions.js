export class TokenQuickActions {

  static async addTop3Attacks(app, html, data) {
     
      let actor = game.actors.get(data.actorId);
      if (actor === undefined)
          return;
      
      let quickActions = '<div class="col actions"><div class="below">'
      actor.data.items.forEach( function(item) {
        if(item.type === "attack") {
          const icon = "/systems/pf1/icons/actions/" + ( item.data.actionType === "mwak" ? "melee" : "ranged" ) + "-attack.svg"
          const title = game.i18n.localize("PF1.AttackWith").format(item.name)
          quickActions += '<div id="attack-' + item._id + '" class="control-icon token-quick-action"><img src="' + icon + '" width="36" height="36" title="' + title + '"></div>';
        }
      });
      
      html.find('.col.middle').after(quickActions + '</div></div>');
      
      actor.data.items.forEach( function(item) {
        if(item.type === "attack") {
          html.find('#attack-' + item._id).click( function(event) {
            game.pf1.rollItemMacro(item.name, {
              itemId: item._id,
              itemType: "attack",
              actorId: actor._id
            });
          });
        }
      });
    }
}


