import { isString } from "markdown-it/lib/common/utils";
import { getFirstActiveGM } from "./lib.js";

/**
 *
 */
export function initializeSocket() {
  game.socket.on("system.pf1", runSocketFunction);
}

const runSocketFunction = async function (args, senderId) {
  const isFirstGM = game.user === getFirstActiveGM();
  const sender = game.users.get(senderId);
  try {
    switch (args.eventType) {
      case "cleanItemLink": {
        // Get actor
        const actor = await fromUuid(args.actorUUID);
        // Get item
        const parentItemData = await fromUuid(args.itemUUID);
        const parentItem = actor.items.get(parentItemData._id);
        // Get link data
        const link = args.link;
        const linkType = args.linkType;
        // Clean item links
        parentItem._cleanLink(link, linkType);
        break;
      }
      case "redrawCanvas":
        canvas.perception.update({
          lighting: { initialize: true, refresh: true },
          sight: { initialize: true, refresh: true },
          sounds: { refresh: true },
          foreground: { refresh: true },
        });
        break;
      case "currencyTransfer": {
        if (!isFirstGM) return;
        let source = await fromUuid(args.data.sourceActor);
        let dest = await fromUuid(args.data.destActor);

        if (args.data.sourceContainer) source = source.items.get(args.data.sourceContainer);
        if (args.data.destContainer) dest = dest.items.get(args.data.destContainer);
        const amount = args.data.amount;

        game.pf1.applications.CurrencyTransfer.transfer(
          source,
          dest,
          amount,
          args.data.sourceAlt,
          args.data.destAlt,
          false
        );
        break;
      }
      case "alterChatTargetAttribute":
        if (isFirstGM) alterChatTargetAttribute(args);
        break;
      case "giveItem": {
        if (!isFirstGM) return;
        const item = await fromUuid(args.item);
        const sourceActor = item.parent;
        if (!sourceActor.testUserPermission(sender, "OWNER")) return;
        const targetActor = await fromUuid(args.targetActor);
        const itemData = item.toObject();
        await targetActor.createEmbeddedDocuments("Item", [itemData]);
        await sourceActor.deleteEmbeddedDocuments("Item", [item.id]);
        break;
      }
    }
  } catch (err) {
    console.log("PF1 | Socket Error: ", err);
  }
};

export const alterChatTargetAttribute = function (args) {
  const message = game.messages.get(args.message);
  const contentHTML = $(message.data.content);

  // Alter saving throw
  if (args.save != null) {
    const targetElem = contentHTML.find(
      `div.attack-targets .target[data-uuid="${args.targetUuid}"] .saving-throws .${args.save}`
    );
    const valueElem = targetElem.find(".value");
    valueElem.html(`${args.value}`);

    // Add classes based off extra data
    if (args.isFailure) valueElem.addClass("failure");
    else valueElem.removeClass("failure");
    if (args.isSuccess) valueElem.addClass("success");
    else valueElem.removeClass("success");

    return message.update({
      content: contentHTML.prop("outerHTML"),
    });
  }
};
