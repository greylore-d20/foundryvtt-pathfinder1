import { ItemPF } from "./item-pf.mjs";

const itemHandler = {
  construct(_, args) {
    const type = args[0]?.type;
    const cls = CONFIG.Item.documentClasses[type];
    if (!cls) throw new Error(`"${type}" is not valid item type`);
    return new cls(...args);
  },
};

export const ItemPFProxy = new Proxy(ItemPF, itemHandler);
