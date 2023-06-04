import { ItemPF } from "./item-pf.mjs";

const itemHandler = {
  construct(_, args) {
    return new CONFIG.Item.documentClasses[args[0]?.type](...args);
  },
};

export const ItemPFProxy = new Proxy(ItemPF, itemHandler);
