import { LinksApp } from "../links.js";
import { dialogGetNumber } from "../../dialog.js";

export class ClassLinksApp extends LinksApp {
  getEdgeCommands(e) {
    let result = super.getEdgeCommands(e),
      app = this,
      src = e.source(),
      target = e.target(),
      item = [src.data("item"), target.data("item")];

    // Set required level
    if (item[0] instanceof Item && item[0].type === "class" &&
      item[1] instanceof Item && item[1].type === "feat") {
      result.push({
        content: game.i18n.localize("PF1.LinkSetMinLevel"),
        select: async e => {
          let value = await dialogGetNumber({
            title: game.i18n.localize("PF1.LinkSetMinLevelFor").format(item[1].name),
            min: 1,
            max: 20,
            initial: e.data("minLevel") || 1,
          });

          if (value != null) {
            e.data("minLevel", value);
            app._updateItemInfo();
          }
        },
      });
    }

    return result;
  }

  canAddItem(item) {
    if (item instanceof Item && item.type === "feat") return true;

    return false;
  }
}
