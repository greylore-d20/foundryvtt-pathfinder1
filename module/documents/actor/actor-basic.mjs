import { ActorBasePF } from "./actor-base.mjs";

/**
 * Basic actor with no built-in functionality.
 *
 * @deprecated Obsolete with Foundry v11
 */
export class BasicActorPF extends ActorBasePF {
  constructor(...args) {
    foundry.utils.logCompatibilityWarning("Basic actor type is obsolete with Foundry v11", {
      since: "PF1 v9",
      until: "PF1 v11",
    });
    super(...args);
  }

  _resetInherentTotals() {}

  _setSourceDetails() {}

  prepareBaseData() {}

  prepareDerivedData() {}

  applyActiveEffects() {}
}
