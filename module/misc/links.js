export const LinkFunctions = {
  charges: function (item, links) {
    for (const l of links) {
      const otherItem = this.items.find((o) => o.id === l.id);
      if (!otherItem) continue;

      otherItem.links.charges = item;
      otherItem.prepareLinks();
    }
  },
};
