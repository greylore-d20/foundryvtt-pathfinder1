import { ActorPF } from "./actor-pf.mjs";

const actorHandler = {
  construct(_, args) {
    return new CONFIG.Actor.documentClasses[args[0]?.type](...args);
  },
};

export const ActorPFProxy = new Proxy(ActorPF, actorHandler);
