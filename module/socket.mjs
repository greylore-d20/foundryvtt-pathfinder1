import { refreshActors } from "./utils/lib.mjs";

/**
 *
 */
export function initializeSocket() {
  game.socket.on("system.pf1", runSocketFunction);
}

const runSocketFunction = async function (args, senderId) {
  const isFirstGM = game.users.activeGM.isSelf;
  const sender = game.users.get(senderId);
  try {
    switch (args.eventType) {
      case "currencyTransfer": {
        if (!isFirstGM) return;
        let source = await fromUuid(args.data.sourceActor);
        let dest = await fromUuid(args.data.destActor);

        if (args.data.sourceContainer) source = source.items.get(args.data.sourceContainer);
        if (args.data.destContainer) dest = dest.items.get(args.data.destContainer);
        const amount = args.data.amount;

        pf1.applications.CurrencyTransfer.transfer(source, dest, amount, args.data.sourceAlt, args.data.destAlt, false);
        break;
      }
      case "alterChatTargetAttribute":
        if (isFirstGM) alterChatTargetAttribute(args);
        break;
      case "giveItem": {
        if (!isFirstGM) return;
        const item = await fromUuid(args.item);
        const sourceActor = item.actor;
        if (!sourceActor.testUserPermission(sender, "OWNER")) return;
        const targetActor = await fromUuid(args.targetActor);
        const itemData = item.toObject();
        await targetActor.createEmbeddedDocuments("Item", [itemData]);
        await sourceActor.deleteEmbeddedDocuments("Item", [item.id]);
        break;
      }
      case "refreshActorSheets":
        pf1.utils.refreshActors({ renderOnly: true });
        break;
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
