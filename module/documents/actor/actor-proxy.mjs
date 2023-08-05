import { ActorPF } from "./actor-pf.mjs";

const actorHandler = {
  construct(_, args) {
    const type = args[0]?.type;
    const cls = CONFIG.Actor.documentClasses[type];
    if (!cls) throw new Error(`"${type}" is not valid actor type`);
    return new cls(...args);
  },
};

export const ActorPFProxy = new Proxy(ActorPF, actorHandler);
