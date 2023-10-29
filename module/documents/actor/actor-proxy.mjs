import { ActorBasePF } from "./actor-base.mjs";

const actorHandler = {
  construct(_, args) {
    const type = args[0]?.type;
    const cls = CONFIG.Actor.documentClasses[type] ?? ActorBasePF;
    return new cls(...args);
  },
};

export const ActorPFProxy = new Proxy(ActorBasePF, actorHandler);
