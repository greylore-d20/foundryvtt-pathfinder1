/**
 *
 */
export function initializeSocket() {
  game.socket.on("system.pf1", async (args) => {
    const isFirstGM = game.user === game.users.find((u) => u.isGM).sort((a, b) => a.id - b.id)[0];
    try {
      switch (args.eventType) {
        case "cleanItemLink": {
          // Get actor
          const actor = await fromUuid(args.actorUUID);
          // Get item
          const parentItemData = await fromUuid(args.itemUUID);
          const parentItem = actor.items.find((o) => o._id === parentItemData._id);
          // Get link data
          const link = args.link;
          const linkType = args.linkType;
          // Clean item links
          parentItem._cleanLink(link, linkType);
          break;
        }
        case "redrawCanvas":
          canvas.draw();
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
      }
    } catch (err) {
      console.log("PF1 | Socket Error: ", err);
    }
  });
}
