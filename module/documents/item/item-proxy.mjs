import { ItemBasePF } from "./item-base.mjs";

const itemHandler = {
  construct(_, args) {
    const type = args[0]?.type;
    const cls = CONFIG.Item.documentClasses[type] ?? ItemBasePF;
    return new cls(...args);
  },
};

export const ItemPFProxy = new Proxy(ItemBasePF, itemHandler);
