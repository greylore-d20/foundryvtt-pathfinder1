export const LinkFunctions = {
  charges: function (item, links) {
    for (const l of links) {
      const otherItem = this.items.get(l.id);
      if (!otherItem) continue;

      otherItem.links.charges = item;
      otherItem.prepareLinks();
    }
  },
};
